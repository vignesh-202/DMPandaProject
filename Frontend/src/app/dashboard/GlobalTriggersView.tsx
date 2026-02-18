// Global Triggers View - DM Automation Style
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import {
    MessageSquare, Plus, Trash2, Save, AlertCircle, Radio, BookText,
    MousePointerClick, Smartphone, Loader2, Instagram, CheckCircle2, Globe, Pencil, Lightbulb, PencilLine, HelpCircle, Film, RefreshCcw, Calendar, ChevronDown, Check, Info, ArrowLeft, MoreHorizontal, Settings, X, Search,
    Image as ImageIcon, Video, Music, FileText, Share2, Reply, ChevronRight, Link as LinkIcon, Power, LayoutTemplate, Zap
} from 'lucide-react';
import ModernCalendar from '../../components/ui/ModernCalendar';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import MobilePreview from '../../components/dashboard/MobilePreview';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import {
    getByteLength,
    AUTOMATION_TITLE_MAX,
    TEXT_MAX,
    BUTTON_TITLE_MAX,
    QUICK_REPLY_TITLE_MAX,
    QUICK_REPLY_PAYLOAD_MAX,
    CAROUSEL_TITLE_MAX,
    CAROUSEL_SUBTITLE_MAX,
} from '../../lib/templateLimits';

