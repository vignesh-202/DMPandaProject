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
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate, prefetchReplyTemplates } from '../../components/dashboard/TemplateSelector';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import AutomationToast from '../../components/ui/AutomationToast';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';
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
    const [prefetchedTemplate, setPrefetchedTemplate] = useState<ReplyTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<ReplyTemplate | null>(null);
    const [isPreviewTemplateLoading, setIsPreviewTemplateLoading] = useState(false);
    const templateCacheRef = useRef<Record<string, ReplyTemplate>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [isPreparingEditor, setIsPreparingEditor] = useState(false);
    const [editorLoadingMessage, setEditorLoadingMessage] = useState('Preparing global trigger editor');
    const fetchingRef = useRef(false);
    const [editorDirty, setEditorDirty] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const saveHandlerRef = useRef<() => Promise<boolean>>(async () => true);
    useDashboardMainScrollLock(Boolean(editingTrigger || isPreparingEditor));
    const location = useLocation();
    const navigate = useNavigate();

    const primeEditorResources = useCallback(async () => {
        if (!activeAccountID) return;
        await prefetchReplyTemplates(activeAccountID, authenticatedFetch);
    }, [activeAccountID, authenticatedFetch]);

    const fetchTriggers = useCallback(async (isManual = false) => {
        if (!activeAccountID) return;
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        if (!isManual) setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(
                `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations?account_id=${activeAccountID}&type=global&summary=1`
            );
            const data = await res.json();
            if (res.ok) {
                const normalized = (data.automations || data.documents || []).map((doc: any) => ({
                    ...doc,
                    active: doc?.is_active !== false,
                    is_active: doc?.is_active !== false,
                }));
                setGlobalTriggers(normalized);
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
        setReplyTemplatesList((current) => {
            const merged = new Map(current.map((template) => [template.id, template]));
            templates.forEach((template) => {
                merged.set(template.id, {
                    ...(merged.get(template.id) || {}),
                    ...template,
                    template_data: template.template_data && Object.keys(template.template_data || {}).length > 0
                        ? template.template_data
                        : merged.get(template.id)?.template_data
                });
            });
            return Array.from(merged.values());
        });
    }, []);

    useEffect(() => {
        fetchTriggers();
    }, [fetchTriggers]);

    useEffect(() => {
        let cancelled = false;
        if (!selectedTemplateId) {
            setPreviewTemplate(null);
            setIsPreviewTemplateLoading(false);
            return;
        }

        const cachedTemplate = templateCacheRef.current[selectedTemplateId] || null;
        if (cachedTemplate?.template_data && Object.keys(cachedTemplate.template_data || {}).length > 0) {
            setPreviewTemplate(cachedTemplate);
            setIsPreviewTemplateLoading(false);
            return;
        }

        const inList = replyTemplatesList.find(t => t.id === selectedTemplateId) || null;
        const hasData = !!(inList?.template_data && Object.keys(inList.template_data || {}).length > 0);

        if (hasData) {
            setPreviewTemplate(inList);
            templateCacheRef.current[selectedTemplateId] = inList;
            setIsPreviewTemplateLoading(false);
            return;
        }

        (async () => {
            try {
                setIsPreviewTemplateLoading(true);
                const fullTemplate = await fetchReplyTemplateById(activeAccountID || '', authenticatedFetch, selectedTemplateId);
                if (!cancelled) {
                    if (fullTemplate) {
                        setPreviewTemplate(fullTemplate);
                        templateCacheRef.current[selectedTemplateId] = fullTemplate;
                    } else {
                        setPreviewTemplate(inList);
                    }
                }
            } catch (_) {
                if (!cancelled) setPreviewTemplate(inList);
            } finally {
                if (!cancelled) setIsPreviewTemplateLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [activeAccountID, authenticatedFetch, replyTemplatesList, selectedTemplateId]);

    const handleCreateNew = useCallback(async () => {
        navigate('/dashboard/global-triggers/edit/new');
    }, [navigate]);

    const loadTrigger = useCallback(async (targetId: string, preloadedTrigger?: any) => {
        setEditorLoadingMessage(targetId === 'new' ? 'Opening global trigger editor' : 'Loading global trigger');
        setIsPreparingEditor(true);
        try {
            await primeEditorResources();
            if (targetId === 'new') {
                setEditingTrigger({
                    title: '',
                    keyword: [],
                    template_type: 'template_text',
                    template_content: '',
                    followers_only: false
                });
                setPrefetchedTemplate(null);
                setPreviewTemplate(null);
                setEditorDirty(false);
                setShowLeaveModal(false);
                setSelectedTemplateId('');
                setHasUnsavedChanges(false);
                return;
            }

            let resolvedTrigger = preloadedTrigger || { $id: targetId };
            let resolvedTemplate: ReplyTemplate | null = null;

            if (!preloadedTrigger && targetId) {
                const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${targetId}?account_id=${activeAccountID}`);
                if (res.ok) {
                    resolvedTrigger = await res.json();
                }
            }

            const resolvedTemplateId = String(resolvedTrigger?.template_id || '').trim();
            if (resolvedTemplateId) {
                const templateRes = await authenticatedFetch(
                    `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${resolvedTemplateId}?account_id=${activeAccountID}`
                );
                if (templateRes.ok) {
                    resolvedTemplate = await templateRes.json();
                }
            }

            setEditingTrigger(resolvedTrigger);
            setPrefetchedTemplate(resolvedTemplate);
            setPreviewTemplate(resolvedTemplate);
            if (resolvedTemplate?.id) {
                templateCacheRef.current[resolvedTemplate.id] = resolvedTemplate;
            }
            setEditorDirty(false);
            setShowLeaveModal(false);
            setSelectedTemplateId(String(resolvedTrigger?.template_id || '').trim() || resolvedTemplate?.id || '');
            setHasUnsavedChanges(false);
        } finally {
            setIsPreparingEditor(false);
        }
    }, [activeAccountID, authenticatedFetch, primeEditorResources, setHasUnsavedChanges]);

    const handleEdit = useCallback((trigger: any) => {
        navigate(`/dashboard/global-triggers/edit/${trigger.$id}`, { state: { trigger } });
    }, [navigate]);

    useEffect(() => {
        if (editingTrigger) {
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [editingTrigger]);

    useEffect(() => {
        if (!activeAccountID) return;
        const match = location.pathname.match(/\/dashboard\/global-triggers\/edit\/([^/]+)/);
        const targetId = match ? match[1] : null;

        if (!targetId) {
            if (editingTrigger || isPreparingEditor) {
                setEditingTrigger(null);
                setEditorDirty(false);
                setShowLeaveModal(false);
                setPrefetchedTemplate(null);
                setPreviewTemplate(null);
                setSelectedTemplateId('');
                setHasUnsavedChanges(false);
                setIsPreparingEditor(false);
            }
            return;
        }

        if (targetId === 'new') {
            if (editingTrigger && !editingTrigger.$id) return;
            loadTrigger(targetId);
            return;
        }

        if (editingTrigger?.$id === targetId) return;

        const stateTrigger = location.state?.trigger;
        const existing = stateTrigger || (globalTriggers || []).find((t: any) => t.$id === targetId);

        loadTrigger(targetId, existing);
    }, [activeAccountID, location.pathname, location.state, globalTriggers, editingTrigger, loadTrigger, isPreparingEditor, setHasUnsavedChanges]);

    const handleClose = useCallback(() => {
        navigate('/dashboard/global-triggers');
    }, [navigate]);

    const requestClose = useCallback(() => {
        if (editorDirty) {
            setShowLeaveModal(true);
            return;
        }
        handleClose();
    }, [editorDirty, handleClose]);

    const handleSave = useCallback(async (savedAutomation?: any) => {
        await fetchTriggers(true);
        const savedId = String(savedAutomation?.automation_id || savedAutomation?.$id || editingTrigger?.$id || '').trim();
        if (savedId && location.pathname.endsWith('/edit/new')) {
            navigate(`/dashboard/global-triggers/edit/${savedId}`, { replace: true });
        }
    }, [editingTrigger?.$id, fetchTriggers, location.pathname, navigate]);

    const handleToggleActive = async (trigger: any) => {
        setTogglingIds((s) => new Set(s).add(trigger.$id));
        const next = !trigger.active;
        setGlobalTriggers((prev: any) => prev.map((x: any) => (x.$id === trigger.$id ? { ...x, active: next, is_active: next } : x)));

        try {
            await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${trigger.$id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: next })
            });
        } catch {
            setGlobalTriggers((prev: any) => prev.map((x: any) => (x.$id === trigger.$id ? { ...x, active: !!trigger.active, is_active: !!trigger.is_active } : x)));
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
                    await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${id}`, {
                        method: 'DELETE'
                    });
                    setGlobalTriggers((prev: any) => prev.filter((x: any) => x.$id !== id));
                } finally {
                    setDeletingIds((s) => { const n = new Set(s); n.delete(id); return n; });
                }
            }
        });
    };

    const handleEditorChange = useCallback((dirty: boolean) => {
        setEditorDirty(dirty);
        setHasUnsavedChanges(dirty);
    }, [setHasUnsavedChanges]);

    useEffect(() => {
        if (editingTrigger) {
            setSaveUnsavedChanges(() => async () => saveHandlerRef.current());
            setDiscardUnsavedChanges(() => () => {
                handleClose();
            });
        } else {
            setEditorDirty(false);
            setShowLeaveModal(false);
            setHasUnsavedChanges(false);
            setSaveUnsavedChanges(() => async () => true);
            setDiscardUnsavedChanges(() => () => { });
        }
    }, [editingTrigger, handleClose, setDiscardUnsavedChanges, setHasUnsavedChanges, setSaveUnsavedChanges]);

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
                <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">Select Instagram Account</h2>
                <p className="text-muted-foreground max-w-md mb-8 font-medium">Global Triggers require an active Instagram Business account.</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingOverlay variant="fullscreen" message="Loading Global Triggers" subMessage="Fetching your rulesâ€¦" />;
    }

    if (isPreparingEditor) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message={editorLoadingMessage}
                subMessage="Preparing the trigger editor and linked reply templates..."
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-screen">
            <AutomationToast message={success} variant="success" onClose={() => setSuccess(null)} />
            <AutomationToast message={error} variant="error" onClose={() => setError(null)} />
            {/* Editor Mode */}
            {editingTrigger ? (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                        <div className="xl:col-span-8 w-full min-w-0 space-y-8 xl:overflow-y-auto xl:pr-2">
                            <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8 xl:min-h-0">
                                    <AutomationEditor
                                        type="global"
                                        isStandalone={false}
                                        autoCloseOnSave={false}
                                        useParentLayout
                                        activeAccountID={activeAccountID}
                                        authenticatedFetch={authenticatedFetch}
                                        automationId={editingTrigger.$id || undefined}
                                        initialAutomationData={editingTrigger}
                                        initialSelectedTemplate={prefetchedTemplate}
                                        existingTitles={(globalTriggers || []).map((t: any) => ({ id: t.$id, title: t.title }))}
                                        onSave={handleSave}
                                        onClose={requestClose}
                                        registerSaveHandler={(handler) => {
                                            saveHandlerRef.current = handler;
                                        }}
                                        onDelete={editingTrigger.$id ? async (id) => {
                                        await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${id}`, { method: 'DELETE' });
                                        handleSave();
                                    } : undefined}
                                    onChange={handleEditorChange}
                                    onTemplateSelect={(templateId) => {
                                        setSelectedTemplateId(templateId || '');
                                        if (!templateId) {
                                            setPreviewTemplate(null);
                                        }
                                    }}
                                    onTemplatesLoaded={handleTemplatesLoaded}
                                    titleOverride=""
                                    actionBarLeft={
                                        <button
                                            type="button"
                                            onClick={requestClose}
                                            className="p-3 rounded-2xl border-2 border-border hover:bg-muted/40 text-foreground transition-all hover:scale-105"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>
                                    }
                                />
                            </section>
                        </div>

                        {/* Right: Live Preview */}
                        <AutomationPreviewPanel>
                            {(() => {
                                const displayName = activeAccount?.username || 'your_account';
                                const profilePic = activeAccount?.profile_picture_url ?? undefined;
                                const template = selectedTemplateId ? (previewTemplate || replyTemplatesList.find(t => t.id === selectedTemplateId)) : null;

                                if (template) {
                                    const previewAutomation = {
                                        ...editingTrigger,
                                        ...(buildPreviewAutomationFromTemplate(template) || {}),
                                        keyword: editingTrigger.keyword?.[0] || editingTrigger.title || 'Trigger message'
                                    };

                                    return (
                                        <SharedMobilePreview
                                            mode="automation"
                                            automation={previewAutomation}
                                            activeAccountID={activeAccountID}
                                            authenticatedFetch={authenticatedFetch}
                                            displayName={displayName}
                                            profilePic={profilePic}
                                            lockScroll
                                            hideAutomationPrompt
                                            isLoadingPreview={isPreviewTemplateLoading}
                                        />
                                    );
                                }

                                const fallbackAutomation = {
                                    ...editingTrigger,
                                    keyword: editingTrigger.keyword?.[0] || editingTrigger.title || 'Trigger message'
                                };

                                return (
                                    <SharedMobilePreview
                                        mode="automation"
                                        automation={fallbackAutomation}
                                        activeAccountID={activeAccountID}
                                        authenticatedFetch={authenticatedFetch}
                                        displayName={displayName}
                                        profilePic={profilePic}
                                        lockScroll
                                        hideAutomationPrompt
                                        isLoadingPreview={isPreviewTemplateLoading}
                                    />
                                );
                            })()}
                        </AutomationPreviewPanel>
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
                            <h1 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">Global Triggers</h1>
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
                                onClick={() => void handleCreateNew()}
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
                                onClick={() => void handleCreateNew()}
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
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 sm:gap-6">
                                                <div className="w-16 h-16 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
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
                                            <div className="flex items-center gap-3 shrink-0">
                                                <button
                                                    onClick={() => void handleEdit(trigger)}
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
            <ModernConfirmModal
                isOpen={showLeaveModal}
                onClose={() => setShowLeaveModal(false)}
                onConfirm={async () => {
                    const ok = await saveHandlerRef.current();
                    if (ok) {
                        setShowLeaveModal(false);
                    }
                }}
                onSecondary={() => {
                    setShowLeaveModal(false);
                    handleClose();
                }}
                title="Unsaved changes"
                description="Do you want to save before leaving?"
                type="warning"
                confirmLabel="Save"
                secondaryLabel="Leave without saving"
                cancelLabel="Cancel"
            />
        </div>
    );
};

export default GlobalTriggersView;

