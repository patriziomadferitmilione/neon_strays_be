// services/songFileService.js
const fs = require('fs');
const path = require('path');
const mimeTypes = require('mime-types');

const uploadsDir = path.resolve(process.cwd(), 'uploads');

function resolveExisting(p) {
    if (!p) return { resolved: null, tried: [] };
    const tried = [];

    // Absolute as-is
    if (path.isAbsolute(p)) {
        tried.push(p);
        if (fs.existsSync(p)) return { resolved: p, tried };
    }

    // Try relative from cwd
    let abs = path.resolve(process.cwd(), p);
    tried.push(abs);
    if (fs.existsSync(abs)) return { resolved: abs, tried };

    // Try relative from uploads folder
    abs = path.resolve(uploadsDir, p);
    tried.push(abs);
    if (fs.existsSync(abs)) return { resolved: abs, tried };

    // Try relative from current file dir
    abs = path.resolve(__dirname, p);
    tried.push(abs);
    if (fs.existsSync(abs)) return { resolved: abs, tried };

    return { resolved: null, tried };
}

function pickBestFile(song) {
    const cands = [song.url_mp3, song.url_aac, song.url_wav].filter(Boolean);
    for (const c of cands) {
        const { resolved } = resolveExisting(c);
        if (resolved) return resolved;
    }
    return null;
}

function getContentType(filePath) {
    return mimeTypes.lookup(filePath) || 'audio/mpeg';
}

module.exports = {
    resolveExisting,
    pickBestFile,
    getContentType
};
