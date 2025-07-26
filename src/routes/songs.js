const express = require('express');
const { getSongs, getSongStream } = require('../controllers/songController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/', getSongs);
router.get('/stream/:id', protect, getSongStream);

module.exports = router;