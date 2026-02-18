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
    const isFetchingRef = useRef(false);

    const fetchRules = useCallback(async () => {
        if (!activeAccountID) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/comment-moderation?account_id=${activeAccountID}`);
            if (res.ok) {
                const data = await res.json();
                setRules(data.rules || []);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to load rules');
            }
        } catch (err) {
            console.error('Error fetching comment moderation rules:', err);
            setError('Network error loading rules');
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        isFetchingRef.current = false;
    }, [activeAccountID]);

    useEffect(() => {
        if (activeAccountID) {
            fetchRules();
        } else {
            setLoading(false);
        }
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
                <Shield className="w-12 h-12 text-gray-400 mb-4" />
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Connect Instagram Account</h2>
                <p className="text-gray-500 max-w-md text-center font-medium">Comment Moderation requires an active Instagram Business account.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        Comment Moderation
                    </h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">
                        Automatically hide or delete comments containing specific keywords on your posts and reels.
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {success}
                </div>
            )}

            <div className="bg-white dark:bg-gray-950 rounded-[2rem] border border-content shadow-xl overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 dark:text-white">Moderation Rules</h2>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                Create rules to automatically hide or delete comments containing specific keywords
                            </p>
                        </div>
                        <button
                            onClick={addRule}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            Add Rule
                        </button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm text-gray-500 font-medium mb-2">No moderation rules yet</p>
                            <p className="text-xs text-gray-400">Click "Add Rule" to create your first moderation rule</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {rules.map((rule, ruleIndex) => (
                                <div key={ruleIndex} className="p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-sm">
                                                {ruleIndex + 1}
                                            </div>
                                            <h3 className="text-sm font-black text-gray-900 dark:text-white">Rule {ruleIndex + 1}</h3>
                                        </div>
                                        <button
                                            onClick={() => removeRule(ruleIndex)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Action</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => updateRuleAction(ruleIndex, 'hide')}
                                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                                                        rule.action === 'hide'
                                                            ? 'border-blue-500 bg-blue-500/5 text-blue-500'
                                                            : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    <Eye className="w-5 h-5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Hide</span>
                                                </button>
                                                <button
                                                    onClick={() => updateRuleAction(ruleIndex, 'delete')}
                                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                                                        rule.action === 'delete'
                                                            ? 'border-red-500 bg-red-500/5 text-red-500'
                                                            : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Keywords</label>
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
                                                    className="flex-1 bg-white dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 outline-none rounded-xl py-2.5 px-4 text-xs font-bold"
                                                />
                                                <button
                                                    onClick={() => addKeywordToRule(ruleIndex)}
                                                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            {rule.keywords.length === 0 ? (
                                                <p className="text-xs text-gray-400 italic">No keywords added yet</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {rule.keywords.map((keyword, keywordIndex) => (
                                                        <div
                                                            key={keywordIndex}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        >
                                                            {keyword}
                                                            <button
                                                                onClick={() => removeKeywordFromRule(ruleIndex, keywordIndex)}
                                                                className="hover:bg-blue-700 rounded p-0.5 transition-colors"
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

                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
