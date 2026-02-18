const AppwriteClient = require('./appwrite');
const InstagramAPI = require('./instagram');
const AutomationMatcher = require('./matcher');
const TemplateRenderer = require('./renderer');

class DMWorker {
    constructor() {
        this.appwrite = new AppwriteClient();
    }

    /**
     * Process an incoming message webhook.
     * 
     * @param {Object} webhookData - Instagram webhook payload
     * @returns {Promise<boolean>} - True if processed, False otherwise
     */
    async processMessage(webhookData) {
        try {
            // Instagram webhook structure is complex: entry -> messaging -> message
            const entry = webhookData.entry?.[0];
            const messaging = entry?.messaging?.[0];

            if (!messaging) {
                console.log('Not a messaging event, skipping.');
                return false;
            }

            const recipientId = entry.id; // The Page/IG Account receiving the message
            const senderId = messaging.sender.id; // The User sending the message
            const message = messaging.message;

            if (!message || !message.text) {
                console.log('No message text found, skipping.');
                return false;
            }

            console.log(`Processing message from ${senderId}: "${message.text}"`);

            // 1. Get the IG Account from Appwrite to get the access token
            console.log(`Fetching IG account for recipient: ${recipientId}`);
            const igAccount = await this.appwrite.getIGAccount(recipientId);
            if (!igAccount) {
                console.error(`IG account ${recipientId} not found in database.`);
                return false;
            }
            console.log(`IG account found: ${igAccount.username}`);

            const accessToken = igAccount.access_token;
            const fbAccessToken = igAccount.facebook_access_token; // If available

            // 2. Get active automations for this account
            console.log(`Fetching active automations for account: ${recipientId}`);
            const automations = await this.appwrite.getActiveAutomations(recipientId);
            if (!automations || automations.length === 0) {
                console.log(`No active automations for account ${recipientId}.`);
                return false;
            }
            console.log(`Found ${automations.length} active automations.`);

            // 3. Match the message against automation rules
            console.log(`Matching message: "${message.text}"`);
            const matchedAutomation = AutomationMatcher.matchDM(message.text, automations);
            if (!matchedAutomation) {
                console.log(`No keyword match for: ${message.text}`);
                return false;
            }

            console.log(`Matched automation: ${matchedAutomation.title || matchedAutomation.$id}`);

            // 4. Get the template for the automation
            const template = await this.appwrite.getTemplate(matchedAutomation.template_id);
            if (!template) {
                console.error(`Template ${matchedAutomation.template_id} not found.`);
                return false;
            }

            // 5. Render the template
            const context = {
                sender_id: senderId,
                recipient_id: recipientId,
                // Add more context if needed, e.g. from profiles collection
            };
            const renderedTemplate = TemplateRenderer.render(template, context);

            // 6. Send the message via Instagram API
            const instagram = new InstagramAPI(accessToken);
            const success = await instagram.sendMessage(
                senderId,
                template.type,
                renderedTemplate.payload
            );

            return success;
        } catch (error) {
            console.error('Error in DMWorker.processMessage:', error);
            return false;
        }
    }
}

module.exports = DMWorker;
