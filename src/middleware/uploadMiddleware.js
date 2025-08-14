const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure temp folder exists
const tempDir = path.resolve(process.cwd(), 'uploads/tmp');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        cb(null, `${base}-${Date.now()}${ext}`);
    }
});

const allowed = [
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4',
    'image/jpeg', 'image/png', 'image/webp'
];

const fileFilter = (req, file, cb) => {
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type'), false);
    }
};

const upload = multer({ storage, fileFilter });
module.exports = upload;
