// controllers/songController.js
const Song = require('../models/Song');
const mimeTypes = require('mime-types');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const os = require('os');

/** ========= helpers ========= **/

const STREAM_SECRET = process.env.STREAM_SECRET || 'change-me';
const STREAM_TTL_SECONDS = parseInt(process.env.STREAM_TTL_SECONDS || '300', 10); // 5 min

function signStreamToken({ songId, userId }, ttl = STREAM_TTL_SECONDS) {
    return jwt.sign({ songId, userId }, STREAM_SECRET, { expiresIn: ttl });
}
function verifyStreamToken(token) {
    try {
        return jwt.verify(token, STREAM_SECRET);
    } catch {
        return null;
    }
}

function trace(...args){ console.log('[STREAM][TRACE]', ...args); }
function warn (...args){ console.warn('[STREAM][WARN]',  ...args); }
function err  (...args){ console.error('[STREAM][ERR ]', ...args); }

function resolveExisting(p) {
    if (!p) return { resolved: null, tried: [] };
    const tried = [];

    // absolute as-is
    if (path.isAbsolute(p)) {
        tried.push(p);
        if (fs.existsSync(p)) return { resolved: p, tried };
    }

    // CWD
    let abs = path.resolve(process.cwd(), p);
    tried.push(abs);
    if (fs.existsSync(abs)) return { resolved: abs, tried };

    // __dirname
    abs = path.resolve(__dirname, p);
    tried.push(abs);
    if (fs.existsSync(abs)) return { resolved: abs, tried };

    return { resolved: null, tried };
}

function pickBestFile(song) {
    const cands = [song.url_mp3, song.url_aac, song.url_wav].filter(Boolean);
    for (const c of cands) {
        const { resolved, tried } = resolveExisting(c);
        // trace('pickBestFile candidate:', { original: c, tried, resolved });
        if (resolved) return resolved;
    }
    return null;
}

// Derive content type from file path (fallback to audio/mpeg)
function getContentType(filePath) {
    return mimeTypes.lookup(filePath) || 'audio/mpeg';
}

/** ========= controllers ========= **/

exports.getSongs = async (req, res) => {
    try {
        const songs = await Song.find().populate('album').lean();

        const baseUrl = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
        const userId = req.user?._id?.toString?.();

        // console.log('[SONGS] count =', songs.length, {
        //     baseUrl,
        //     cwd: process.cwd(),
        //     __dirname,
        //     node: process.version,
        //     platform: process.platform,
        //     hostname: os.hostname(),
        // });

        const payload = await Promise.all(
            songs.map(async (s, i) => {
                const filePath = pickBestFile(s);
                const sig = s._id ? signStreamToken({ songId: s._id.toString(), userId }) : null;
                const streamUrl = filePath && sig
                    ? `${baseUrl}/api/songs/stream/${s._id}?sig=${encodeURIComponent(sig)}`
                    : null;

                // console.log(`[SONGS][#${i+1}]`, {
                //     id: s._id?.toString(),
                //     title: s.title,
                //     url_mp3: s.url_mp3,
                //     url_aac: s.url_aac,
                //     url_wav: s.url_wav,
                //     resolvedFile: filePath,
                //     streamUrlExists: !!streamUrl,
                // });

                const coverData = await loadCoverAsDataUri(s.cover);
                const albumCoverData = s.album ? await loadCoverAsDataUri(s.album.cover) : null;

                return {
                    id: s._id,
                    title: s.title,
                    artist: s.artist,
                    price: s.price,
                    access: s.access,
                    releaseDate: s.releaseDate,
                    cover: coverData,
                    album: s.album ? { id: s.album._id, title: s.album.title, cover: albumCoverData } : null,
                    url: streamUrl,
                };
            })
        );

        res.json(payload);
    } catch (e) {
        err('getSongs', e);
        res.status(500).json({ error: e.message });
    }
};


