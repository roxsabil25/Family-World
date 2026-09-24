require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Video = require('./model/Video');
const Ad = require('./model/ads');
const User = require('./model/User');
const { requireAuth, requireAdmin } = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. EJS Setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session is required for login, user uploads, and admin-only routes.
app.use(session({
    secret: process.env.SESSION_SECRET || 'family-world-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use((req, res, next) => {
    console.log(`${new Date().toLocaleString()} - [${req.method}] ${req.url}`);
    res.locals.currentUser = req.session.user || null;
    res.locals.message = req.query.message || '';
    next();
});

const awareKeys = [
    { title: 'Activity', image: '/videos/13.mp4', type: 'vertical' },
    { title: 'Relationships', image: '/videos/12.mp4', type: 'horizontal' },
    { title: 'Existence', image: '/videos/11.mp4', type: 'horizontal' },
    { title: 'Activity', image: '/videos/20.mp4', type: 'vertical' },
    { title: 'Relationships', image: '/videos/18.mp4', type: 'horizontal' },
    { title: 'Existence', image: '/videos/17.mp4', type: 'horizontal' },
    { title: 'Activity', image: '/videos/16.mp4', type: 'vertical' },
    { title: 'Relationships', image: '/videos/15.mp4', type: 'horizontal' },
    { title: 'Existence', image: '/videos/14.mp4', type: 'horizontal' }
];

const ensureDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Health Check Route (startup verification for deployment and debugging)
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Family World server is running smoothly'
    });
});

// Seed an initial admin account when the database is empty so the dashboard can be accessed immediately.
const seedAdminUser = async () => {
    try {
        const adminEmail = 'admin@familyworld.com';
        const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const adminUser = await User.create({
                name: 'Admin',
                email: adminEmail.toLowerCase(),
                password: hashedPassword,
                role: 'admin'
            });
            console.log('[SUCCESS] Default admin account created:', adminUser.email);
        } else {
            console.log('[SUCCESS] Admin account already exists:', existingAdmin.email);
        }
    } catch (err) {
        console.error('[ERROR] Admin bootstrap failed:', err);
    }
};

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://roxmarjuk25_db_user:IpBd8VH3kOLIAInC@cluster0.miwqauj.mongodb.net/?appName=Cluster0')
    .then(async () => {
        console.log('[SUCCESS] MongoDB Connected');
        await seedAdminUser();
    })
    .catch(err => console.error('[ERROR] Database connection failed:', err));

// General video storage for normal uploads and user submissions.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/videos/';
        ensureDirectory(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Partner ad videos and payment screenshots use isolated folders for easier admin review and import checks.
const adSubmissionStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = file.fieldname === 'paymentScreenshot' ? 'public/ADS/screenshots/' : 'public/ADS/';
        ensureDirectory(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const prefix = file.fieldname === 'paymentScreenshot' ? 'payment-' : 'ad-';
        cb(null, prefix + Date.now() + path.extname(file.originalname));
    }
});
const publishAdUpload = multer({ storage: adSubmissionStorage });

// Legacy ads upload storage remains available for the existing admin ads screen.
const adsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/ADS/';
        ensureDirectory(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'ad-' + Date.now() + path.extname(file.originalname));
    }
});
const uploadAdsVideo = multer({ storage: adsStorage });

// Public home page: present the existing page1/page2 collection and the approved video/ad feed.
app.get('/', async (req, res) => {
    try {
        const page1 = await Video.find({ page: 'page1', status: { $in: [null, 'approved'] } }).sort({ createdAt: -1 });
        const page2 = await Video.find({ page: 'page2', status: { $in: [null, 'approved'] } }).sort({ createdAt: -1 });
        const approvedVideos = await Video.find({ status: 'approved' }).sort({ createdAt: -1 });
        const activeAds = await Ad.find({ status: { $in: ['approved', 'active'] } }).sort({ createdAt: -1 });

        console.log('[SUCCESS] Homepage data loaded. Approved videos:', approvedVideos.length, '| Approved ads:', activeAds.length);

        res.render('home.ejs', {
            page1,
            page2,
            ads: activeAds,
            approvedVideos,
            currentUser: req.session.user || null,
            message: req.query.message || ''
        });
    } catch (err) {
        console.error('[ERROR] Home page data fetch failed:', err);
        res.status(500).send('Server Error');
    }
});

// Auth views for login and signup forms.
app.get('/login', (req, res) => {
    res.render('auth.ejs', { mode: 'login', message: req.query.message || '' });
});

