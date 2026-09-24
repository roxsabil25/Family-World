// Protect authenticated user routes and admin-only screens.
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login?message=' + encodeURIComponent('Please log in to continue.'));
    }

    return next();
};

// Restrict management routes so only administrators can access them.
const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login?message=' + encodeURIComponent('Please log in to continue.'));
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admin privileges are required.');
    }

    return next();
};

module.exports = {
    requireAuth,
    requireAdmin
};
