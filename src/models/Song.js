const mongoose = require('mongoose');

const SongSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, default: 'Unknown Artist' },
    album: { type: String },
    url: { type: String, required: true }, // Path or S3 URL
    duration: { type: Number }, // seconds
    access: { type: String, enum: ['free', 'paid'], default: 'free' },
    releaseDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Song', SongSchema);