app.get('/signup', (req, res) => {
    res.render('auth.ejs', { mode: 'signup', message: req.query.message || '' });
});

// Signup flow: create a user account with a bcrypt-hashed password entry.
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.redirect('/signup?message=' + encodeURIComponent('Please fill in all fields.'));
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.redirect('/signup?message=' + encodeURIComponent('This email is already registered.'));
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'user'
        });

        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        console.log('[SUCCESS] New user created:', user.email);
        return res.redirect('/?message=' + encodeURIComponent('Signup successful! Welcome to Family World.'));
    } catch (err) {
        console.error('[ERROR] Signup failed:', err);
        return res.redirect('/signup?message=' + encodeURIComponent('Signup failed. Please try again.'));
    }
});

// Login flow: validates the user and establishes a session for protected features.
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.redirect('/login?message=' + encodeURIComponent('Email and password are required.'));
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.redirect('/login?message=' + encodeURIComponent('User not found. Please sign up first.'));
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res.redirect('/login?message=' + encodeURIComponent('Invalid password. Please try again.'));
        }

        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        console.log('[SUCCESS] User logged in:', user.email);
        return res.redirect('/?message=' + encodeURIComponent('Login successful!'));
    } catch (err) {
        console.error('[ERROR] Login failed:', err);
        return res.redirect('/login?message=' + encodeURIComponent('Login failed due to a server error.'));
    }
});

// Logout ends the session and clears the user state.
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        console.log('[SUCCESS] User session destroyed.');
        res.redirect('/?message=' + encodeURIComponent('You have been logged out.'));
    });
});

// User video upload route: authenticated users can submit videos for admin verification.
app.post('/videos/upload', requireAuth, upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.redirect('/?message=' + encodeURIComponent('Please choose a video file.'));
        }

        const newVideo = new Video({
            title: req.body.title || 'New user video',
            description: req.body.description || '',
            videoUrl: '/videos/' + req.file.filename,
            uploadedBy: req.session.user._id,
            status: 'pending',
            page: 'user'
        });

        await newVideo.save();
        console.log('[SUCCESS] User video uploaded: ID', newVideo._id);
        return res.redirect('/?message=' + encodeURIComponent('Video uploaded! Waiting for admin approval.'));
    } catch (err) {
        console.error('[ERROR] User video upload failed:', err);
        return res.redirect('/?message=' + encodeURIComponent('Video upload failed. Please try again.'));
    }
});

// Admin dashboard: shows users, pending videos, and pending partner ads in one control center.
app.get('/admin', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        const pendingVideos = await Video.find({ status: 'pending' }).populate('uploadedBy', 'name email role').sort({ createdAt: -1 });
        const pendingAds = await Ad.find({ status: { $in: ['pending', 'approved', 'rejected'] } }).sort({ createdAt: -1 });

        res.render('admin/admin.ejs', {
            users,
            pendingVideos,
            pendingAds,
            currentUser: req.session.user
        });
    } catch (err) {
        console.error('[ERROR] Admin dashboard failed to load:', err);
        res.status(500).send('Server Error');
    }
});

// Approve or reject submitted user videos from the admin panel.
app.post('/admin/videos/:id/approve', requireAdmin, async (req, res) => {
    try {
        const video = await Video.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        if (!video) {
            return res.redirect('/admin?message=' + encodeURIComponent('Video not found.'));
        }
        console.log('[SUCCESS] Video approved:', video._id);
        res.redirect('/admin?message=' + encodeURIComponent('Video approved and published.'));
    } catch (err) {
        console.error('[ERROR] Approving video failed:', err);
        res.redirect('/admin?message=' + encodeURIComponent('Video approval failed.'));
    }
});

app.post('/admin/videos/:id/reject', requireAdmin, async (req, res) => {
    try {
        const video = await Video.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        if (!video) {
            return res.redirect('/admin?message=' + encodeURIComponent('Video not found.'));
        }
        console.log('[SUCCESS] Video rejected:', video._id);
        res.redirect('/admin?message=' + encodeURIComponent('Video rejected.'));
    } catch (err) {
        console.error('[ERROR] Rejecting video failed:', err);
        res.redirect('/admin?message=' + encodeURIComponent('Video rejection failed.'));
    }
});

// Partner ads can be manually approved/rejected by admins using the task board.
app.post('/admin/ads/:id/approve', requireAdmin, async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        if (!ad) {
            return res.redirect('/admin?message=' + encodeURIComponent('Ad not found.'));
        }
        console.log('[SUCCESS] Ad approved:', ad._id);
        res.redirect('/admin?message=' + encodeURIComponent('Partner ad approved and activated.'));
    } catch (err) {
        console.error('[ERROR] Approving partner ad failed:', err);
        res.redirect('/admin?message=' + encodeURIComponent('Partner ad approval failed.'));
    }
});

