require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;



const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Video = require('./model/Video');





// 1. EJS Setup
app.set('view engine', 'ejs');

app.use(express.static('public'));

// 3. Built-in Middleware: Body Parser (Form theke data grohon korar jonno)
app.use(express.urlencoded({ extended: true })); // Form submissions
app.use(express.json()); // JSON data handled

// 4. Custom Middleware: Logger (Eiti protiti request-er info print korbe)
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleString()} - [${req.method}] ${req.url}`);
    next(); // 'next' call na korle request ekhaneit atkye thakbe, porer dhap-e jabe na
});

// --- MIDDLEWARE SECTION END ---


const awareKeys = [
    { title: 'Activity', image: '/videos/13.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/12.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/11.mp4', type: 'horizontal' }, // 16/9 aspect ratio

    { title: 'Activity', image: '/videos/20.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/18.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/17.mp4', type: 'horizontal' }, // 16/9 aspect ratio

    { title: 'Activity', image: '/videos/16.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/15.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/14.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    // স্লাইডারে লুপ করার জন্য কার্ডগুলো ডুপ্লিকেট করা হয়েছে
{ title: 'Activity', image: '/videos/13.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/12.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/11.mp4', type: 'horizontal' }, // 16/9 aspect ratio

    { title: 'Activity', image: '/videos/20.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/18.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/17.mp4', type: 'horizontal' }, // 16/9 aspect ratio

    { title: 'Activity', image: '/videos/16.mp4', type: 'vertical' }, // 9/16 aspect ratio
    { title: 'Relationships', image: '/videos/15.mp4', type: 'horizontal' }, // 16/9 aspect ratio
    { title: 'Existence', image: '/videos/14.mp4', type: 'horizontal' }, // 16/9 aspect ratio
];

// Route


// Health Check Route (ETAKE UPORE NIYE ASHUN)
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Family World server is running smoothly'
    });
});


// MongoDB Atlas Connection
mongoose.connect('mongodb+srv://roxmarjuk25_db_user:IpBd8VH3kOLIAInC@cluster0.miwqauj.mongodb.net/?appName=Cluster0')
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// Multer Storage Setup (ভিডিও সেভ করার জন্য)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/videos/'); // ভিডিও এই ফোল্ডারে সেভ হবে
    },
    filename: function (req, file, cb) {
        // ফাইলের ইউনিক নাম দেওয়া হচ্ছে যেন এক নামের ফাইল ওভাররাইট না হয়
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


app.get('/', async (req, res) => {
    try {
        const videos = await Video.find().sort({ createdAt: -1 }); // সব ভিডিও নিয়ে আসা হলো
        res.render('home', { videos: videos , awareKeys}); // ইজেএস ফাইলে পাঠানো হলো
    } catch (err) {
        res.status(500).send("সার্ভার ত্রুটি");
    }
});


// ২. অ্যাডমিন প্যানেল পেজ (ভিডিও আপলোড করার ফর্ম)
app.get('/admin', (req, res) => {
    res.render('admin');
});



// ৩. ভিডিও আপলোড করার POST রাউট
app.post('/admin/upload', upload.single('videoFile'), async (req, res) => {
    try {
        const newVideo = new Video({
            title: req.body.title,
            videoUrl: '/videos/' + req.file.filename // ফ্রন্টএন্ডে প্লে করার জন্য পাথ সেভ হচ্ছে
        });
        await newVideo.save();
        res.redirect('/'); // আপলোড শেষে মেইন পেজে রিডাইরেক্ট
    } catch (err) {
        res.status(500).send("আপলোড ব্যর্থ হয়েছে");
    }
});


// লাইক আপডেট করার API রাউট
app.post('/api/videos/:id/like', async (req, res) => {
    try {
        const videoId = req.params.id;
        const action = req.body.action; // 'like' অথবা 'unlike'

        let updateQuery = { $inc: { likes: 1 } }; // ডিফল্টভাবে ১ বাড়াবে
        if (action === 'unlike') {
            updateQuery = { $inc: { likes: -1 } }; // আনলাইক করলে ১ কমাবে
        }

        // ডাটাবেজে আপডেট করে নতুন ডাটাটি রিটার্ন করবে
        const updatedVideo = await Video.findByIdAndUpdate(videoId, updateQuery, { new: true });
        
        if (!updatedVideo) {
            return res.status(404).json({ success: false, message: 'ভিডিও পাওয়া যায়নি' });
        }

        res.json({ success: true, likes: updatedVideo.likes });
    } catch (err) {
        res.status(500).json({ success: false, message: 'সার্ভার ত্রুটি' });
    }
});

app.get('/about', (req, res) => {
    res.render('about');
});



// Post Route (Form data test korar jonno)
app.post('/login', (req, res) => {
    const username = req.body.username; // middleware chhara eta undefined ashbe
    res.send(`Login successful for: ${username}`);
});

// 5. 404 Error Middleware (Shob route-er niche thakte hoy)
app.use((req, res) => {
    res.status(404).send("Oops! Ei page-ti khuje paowa jayni.");
});






app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});