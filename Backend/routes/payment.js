const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { loginRequired } = require('../middleware/auth');
const { getAppwriteClient, PRICING_COLLECTION_ID } = require('../utils/appwrite');
const { Databases, Query } = require('node-appwrite');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
});

// Create Order (Protected)
router.post('/create-order', loginRequired, async (req, res) => {
    try {
        const { amount, currency = 'INR' } = req.body;

        if (!amount) return res.status(400).json({ error: 'Amount is required' });

        const options = {
            amount: amount * 100, // Amount in lowest denomination (paise)
            currency,
            receipt: `receipt_${req.user.$id}_${Date.now()}`,
            payment_capture: 1
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error(`Razorpay Create Order Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to create payment order.' });
    }
});

// Verify Payment (Protected)
router.post('/verify-payment', loginRequired, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details' });
        }

        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            console.log(`Payment Verified for user ${req.user.$id}. Payment ID: ${razorpay_payment_id}`);

            // TODO: Update user subscription status in Appwrite here
            // const databases = new Databases(req.appwriteClient);
            // ... update user doc or subscription log

            return res.json({ message: 'Payment verified successfully' });
        } else {
            return res.status(400).json({ error: 'Payment verification failed' });
        }
    } catch (err) {
        console.error(`Razorpay Verify Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to verify payment.' });
    }
});

// Get My Plan
router.get('/my-plan', loginRequired, async (req, res) => {
    try {
        // In a real app, we'd fetch the user's subscription from DB
        // For now, return a default Free plan or mock data
        // User ID is in req.user.$id

        // TODO: Fetch user's actual plan from database
        const plan = {
            plan_id: 'free',
            status: 'active',
            expires: null,
            details: {
                name: 'Free Plan',
                features: ['1 Instagram Account', 'Basic Automation', '100 Actions/day'],
                price_monthly_inr: 0,
                price_monthly_usd: 0
            }
        };

        res.json(plan);
    } catch (err) {
        console.error(`Get My Plan Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch plan details' });
    }
});

// Get Pricing Plans (Public)
router.get('/pricing', async (req, res) => {
    try {
        const serverClient = getAppwriteClient({ useApiKey: true }); // Public endpoint can use API key for read-only if collection permissions are open to 'any'
        // Or if permissions restrict, use API key. app.py setup says permissions=[Permission.read(Role.any())]
        // So we can use a client without session for read, but listDocuments requires a client.
        // If we use 'useApiKey: true', we bypass user checks which is fine for read-only public data.

        const databases = new Databases(serverClient);

        const plans = await databases.listDocuments(
            process.env.APPWRITE_DATABASE_ID,
            PRICING_COLLECTION_ID
        );

        res.json({ plans: plans.documents });

    } catch (err) {
        console.error(`Fetch Pricing Error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch pricing plans.' });
    }
});

module.exports = router;
