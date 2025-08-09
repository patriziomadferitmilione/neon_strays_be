// utils/streamToken.js
const jwt = require('jsonwebtoken');

const STREAM_SECRET = process.env.STREAM_SECRET || 'streamingTokenSTREAMSECRET';
const DEFAULT_TTL = 60 * 5; // 5 minutes

function signStreamToken({ songId, userId }, ttl = DEFAULT_TTL) {
    return jwt.sign({ songId, userId }, STREAM_SECRET, { expiresIn: ttl });
}

function verifyStreamToken(token) {
    try {
        return jwt.verify(token, STREAM_SECRET);
    } catch {
        return null;
    }
}

module.exports = { signStreamToken, verifyStreamToken };
