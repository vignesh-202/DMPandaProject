class AutomationMatcher {
    /**
     * Match a message against automation rules.
     * 
     * @param {string} text - Message text to match
     * @param {Array} automations - List of active automations
     * @returns {Object|null} - Matched automation or null
     */
    static matchDM(text, automations) {
        if (!text || !automations || automations.length === 0) {
            return null;
        }

        const normalizedText = text.toLowerCase().trim();

        for (const automation of automations) {
            const keywords = automation.trigger_keyword || [];

            for (const keyword of keywords) {
                if (!keyword) continue;

                const normalizedKeyword = keyword.toLowerCase().trim();

                // Exact match
                if (normalizedText === normalizedKeyword) {
                    return automation;
                }

                // Contains match (if keyword is more than 3 chars)
                if (normalizedKeyword.length > 3 && normalizedText.includes(normalizedKeyword)) {
                    return automation;
                }
            }
        }

        return null;
    }
}

module.exports = AutomationMatcher;
