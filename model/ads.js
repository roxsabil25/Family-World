const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
    // Existing brand/company identifier preserved for legacy admin display.
    companyName: {
        type: String,
        trim: true,
        default: ''
    },
    // Legacy upload field still kept so older admin card views continue to render correctly.
    adsVideo: {
        type: String,
        trim: true,
        default: ''
    },
    // Public title shown on the ad card and review list.
    title: {
        type: String,
        trim: true,
        default: 'Sponsored Ad'
    },
    // New field used by the partner ad publication flow.
    adVideoUrl: {
        type: String,
        trim: true,
        default: ''
    },
    // Payment mode selected by the partner advertiser.
    paymentType: {
        type: String,
        enum: ['manual', 'direct'],
        default: 'manual'
    },
    // bKash / Nagad / Rocket payment reference details.
    trxId: {
        type: String,
        trim: true,
        default: ''
    },
    screenshotUrl: {
        type: String,
        trim: true,
        default: ''
    },
    accountNo: {
        type: String,
        trim: true,
        default: ''
    },
    gateway: {
        type: String,
        enum: ['bkash', 'nagad', 'rocket', ''],
        default: ''
    },
    // Legacy image and target URL are retained to avoid breaking any existing ad layout.
    imageUrl: {
        type: String,
        default: ''
    },
    targetUrl: {
        type: String,
        default: ''
    },
    // Frontend filter state; includes the new moderated flow as well as legacy active/inactive states.
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'active', 'inactive'],
        default: 'pending'
    },
    views: {
        type: Number,
        default: 0
    },
    clicks: {
        type: Number,
        default: 0
    },
    expiryDate: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Ad = mongoose.model('Ad', adSchema);

module.exports = Ad;