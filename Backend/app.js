const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { Databases } = require('node-appwrite');
const { getAppwriteClient } = require('./utils/appwrite');
const { saveRuntimeFrontendOrigin, normalizeRuntimeOrigin } = require('./utils/systemConfig');

const app = express();
const PORT = process.env.PORT || 5000;

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

// Middleware
app.use('/api/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = new Set([
    process.env.FRONTEND_ORIGIN,
    process.env.ADMIN_PANEL_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000'
].map(normalizeOrigin).filter(Boolean));

const isDevOrigin = (origin) => {
    if (!origin) return false;
    const normalized = normalizeOrigin(origin).toLowerCase();
    // Allow any devtunnels.ms origin
    if (normalized.endsWith('.devtunnels.ms')) return true;
    // Allow any localhost origin
    if (normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:')) return true;
    return false;
};

app.use(cors({
    origin: (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);
        if (!origin || allowedOrigins.has(normalizedOrigin) || isDevOrigin(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked for origin: "${origin}" (normalized: "${normalizedOrigin}"). Allowed origins:`, Array.from(allowedOrigins));
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use((req, _res, next) => {
    const requestOrigin = normalizeRuntimeOrigin(req.get('origin') || req.get('referer') || '');
    if (requestOrigin && (allowedOrigins.has(requestOrigin) || isDevOrigin(requestOrigin))) {
        const databases = new Databases(getAppwriteClient({ useApiKey: true }));
        saveRuntimeFrontendOrigin(databases, requestOrigin).catch((error) => {
            console.warn(`Failed to capture runtime frontend origin: ${error?.message || String(error)}`);
        });
    }
    next();
});

// Routes

// Routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payment');
const instagramRoutes = require('./routes/instagram');
const adminRoutes = require('./routes/admin');
const seoRoutes = require('./routes/seo');

app.use('/', authRoutes); // Mount at root to allow /api/register and /auth/google
app.use('/', seoRoutes);  // Mount sitemap.xml and robots.txt at root
app.use('/api/account', accountRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', paymentRoutes);
app.use('/api', instagramRoutes);
app.use('/api/admin', adminRoutes);


// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'DM Panda Backend is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing backend process or set a different PORT before starting this server.`);
        return;
    }
    console.error('Backend server failed to start:', error);
});
