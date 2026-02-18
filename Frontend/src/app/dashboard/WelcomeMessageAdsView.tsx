import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Megaphone, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle2, Loader2, Pencil, X, Save, MessageSquare, HelpCircle } from 'lucide-react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import TemplateSelector from '../../components/dashboard/TemplateSelector';

interface QuickReply {
    content_type: 'text';
    title: string;
    payload: string;
}

interface WelcomeMessageFlow {
    message: {
        text: string;
        quick_replies: QuickReply[];
    };
}

interface WelcomeMessageAd {
    id?: string;
    flow_id?: string;
    name: string;
    welcome_message_flow: WelcomeMessageFlow[];
    eligible_platforms: string[];
    is_used_in_ad?: boolean;
    db_synced?: boolean;
    db_id?: string;
    last_update_time?: string;
}

const WelcomeMessageAdsView: React.FC = () => {
    const { activeAccountID } = useDashboard();
    const { authenticatedFetch } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [flows, setFlows] = useState<WelcomeMessageAd[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editingFlow, setEditingFlow] = useState<WelcomeMessageAd | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [modal, setModal] = useState<{ open: boolean; title: string; description: string; type: 'danger' | 'info'; onConfirm: () => void }>({
        open: false, title: '', description: '', type: 'info', onConfirm: () => {}
    });
    const fetchingRef = useRef(false);
    const lastFetchedAccountIdRef = useRef<string | null>(null);

    const fetchFlows = useCallback(async () => {
        if (!activeAccountID) {
            setLoading(false);
            return;
        }

        // Prevent duplicate requests
        if (fetchingRef.current) {
            return;
        }

        // Skip if we already fetched for this account
        if (lastFetchedAccountIdRef.current === activeAccountID) {
            setLoading(false);
            return;
        }

        fetchingRef.current = true;
        setRefreshing(true);
        setError(null);
        try {
            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/welcome-message-ads?account_id=${activeAccountID}`
            );
            if (res.ok) {
                const data = await res.json();
                setFlows(data.flows || []);
                lastFetchedAccountIdRef.current = activeAccountID;
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to load flows.');
            }
        } catch (e) {
            setError('Network error.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        // Reset last fetched account ID when account changes
        if (lastFetchedAccountIdRef.current !== activeAccountID) {
            lastFetchedAccountIdRef.current = null;
        }
        fetchFlows();
    }, [activeAccountID, fetchFlows]);

    const handleCreate = () => {
        setEditingFlow({
            name: '',
            welcome_message_flow: [{
                message: {
                    text: '',
                    quick_replies: []
                }
            }],
            eligible_platforms: ['instagram']
        });
        setIsCreating(true);
    };

    const handleEdit = (flow: WelcomeMessageAd) => {
        setEditingFlow({ ...flow });
        setIsCreating(false);
    };

    const handleSave = async () => {
        if (!editingFlow || !activeAccountID) return;

        if (!editingFlow.name.trim()) {
            setError('Flow name is required.');
            return;
        }

        if (!editingFlow.welcome_message_flow[0]?.message?.text?.trim()) {
            setError('Welcome message text is required.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const url = editingFlow.flow_id
                ? `${import.meta.env.VITE_API_BASE_URL}/api/instagram/welcome-message-ads?account_id=${activeAccountID}&flow_id=${editingFlow.flow_id}`
                : `${import.meta.env.VITE_API_BASE_URL}/api/instagram/welcome-message-ads?account_id=${activeAccountID}`;

            const method = editingFlow.flow_id ? 'PATCH' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingFlow.name,
                    welcome_message_flow: editingFlow.welcome_message_flow,
                    eligible_platforms: editingFlow.eligible_platforms
                })
            });

            if (res.ok) {
                setEditingFlow(null);
                setIsCreating(false);
                fetchFlows();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save flow.');
            }
        } catch (e) {
            setError('Network error occurred.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (flow: WelcomeMessageAd) => {
        if (!flow.flow_id) return;

        if (flow.is_used_in_ad) {
            setError('Cannot delete flow that is currently used in an ad.');
            return;
        }

        setModal({
            open: true,
            title: 'Delete Welcome Message Flow?',
            description: 'This will permanently delete the flow from Instagram and your database. This action cannot be undone.',
            type: 'danger',
            onConfirm: async () => {
                setModal((m) => ({ ...m, open: false }));
                setDeletingId(flow.flow_id!);
                try {
                    const res = await authenticatedFetch(
                        `${import.meta.env.VITE_API_BASE_URL}/api/instagram/welcome-message-ads?account_id=${activeAccountID}&flow_id=${flow.flow_id}`,
                        { method: 'DELETE' }
                    );
                    if (res.ok) {
                        fetchFlows();
                    } else {
                        const data = await res.json();
                        setError(data.error || 'Failed to delete flow.');
                    }
                } catch (e) {
                    setError('Network error occurred.');
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    const addQuickReply = () => {
        if (!editingFlow) return;
        const currentReplies = editingFlow.welcome_message_flow[0]?.message?.quick_replies || [];
        if (currentReplies.length >= 13) {
            setError('Maximum 13 quick replies allowed.');
            return;
        }
        setEditingFlow({
            ...editingFlow,
            welcome_message_flow: [{
                message: {
                    ...editingFlow.welcome_message_flow[0].message,
                    quick_replies: [
                        ...currentReplies,
                        { content_type: 'text', title: '', payload: '' }
                    ]
                }
            }]
        });
    };

    const removeQuickReply = (index: number) => {
        if (!editingFlow) return;
        const currentReplies = [...(editingFlow.welcome_message_flow[0]?.message?.quick_replies || [])];
        currentReplies.splice(index, 1);
        setEditingFlow({
            ...editingFlow,
            welcome_message_flow: [{
                message: {
                    ...editingFlow.welcome_message_flow[0].message,
                    quick_replies: currentReplies
                }
            }]
        });
    };

    const updateQuickReply = (index: number, field: 'title' | 'payload', value: string) => {
        if (!editingFlow) return;
        const currentReplies = [...(editingFlow.welcome_message_flow[0]?.message?.quick_replies || [])];
        currentReplies[index] = { ...currentReplies[index], [field]: value };
        setEditingFlow({
            ...editingFlow,
            welcome_message_flow: [{
                message: {
                    ...editingFlow.welcome_message_flow[0].message,
                    quick_replies: currentReplies
                }
            }]
        });
    };

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-orange-600 rounded-[28%] flex items-center justify-center text-white mb-6 shadow-2xl shadow-amber-500/20">
                    <Megaphone className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Select Instagram Account</h2>
                <p className="text-gray-500 max-w-md mb-8 font-medium">Welcome Message Ads require an active Instagram Business account.</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingOverlay variant="fullscreen" message="Loading Welcome Message Ads" subMessage="Fetching your flows…" />;
    }

    if (editingFlow) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
                            {isCreating ? 'Create Welcome Message Flow' : 'Edit Welcome Message Flow'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Configure welcome message and quick replies for Click to Instagram Direct ads.</p>
                    </div>
                    <button
                        onClick={() => { setEditingFlow(null); setIsCreating(false); setError(null); }}
                        className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6 space-y-6">
                    {/* Flow Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-white">Flow Name *</label>
                        <input
                            type="text"
                            value={editingFlow.name}
                            onChange={(e) => setEditingFlow({ ...editingFlow, name: e.target.value })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="e.g., Welcome Flow 1"
                        />
                    </div>

                    {/* Welcome Message */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-900 dark:text-white">Welcome Message Text *</label>
                        <textarea
                            value={editingFlow.welcome_message_flow[0]?.message?.text || ''}
                            onChange={(e) => setEditingFlow({
                                ...editingFlow,
                                welcome_message_flow: [{
                                    message: {
                                        ...editingFlow.welcome_message_flow[0].message,
                                        text: e.target.value
                                    }
                                }]
                            })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px]"
                            placeholder="Enter your welcome message..."
                        />
                        <p className="text-xs text-gray-400">This message will be sent when someone clicks your ad.</p>
                    </div>

                    {/* Quick Replies */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900 dark:text-white">Quick Replies (Optional)</label>
                            <button
                                onClick={addQuickReply}
                                disabled={(editingFlow.welcome_message_flow[0]?.message?.quick_replies || []).length >= 13}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                Add Quick Reply
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">Add up to 13 quick reply buttons (max 20 characters each).</p>

                        <div className="space-y-3">
                            {(editingFlow.welcome_message_flow[0]?.message?.quick_replies || []).map((reply, index) => (
                                <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 mb-1 block">Button Text *</label>
                                            <input
                                                type="text"
                                                value={reply.title}
                                                onChange={(e) => updateQuickReply(index, 'title', e.target.value)}
                                                maxLength={20}
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                placeholder="Button text..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 mb-1 block">Payload *</label>
                                            <input
                                                type="text"
                                                value={reply.payload}
                                                onChange={(e) => updateQuickReply(index, 'payload', e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                placeholder="Webhook payload..."
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeQuickReply(index)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        <button
                            onClick={() => { setEditingFlow(null); setIsCreating(false); setError(null); }}
                            className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Save Flow'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Welcome Message Ads</h1>
                    <p className="text-sm text-gray-500 mt-1">Create and manage welcome message flows for Click to Instagram Direct ads.</p>
                </div>
                <div className="flex items-center gap-3">
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl text-xs font-bold border border-red-200 dark:border-red-500/20">
                            <AlertCircle className="w-3.5 h-3.5" /> {error}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => fetchFlows()}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> Create Flow
                    </button>
                </div>
            </div>

            {flows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
                    <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium mb-2">No welcome message flows yet</p>
                    <p className="text-sm text-muted-foreground mb-6">Create a flow to use in your Click to Instagram Direct ads.</p>
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold"
                    >
                        <Plus className="w-4 h-4" /> Create Flow
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {flows.map((flow) => (
                        <div
                            key={flow.id || flow.flow_id}
                            className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card hover:border-primary/20 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-900 dark:text-white">{flow.name}</span>
                                    {flow.is_used_in_ad && (
                                        <span className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase">Used in Ad</span>
                                    )}
                                    {!flow.db_synced && (
                                        <span className="px-2 py-0.5 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold uppercase">Not Synced</span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Message: {flow.welcome_message_flow[0]?.message?.text?.substring(0, 50) || '—'}...
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Quick Replies: {(flow.welcome_message_flow[0]?.message?.quick_replies || []).length}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleEdit(flow)}
                                    className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="Edit"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(flow)}
                                    disabled={deletingId === flow.flow_id || flow.is_used_in_ad}
                                    className="p-2 rounded-xl border border-border hover:bg-red-500/10 text-muted-foreground hover:text-red-500 disabled:opacity-50"
                                    title="Delete"
                                >
                                    {deletingId === flow.flow_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModernConfirmModal
                isOpen={modal.open}
                title={modal.title}
                description={modal.description}
                type={modal.type}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={modal.onConfirm}
                onCancel={() => setModal((m) => ({ ...m, open: false }))}
            />
        </div>
    );
};

export default WelcomeMessageAdsView;