const GlobalTriggersView: React.FC = () => {
    const { activeAccountID, activeAccount, globalTriggers, setGlobalTriggers, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
    const { authenticatedFetch } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingTrigger, setEditingTrigger] = useState<any>(null);
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [replyTemplatesList, setReplyTemplatesList] = useState<ReplyTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [refreshing, setRefreshing] = useState(false);
    const fetchingRef = useRef(false);

    const fetchTriggers = useCallback(async (isManual = false) => {
        if (!activeAccountID) return;
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        if (!isManual) setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=global`
            );
            const data = await res.json();
            if (res.ok) {
                setGlobalTriggers(data.documents || []);
            } else {
                setError(data.error || 'Failed to load global triggers.');
            }
        } catch (e) {
            setError('Network error.');
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, authenticatedFetch, setGlobalTriggers]);

    const handleTemplatesLoaded = useCallback((templates: ReplyTemplate[]) => {
        setReplyTemplatesList(templates);
    }, []);

    useEffect(() => {
        fetchTriggers();
    }, [fetchTriggers]);

    const handleCreateNew = () => {
        setEditingTrigger({
            title: '',
            keyword: [],
            template_type: 'template_text',
            template_content: '',
            followers_only: false
        });
        setSelectedTemplateId('');
        setHasUnsavedChanges(true);
        setSaveUnsavedChanges(() => async () => {
            // Will be handled by AutomationEditor
            return true;
        });
        setDiscardUnsavedChanges(() => () => {
            setEditingTrigger(null);
            setSelectedTemplateId('');
            setHasUnsavedChanges(false);
        });
    };

    const handleEdit = (trigger: any) => {
        setEditingTrigger(trigger);
        setSelectedTemplateId(trigger.template_id || '');
        setHasUnsavedChanges(true);
        setSaveUnsavedChanges(() => async () => {
            // Will be handled by AutomationEditor
            return true;
        });
        setDiscardUnsavedChanges(() => () => {
            setEditingTrigger(null);
            setSelectedTemplateId('');
            setHasUnsavedChanges(false);
        });
    };

    const handleClose = () => {
        setEditingTrigger(null);
        setSelectedTemplateId('');
        setHasUnsavedChanges(false);
    };

    const handleSave = useCallback(async () => {
        if (!editingTrigger) return;
        setSaving(true);
        try {
            const payload = {
                ...editingTrigger,
                account_id: activeAccountID,
                type: 'global'
            };

            const url = editingTrigger.$id
                ? `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${editingTrigger.$id}`
                : `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations`;
            const method = editingTrigger.$id ? 'PUT' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (editingTrigger.$id) {
                    setGlobalTriggers((prev: any) => prev.map((x: any) => (x.$id === editingTrigger.$id ? data : x)));
                } else {
                    setGlobalTriggers((prev: any) => [data, ...prev]);
                }
                setSuccess(editingTrigger.$id ? 'Global trigger updated!' : 'Global trigger created!');
                setTimeout(() => setSuccess(null), 3000);
                handleClose();
                fetchTriggers(true);
            } else {
                const errorData = await res.json();
                setError(errorData.error || 'Failed to save trigger.');
                setTimeout(() => setError(null), 5000);
            }
        } catch (e) {
            setError('Network error.');
            setTimeout(() => setError(null), 5000);
        } finally {
            setSaving(false);
        }
    }, [editingTrigger, activeAccountID, authenticatedFetch, setGlobalTriggers, handleClose, fetchTriggers]);

    const handleToggleActive = async (trigger: any) => {
        setTogglingIds((s) => new Set(s).add(trigger.$id));
        const next = !trigger.active;
        setGlobalTriggers((prev: any) => prev.map((x: any) => (x.$id === trigger.$id ? { ...x, active: next } : x)));

        try {
            await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${trigger.$id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: next })
            });
        } catch {
            setGlobalTriggers((prev: any) => prev.map((x: any) => (x.$id === trigger.$id ? { ...x, active: !!trigger.active } : x)));
        } finally {
            setTogglingIds((s) => { const n = new Set(s); n.delete(trigger.$id); return n; });
        }
    };

    const handleDelete = (id: string) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Global Trigger?',
            description: 'This cannot be undone. The trigger will be removed.',
            type: 'danger',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                setModalConfig((prev) => ({ ...prev, isOpen: false }));
                setDeletingIds((s) => new Set(s).add(id));
                try {
                    await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}`, {
                        method: 'DELETE'
                    });
                    setGlobalTriggers((prev: any) => prev.filter((x: any) => x.$id !== id));
                } finally {
                    setDeletingIds((s) => { const n = new Set(s); n.delete(id); return n; });
                }
            }
        });
    };

    const handleEditorChange = useCallback(() => {
        setHasUnsavedChanges(true);
    }, [setHasUnsavedChanges]);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmLabel?: string;
        cancelLabel?: string;
        secondaryLabel?: string;
        onConfirm: () => void;
        onSecondary?: () => void;
        oneButton?: boolean;
    }>({
        isOpen: false,
        title: '',
        description: '',
        type: 'info',
        onConfirm: () => { }
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-orange-600 rounded-[28%] flex items-center justify-center text-white mb-6 shadow-2xl shadow-amber-500/20">
                    <Globe className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Select Instagram Account</h2>
                <p className="text-gray-500 max-w-md mb-8 font-medium">Global Triggers require an active Instagram Business account.</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingOverlay variant="fullscreen" message="Loading Global Triggers" subMessage="Fetching your rules…" />;
    }

    return (
        <div className="max-w-[1400px] mx-auto py-8 px-6 space-y-8 min-h-screen">
            {/* Editor Mode */}
            {editingTrigger ? (
                <>
                <div className="flex items-center justify-between border-b border-content pb-6">
                    <button onClick={handleClose} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
                        <ChevronRight className="w-4 h-4 rotate-180" /> Back to Dashboard
                    </button>
                    <div className="flex items-center gap-3">
                        {error && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black border border-red-200 dark:border-red-500/20 animate-in fade-in slide-in-from-right-2">
                                <AlertCircle className="w-3 h-3" /> {error}
                            </div>
                        )}
                        {success && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-500/10 text-green-500 rounded-lg text-[10px] font-black border border-green-200 dark:border-green-500/20 animate-in fade-in slide-in-from-right-2">
                                <CheckCircle2 className="w-3 h-3" /> {success}
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:h-[calc(100vh-11rem)] xl:min-h-0">
                    {/* Left: Editor - scrollable on xl */}
                    <div className="xl:col-span-8 space-y-8 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
                        <section className="bg-white dark:bg-gray-950 p-8 rounded-[40px] border border-content shadow-sm space-y-8">
                            <AutomationEditor
                                type="global"
                                isStandalone={false}
                                useParentLayout
                                activeAccountID={activeAccountID}
                                authenticatedFetch={authenticatedFetch}
                                automationId={editingTrigger.$id || undefined}
                                onClose={() => {}}
                                onSave={handleSave}
                                onDelete={editingTrigger.$id ? async (id) => { await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}`, { method: 'DELETE' }); handleSave(); } : undefined}
                                onChange={handleEditorChange}
                                onTemplateSelect={(templateId) => setSelectedTemplateId(templateId || '')}
                                onTemplatesLoaded={handleTemplatesLoaded}
                                titleOverride=""
                            />
                        </section>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="xl:col-span-4 order-1 xl:order-2">
                        <div className="xl:sticky xl:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
                            <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
                                {success && (
                                    <div className="bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span className="font-bold text-sm">{success}</span>
                                    </div>
                                )}
                                {error && (
                                    <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="font-bold text-sm">{error}</span>
                                    </div>
                                )}
                            </div>

                            {/* Live Preview */}
                            <div className="space-y-4">
                                {selectedTemplateId ? (
                                    (() => {
                                        const template = replyTemplatesList.find(t => t.id === selectedTemplateId);
                                        if (template) {
                                            const displayName = activeAccount?.username || 'your_account';
                                            const profilePic = activeAccount?.profile_picture_url ?? undefined;

                                            const previewAutomation = {
                                                template_type: template.template_type,
                                                template_content: template.template_type === 'template_text' ? template.template_data?.text :
                                                    template.template_type === 'template_media' ? template.template_data?.media_url :
                                                        template.template_type === 'template_quick_replies' ? template.template_data?.text : undefined,
                                                template_elements: template.template_type === 'template_carousel' ? template.template_data?.elements : undefined,
                                                replies: template.template_type === 'template_quick_replies' ? template.template_data?.replies : undefined,
                                                buttons: template.template_type === 'template_buttons' ? template.template_data?.buttons : undefined,
                                                media_id: template.template_type === 'template_share_post' ? template.template_data?.media_id : undefined,
                                                media_url: template.template_type === 'template_share_post' ? template.template_data?.media_url : undefined,
                                                use_latest_post: template.template_type === 'template_share_post' ? template.template_data?.use_latest_post : undefined,
                                                latest_post_type: template.template_type === 'template_share_post' ? template.template_data?.latest_post_type : undefined,
                                                keyword: editingTrigger.keyword?.[0] || editingTrigger.title || 'Trigger message',
                                            };

                                            return (
                                                <div className="bg-gray-50 dark:bg-black p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                                                    <MobilePreview automation={previewAutomation} displayName={displayName} profilePic={profilePic} />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                ) : (
                                    <div className="bg-gray-50 dark:bg-black p-8 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 min-h-[400px]">
                                        <div className="text-center space-y-2">
                                            <LayoutTemplate className="w-12 h-12 text-muted-foreground mx-auto" />
                                            <p className="text-sm font-bold text-muted-foreground">Select a reply template</p>
                                            <p className="text-xs text-muted-foreground">Choose from the Reply Templates section</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                </>
            ) : (
                /* List Mode */
                <>
                {/* Header - same layout as DM Automation */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-700 pb-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-purple-600 mb-2">
                            <Globe className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Global Triggers</span>
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Global Triggers</h1>
                        <p className="text-gray-500 font-medium max-w-xl">
                            Global triggers apply across all your content. When keywords are detected in comments, stories, or live sessions, DMPanda replies automatically.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => { setRefreshing(true); fetchTriggers(true).finally(() => setRefreshing(false)); }}
                            disabled={loading || refreshing}
                            className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-500 hover:text-purple-600 rounded-2xl transition-all border border-content disabled:opacity-50"
                        >
                            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleCreateNew}
                            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20 flex items-center gap-2"
                        >
                            <Plus className="w-3 h-3" /> Create New Rule
                        </button>
                    </div>
                </div>

                {globalTriggers.length === 0 ? (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-20 text-center">
                        <Globe className="w-12 h-12 text-gray-300 mx-auto mb-6" />
                        <h4 className="text-gray-900 dark:text-white font-black text-xl mb-2">No global triggers yet</h4>
                        <p className="text-gray-500 text-sm max-w-sm mx-auto mb-8">Create your first global trigger to automatically respond to keywords across all your Instagram content.</p>
                        <button
                            onClick={handleCreateNew}
                            className="mx-auto px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 hover:scale-105"
                        >
                            <Plus className="w-4 h-4" />
                            Create Your First Trigger
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {globalTriggers.map((trigger: any) => {
                            const isToggling = togglingIds.has(trigger.$id);
                            const isDeleting = deletingIds.has(trigger.$id);
                            const t = trigger.template_type || 'template_text';
                            return (
                                <div key={trigger.$id} className="relative group bg-white dark:bg-gray-950 border border-content rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-purple-500/30 transition-all duration-500 overflow-hidden">
                                    {isDeleting && (
                                        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md rounded-3xl flex items-center justify-center animate-in fade-in duration-300">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 transition-all">Removing Trigger...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                                                {t === 'template_text' && <FileText className="w-7 h-7" />}
                                                {t === 'template_carousel' && <Smartphone className="w-7 h-7" />}
                                                {t === 'template_buttons' && <MousePointerClick className="w-7 h-7" />}
                                                {t === 'template_media' && <ImageIcon className="w-7 h-7" />}
                                                {t === 'template_quick_replies' && <Reply className="w-7 h-7" />}
                                                {t === 'template_share_post' && <Share2 className="w-7 h-7" />}
                                                {!['template_text', 'template_carousel', 'template_buttons', 'template_media', 'template_quick_replies', 'template_share_post'].includes(t) && <Globe className="w-7 h-7" />}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-gray-900 dark:text-white">{trigger.title || 'Untitled Trigger'}</h4>
                                                {trigger.template_content && t === 'template_text' && (
                                                    <p className="text-[10px] text-gray-400 line-clamp-1 mb-1 font-medium italic">&quot;{trigger.template_content}&quot;</p>
                                                )}
                                                {trigger.template_content && t === 'template_carousel' && (
                                                    <p className="text-[10px] text-gray-400 line-clamp-1 mb-1 font-medium italic">
                                                        {(() => {
                                                            try {
                                                                const el = typeof trigger.template_content === 'string' ? JSON.parse(trigger.template_content) : trigger.template_content;
                                                                const count = Array.isArray(el) ? el.length : (el ? 1 : 0);
                                                                return `${count} Carousel Element${count !== 1 ? 's' : ''}`;
                                                            } catch {
                                                                return 'Carousel Template';
                                                            }
                                                        })()}
                                                    </p>
                                                )}
                                                {trigger.template_content && t === 'template_media' && (
                                                    <p className="text-[10px] text-gray-400 line-clamp-1 mb-1 font-medium italic">Image/Video Attachment</p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {(Array.isArray(trigger.keyword) ? trigger.keyword : [trigger.keyword]).filter(Boolean).map((kw: string, ki: number) => (
                                                        <span key={ki} className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-[9px] font-black rounded-lg tracking-wider">{kw}</span>
                                                    ))}
                                                    {trigger.followers_only && (
                                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                                                            <CheckCircle2 className="w-2.5 h-2.5" /> Followers Only
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold text-gray-400 capitalize">{(t || 'template_text').replace('template_', '').replace('_', ' ')} Response</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleEdit(trigger)}
                                                className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-purple-500 rounded-xl transition-all"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(trigger.$id)}
                                                disabled={isDeleting}
                                                className="p-3 bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                            <div className="h-8 w-[1px] bg-slate-200 dark:border-slate-700 mx-2" />
                                            {isToggling ? (
                                                <div className="w-[44px] h-[24px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full">
                                                    <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                                                </div>
                                            ) : (
                                                <ToggleSwitch
                                                    isChecked={trigger.active ?? true}
                                                    onChange={() => handleToggleActive(trigger)}
                                                    variant="plain"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                </>
            )}

            {/* Success/Error Notifications */}
            <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
                {success && (
                    <div className="bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold text-sm">{success}</span>
                    </div>
                )}
                {error && (
                    <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-bold text-sm">{error}</span>
                    </div>
                )}
            </div>

            <ModernConfirmModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                description={modalConfig.description}
                type={modalConfig.type}
                confirmLabel={modalConfig.confirmLabel}
                cancelLabel={modalConfig.cancelLabel}
                onConfirm={modalConfig.onConfirm}
                onClose={closeModal}
            />
        </div>
    );
};

export default GlobalTriggersView;