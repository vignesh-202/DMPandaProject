import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { Shield, Plus, Trash2, Eye, X, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

interface ModerationRule {
    keywords: string[];
    action: 'hide' | 'delete';
}

const CommentModerationView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount } = useDashboard();
    const [rules, setRules] = useState<ModerationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [newKeyword, setNewKeyword] = useState('');
    const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
    const fetchRules = useCallback(async (signal?: AbortSignal) => {
        if (!activeAccountID) return;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                signal
            });
            if (res.ok) {
                const data = await res.json();
                setRules(data.rules || []);
            } else {
                const data = await res.json();
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
        }, 50); // Small debounce to prevent double-fetch in Strict Mode

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [activeAccountID, fetchRules]);

    const handleSave = async () => {
        if (!activeAccountID) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/comment-moderation?account_id=${activeAccountID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rules })
            });
            if (res.ok) {
                setSuccess('Comment moderation rules saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save rules');
            }
        } catch (err) {
            console.error('Error saving comment moderation rules:', err);
            setError('Network error saving rules');
        } finally {
            setSaving(false);
        }
    };

    const addRule = () => {
        setRules([...rules, { keywords: [], action: 'hide' }]);
        setEditingRuleIndex(rules.length);
    };

    const removeRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
        if (editingRuleIndex === index) setEditingRuleIndex(null);
        else if (editingRuleIndex !== null && editingRuleIndex > index) setEditingRuleIndex(editingRuleIndex - 1);
    };

    const addKeywordToRule = (ruleIndex: number) => {
        if (!newKeyword.trim()) return;
        const updatedRules = [...rules];
        if (!updatedRules[ruleIndex].keywords) updatedRules[ruleIndex].keywords = [];
        if (!updatedRules[ruleIndex].keywords.includes(newKeyword.trim().toLowerCase())) {
            updatedRules[ruleIndex].keywords.push(newKeyword.trim().toLowerCase());
        }
        setRules(updatedRules);
        setNewKeyword('');
    };

    const removeKeywordFromRule = (ruleIndex: number, keywordIndex: number) => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].keywords.splice(keywordIndex, 1);
        setRules(updatedRules);
    };

    const updateRuleAction = (ruleIndex: number, action: 'hide' | 'delete') => {
        const updatedRules = [...rules];
        updatedRules[ruleIndex].action = action;
        setRules(updatedRules);
    };

    if (loading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Comment Moderation"
                subMessage="Fetching your moderation rules..."
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
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
                        <Shield className="w-8 h-8 text-primary" />
                        Comment Moderation
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                        Automatically hide or delete comments containing specific keywords on your posts and reels.
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

            <div className="bg-card rounded-[2rem] border border-content shadow-xl overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-foreground">Moderation Rules</h2>
                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                                Create rules to automatically hide or delete comments containing specific keywords
                            </p>
                        </div>
                        <button
                            onClick={addRule}
                            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add Rule
                        </button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
                            <Shield className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground font-medium mb-2">No moderation rules yet</p>
                            <p className="text-xs text-muted-foreground">Click "Add Rule" to create your first moderation rule</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rules.map((rule, ruleIndex) => (
                                <div key={ruleIndex} className="p-6 bg-muted/40 rounded-2xl border border-border space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                                                {ruleIndex + 1}
                                            </div>
                                            <h3 className="text-sm font-black text-foreground">Rule {ruleIndex + 1}</h3>
                                        </div>
                                        <button
                                            onClick={() => removeRule(ruleIndex)}
                                            className="p-2 text-destructive hover:bg-destructive-muted/60 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Action</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => updateRuleAction(ruleIndex, 'hide')}
                                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${rule.action === 'hide'
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/60'
                                                        }`}
                                                >
                                                    <Eye className="w-5 h-5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Hide</span>
                                                </button>
                                                <button
                                                    onClick={() => updateRuleAction(ruleIndex, 'delete')}
                                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${rule.action === 'delete'
                                                        ? 'border-destructive bg-destructive-muted/40 text-destructive'
                                                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/60'
                                                        }`}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Keywords</label>
                                            <div className="flex gap-2 mb-3">
                                                <input
                                                    type="text"
                                                    value={newKeyword}
                                                    onChange={(e) => setNewKeyword(e.target.value.toLowerCase())}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addKeywordToRule(ruleIndex);
                                                        }
                                                    }}
                                                    placeholder="Type keyword and press Enter..."
                                                    className="flex-1 bg-card border-2 border-transparent focus:border-primary outline-none rounded-xl py-2.5 px-4 text-xs font-bold"
                                                />
                                                <button
                                                    onClick={() => addKeywordToRule(ruleIndex)}
                                                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            {rule.keywords.length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic">No keywords added yet</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {rule.keywords.map((keyword, keywordIndex) => (
                                                        <div
                                                            key={keywordIndex}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            {keyword}
                                                            <button
                                                                onClick={() => removeKeywordFromRule(ruleIndex, keywordIndex)}
                                                                className="hover:bg-primary/90 rounded p-0.5 transition-colors"
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
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-border">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
        </div>
    );
};

export default CommentModerationView;

