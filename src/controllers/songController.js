const Song = require('../models/Song');
const fs = require('fs');
const path = require('path');

exports.getSongs = async (req, res) => {
    try {
        const songs = await Song.find().populate('album');
        res.json(songs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getSongStream = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        const filePath = path.resolve(song.url);
        const stat = fs.statSync(filePath);
        const total = stat.size;
        const range = req.headers.range;

        if (!range) {
            res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'audio/mpeg' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            const [start, end] = range.replace(/bytes=/, "").split("-");
            const chunkStart = parseInt(start, 10);
            const chunkEnd = end ? parseInt(end, 10) : total - 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${total}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkEnd - chunkStart + 1,
                'Content-Type': 'audio/mpeg',
            });

            fs.createReadStream(filePath, { start: chunkStart, end: chunkEnd }).pipe(res);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.uploadSong = async (req, res) => {
    try {
        const { title, artist, album, access, releaseDate } = req.body;

        if (!title || !req.files.mp3) {
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