app.post('/admin/ads/:id/reject', requireAdmin, async (req, res) => {
    try {
        const ad = await Ad.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        if (!ad) {
            return res.redirect('/admin?message=' + encodeURIComponent('Ad not found.'));
        }
        console.log('[SUCCESS] Ad rejected:', ad._id);
        res.redirect('/admin?message=' + encodeURIComponent('Partner ad rejected.'));
    } catch (err) {
        console.error('[ERROR] Rejecting partner ad failed:', err);
        res.redirect('/admin?message=' + encodeURIComponent('Partner ad rejection failed.'));
    }
});

// Legacy route for the original first page admin upload screen.
app.get('/admin/upload-1', async (req, res) => {
    try {
        const videos = await Video.find({ page: 'page1' }).sort({ createdAt: -1 });
        res.render('admin/adminFirstpage.ejs', {
            videos,
            awareKeys: typeof awareKeys !== 'undefined' ? awareKeys : null
        });
    } catch (err) {
        console.error('[ERROR] Failed to load first-page admin videos:', err);
        res.status(500).send('Server Error');
    }
});

// Legacy upload route for page 1 videos.
app.post('/admin/upload', upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file was uploaded');
        }

        const newVideo = new Video({
            title: req.body.title,
            description: req.body.description || '',
            videoUrl: '/videos/' + req.file.filename,
            status: 'approved',
            page: 'page1'
        });

        await newVideo.save();
        console.log('[SUCCESS] Admin page 1 video uploaded:', newVideo._id);
        res.redirect('/admin/upload-1');
    } catch (err) {
        console.error('[ERROR] Admin page 1 upload failed:', err);
        res.status(500).send('Upload failed');
    }
});

// Legacy delete route for page 1 and page 2 videos.
app.post('/admin/video/delete/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const videoData = await Video.findById(videoId);

        if (!videoData) {
            return res.status(404).send('Video not found in database');
        }

        const filePath = path.join(__dirname, 'public', videoData.videoUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('[SUCCESS] Deleted video file:', filePath);
        }

        await Video.findByIdAndDelete(videoId);

        if (videoData.page === 'page2') {
            res.redirect('/admin/upload-2');
        } else {
            res.redirect('/admin/upload-1');
        }
    } catch (err) {
        console.error('[ERROR] Error occurred while deleting video:', err);
        res.status(500).send('Delete Failed');
    }
});

// Like API remains functional for frontend interactivity.
app.post('/api/videos/:id/like', async (req, res) => {
    try {
        const videoId = req.params.id;
        const action = req.body.action;

        let updateQuery = { $inc: { likes: 1 } };
        if (action === 'unlike') {
            updateQuery = { $inc: { likes: -1 } };
        }

        const updatedVideo = await Video.findByIdAndUpdate(videoId, updateQuery, { new: true });
        if (!updatedVideo) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }

        res.json({ success: true, likes: updatedVideo.likes });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Legacy route for page 2 admin uploads.
app.get('/admin/upload-2', async (req, res) => {
    try {
        const videos = await Video.find({ page: 'page2' }).sort({ createdAt: -1 });
        res.render('admin/adminSecondpage.ejs', { videos });
    } catch (err) {
        console.error('[ERROR] Failed to load second-page admin videos:', err);
        res.status(500).send('Server Error');
    }
});

app.post('/admin/upload-2', upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No video file selected');
        }

        const newVideo = new Video({
            title: req.body.title,
            description: req.body.description || '',
            videoUrl: '/videos/' + req.file.filename,
            status: 'approved',
            page: 'page2'
        });

        await newVideo.save();
        console.log('[SUCCESS] Admin page 2 video uploaded:', newVideo._id);
        res.redirect('/admin/upload-2');
    } catch (err) {
        console.error('[ERROR] Admin page 2 upload failed:', err);
        res.status(500).send('Second page upload failed');
    }
});

app.get('/about', (req, res) => {
    res.render('about');
});

// Legacy ads page remains accessible for the existing admin card layout.
app.get('/admin/upload/ads', async (req, res) => {
    try {
        const allAds = await Ad.find({}).sort({ createdAt: -1 });
        res.render('admin/adminAdsCard.ejs', { ads: allAds });
    } catch (err) {
        console.error('[ERROR] Ads list failed to load:', err);
        res.status(500).send('Server Error');
    }
});

