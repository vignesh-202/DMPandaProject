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

        const normalizedText = text.toUpperCase().trim();

        for (const automation of automations) {
            let keywords = automation.trigger_keyword || automation.keywords || automation.keyword || [];
            if (typeof keywords === 'string') {
                try {
                    keywords = JSON.parse(keywords);
                } catch (_) {
                    keywords = keywords.split(',');
                }
            }
            if (!Array.isArray(keywords)) keywords = [keywords];

            for (const keyword of keywords) {
                if (!keyword) continue;

                const normalizedKeyword = String(keyword).toUpperCase().trim();

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
