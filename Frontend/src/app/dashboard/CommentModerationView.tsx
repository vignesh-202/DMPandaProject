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
    accentClasses: string;
    chipClasses: string;
    buttonClasses: string;
    inputBorderClasses: string;
}> = {
    hide: {
        title: 'Hide Comments',
        description: 'Comments with these keywords stay out of sight without removing them permanently.',
        icon: Eye,
        accentClasses: 'border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent hover:border-blue-500/40 dark:from-blue-500/5 dark:to-transparent',
        chipClasses: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20',
        buttonClasses: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35',
        inputBorderClasses: 'focus:border-blue-500'
    },
    delete: {
        title: 'Delete Comments',
        description: 'Comments with these keywords are removed completely from the thread.',
        icon: Trash2,
        accentClasses: 'border-rose-500/20 bg-gradient-to-b from-rose-500/5 to-transparent hover:border-rose-500/40 dark:from-rose-500/5 dark:to-transparent',
        chipClasses: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20',
        buttonClasses: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35',
        inputBorderClasses: 'focus:border-rose-500'
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
        <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-6xl mx-auto space-y-8 pb-32">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                        <Shield className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent dark:from-violet-400 dark:via-fuchsia-400 dark:to-pink-400">
                                Comment Moderation
                            </h1>
                            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                                Active Protection
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 font-medium leading-relaxed">
                            Manage separate hide and delete keyword lists for comments on your posts and reels.
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -left-16 -bottom-16 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
                
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Keyword Exclusivity Rules
                </p>
                <p className="mt-3 text-sm leading-relaxed font-medium text-muted-foreground max-w-4xl">
                    Moderation keywords are kept strictly exclusive. If a word is used here, it cannot be reused in automations or global triggers, and vice versa. This prevents conflicting automation paths.
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {(['hide', 'delete'] as ModerationAction[]).map((action) => {
                    const meta = ACTION_META[action];
                    const Icon = meta.icon;
                    const keywords = keywordLists[action];

                    return (
                        <div key={action} className={`group relative rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl ${meta.accentClasses}`}>
                            <div className="p-6 sm:p-8 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card border border-slate-200/80 dark:border-slate-800/80 shadow-md group-hover:scale-110 transition-transform duration-300">
                                        <Icon className="w-6 h-6 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-foreground tracking-tight">{meta.title}</h2>
                                        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-relaxed">{meta.description}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/80 block">
                                        Keywords List
                                    </label>
                                    <div className="flex gap-2">
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
                                            className={`input-base flex-1 rounded-2xl border-2 border-content bg-card/90 py-3.5 px-5 text-xs font-bold outline-none transition-all focus:bg-card ${meta.inputBorderClasses}`}
                                        />
                                        <button
                                            onClick={() => addKeyword(action)}
                                            className={`px-5 py-3.5 text-[10px] font-black uppercase tracking-wider rounded-2xl flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${meta.buttonClasses}`}
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add</span>
                                        </button>
                                    </div>

                                    {keywords.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-card/40 px-4 py-8 text-center flex flex-col items-center justify-center">
                                            <p className="text-xs font-semibold text-muted-foreground">No keywords added yet</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-1">Comments will not trigger {meta.title.toLowerCase()}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                                            {keywords.map((keyword) => (
                                                <div
                                                    key={`${action}-${keyword}`}
                                                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] ${meta.chipClasses}`}
                                                >
                                                    <span>{keyword}</span>
                                                    <button
                                                        onClick={() => removeKeyword(action, keyword)}
                                                        className="rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/20"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
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

            {/* Sticky Bottom Save Bar */}
            <div className="sticky bottom-6 flex items-center justify-between rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg p-4 shadow-2xl w-full z-50 animate-in slide-in-from-bottom-6 duration-300">
                <div className="hidden sm:flex items-center gap-2.5 text-xs font-bold text-muted-foreground ml-4">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                    <span>Changes apply instantly to new comments</span>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="group relative w-full sm:w-auto flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] sm:hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {saving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving Rules...</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 transition-transform group-hover:scale-110" />
                            <span>Save Moderation Rules</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CommentModerationView;

