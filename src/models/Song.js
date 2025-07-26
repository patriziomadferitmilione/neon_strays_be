const mongoose = require('mongoose');

const SongSchema = new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, default: 'Neon Strays' },

    url_mp3:     { type: String, required: true },
    url_wav:     { type: String },
    url_aac:     { type: String },

    duration: { type: Number },
    access: { type: String, enum: ['free', 'paid'], default: 'free' },
    releaseDate: { type: Date, default: Date.now },
    cover: { type: String },
    album: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Album'
    },
}, {timestamps: true});

module.exports = mongoose.model('Song', SongSchema);
