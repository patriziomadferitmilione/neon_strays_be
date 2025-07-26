const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username:  { type: String, required: true, unique: true },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    isAdmin:   { type: Boolean, default: false },

    // 🆕 Added fields
    firstName:  { type: String },
    lastName:   { type: String },
    birthday:   { type: Date },
    country:    { type: String },
    gender:     { type: String, enum: ['male', 'female', 'nonbinary', 'prefer_not_to_say'] },
    preferences: [{ type: String }],
    joinedFrom: { type: String, enum: ['organic', 'instagram', 'tiktok', 'facebook', 'referral', 'other'] },
    newsletter: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
