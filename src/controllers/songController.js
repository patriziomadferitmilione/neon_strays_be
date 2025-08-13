const Song = require('../models/Song');
const { signStreamToken, verifyStreamToken } = require('../services/streamTokenService');
const { pickBestFile, getContentType } = require('../services/songFileService');
const { loadCoverAsDataUri } = require('../services/coverService');
const { err, upload } = require('../services/logger');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

exports.getSongs = async (req, res) => {
    try {
        const songs = await Song.find().populate('album').lean();
        const baseUrl = process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
        const userId = req.user?._id?.toString?.();

        const payload = await Promise.all(
            songs.map(async (s) => {
                const filePath = pickBestFile(s);
                const sig = s._id ? signStreamToken({ songId: s._id.toString(), userId }) : null;
                const streamUrl = filePath && sig
                    ? `${baseUrl}/api/songs/stream/${s._id}?sig=${encodeURIComponent(sig)}`
                    : null;

                return {
                    id: s._id,
                    title: s.title,
                    artist: s.artist,
                    price: s.price,
                    access: s.access,
                    releaseDate: s.releaseDate,
                    cover: await loadCoverAsDataUri(s.cover),
                    album: s.album ? {
                        id: s.album._id,
                        title: s.album.title,
                        cover: await loadCoverAsDataUri(s.album.cover)
                    } : null,
                    url: streamUrl
                };
            })
        );

        res.json(payload);
    } catch (e) {
        err('[songController] getSongs', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getSongStream = async (req, res) => {
    try {
        const { id } = req.params;
        const { sig } = req.query;

        const tokenPayload = sig ? verifyStreamToken(sig) : null;
        const isAuthorized = (tokenPayload && tokenPayload.songId === id) || Boolean(req.user);

        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized stream request' });
        }

        const song = await Song.findById(id).lean();
        if (!song) return res.status(404).json({ error: 'Song not found' });

        const filePath = pickBestFile(song);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }

        const stat = fs.statSync(filePath);
        const total = stat.size;
        const contentType = getContentType(filePath);

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', contentType);

        const range = req.headers.range;
        if (!range) {
            res.setHeader('Content-Length', total);
            return fs.createReadStream(filePath).pipe(res);
        }

        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m) {
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : total - 1;

        if (isNaN(start) || start < 0) start = 0;
        if (isNaN(end) || end >= total) end = total - 1;
        if (start > end) {
            res.status(416).set('Content-Range', `bytes */${total}`).end();
            return;
        }

        const chunkSize = end - start + 1;
        res.status(206).set({
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': chunkSize,
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } catch (e) {
        err('[songController] getSongStream', e);
        res.status(500).json({ error: e.message });
    }
};

exports.uploadSong = async (req, res) => {
    try {
        const { title, artist, album, access, releaseDate } = req.body;

        if (!title || !req.files?.mp3?.[0]) {
            return res.status(400).json({ error: 'Title and MP3 are required' });
        }

        // Create unique folder for the song inside /uploads
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Use timestamp to avoid collisions
        const safeTitle = title.replace(/[^a-z0-9_\-]+/gi, '_');
        const songFolder = path.join(uploadsDir, `${Date.now()}_${safeTitle}`);
        fs.mkdirSync(songFolder, { recursive: true });

        // Move uploaded files into this folder
        function moveFile(file) {
            if (!file) return null;
            const newPath = path.join(songFolder, file.originalname);
            fs.renameSync(file.path, newPath);
            return newPath;
        }

        const mp3Path = moveFile(req.files.mp3?.[0]);
        const aacPath = moveFile(req.files.aac?.[0]);
        const wavPath = moveFile(req.files.wav?.[0]);
        const coverPath = moveFile(req.files.cover?.[0]);

        // Save DB record
        const song = new Song({
            title,
            artist,
            album,
            access,
            releaseDate,
            url_mp3: mp3Path,
            url_aac: aacPath,
            url_wav: wavPath,
            cover: coverPath,
        });

        await song.save();

        upload(`Song uploaded: ${title}`, {
            id: song._id.toString(),
            folder: songFolder,
            files: { mp3: mp3Path, aac: aacPath, wav: wavPath, cover: coverPath }
        });

        res.status(201).json({ message: 'Song uploaded', song });
    } catch (e) {
        err('[songController] uploadSong', e);
        res.status(500).json({ error: e.message });
    }
};

exports.downloadSongZip = async (req, res) => {
    try {
        const { id } = req.params;
        const song = await Song.findById(id).lean();
        if (!song) return res.status(404).json({ error: 'Song not found' });

        // Find song folder (any file's folder will do)
        const anyFile = song.url_mp3 || song.url_aac || song.url_wav || song.cover;
        if (!anyFile) return res.status(404).json({ error: 'No files found' });

        const folder = path.dirname(anyFile);
        if (!fs.existsSync(folder)) return res.status(404).json({ error: 'Folder not found' });

        res.setHeader('Content-Disposition', `attachment; filename="${song.title}.zip"`);
        res.setHeader('Content-Type', 'application/zip');

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        archive.directory(folder, false);
        archive.finalize();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};