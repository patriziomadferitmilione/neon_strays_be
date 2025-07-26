const Album = require('../models/Album');

exports.getAlbums = async (req, res) => {
    try {
        const albums = await Album.find().sort({ releaseDate: -1 });
        res.json(albums);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createAlbum = async (req, res) => {
    try {
        const { title, releaseDate, description, cover } = req.body;

        if (!title) return res.status(400).json({ error: 'Title is required' });

        const album = new Album({
            title,
            releaseDate,
            description,
            cover
        });

        await album.save();
        res.status(201).json(album);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