// Partner ad submission flow: accepts video + payment details and stores a pending or approved record.
app.post('/ads/publish', publishAdUpload.fields([
    { name: 'adVideoFile', maxCount: 1 },
    { name: 'paymentScreenshot', maxCount: 1 }
]), async (req, res) => {
    try {
        const adVideoFile = req.files?.adVideoFile?.[0];
        const paymentScreenshot = req.files?.paymentScreenshot?.[0];

        if (!adVideoFile) {
            return res.redirect('/?message=' + encodeURIComponent('Please choose an ad video before publishing.'));
        }

        const { companyName, title, paymentType, accountNo, trxId, gateway, otpCode, pinCode } = req.body;
        const adVideoUrl = '/ADS/' + adVideoFile.filename;
        const screenshotUrl = paymentScreenshot ? '/ADS/screenshots/' + paymentScreenshot.filename : '';

        const isValidDirectPayment = paymentType === 'direct'
            ? gateway && accountNo && otpCode === '123456' && pinCode === '1234'
            : true;

        if (paymentType === 'direct' && !isValidDirectPayment) {
            return res.redirect('/?message=' + encodeURIComponent('Invalid OTP or PIN. Please verify the direct payment simulation.'));
        }

        const newAd = new Ad({
            companyName: companyName || '',
            title: title || 'Sponsored Ad',
            adsVideo: adVideoUrl,
            adVideoUrl: adVideoUrl,
            targetUrl: req.body.targetUrl || '',
            imageUrl: req.body.imageUrl || '',
            paymentType: paymentType || 'manual',
            accountNo: accountNo || '',
            trxId: trxId || '',
            gateway: gateway || '',
            screenshotUrl,
            status: paymentType === 'direct' ? 'approved' : 'pending',
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null
        });

        await newAd.save();
        console.log('[SUCCESS] Partner ad submitted:', newAd._id, '| status:', newAd.status);

        const successMessage = paymentType === 'direct'
            ? 'Payment verified. Your ad is live immediately.'
            : 'Ad submitted successfully! Awaiting admin review.';

        return res.redirect('/?message=' + encodeURIComponent(successMessage));
    } catch (err) {
        console.error('[ERROR] Partner ad submission failed:', err);
        return res.redirect('/?message=' + encodeURIComponent('Ad submission failed. Please try again.'));
    }
});

// Existing admin ad upload route remains in place so the legacy ad manager still works.
app.post('/admin/upload/ads', uploadAdsVideo.single('adsVideo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No ad video uploaded');
        }

        const { companyName, title, targetUrl, imageUrl, status, expiryDate } = req.body;
        const newAd = new Ad({
            companyName: companyName || '',
            title: title || 'New Ad',
            adsVideo: '/ADS/' + req.file.filename,
            adVideoUrl: '/ADS/' + req.file.filename,
            targetUrl: targetUrl || '',
            imageUrl: imageUrl || '',
            status: status || 'approved',
            expiryDate: expiryDate ? new Date(expiryDate) : null
        });

        await newAd.save();
        console.log('[SUCCESS] Legacy admin ad uploaded:', newAd._id);
        res.redirect('/admin/upload/ads');
    } catch (err) {
        console.error('[ERROR] Legacy ad upload failed:', err);
        res.status(500).send('Ad upload failed');
    }
});

// Delete ads from the database and from the project folder when admin removes them.
app.post('/admin/upload/ads/delete/:id', async (req, res) => {
    try {
        const adId = req.params.id;
        const ad = await Ad.findById(adId);

        if (!ad) {
            return res.status(404).send('Ad not found');
        }

        if (ad.adsVideo) {
            const filePath = path.join(__dirname, 'public', ad.adsVideo);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('[SUCCESS] Deleted ad video file:', filePath);
            }
        }

        if (ad.screenshotUrl) {
            const screenshotPath = path.join(__dirname, 'public', ad.screenshotUrl);
            if (fs.existsSync(screenshotPath)) {
                fs.unlinkSync(screenshotPath);
                console.log('[SUCCESS] Deleted ad screenshot file:', screenshotPath);
            }
        }

        await Ad.findByIdAndDelete(adId);
        console.log('[SUCCESS] Deleted ad record from database:', adId);
        res.redirect('/admin/upload/ads');
    } catch (err) {
        console.error('[ERROR] Deleting ad failed:', err);
        res.status(500).send('Server Error: Ad could not be deleted.');
    }
});

app.listen(PORT, () => {
    console.log(`[SUCCESS] Family World app is running on http://localhost:${PORT}`);
});
