const mongoose = require('mongoose');

const AlbumSchema = new mongoose.Schema({
    title: { type: String, required: true },
    cover: { type: String }, // path or URL to album cover image
    releaseDate: { type: Date },
    description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Album', AlbumSchema);
