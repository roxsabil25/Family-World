const express = require('express');
const app = express();
require('dotenv').config();
const PORT = process.env.PORT || 3000;

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
app.get('/', (req, res) => {
    res.render('home', { awareKeys });
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


// Health Check Route
app.get('/healthz', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Family World server is running smoothly'
    });
});




app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});