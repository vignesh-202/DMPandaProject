class AutomationMatcher {
    static _getKeywordList(automation) {
        let keywords = automation.trigger_keyword || automation.keywords || automation.keyword || [];
        if (typeof keywords === 'string') {
            try {
                keywords = JSON.parse(keywords);
            } catch (_) {
                keywords = keywords.split(',');
            }
        }
        if (!Array.isArray(keywords)) keywords = [keywords];
        return keywords
            .map((keyword) => String(keyword || '').toUpperCase().trim())
            .filter(Boolean);
    }

    static _getTitleCandidate(automation) {
        const automationType = String(automation?.automation_type || '').trim().toLowerCase();
        if (!['convo_starter', 'inbox_menu'].includes(automationType)) {
            return '';
        }
        return String(automation?.title || automation?.title_normalized || '').toUpperCase().trim();
    }

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

        // Pass 1: exact match only (highest priority)
        for (const automation of automations) {
            for (const normalizedKeyword of this._getKeywordList(automation)) {
                // Exact match
                if (normalizedText === normalizedKeyword) {
                    return automation;
                }
            }

            const normalizedTitle = this._getTitleCandidate(automation);
            if (normalizedTitle && normalizedText === normalizedTitle) {
                return automation;
            }
        }

        // Pass 2: contains match only for automations explicitly configured for it
        for (const automation of automations) {
            const matchType = String(automation.keyword_match_type || 'exact').toLowerCase();
            const allowContains = matchType === 'contains' || matchType === 'partial' || matchType === 'includes';
            if (!allowContains) continue;

            for (const normalizedKeyword of this._getKeywordList(automation)) {
                if (normalizedKeyword.length > 0 && normalizedText.includes(normalizedKeyword)) {
                    return automation;
                }
            }
        }

        return null;
    }
}

module.exports = AutomationMatcher;
