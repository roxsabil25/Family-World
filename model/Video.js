const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    // Video title shown on the public feed and admin review list.
    title: {
        type: String,
        required: true,
        trim: true
    },
    // Short description submitted by the uploader for moderator review.
    description: {
        type: String,
        default: ''
    },
    // Uploaded media path for public playback.
    videoUrl: {
        type: String,
        required: true
    },
    // Optional like counter kept for the existing interactive frontend.
    likes: {
        type: Number,
        default: 0
    },
    // The user who uploaded the media. This keeps the review workflow tied to the account.
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Moderation state for the video feed and admin approval workflow.
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    // Existing page field is preserved for the first and second page categories.
    page: {
        type: String,
        default: 'page1'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Video', videoSchema);