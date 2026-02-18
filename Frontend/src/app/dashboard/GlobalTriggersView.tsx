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
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
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
    const [previewTemplate, setPreviewTemplate] = useState<ReplyTemplate | null>(null);
    const templateCacheRef = useRef<Record<string, ReplyTemplate>>({});
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

    useEffect(() => {
        let cancelled = false;
        if (!selectedTemplateId) {
            setPreviewTemplate(null);
            return;
        }

        if (templateCacheRef.current[selectedTemplateId]) {
            setPreviewTemplate(templateCacheRef.current[selectedTemplateId]);
            return;
        }

        const inList = replyTemplatesList.find(t => t.id === selectedTemplateId) || null;
        const hasData = !!(inList?.template_data && Object.keys(inList.template_data || {}).length > 0);

        if (hasData) {
            setPreviewTemplate(inList);
            templateCacheRef.current[selectedTemplateId] = inList;
            return;
        }

        (async () => {
            try {
                const res = await authenticatedFetch(
                    `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${selectedTemplateId}?account_id=${activeAccountID}`
                );
                if (!cancelled) {
                    if (res.ok) {
                        const fullTemplate = await res.json();
                        setPreviewTemplate(fullTemplate);
                        templateCacheRef.current[selectedTemplateId] = fullTemplate;
                    } else {
                        setPreviewTemplate(inList);
                    }
                }
            } catch (_) {
                if (!cancelled) setPreviewTemplate(inList);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [selectedTemplateId, replyTemplatesList, authenticatedFetch]);

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

    useEffect(() => {
        if (!activeAccountID) return;
        const targetId = sessionStorage.getItem('openAutomationId');
        const targetType = sessionStorage.getItem('openAutomationType');
        if (!targetId || (targetType !== 'global' && targetType !== 'global_trigger')) return;

        sessionStorage.removeItem('openAutomationId');
        sessionStorage.removeItem('openAutomationType');

        const existing = (globalTriggers || []).find((t: any) => t.$id === targetId);
        if (existing) {
            handleEdit(existing);
            return;
        }

        (async () => {
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${targetId}?account_id=${activeAccountID}`);
                if (res.ok) {
                    const data = await res.json();
                    handleEdit(data);
                }
            } catch (_) { }
        })();
    }, [activeAccountID, authenticatedFetch, globalTriggers]);

    const handleClose = () => {
        setEditingTrigger(null);
        setSelectedTemplateId('');
        setHasUnsavedChanges(false);
    };

    const handleSave = useCallback(async () => {
        // AutomationEditor performs the actual save.
        // Here we just refresh and close the editor after success.
        handleClose();
        fetchTriggers(true);
    }, [handleClose, fetchTriggers]);

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
                <div className="w-20 h-20 bg-primary rounded-[28%] flex items-center justify-center text-primary-foreground mb-6 shadow-2xl shadow-primary/20">
                    <Globe className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-foreground mb-3">Select Instagram Account</h2>
                <p className="text-muted-foreground max-w-md mb-8 font-medium">Global Triggers require an active Instagram Business account.</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingOverlay variant="fullscreen" message="Loading Global Triggers" subMessage="Fetching your rulesâ€¦" />;
    }

    return (
        <div className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-screen">
            {/* Editor Mode */}
            {editingTrigger ? (
                <>
                    <div className="flex items-center justify-between border-b border-content pb-6">
                        <button onClick={handleClose} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Dashboard
                        </button>
                        <div className="flex items-center gap-3">
                            {error && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-destructive-muted/40 text-destructive rounded-lg text-[10px] font-black border border-destructive/30 animate-in fade-in slide-in-from-right-2">
                                    <AlertCircle className="w-3 h-3" /> {error}
                                </div>
                            )}
                            {success && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-success-muted/60 text-success rounded-lg text-[10px] font-black border border-success/30 animate-in fade-in slide-in-from-right-2">
                                    <CheckCircle2 className="w-3 h-3" /> {success}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:h-[calc(100vh-11rem)] xl:min-h-0">
                        {/* Left: Editor - scrollable on xl */}
                        <div className="xl:col-span-8 space-y-8 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
                            <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8">
                                    <AutomationEditor
                                        type="global"
                                        isStandalone={false}
                                        useParentLayout
                                        activeAccountID={activeAccountID}
                                        authenticatedFetch={authenticatedFetch}
                                        automationId={editingTrigger.$id || undefined}
                                        existingTitles={(globalTriggers || []).map((t: any) => ({ id: t.$id, title: t.title }))}
                                        onSave={handleSave}
                                        onClose={handleClose}
                                        onDelete={editingTrigger.$id ? async (id) => {
                                        await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}`, { method: 'DELETE' });
                                        handleSave();
                                    } : undefined}
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
                                        <div className="bg-success text-success-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span className="font-bold text-sm">{success}</span>
                                        </div>
                                    )}
                                    {error && (
                                        <div className="bg-destructive text-destructive-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                                            <AlertCircle className="w-5 h-5" />
                                            <span className="font-bold text-sm">{error}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Live Preview */}
                                <div className="space-y-4">
                                    {(() => {
                                        const displayName = activeAccount?.username || 'your_account';
                                        const profilePic = activeAccount?.profile_picture_url ?? undefined;
                                        const template = selectedTemplateId ? (previewTemplate || replyTemplatesList.find(t => t.id === selectedTemplateId)) : null;

                                        if (template) {
                                            const previewAutomation = {
                                                template_type: template.template_type as any,
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
                                                template_data: template.template_data
                                            };

                                            return (
                                                <SharedMobilePreview
                                                    mode="automation"
                                                    automation={previewAutomation}
                                                    displayName={displayName}
                                                    profilePic={profilePic}
                                                />
                                            );
                                        }

                                        const fallbackAutomation = {
                                            ...editingTrigger,
                                            keyword: editingTrigger.keyword?.[0] || editingTrigger.title || 'Trigger message'
                                        };

                                        return (
                                            <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                                                <SharedMobilePreview
                                                    mode="automation"
                                                    automation={fallbackAutomation}
                                                    displayName={displayName}
                                                    profilePic={profilePic}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* List Mode */
                <>
                    {/* Header - same layout as DM Automation */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary mb-2">
                                <Globe className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Global Triggers</span>
                            </div>
                            <h1 className="text-4xl font-black text-foreground tracking-tight">Global Triggers</h1>
                            <p className="text-muted-foreground font-medium max-w-xl">
                                Global triggers apply across all your content. When keywords are detected in comments, stories, or live sessions, DMPanda replies automatically.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => { setRefreshing(true); fetchTriggers(true).finally(() => setRefreshing(false)); }}
                                disabled={loading || refreshing}
                                className="p-3 bg-muted/40 text-muted-foreground hover:text-primary rounded-2xl transition-all border border-content disabled:opacity-50"
                            >
                                <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={handleCreateNew}
                                className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                            >
                                <Plus className="w-3 h-3" /> Create New Rule
                            </button>
                        </div>
                    </div>

                    {globalTriggers.length === 0 ? (
                        <div className="bg-muted/40 border-2 border-dashed border-border rounded-3xl p-20 text-center">
                            <Globe className="w-12 h-12 text-muted-foreground/60 mx-auto mb-6" />
                            <h4 className="text-foreground font-black text-xl mb-2">No global triggers yet</h4>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">Create your first global trigger to automatically respond to keywords across all your Instagram content.</p>
                            <button
                                onClick={handleCreateNew}
                                className="mx-auto px-8 py-4 bg-card text-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 hover:scale-105"
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
                                    <div key={trigger.$id} className="relative group bg-card border border-content rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-500 overflow-hidden">
                                        {isDeleting && (
                                            <div className="absolute inset-0 z-20 bg-card/80 backdrop-blur-md rounded-3xl flex items-center justify-center animate-in fade-in duration-300">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-all">Removing Trigger...</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                    {t === 'template_text' && <FileText className="w-7 h-7" />}
                                                    {t === 'template_carousel' && <Smartphone className="w-7 h-7" />}
                                                    {t === 'template_buttons' && <MousePointerClick className="w-7 h-7" />}
                                                    {t === 'template_media' && <ImageIcon className="w-7 h-7" />}
                                                    {t === 'template_quick_replies' && <Reply className="w-7 h-7" />}
                                                    {t === 'template_share_post' && <Share2 className="w-7 h-7" />}
                                                    {!['template_text', 'template_carousel', 'template_buttons', 'template_media', 'template_quick_replies', 'template_share_post'].includes(t) && <Globe className="w-7 h-7" />}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-foreground">{trigger.title || 'Untitled Trigger'}</h4>
                                                    {trigger.template_content && t === 'template_text' && (
                                                        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">&quot;{trigger.template_content}&quot;</p>
                                                    )}
                                                    {trigger.template_content && t === 'template_carousel' && (
                                                        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">
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
                                                        <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">Image/Video Attachment</p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        {(Array.isArray(trigger.keyword) ? trigger.keyword : [trigger.keyword]).filter(Boolean).map((kw: string, ki: number) => (
                                                            <span key={ki} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-lg tracking-wider">{kw}</span>
                                                        ))}
                                                        {trigger.followers_only && (
                                                            <span className="px-2 py-0.5 bg-warning-muted/60 text-warning text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircle2 className="w-2.5 h-2.5" /> Followers Only
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-muted-foreground capitalize">{(t || 'template_text').replace('template_', '').replace('_', ' ')} Response</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleEdit(trigger)}
                                                    className="p-3 bg-muted/40 text-muted-foreground hover:text-primary rounded-xl transition-all"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(trigger.$id)}
                                                    disabled={isDeleting}
                                                    className="p-3 bg-destructive-muted/40 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                                <div className="h-8 w-[1px] bg-border mx-2" />
                                                {isToggling ? (
                                                    <div className="w-[44px] h-[24px] flex items-center justify-center bg-muted rounded-full">
                                                        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
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
                    <div className="bg-success text-success-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold text-sm">{success}</span>
                    </div>
                )}
                {error && (
                    <div className="bg-destructive text-destructive-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
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
