// services/coverService.js
const fs = require('fs').promises;
const path = require('path');
const mime = require('mime-types');

const uploadsDir = path.resolve(process.cwd(), 'uploads');

async function loadCoverAsDataUri(rawPath) {
    if (!rawPath) return null;

    let rel = String(rawPath).replace(/\\/g, '/');
    let candidates = [];

    // Absolute path as-is
    if (path.isAbsolute(rel)) {
        candidates.push(rel);
    }

    // Relative from project root
    candidates.push(path.resolve(process.cwd(), rel));

    // Inside uploads folder
    candidates.push(path.resolve(uploadsDir, rel));

    // Relative from current file directory
    candidates.push(path.resolve(__dirname, rel));

    for (const abs of candidates) {
        try {
            await fs.access(abs);
            const buf = await fs.readFile(abs);
            const mt = mime.lookup(abs) || 'application/octet-stream';
            return `data:${mt};base64,${buf.toString('base64')}`;
        } catch {
            // Skip to next candidate
        }
    }

    return null; // Could not find cover
}

module.exports = {
    loadCoverAsDataUri
};
