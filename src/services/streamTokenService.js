// services/streamTokenService.js
const jwt = require('jsonwebtoken');

// Get secret dynamically to avoid load order issues
function getStreamSecret() {
    return (process.env.STREAM_SECRET && process.env.STREAM_SECRET.trim()) || 'change-me';
}

// Get TTL dynamically (defaults to 5 min)
function getStreamTtl() {
    const val = parseInt(process.env.STREAM_TTL_SECONDS, 10);
    return Number.isFinite(val) && val > 0 ? val : 300;
}

function signStreamToken({ songId, userId }, ttl = getStreamTtl()) {
    const secret = getStreamSecret();
    if (!secret || secret === 'change-me') {
        console.warn('[streamTokenService] ⚠️ STREAM_SECRET missing or defaulting — stream tokens will be insecure.');
    }
    return jwt.sign({ songId, userId }, secret, { expiresIn: ttl });
}

function verifyStreamToken(token) {
    try {
        return jwt.verify(token, getStreamSecret());
    } catch {
        return null;
    }
}

module.exports = {
    signStreamToken,
    verifyStreamToken
};
