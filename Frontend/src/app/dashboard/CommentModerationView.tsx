import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNotification } from '../../contexts/NotificationContext';
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
    badgeClasses: string;
    chipClasses: string;
}> = {
    hide: {
        title: 'Hide Comments',
        description: 'Comments with these keywords stay hidden from public view automatically.',
        icon: Eye,
        badgeClasses: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        chipClasses: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15'
    },
    delete: {
        title: 'Delete Comments',
        description: 'Comments with these keywords are permanently deleted from your posts.',
        icon: Trash2,
        badgeClasses: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
        chipClasses: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15'
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
    const { showSuccess, showError } = useNotification();

    const fetchRules = useCallback(async (signal?: AbortSignal) => {
        if (!activeAccountID) return;
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                signal
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setKeywordLists(normalizeRulesToLists(data.rules || []));
            } else {
                showError(data.error || 'Failed to load rules');
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('Error fetching comment moderation rules:', err);
            showError('Network error loading rules');
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
            showError(`"${normalized}" is already assigned to the other moderation action.`);
            return;
        }

        setKeywordLists((prev) => ({
            ...prev,
            [action]: prev[action].includes(normalized) ? prev[action] : [...prev[action], normalized]
        }));
        setKeywordInputs((prev) => ({ ...prev, [action]: '' }));
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

        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules: moderationRulesFromLists(keywordLists) })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                showSuccess('Comment moderation rules saved successfully.');
            } else {
                showError(data.error || 'Failed to save rules');
            }
        } catch (err) {
            console.error('Error saving comment moderation rules:', err);
            showError('Network error saving rules');
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
            <div className="flex flex-col items-center justify-center h-[500px] p-6 max-w-md mx-auto text-center space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-inner">
                    <Shield className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-foreground tracking-tight">Connect Instagram Account</h2>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                        Comment Moderation requires an active Instagram Business account. Please link an account to continue.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/70">
                <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#405DE6]/10 via-[#833AB4]/10 to-[#FD1D1D]/10 text-[#833AB4] border border-[#833AB4]/20 shadow-xs">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                Comment Moderation
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Active Protection
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Automatically filter, hide, or permanently remove unwanted spam and toxic comments on your Instagram posts and reels.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-6 py-2.5 text-xs font-semibold text-white shadow-xs shadow-[#833AB4]/25 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>Save Rules</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Keyword Exclusivity Info */}
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5 flex items-start gap-3.5">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Shield className="h-4 w-4" />
                </div>
                <div>
                    <h3 className="text-xs font-semibold text-foreground">Keyword Exclusivity & Safe Isolation</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Keywords assigned here are strictly protected. They cannot overlap between Hide and Delete, and will never trigger or interfere with your active direct message keyword automations.
                    </p>
                </div>
            </div>

            {/* Moderation Action Cards */}
            <div className="grid gap-6 lg:grid-cols-2">
                {(['hide', 'delete'] as ModerationAction[]).map((action) => {
                    const meta = ACTION_META[action];
                    const Icon = meta.icon;
                    const keywords = keywordLists[action];

                    return (
                        <div
                            key={action}
                            className="rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs flex flex-col justify-between min-h-[480px]"
                        >
                            <div className="flex-1 flex flex-col space-y-5">
                                <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/60">
                                    <div className="flex items-center gap-3.5">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/60 border border-border/60 text-foreground">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-foreground tracking-tight">{meta.title}</h2>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${meta.badgeClasses}`}>
                                        {keywords.length} {keywords.length === 1 ? 'word' : 'words'}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-muted-foreground block">
                                        Add Filter Keyword
                                    </label>
                                    <div className="flex gap-2.5">
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
                                            placeholder={`Type a keyword and press Add or Enter...`}
                                            className="input-base flex-1 rounded-xl text-sm py-2.5 px-3.5"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => addKeyword(action)}
                                            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition active:scale-[0.98]"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col space-y-2 pt-1">
                                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                        <span>Configured Keywords</span>
                                        {keywords.length > 0 && (
                                            <span className="text-[11px] text-muted-foreground/60">
                                                Click × on any tag to remove
                                            </span>
                                        )}
                                    </div>

                                    {keywords.length === 0 ? (
                                        <div className="flex-1 min-h-[220px] rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center flex flex-col items-center justify-center">
                                            <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground mb-2">
                                                <Icon className="w-5 h-5 opacity-60" />
                                            </div>
                                            <p className="text-sm font-semibold text-muted-foreground">No keywords added</p>
                                            <p className="text-xs text-muted-foreground/60 mt-0.5">Add keywords above to enable automatic {meta.title.toLowerCase()}.</p>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto custom-scrollbar p-3.5 rounded-xl border border-border/60 bg-muted/10 flex flex-wrap content-start gap-2">
                                            {keywords.map((keyword) => (
                                                <div
                                                    key={`${action}-${keyword}`}
                                                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${meta.chipClasses}`}
                                                >
                                                    <span>{keyword}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeKeyword(action, keyword)}
                                                        className="rounded p-0.5 transition-colors hover:bg-foreground/10"
                                                        aria-label={`Remove keyword ${keyword}`}
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

            {/* Moderation Operational Guidelines */}
            <div className="grid gap-5 md:grid-cols-3 pt-2">
                <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                        01
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">Auto-Hide Spam</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Hidden comments remain visible only to the commenter, preventing spammers from noticing they have been muted while keeping your public community feed clean.
                    </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xs">
                        02
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">Permanent Deletion</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Toxic, abusive, or harmful comments containing blacklisted terms are permanently purged from your posts and reels instantly upon detection.
                    </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                        03
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">Zero Conflict System</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Moderation rules take immediate precedence over DM triggers. Flagged comments are quarantined before any automated reply workflows can fire.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CommentModerationView;
