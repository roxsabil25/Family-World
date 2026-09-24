const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // Human-readable account name displayed in the dashboard and navbar.
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Email is unique so that each user has a single account for login and admin review.
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Password is stored as a bcrypt hash to keep local authentication secure.
    password: {
        type: String,
        required: true
    },
    // Role controls access to admin screens and protected upload actions.
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
