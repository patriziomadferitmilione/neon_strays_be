const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const songsRoute = require('./routes/songs');
const authRoutes = require('./routes/auth');

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/songs', songsRoute);
app.use('/api/auth', authRoutes);

module.exports = app;
