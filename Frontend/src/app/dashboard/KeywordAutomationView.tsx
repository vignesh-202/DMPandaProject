import React, { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import {
    MessageSquare, Plus, Trash2, Save, AlertCircle,
    MousePointerClick, Smartphone, Loader2, Instagram, CheckCircle2,
    Pencil, Lightbulb, Power, Image, FileText, Reply, Link as LinkIcon, ChevronRight
} from 'lucide-react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';

interface Automation {
    $id?: string;
    keyword: string;
    title: string;
    template_type: 'template_text' | 'template_media' | 'template_quick_replies' | 'template_url' | 'template_media_attachment';
    template_id: string;
    active: boolean;
    created_at?: string;
}

const MobilePreview = React.memo(({ automation }: { automation: any }) => {
    return (
        <div className="relative w-[300px] h-[600px] mx-auto bg-black rounded-[50px] border-[8px] border-gray-900 shadow-[0_0_60px_rgba(0,0,0,0.15)] overflow-hidden scale-95 origin-top lg:scale-100">
            {/* ... same mobile-frame code from ConvoStarterView ... */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-3xl z-40 flex items-center justify-center">
                <div className="w-10 h-1.5 bg-gray-800 rounded-full" />
            </div>
            {/* Status Bar */}
            <div className="absolute top-0 left-0 w-full h-10 flex justify-between items-center px-8 pt-3 z-30 text-[11px] font-bold dark:text-white text-gray-900">
                <span>9:41</span>
                <div className="flex gap-1.5 items-center">
                    <div className="w-4 h-4 border-2 border-current rounded-[3px]" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full" />
                </div>
            </div>

            <div className="h-full bg-white dark:bg-black flex flex-col pt-10">
                {/* Nav Bar */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-900 flex items-center justify-between z-20 bg-white dark:bg-black">
                    <div className="flex items-center gap-3">
                        <div className="text-gray-400"><Instagram className="w-5 h-5" /></div>
                        <div>
                            <div className="text-[12px] font-bold dark:text-white">Preview</div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex justify-start">
                        <div className="max-w-[80%] p-3 bg-gray-100 dark:bg-gray-900 rounded-2xl rounded-bl-sm text-[12px]">
                            Keyword triggered: <span className="font-bold underline text-blue-500">{automation?.keyword || '...'}</span>
                        </div>
                    </div>
                    <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-500">
                        <div className="max-w-[80%] p-3 bg-blue-500 text-white rounded-2xl rounded-br-sm text-[12px] shadow-lg shadow-blue-500/20">
                            {automation?.template_type === 'template_text' && (automation?.template_content || 'Text message response...')}
                            {automation?.template_type === 'template_url' && 'Redirecting to: ' + (automation?.template_content || 'https://...')}
                            {automation?.template_type === 'template_media' && 'Media Template...'}
                            {automation?.template_type === 'template_media_attachment' && 'Media Attachment...'}
                            {automation?.template_type === 'template_quick_replies' && 'Quick Replies...'}
                            {!automation?.template_type && 'AI Response...'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

const KeywordAutomationView: React.FC = () => {
    const { activeAccountID, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
    const { authenticatedFetch, user } = useAuth();
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingAutomation, setEditingAutomation] = useState<any>(null);

    // Track unsaved changes when editing automation
    useEffect(() => {
        if (editingAutomation) {
            setHasUnsavedChanges(true);
            setSaveUnsavedChanges(() => async () => {
                // Since the save logic is handled inline, we just need to wait for it to complete
                return true;
            });
            setDiscardUnsavedChanges(() => () => {
                setEditingAutomation(null);
            });
        } else {
            setHasUnsavedChanges(false);
        }
    }, [editingAutomation, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        description: '',
        type: 'info',
        onConfirm: () => { }
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const fetchAutomations = useCallback(async () => {
        if (!activeAccountID) {
            setLoading(false);
            return;
        }

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=dm`);
            const data = await res.json();
            if (res.ok) {
                setAutomations(data.documents || []);
            }
        } catch (err) {
            console.error("Failed to fetch automations", err);
            setError("Could not load your DM automations.");
        } finally {
            setLoading(false);
        }
    }, [activeAccountID, authenticatedFetch]);

    // Clear success/error messages when account changes
    useEffect(() => {
        setSuccess(null);
        setError(null);
    }, [activeAccountID]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    const handleCreate = () => {
        setEditingAutomation({
            title: 'New Automation',
            keyword: '',
            template_type: 'template_text',
            template_content: '',
            active: true
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}`, {
                method: editingAutomation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editingAutomation, type: 'dm' })
            });

            if (res.ok) {
                setSuccess("Automation saved successfully!");
                setEditingAutomation(null);
                setHasUnsavedChanges(false);
                fetchAutomations();
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save automation.");
            }
        } catch (err) {
            setError("Network error occurred.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Rule?',
            description: 'Are you sure you want to delete this automation rule? This action cannot be undone.',
            type: 'danger',
            confirmLabel: 'Delete Now',
            onConfirm: async () => {
                closeModal();
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        fetchAutomations();
                    } else {
                        const data = await res.json();
                        setError(data.error || "Failed to delete.");
                    }
                } catch (err) {
                    setError("Failed to delete.");
                }
            }
        });
    };

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-400 to-indigo-600 rounded-[28%] flex items-center justify-center text-white mb-6 shadow-2xl shadow-blue-500/20">
                    <MessageSquare className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Select Instagram Account</h2>
                <p className="text-gray-500 max-w-md mb-8 font-medium">Keywords-based DM Automation requires an active Instagram Business link.</p>
            </div>
        );
    }

    if (editingAutomation) {
        return (
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-12">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-8">
                    <button onClick={() => setEditingAutomation(null)} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">
                        &larr; Back to List
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {editingAutomation.$id ? 'Update Rule' : 'Create Rule'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-7 space-y-8">
                        <section className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Basic Configuration</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Automation Title</label>
                                    <input
                                        value={editingAutomation.title}
                                        onChange={e => setEditingAutomation({ ...editingAutomation, title: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-gray-950 border-none rounded-2xl py-4 px-6 text-sm font-bold shadow-inner"
                                        placeholder="e.g., Pricing FAQ"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Trigger Keyword</label>
                                    <div className="relative">
                                        <input
                                            value={editingAutomation.keyword}
                                            onChange={e => setEditingAutomation({ ...editingAutomation, keyword: e.target.value })}
                                            className="w-full bg-blue-50 dark:bg-blue-900/10 border-none rounded-2xl py-4 px-6 text-sm font-black text-blue-600 dark:text-blue-400 shadow-inner placeholder:text-blue-300"
                                            placeholder="e.g., PRICE"
                                        />
                                        <Instagram className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Response Template</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { id: 'template_text', icon: FileText, label: 'Text' },
                                    { id: 'template_media', icon: Smartphone, label: 'Media' },
                                    { id: 'template_media_attachment', icon: Image, label: 'Media attachments' },
                                    { id: 'template_quick_replies', icon: Reply, label: 'Quick replies' },
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setEditingAutomation({ ...editingAutomation, template_type: type.id })}
                                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${editingAutomation.template_type === type.id
                                            ? 'border-blue-500 bg-blue-500/5 text-blue-500'
                                            : 'border-transparent bg-gray-50 dark:bg-gray-950 text-gray-400 grayscale hover:grayscale-0'
                                            }`}
                                    >
                                        <type.icon className="w-5 h-5" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{type.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="p-6 bg-white dark:bg-gray-950 rounded-3xl border border-content shadow-xl">
                                {editingAutomation.template_type === 'template_text' && (
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Message Content</label>
                                        <textarea
                                            value={editingAutomation.template_content}
                                            onChange={e => setEditingAutomation({ ...editingAutomation, template_content: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 text-xs font-bold min-h-[120px]"
                                            placeholder="Write your message here..."
                                        />
                                    </div>
                                )}
                                {editingAutomation.template_type === 'template_url' && (
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Destination URL</label>
                                        <input
                                            value={editingAutomation.template_content}
                                            onChange={e => setEditingAutomation({ ...editingAutomation, template_content: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-2xl p-4 text-xs font-bold"
                                            placeholder="https://yourlink.com"
                                        />
                                    </div>
                                )}
                                {/* Others can be implemented as needed */}
                                {['template_media_attachment', 'template_quick_replies'].includes(editingAutomation.template_type) && (
                                    <div className="py-8 text-center">
                                        <p className="text-xs font-bold text-gray-400 italic">Advanced template builder coming soon...</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="lg:col-span-5 hidden lg:block">
                        <div className="lg:sticky lg:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
                            <MobilePreview automation={editingAutomation} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 dark:border-gray-800 pb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Direct Messaging</span>
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">DM Automation</h1>
                    <p className="text-gray-500 font-medium max-w-xl">
                        Keywords-based responses. When a user sends a keyword, DMPanda replies automatically.
                    </p>
                </div>

                <button
                    onClick={handleCreate}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2"
                >
                    <Plus className="w-3 h-3" /> Create New AI Rule
                </button>
            </div>

            {loading ? (
                <LoadingOverlay variant="fullscreen" message="Loading DM Automation" subMessage="Fetching your rules..." />
            ) : automations.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-20 text-center">
                    <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-6" />
                    <h4 className="text-gray-900 dark:text-white font-black text-xl mb-2">No active rules</h4>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto">Click "Create New" to start automating your Instagram inbox with AI powered responses.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {automations.map((auto) => (
                        <div key={auto.$id} className="group bg-white dark:bg-gray-950 border border-content rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-blue-500/30 transition-all duration-500">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                        {auto.template_type === 'template_text' && <FileText className="w-7 h-7" />}
                                        {auto.template_type === 'template_media' && <Smartphone className="w-7 h-7" />}
                                        {auto.template_type === 'template_media_attachment' && <Image className="w-7 h-7" />}
                                        {auto.template_type === 'template_quick_replies' && <Reply className="w-7 h-7" />}
                                        {auto.template_type === 'template_url' && <LinkIcon className="w-7 h-7" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white">{auto.title || 'Untitled Rule'}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">{auto.keyword}</span>
                                            <span className="text-[10px] font-bold text-gray-400 capitalize">{auto.template_type.replace('template_', '').replace('_', ' ')} Response</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditingAutomation(auto)}
                                        className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-blue-500 rounded-xl transition-all"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(auto.$id!)}
                                        className="p-3 bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-800 mx-2" />
                                    <button
                                        className={`p-3 rounded-xl transition-all ${auto.active ? 'bg-green-500/10 text-green-500' : 'bg-gray-100 text-gray-400'}`}
                                    >
                                        <Power className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ModernConfirmModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                description={modalConfig.description}
                type={modalConfig.type}
                confirmLabel={modalConfig.confirmLabel}
                cancelLabel={modalConfig.cancelLabel}
            />
        </div>
    );
};

export default KeywordAutomationView;
