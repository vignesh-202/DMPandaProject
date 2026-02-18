const { Account } = require('node-appwrite');
const { getAppwriteClient } = require('../utils/appwrite');

const loginRequired = async (req, res, next) => {
    let sessionToken = req.cookies.session_token;

    if (!sessionToken) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionToken = authHeader.split(' ')[1];
        }
    }

    if (!sessionToken) {
        return res.status(401).json({ error: 'Not authorized' });
    }

    try {
        const client = getAppwriteClient({ sessionToken });
        const account = new Account(client);
        const user = await account.get();

        req.user = user;
        req.appwriteClient = client;
        next();
    } catch (err) {
        console.error(`Auth error: ${err.message}`);
        res.clearCookie('session_token');
        return res.status(401).json({ error: 'Session is invalid' });
    }
};

module.exports = { loginRequired };
