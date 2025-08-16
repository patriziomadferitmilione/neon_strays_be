const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Absolute temp folder in project root
const tempDir = path.resolve(process.cwd(), 'uploads', 'tmp');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
        cb(null, `${base}-${Date.now()}${ext}`);
    }
});

const allowed = [
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
    'audio/aac', 'audio/mp4', 'audio/vnd.dlna.adts', 'application/octet-stream',
    'image/jpeg', 'image/png', 'image/webp'
];

const fileFilter = (req, file, cb) => {
    console.log('[UPLOAD] Received:', file.originalname, file.mimetype);
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        console.error('[UPLOAD] Unsupported type:', file.originalname, file.mimetype);
        cb(new Error('Unsupported file type'), false);
    }
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
