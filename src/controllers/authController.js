const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { err } = require('../services/logger');

exports.register = async (req, res) => {
    try {
        const {
            username, email, password,
            firstName, lastName, birthday,
            country, gender, preferences,
            joinedFrom, newsletter
        } = req.body;

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ error: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            firstName,
            lastName,
            birthday,
            country,
            gender,
            preferences,
            joinedFrom,
            newsletter
        });

        res.status(201).json({ message: 'User registered successfully' });
    } catch (e) {
        err('[authController] register', e);
        res.status(500).json({ error: e.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: user._id, email: user.email, isAdmin: user.isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token });
    } catch (e) {
        err('[authController] login', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        res.json(req.user);
    } catch (e) {
        err('[authController] getUser', e);
        res.status(500).json({ error: e.message });
    }
};