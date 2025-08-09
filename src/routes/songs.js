const express = require('express');
const { getSongs, getSongStream, uploadSong } = require('../controllers/songController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.get('/', getSongs);
router.get('/stream/:id', getSongStream);

// Multiple file inputs: mp3, aac, wav
router.post(
    '/upload',
    protect,
    upload.fields([
        { name: 'mp3', maxCount: 1 },
        { name: 'aac', maxCount: 1 },
        { name: 'wav', maxCount: 1 },
        { name: 'cover', maxCount: 1 },
    ]),
    uploadSong
);

module.exports = router;
