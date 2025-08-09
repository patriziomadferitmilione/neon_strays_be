// controllers/songController.js
const Song = require('../models/Song');
const fs = require('fs');
const path = require('path');
const mimeTypes = require('mime-types');
const jwt = require('jsonwebtoken');

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

// Choose the best available file path on the Song doc
function pickBestFile(song) {
    const candidates = [song.url_mp3, song.url_aac, song.url_wav].filter(Boolean);
    return candidates.length ? path.resolve(candidates[0]) : null;
}

// Derive content type from file path (fallback to audio/mpeg)
function getContentType(filePath) {
    return mimeTypes.lookup(filePath) || 'audio/mpeg';
}

/** ========= controllers ========= **/

exports.getSongs = async (req, res) => {
    try {
        const songs = await Song.find().populate('album').lean();

        const baseUrl =
            process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;

        const userId = req.user?._id?.toString?.(); // if this route is protected; OK if undefined

        const payload = songs.map((s) => {
            const filePath = pickBestFile(s);
            // If no file, return as-is without url (frontend can hide/unplayable)
            const sig = s._id ? signStreamToken({ songId: s._id.toString(), userId }) : null;
            const streamUrl =
                filePath && sig
                    ? `${baseUrl}/api/songs/stream/${s._id}?sig=${encodeURIComponent(sig)}`
                    : null;

            return {
                id: s._id,
                title: s.title,
                artist: s.artist,
                price: s.price,
                access: s.access,
                releaseDate: s.releaseDate,
                cover: s.cover,
                album: s.album
                    ? { id: s.album._id, title: s.album.title, cover: s.album.cover }
                    : null,
                url: streamUrl, // <-- frontend <audio> can use directly
            };
        });

        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getSongStream = async (req, res) => {
    try {
        console.log('--- STREAM REQUEST ---');
        console.log('Params:', req.params);
        console.log('Query:', req.query);
        console.log('Headers.range:', req.headers.range);

        const { id } = req.params;
        const { sig } = req.query;

        const tokenPayload = sig ? verifyStreamToken(sig) : null;
        console.log('Token payload:', tokenPayload);

        const isAuthorized =
            (tokenPayload && tokenPayload.songId === id) || Boolean(req.user);
        console.log('Authorized:', isAuthorized);

        if (!isAuthorized) {
            console.warn('Unauthorized stream attempt');
            return res.status(401).json({ error: 'Unauthorized stream request' });
        }

        const song = await Song.findById(id).lean();
        console.log('Song found:', song ? song.title : null);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        const filePath = pickBestFile(song);
        console.log('Resolved file path:', filePath);
        if (!filePath || !fs.existsSync(filePath)) {
            console.warn('Audio file missing on disk');
            return res.status(404).json({ error: 'Audio file not found' });
        }

        const stat = fs.statSync(filePath);
        const total = stat.size;
        console.log('File size (bytes):', total);

        const contentType = getContentType(filePath);
        console.log('Content-Type:', contentType);

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', contentType);

        const range = req.headers.range;
        if (!range) {
            console.log('No Range: sending full file');
            res.setHeader('Content-Length', total);
            return fs.createReadStream(filePath).pipe(res);
        }

        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m) {
            console.warn('Invalid Range format:', range);
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : total - 1;

        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) {
            console.warn('Range start > end:', start, end);
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        console.log(`Streaming bytes ${start}-${end} of ${total}`);
        const chunkSize = end - start + 1;
        res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': chunkSize,
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ error: err.message });
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
