import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { Shield, Trash2, Eye, X, Save, Loader2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

type ModerationAction = 'hide' | 'delete';

interface ModerationRule {
    keywords: string[];
    action: ModerationAction;
}

const ACTION_META: Record<ModerationAction, {
    title: string;
    description: string;
    icon: typeof Eye;
    accentClasses: string;
    chipClasses: string;
}> = {
    hide: {
        title: 'Hide Comments',
        description: 'Comments with these keywords stay out of sight without removing them permanently.',
        icon: Eye,
        accentClasses: 'border-blue-500/20 bg-blue-500/5',
        chipClasses: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300'
    },
    delete: {
        title: 'Delete Comments',
        description: 'Comments with these keywords are removed completely from the thread.',
        icon: Trash2,
        accentClasses: 'border-red-500/20 bg-red-500/5',
        chipClasses: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300'
    }
};

const normalizeRulesToLists = (rules: ModerationRule[]) => {
    const lists: Record<ModerationAction, string[]> = { hide: [], delete: [] };

    (Array.isArray(rules) ? rules : []).forEach((rule) => {
        const action = rule?.action === 'delete' ? 'delete' : 'hide';
        const keywords = Array.isArray(rule?.keywords)
            ? rule.keywords.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean)
            : [];
        lists[action] = Array.from(new Set([...(lists[action] || []), ...keywords]));
    });

    return lists;
};

const moderationRulesFromLists = (lists: Record<ModerationAction, string[]>): ModerationRule[] => (
    (['hide', 'delete'] as ModerationAction[])
        .map((action) => ({
            action,
            keywords: Array.from(new Set((lists[action] || []).map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean)))
        }))
        .filter((rule) => rule.keywords.length > 0)
);

const CommentModerationView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount } = useDashboard();
    const [keywordLists, setKeywordLists] = useState<Record<ModerationAction, string[]>>({ hide: [], delete: [] });
    const [keywordInputs, setKeywordInputs] = useState<Record<ModerationAction, string>>({ hide: '', delete: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchRules = useCallback(async (signal?: AbortSignal) => {
        if (!activeAccountID) return;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                signal
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setKeywordLists(normalizeRulesToLists(data.rules || []));
            } else {
                setError(data.error || 'Failed to load rules');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('Error fetching comment moderation rules:', err);
            setError('Network error loading rules');
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            if (activeAccountID) {
                fetchRules(controller.signal);
            } else {
                setLoading(false);
            }
        }, 50);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [activeAccountID, fetchRules]);

    const addKeyword = (action: ModerationAction) => {
        const normalized = String(keywordInputs[action] || '').trim().toLowerCase();
        if (!normalized) return;

        const keywordTakenElsewhere = Object.entries(keywordLists).some(([listAction, keywords]) => (
            listAction !== action && keywords.includes(normalized)
        ));

        if (keywordTakenElsewhere) {
            setError(`"${normalized}" is already assigned to the other moderation action.`);
            return;
        }

        setKeywordLists((prev) => ({
            ...prev,
            [action]: prev[action].includes(normalized) ? prev[action] : [...prev[action], normalized]
        }));
        setKeywordInputs((prev) => ({ ...prev, [action]: '' }));
        setError(null);
    };

    const removeKeyword = (action: ModerationAction, keyword: string) => {
        setKeywordLists((prev) => ({
            ...prev,
            [action]: prev[action].filter((item) => item !== keyword)
        }));
    };

    const handleSave = async () => {
        if (!activeAccountID) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: moderationRulesFromLists(keywordLists) })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setSuccess('Comment moderation rules saved successfully.');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(data.error || 'Failed to save rules');
            }
        } catch (err) {
            console.error('Error saving comment moderation rules:', err);
            setError('Network error saving rules');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Comment Moderation"
                subMessage="Fetching your moderation keyword lists..."
            />
        );
    }

    if (!activeAccountID || !activeAccount) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px]">
                <Shield className="w-12 h-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-black text-foreground mb-2">Connect Instagram Account</h2>
                <p className="text-muted-foreground max-w-md text-center font-medium">Comment Moderation requires an active Instagram Business account.</p>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary" />
                        Comment Moderation
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                        Manage separate hide and delete keyword lists for comments on your posts and reels.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-destructive-muted/40 border border-destructive/20 rounded-2xl flex items-center gap-3 text-destructive text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 bg-success-muted/60 border border-success/30 rounded-2xl flex items-center gap-3 text-success text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {success}
                </div>
            )}

            <div className="mb-6 rounded-[2rem] border border-content bg-card/80 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Keyword Protection</p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Moderation keywords are kept exclusive. If a word is used here, it cannot be reused in automations or global triggers, and vice versa.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {(['hide', 'delete'] as ModerationAction[]).map((action) => {
                    const meta = ACTION_META[action];
                    const Icon = meta.icon;
                    const keywords = keywordLists[action];

                    return (
                        <div key={action} className={`rounded-[2rem] border shadow-xl overflow-hidden ${meta.accentClasses}`}>
                            <div className="p-6 sm:p-8 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card border border-content shadow-sm">
                                        <Icon className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">{meta.title}</h2>
                                        <p className="text-xs text-muted-foreground mt-1 font-medium">{meta.description}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Keywords</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={keywordInputs[action]}
                                            onChange={(e) => setKeywordInputs((prev) => ({ ...prev, [action]: e.target.value.toLowerCase() }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addKeyword(action);
                                                }
                                            }}
                                            placeholder={`Add a ${action} keyword...`}
                                            className="input-base flex-1 text-xs font-bold"
                                        />
                                        <button
                                            onClick={() => addKeyword(action)}
                                            className="btn-primary px-4 py-3 text-[9px] inline-flex items-center gap-2"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add
                                        </button>
                                    </div>

                                    {keywords.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-content/70 bg-card/60 px-4 py-6 text-center">
                                            <p className="text-xs font-medium text-muted-foreground">No keywords added yet.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {keywords.map((keyword) => (
                                                <div
                                                    key={`${action}-${keyword}`}
                                                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${meta.chipClasses}`}
                                                >
                                                    {keyword}
                                                    <button
                                                        onClick={() => removeKeyword(action, keyword)}
                                                        className="rounded p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary px-8 py-3 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Save Rules
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CommentModerationView;
