const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS Configuration
const allowedOrigins = [
    process.env.FRONTEND_ORIGIN,
    process.env.ADMIN_PANEL_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Routes

// Routes
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payment');
const instagramRoutes = require('./routes/instagram');
const adminRoutes = require('./routes/admin');

app.use('/', authRoutes); // Mount at root to allow /api/register and /auth/google
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
