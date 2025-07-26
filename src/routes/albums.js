const express = require('express');
const { getAlbums, createAlbum } = require('../controllers/albumController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const router = express.Router();

router.get('/', getAlbums);
router.post('/', protect, upload.single('cover'), createAlbum);

module.exports = router;
