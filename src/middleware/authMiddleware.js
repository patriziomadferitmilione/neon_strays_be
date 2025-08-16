const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { err } = require('../services/logger');

exports.protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authorized, no token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // fetch user from DB, exclude password
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user; // attach user doc to request
        next();
    } catch (e) {
        err('[authMiddleware] protect', e);
        res.status(401).json({ error: 'Token invalid or expired' });
    }
};