exports.getSongStream = async (req, res) => {
    const startedAt = Date.now();
    try {
        console.log('--- STREAM REQUEST ---');
        // trace('req.ip', req.ip, 'req.ips', req.ips);
        // trace('headers', req.headers);
        // trace('params', req.params, 'query', req.query);

        const { id } = req.params;
        const { sig } = req.query;

        const tokenPayload = sig ? verifyStreamToken(sig) : null;
        // trace('tokenPayload', tokenPayload);

        const isAuthorized = (tokenPayload && tokenPayload.songId === id) || Boolean(req.user);
        // trace('isAuthorized', isAuthorized);

        if (!isAuthorized) {
            // warn('Unauthorized request', { id, tokenPayloadSongId: tokenPayload?.songId });
            return res.status(401).json({ error: 'Unauthorized stream request' });
        }

        const song = await Song.findById(id).lean();
        // trace('songLoaded', !!song, song ? { id: song._id?.toString(), title: song.title } : null);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        const filePath = pickBestFile(song);
        // trace('resolvedFilePath', filePath, {
        //     url_mp3: song.url_mp3,
        //     url_aac: song.url_aac,
        //     url_wav: song.url_wav,
        //     cwd: process.cwd(),
        //     __dirname,
        // });

        if (!filePath || !fs.existsSync(filePath)) {
            // warn('Audio file missing', { id, filePath });
            return res.status(404).json({ error: 'Audio file not found' });
        }

        const stat = fs.statSync(filePath);
        const total = stat.size;
        const contentType = getContentType(filePath);
        // trace('stat', { total, contentType });

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', contentType);

        const range = req.headers.range;
        if (!range) {
            // trace('no-range -> full file');
            res.setHeader('Content-Length', total);
            const stream = fs.createReadStream(filePath);
            stream.on('error', e => err('readStream error (full)', e));
            // stream.on('close', () => trace('readStream close (full)', Date.now() - startedAt, 'ms'));
            return stream.pipe(res);
        }

        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        // trace('rangeHeader', range, 'parsed', m);
        if (!m) {
            // warn('invalid-range-format', range);
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : total - 1;

        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) {
            // warn('range start > end', { start, end, total });
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        const chunkSize = end - start + 1;
        // trace('partial', { start, end, chunkSize, total });

        res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': chunkSize,
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.on('error', e => err('readStream error (partial)', e));
        // stream.on('close', () => trace('readStream close (partial)', Date.now() - startedAt, 'ms'));
        stream.pipe(res);
    } catch (e) {
        err('getSongStream', e);
        res.status(500).json({ error: e.message });
    }
};


exports.uploadSong = async (req, res) => {
    try {
        const { title, artist, album, access, releaseDate } = req.body;

        if (!title || !req.files?.mp3?.[0]) {
            return res.status(400).json({ error: 'Title and MP3 are required' });
        }

        const song = new Song({
            title,
            artist,
            album,
            access,
            releaseDate,
            url_mp3: req.files.mp3?.[0]?.path,
            url_aac: req.files.aac?.[0]?.path,
            url_wav: req.files.wav?.[0]?.path,
            cover: req.files.cover?.[0]?.path,
        });

        await song.save();
        res.status(201).json({ message: 'Song uploaded', song });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// helper: read image and return data URI
async function loadCoverAsDataUri(rawPath) {
    if (!rawPath) return null;
    try {
        let rel = String(rawPath).replace(/\\/g, '/');

        // resolve absolute
        let abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);

        try {
            await fsp.access(abs);
        } catch {
            abs = path.resolve(__dirname, rel);
            await fsp.access(abs);
        }

        const buf = await fsp.readFile(abs);
        const mt = mime.lookup(abs) || 'application/octet-stream';
        return `data:${mt};base64,${buf.toString('base64')}`;
    } catch (e) {
        // console.warn('⚠️ Could not load cover', rawPath, e.message);
        return null;
    }
}
