const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    videoUrl: {
        type: String,
        required: true
    },
    likes: { type: Number, default: 0 },
    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model('Video', videoSchema);