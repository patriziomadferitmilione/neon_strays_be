const path = require('path');
const fs = require('fs');
const Album = require('../models/Album');

exports.getAlbums = async (req, res) => {
    try {
        const albums = await Album.find().sort({ releaseDate: -1 });

        const albumsWithBase64 = albums.map(albumDoc => {
            const album = albumDoc.toObject();

            if (album.cover && !album.cover.startsWith('data:')) {
                try {
                    const absolutePath = path.resolve(album.cover);
                    if (fs.existsSync(absolutePath)) {
                        const mimeType = 'image/png'; // could detect from ext
                        const base64 = fs.readFileSync(absolutePath, { encoding: 'base64' });
                        album.cover = `data:${mimeType};base64,${base64}`;
                    }
                } catch (err) {
                    console.warn(`[getAlbums] Could not encode cover for album ${album.title}:`, err.message);
                }
            }
            return album;
        });

        res.json(albumsWithBase64);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.createAlbum = async (req, res) => {
    try {
        const { title, releaseDate, description, price } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        let coverPath = null;

        // Handle uploaded cover file
        if (req.file) {
            const uploadsDir = path.resolve(process.cwd(), 'uploads', 'albums');
            fs.mkdirSync(uploadsDir, { recursive: true });

            const safeTitle = title.replace(/[^a-z0-9_\-]+/gi, '_');
            const filename = `${Date.now()}_${safeTitle}_${req.file.originalname}`;
            const destPath = path.join(uploadsDir, filename);

            fs.renameSync(req.file.path, destPath);
            coverPath = destPath;
        }

        const album = new Album({
            title,
            releaseDate,
            description,
            price: price ? Number(price) : 0,
            cover: coverPath
        });

        await album.save();
        res.status(201).json(album);

    } catch (err) {
        console.error('[createAlbum]', err);
        res.status(500).json({ error: err.message });
    }
};
