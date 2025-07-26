const multer = require('multer');
const path = require('path');

// Set destination and filename
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'src/uploads');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        cb(null, `${base}-${Date.now()}${ext}`);
    }
});

// Accept only audio files
const fileFilter = (req, file, cb) => {
    const allowed = [
        'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4',
        'image/jpeg', 'image/png', 'image/webp'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'), false);
};

// Configure for multiple fields
const upload = multer({ storage, fileFilter });

module.exports = upload;
