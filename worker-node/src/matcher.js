class AutomationMatcher {
    static _normalizeToken(value) {
        return String(value || '').toUpperCase().trim();
    }

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
            .map((keyword) => this._normalizeToken(keyword))
            .filter(Boolean);
    }

    static _getConversationStarterCandidates(automation) {
        const automationType = String(automation?.automation_type || '').trim().toLowerCase();
        if (!['convo_starter', 'inbox_menu'].includes(automationType)) {
            return [];
        }
        return Array.from(new Set([
            automation?.title,
            automation?.title_normalized,
            automation?.question,
            automation?.payload,
            automation?.template_content,
            automation?.template_id
        ].map((value) => this._normalizeToken(value)).filter(Boolean)));
    }

    static _getDirectReferenceCandidates(automation) {
        return Array.from(new Set([
            automation?.payload,
            automation?.template_id,
            automation?.template_content,
            automation?.media_id,
            automation?.$id,
            automation?.id
        ].map((value) => this._normalizeToken(value)).filter(Boolean)));
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

            for (const candidate of this._getDirectReferenceCandidates(automation)) {
                if (normalizedText === candidate) {
                    return automation;
                }
            }

            for (const candidate of this._getConversationStarterCandidates(automation)) {
                if (normalizedText === candidate) {
                    return automation;
                }
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
