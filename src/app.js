const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const songsRoute = require('./routes/songs');
const authRoutes = require('./routes/auth');
const albumRoutes = require('./routes/albums');

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/songs', songsRoute);
app.use('/api/auth', authRoutes);
app.use('/api/albums', albumRoutes);

module.exports = app;
