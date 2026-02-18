import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle2, Instagram, MessageCircle, Loader2, Pencil, Image as ImageIcon, Reply, ChevronLeft, X, HelpCircle, List, Calendar, ChevronDown, Film, Globe, PlusSquare, Edit, Grid3X3, Rows, GripVertical } from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import TemplateSelector, { ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import { useDashboard, ViewType } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';

// Max 4 Convo Starters per Instagram API limit
const MAX_CONVO_STARTERS = 4;

// Coalesce duplicate share-post media fetches across strict-mode re-mounts
let sharedConvoStarterMediaPromise: Promise<any[]> | null = null;
let sharedConvoStarterMediaKey = '';

interface ConvoStarter {
    question: string;
    payload: string;
    template_type?: 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies';
    template_id?: string;
    template_data?: any;
}

interface ConvoStarterData {
    ig_starters: ConvoStarter[];
    db_starters: ConvoStarter[];
    is_synced: boolean;
    status: 'match' | 'mismatch' | 'ig_only' | 'db_only' | 'none';
    issue: string | null;
    account_id: string;
}

const getByteLength = (str: string) => new Blob([str]).size;
const createBlankStarter = (): ConvoStarter => ({ question: '', payload: '' });
const normalizeQuestion = (value: string) => (value || '').trim().toLowerCase();
const suggestUniqueQuestion = (base: string, existing: string[]) => {
    const trimmed = (base || '').trim();
    if (!trimmed) return trimmed;
    const existingSet = new Set(existing.map(t => (t || '').trim().toLowerCase()));
    if (!existingSet.has(trimmed.toLowerCase())) return trimmed;
    let i = 2;
    while (i < 1000) {
        const candidate = `${trimmed} (${i})`;
        if (!existingSet.has(candidate.toLowerCase())) return candidate;
        i += 1;
    }
    return `${trimmed} (${Date.now()})`;
};

// Simplified validation function for Convo Starters (now using templates)
const validateConvoStarter = (item: ConvoStarter, selectedTemplate: ReplyTemplate | null) => {
    const errors: { [key: string]: string } = {};

    // Question validation (max 80 UTF-8 bytes)
    if (!item.question) {
        errors.question = 'Question is required.';
    } else if (getByteLength(item.question) > 80) {
        errors.question = 'Question too long (max 80 UTF-8 bytes)';
    }

    // Template validation - now just check if a template is selected
    if (!selectedTemplate) {
        errors.template = 'Please select a reply template';
    }

    return errors;
};

const ConvoStarterView: React.FC = () => {
    const {
        activeAccountID,
        setActiveAccountID,
        activeAccount,
        igAccounts,
        convoStarters,
        setConvoStarters,
        convoStarterData,
        setConvoStarterData,
        fetchConvoStarters,
        convoStarterLoading,
        setHasUnsavedChanges,
        setSaveUnsavedChanges,
        setDiscardUnsavedChanges,
        currentView,
        setCurrentView
    } = useDashboard();
    const { authenticatedFetch } = useAuth();

    // State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [newItem, setNewItem] = useState<ConvoStarter | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
    const [layoutMode, setLayoutMode] = useState<'grid' | 'rows'>('grid');
    const [initialStarters, setInitialStarters] = useState<ConvoStarter[]>([]);
    const [itemBeforeEdit, setItemBeforeEdit] = useState<ConvoStarter | null>(null);
    const hasFetchedForAccount = useRef<string | null>(null);

    // Drag state for reordering
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    // Drag and drop handlers for reordering
    const handleDragStart = (index: number) => {
        setDragIdx(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIdx(index);
    };

    const handleDragLeave = () => {
        setDragOverIdx(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === dropIndex) {
            setDragIdx(null);
            setDragOverIdx(null);
            return;
        }

        const reordered = [...convoStarters];
        const [removed] = reordered.splice(dragIdx, 1);
        reordered.splice(dropIndex, 0, removed);

        setConvoStarters(reordered);
        setDragIdx(null);
        setDragOverIdx(null);
    };

    // Template editor state
    const [activeCarouselElementIdx, setActiveCarouselElementIdx] = useState(0);
    // Share post template state
    const [sharePostContentType, setSharePostContentType] = useState<'all' | 'posts' | 'reels'>('all');
    const [sharePostDateRange, setSharePostDateRange] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
    const [sharePostSortBy, setSharePostSortBy] = useState<'recent' | 'oldest'>('recent');
    const [sharePostCustomRange, setSharePostCustomRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
    const [sharePostMedia, setSharePostMedia] = useState<any[]>([]);
    const [sharePostSelectedMediaId, setSharePostSelectedMediaId] = useState<string | null>(null);
    const [mediaDateDropdownOpen, setMediaDateDropdownOpen] = useState(false);
    const [mediaSortDropdownOpen, setMediaSortDropdownOpen] = useState(false);
    const [isFetchingMedia, setIsFetchingMedia] = useState(false);
    const lastFetchRef = useRef<string>("");

    // Modal
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        confirmLabel?: string;
        secondaryLabel?: string;
        onConfirm: () => void;
        onSecondary?: () => void;
        oneButton?: boolean;
    }>({
        isOpen: false, title: '', description: '', type: 'info', onConfirm: () => { }, oneButton: true
    });
    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    // Navigation Protection Handlers
    const handleCancelEditing = useCallback(() => {
        setConvoStarters(JSON.parse(JSON.stringify(initialStarters)));
        setIsCreatingItem(false);
        setEditingIndex(null);
        setNewItem(null);
        setSelectedTemplate(null);
        setValidationErrors({});
        setItemBeforeEdit(null);
    }, [initialStarters, setConvoStarters]);

    const startCreate = useCallback(() => {
        setNewItem(createBlankStarter());
        setIsCreatingItem(true);
        setEditingIndex(null);
        setSelectedTemplate(null);
        setValidationErrors({});
    }, []);

    const handleSaveConvoStarters = async (): Promise<boolean> => {
        setSaving(true);
        setError(null);
        try {
            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: activeAccountID, starters: convoStarters, publish: false })
                }
            );
            if (res.ok) {
                setInitialStarters(JSON.parse(JSON.stringify(convoStarters)));
                setHasUnsavedChanges(false);
                setSaving(false);
                return true;
            }
            const data = await res.json();
            setError(data.error || 'Failed to save');
            setSaving(false);
            return false;
        } catch (err) {
            setError('Network error');
            setSaving(false);
            return false;
        }
    };


    // Clear success/error messages when account changes
    useEffect(() => {
        setSuccess(null);
        setError(null);
        setValidationErrors({});
    }, [activeAccountID]);

    // Fetch data
    useEffect(() => {
        if (activeAccountID && !convoStarterData && hasFetchedForAccount.current !== activeAccountID) {
            hasFetchedForAccount.current = activeAccountID;
            fetchConvoStarters();
            const timeout = setTimeout(() => {
                setLoading(false);
            }, 10000);
            return () => clearTimeout(timeout);
        }
    }, [activeAccountID, convoStarterData, fetchConvoStarters]);
    useEffect(() => {
        if (hasFetchedForAccount.current && activeAccountID && hasFetchedForAccount.current !== activeAccountID) {
            hasFetchedForAccount.current = null;
        }
    }, [activeAccountID]);

    useEffect(() => {
        if (convoStarterData) {
            setLoading(false);
            const starters = convoStarterData.db_starters?.length > 0
                ? convoStarterData.db_starters
                : convoStarterData.ig_starters || [];
            setConvoStarters(starters);
            setInitialStarters(JSON.parse(JSON.stringify(starters)));
        } else if (!convoStarterLoading && activeAccountID) {
            setLoading(false);
        }
    }, [convoStarterData, convoStarterLoading, activeAccountID, setConvoStarters]);

    useEffect(() => {
        if (!convoStarterData && !convoStarterLoading && activeAccountID) {
            const stored = localStorage.getItem(`convo_starters_${activeAccountID}`);
            if (stored) {
                try {
                    const starters = JSON.parse(stored);
                    if (Array.isArray(starters)) {
                        setConvoStarters(starters);
                        setInitialStarters(JSON.parse(JSON.stringify(starters)));
                    }
                } catch (_) { }
            }
        }
    }, [convoStarterData, convoStarterLoading, activeAccountID, setConvoStarters]);

    // Unsaved changes tracking
    const hasChanges = useMemo(() => {
        return JSON.stringify(convoStarters) !== JSON.stringify(initialStarters);
    }, [convoStarters, initialStarters]);

    useEffect(() => {
        setHasUnsavedChanges(hasChanges || isCreatingItem);
    }, [hasChanges, isCreatingItem, setHasUnsavedChanges]);

    // Global Save/Discard Handlers (Protection)
    useEffect(() => {
        const saveHandler = async (): Promise<boolean> => {
            if (isCreatingItem) await handleSaveItem();
            return await handleSaveConvoStarters();
        };
        const discardHandler = () => {
            handleCancelEditing();
            setHasUnsavedChanges(false);
        };
        setSaveUnsavedChanges(() => saveHandler);
        setDiscardUnsavedChanges(() => discardHandler);
    }, [isCreatingItem, convoStarters, initialStarters, activeAccountID, setSaveUnsavedChanges, setDiscardUnsavedChanges, setHasUnsavedChanges, handleCancelEditing]);

    // Share post template media fetching
    const fetchSharePostMedia = useCallback(async (force = false) => {
        if (!activeAccountID) return;
        const currentParams = `${activeAccountID}-${sharePostDateRange}-${sharePostSortBy}`;
        if (!force && lastFetchRef.current === currentParams) return;
        lastFetchRef.current = currentParams;

        const params = new URLSearchParams({
            account_id: activeAccountID || '',
            type: 'all',
            date_range: sharePostDateRange,
            sort_by: sharePostSortBy,
            limit: '100'
        });

        const requestKey = `${activeAccountID}|${params.toString()}`;
        const doFetch = async () => {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?${params}`);
            if (res.ok) {
                const data = await res.json();
                return data.data || [];
            }
            return [];
        };

        let promise: Promise<any[]>;
        if (!force && sharedConvoStarterMediaPromise && sharedConvoStarterMediaKey === requestKey) {
            promise = sharedConvoStarterMediaPromise;
        } else {
            sharedConvoStarterMediaKey = requestKey;
            promise = doFetch();
            if (!force) {
                sharedConvoStarterMediaPromise = promise;
            }
        }

        setIsFetchingMedia(true);
        try {
            const media = await promise;
            setSharePostMedia(media);
        } catch (error) {
            console.error('Failed to fetch media:', error);
        } finally {
            if (!force && sharedConvoStarterMediaPromise === promise) {
                sharedConvoStarterMediaPromise = null;
            }
            setIsFetchingMedia(false);
        }
    }, [activeAccountID, sharePostDateRange, sharePostSortBy, authenticatedFetch]);

    useEffect(() => {
        if (newItem?.template_type === 'template_share_post' && isCreatingItem) {
            fetchSharePostMedia();
        }
    }, [newItem?.template_type, isCreatingItem, fetchSharePostMedia]);

    useEffect(() => {
        if (isCreatingItem && !newItem) {
            setNewItem(createBlankStarter());
        }
    }, [isCreatingItem, newItem]);

    // Handlers
    const handleSaveItem = async () => {
        if (!newItem) return;
        const errors = validateConvoStarter(newItem, selectedTemplate);
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setError('Please fix the validation errors');
            return;
        }

        const normalizedQuestion = normalizeQuestion(newItem.question || '');
        if (normalizedQuestion) {
            const duplicate = convoStarters.some((item, idx) => {
                if (editingIndex !== null && idx === editingIndex) return false;
                return normalizeQuestion(item.question || '') === normalizedQuestion;
            });
            if (duplicate) {
                const existingQuestions = convoStarters
                    .filter((_, idx) => editingIndex === null || idx !== editingIndex)
                    .map((item) => item.question || '');
                const suggested = suggestUniqueQuestion(newItem.question || '', existingQuestions);
                if (suggested && suggested !== newItem.question) {
                    setNewItem({ ...newItem, question: suggested });
                }
                setValidationErrors({ question: `Question already exists. Suggested: ${suggested}` });
                setError(`Please use a unique question title. Suggested: ${suggested}`);
                return;
            }
        }

        if (editingIndex !== null) {
            const updated = [...convoStarters];
            updated[editingIndex] = newItem;
            setConvoStarters(updated);
        } else {
            setConvoStarters([...convoStarters, newItem]);
        }
        setIsCreatingItem(false);
        setNewItem(null);
        setEditingIndex(null);
        setSelectedTemplate(null);
        setValidationErrors({});
    };

    const handleSave = async () => {
        await handleSaveItem();
    };

    const handlePublish = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            // Clean up convo starters data before saving
            const cleanedStarters = convoStarters.map(starter => {
                const cleaned = { ...starter };
                // If template_id is not a real template ID (fake IDs start with 'saved_'), remove template fields
                if (cleaned.template_id && cleaned.template_id.startsWith('saved_')) {
                    delete cleaned.template_type;
                    delete cleaned.template_id;
                    delete cleaned.template_data;
                }
                return cleaned;
            });

            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: activeAccountID, starters: cleanedStarters, publish: true })
                }
            );
            if (res.ok) {
                setSuccess('Conversation starters published successfully!');
                setInitialStarters(JSON.parse(JSON.stringify(convoStarters)));
                fetchConvoStarters(true);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to publish');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const executeDeleteConvo = async () => {
        setIsDeleting(true);
        try {
            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`,
                { method: 'DELETE' }
            );
            if (res.ok) {
                setConvoStarters([]);
                setInitialStarters([]);
                setSuccess('Conversation starters removed.');
                fetchConvoStarters(true);
            }
        } catch (err) {
            setError('Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRemove = (idx: number) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Question?',
            description: 'This will remove this conversation starter.',
            type: 'danger',
            confirmLabel: 'Delete',
            onConfirm: () => {
                setConvoStarters(convoStarters.filter((_, i) => i !== idx));
                closeModal();
            }
        });
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/convo-starters?account_id=${activeAccountID}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync' })
                }
            );
            if (res.ok) {
                setSuccess('Synced successfully!');
                fetchConvoStarters(true);
            } else {
                const data = await res.json();
                setError(data.error || 'Sync failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setSyncing(false);
        }
    };

    const handleDeleteAll = () => {
        setModalConfig({
            isOpen: true,
            title: 'Delete All?',
            description: 'Remove all conversation starters?',
            type: 'danger',
            confirmLabel: 'Delete All',
            onConfirm: executeDeleteConvo
        });
    };

    // Render logic
    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <MessageCircle className="w-16 h-16 text-primary mb-6" />
                <h2 className="text-2xl font-bold text-foreground mb-3">Select an Account</h2>
                <p className="text-muted-foreground">Please select an Instagram account to manage conversation starters.</p>
            </div>
        );
    }

    if ((loading || convoStarterLoading) && activeAccountID) {
        return <LoadingOverlay variant="fullscreen" message="Loading..." />;
    }

    const status = convoStarterData?.status || 'none';
    const canShowMainWorkspace = isCreatingItem || !!convoStarterData || convoStarters.length > 0 || (!convoStarterLoading && !!activeAccountID);

    return (
        <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Convo Starters</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-black text-foreground">Convo Starters</h1>
                        {status === 'match' && (
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-success-muted/60 text-success text-[10px] font-black uppercase tracking-widest rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Synced
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">Help new visitors start a conversation (max {MAX_CONVO_STARTERS})</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setLayoutMode(layoutMode === 'grid' ? 'rows' : 'grid')}
                        className="p-3 bg-muted rounded-xl"
                        title={`Switch to ${layoutMode === 'grid' ? 'rows' : 'grid'} layout`}
                    >
                        {layoutMode === 'grid' ? <Rows className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => fetchConvoStarters(true)} className="p-3 bg-muted rounded-xl">
                        <RefreshCw className={`w-4 h-4 ${convoStarterLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {!isCreatingItem && (
                        <button
                            onClick={() => {
                                if (convoStarters.length >= MAX_CONVO_STARTERS) {
                                    setError(`Maximum ${MAX_CONVO_STARTERS} conversation starters allowed.`);
                                    return;
                                }
                                startCreate();
                            }}
                            className="px-8 py-3 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-foreground/10 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Question
                        </button>
                    )}
                    {hasChanges && !isCreatingItem && editingIndex === null && (
                        <button onClick={handlePublish} disabled={saving} className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Publish Changes
                        </button>
                    )}
                </div>
            </div>

            {/* Alerts */}
            {error && <div className="p-4 bg-destructive-muted/40 text-destructive rounded-xl flex items-center gap-3">{error}</div>}
            {success && <div className="p-4 bg-success-muted/60 text-success rounded-xl flex items-center gap-3">{success}</div>}

            {/* Main Workspace */}
            {canShowMainWorkspace && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:h-[calc(100vh-11rem)] xl:min-h-0">
                    {/* Left: Form - scrollable on xl */}
                    <div className="xl:col-span-8 space-y-6 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
                        {isCreatingItem && newItem ? (
                            /* Edit Form */
                            <div className="bg-card border border-content rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-foreground/10 space-y-12">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Plus className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">{editingIndex !== null ? 'Edit Question' : 'New Question'}</span>
                                    </div>
                                    <h2 className="text-4xl font-black text-foreground tracking-tight">Configure Starter</h2>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question</label>
                                    <input
                                        value={newItem.question}
                                        onChange={(e) => setNewItem({ ...newItem, question: e.target.value })}
                                        className={`w-full bg-muted/40 border-2 ${validationErrors.question ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl py-5 px-8 text-lg font-black transition-all shadow-inner`}
                                        placeholder="e.g. How can I help you today?"
                                    />
                                    <div className="flex justify-between items-center px-2">
                                        <p className="text-[10px] text-muted-foreground font-medium italic">Visible as a quick question button.</p>
                                        <span className="text-[10px] font-black text-muted-foreground">{getByteLength(newItem.question)}/80 bytes</span>
                                    </div>
                                    {validationErrors.question && (
                                        <p className="text-[10px] text-destructive font-bold px-2">{validationErrors.question}</p>
                                    )}
                                </div>

                                <div className={`space-y-6 pt-6 border-t ${validationErrors.template ? 'border-destructive' : 'border-content'}`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Reply Action</label>
                                        {selectedTemplate && <button onClick={() => setSelectedTemplate(null)} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Change Template</button>}
                                    </div>
                                    {!selectedTemplate ? (
                                        <div className={`rounded-2xl border-2 ${validationErrors.template ? 'border-destructive' : 'border-transparent'}`}>
                                            <TemplateSelector
                                                selectedTemplateId={undefined}
                                                onSelect={(template) => {
                                                    setSelectedTemplate(template);
                                                    if (template) {
                                                        setNewItem({
                                                            ...(newItem || createBlankStarter()),
                                                            template_type: template.template_type as any,
                                                            template_id: template.id,
                                                            payload: template.id,
                                                            template_data: JSON.parse(JSON.stringify(template.template_data))
                                                        });
                                                    }
                                                }}
                                                onCreateNew={() => setCurrentView('Reply Templates')}
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg shadow-primary/20"><Reply className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-sm font-black text-foreground uppercase tracking-tight">{selectedTemplate.name}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedTemplate.template_type.replace('template_', '')}</p>
                                                </div>
                                            </div>
                                            <div className="px-3 py-1.5 bg-success-muted/60 text-success text-[9px] font-black uppercase tracking-widest rounded-lg">Selected</div>
                                        </div>
                                    )}
                                    {validationErrors.template && (
                                        <p className="text-[10px] text-destructive font-bold px-2">{validationErrors.template}</p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-12 border-t-2 border-border/60">
                                    <button onClick={() => { setIsCreatingItem(false); setSelectedTemplate(null); setEditingIndex(null); }} className="px-8 py-4 bg-muted text-muted-foreground rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Cancel</button>
                                    <button onClick={handleSave} disabled={saving || !selectedTemplate} className="px-12 py-4 bg-primary text-primary-foreground rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/30 flex items-center gap-3">
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                        {saving ? 'Saving...' : (editingIndex !== null ? 'Update Starter' : 'Save Starter')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Active Starters ({convoStarters.length}/{MAX_CONVO_STARTERS})
                                </p>
                                {convoStarters.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-[3rem] border-2 border-dashed border-border">
                                        <div className="p-6 bg-card rounded-3xl shadow-sm mb-6">
                                            <MessageSquare className="w-8 h-8 text-muted-foreground/60" />
                                        </div>
                                        <h3 className="text-lg font-black text-foreground mb-2">No Starters Yet</h3>
                                        <p className="text-muted-foreground font-medium text-sm text-center px-6">
                                            Create your first conversation starter to help users engage.
                                        </p>
                                        <button
                                            onClick={startCreate}
                                            className="mt-8 px-10 py-4 bg-primary text-primary-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Create First Question
                                        </button>
                                    </div>
                                ) : (
                                    <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
                                        {convoStarters.map((starter, index) => (
                                            <Card
                                                key={index}
                                                padding="none"
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`group p-6 transition-all duration-500 relative bg-card border rounded-[2rem] hover:shadow-2xl cursor-move
                                                    ${dragOverIdx === index ? 'border-primary ring-2 ring-primary/20 scale-[1.02]' : 'border-content'}
                                                    ${dragIdx === index ? 'opacity-50 scale-95' : ''}
                                                `}
                                            >
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-xl font-black text-muted-foreground/60 w-8">
                                                            {String(index + 1).padStart(2, '0')}
                                                        </div>
                                                        <div className="p-2 bg-muted text-muted-foreground rounded-lg cursor-grab active:cursor-grabbing">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="p-4 bg-muted/40 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary rounded-2xl transition-all duration-500">
                                                            <MessageCircle className="w-6 h-6" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg bg-primary/10 text-primary">
                                                            {starter.template_type?.replace('template_', '') || 'Reply'}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingIndex(index);
                                                                setNewItem(JSON.parse(JSON.stringify(starter)));
                                                                setIsCreatingItem(true);
                                                                if (starter.template_type) {
                                                                    setSelectedTemplate({
                                                                        id: `saved_${index}`,
                                                                        name: 'Existing Reply',
                                                                        template_type: starter.template_type,
                                                                        template_data: starter.template_data,
                                                                        type: 'saved'
                                                                    } as any);
                                                                }
                                                            }}
                                                            className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRemove(index)}
                                                            className="p-1.5 bg-destructive-muted/40 text-destructive rounded-lg hover:bg-destructive hover:text-destructive-foreground transition-all shadow-sm"
                                                            title="Remove"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <h3 className="text-xl font-black text-foreground line-clamp-1">{starter.question}</h3>
                                                    <div className="p-4 bg-muted/30 rounded-2xl border border-content/50">
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Connected Reply</p>
                                                        <div className="flex items-center gap-2">
                                                            <MessageSquare className="w-3 h-3 text-primary" />
                                                            <p className="text-xs font-bold text-muted-foreground truncate">
                                                                {starter.template_type?.replace('template_', '') || 'Reply'} template
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Live Preview - sticky on xl */}
                    <div className="xl:col-span-4 order-1 xl:order-2">
                        <div className="xl:sticky xl:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
                            {isCreatingItem && newItem && selectedTemplate ? (
                                <SharedMobilePreview
                                    mode="convo_starter"
                                    isEditing={true}
                                    newItem={newItem as any}
                                    displayName={activeAccount?.username || 'Username'}
                                    profilePic={activeAccount?.profile_picture_url || null}
                                />
                            ) : convoStarters.length > 0 ? (
                                <SharedMobilePreview
                                    mode="convo_starter"
                                    items={convoStarters.map(starter => ({
                                        title: starter.question,
                                        type: 'postback' as const,
                                        template_type: starter.template_type,
                                        template_data: starter.template_data
                                    }))}
                                    displayName={activeAccount?.username || 'Username'}
                                    profilePic={activeAccount?.profile_picture_url || null}
                                />
                            ) : (
                                <div className="flex justify-center bg-card rounded-2xl p-4 shadow-inner min-h-[400px]">
                                    <SharedMobilePreview
                                        mode="convo_starter"
                                        items={[]}
                                        displayName={activeAccount?.username || 'Username'}
                                        profilePic={activeAccount?.profile_picture_url || null}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Portals & Modals */}
            {modalConfig.isOpen && (
                <ModernConfirmModal
                    {...modalConfig}
                    onConfirm={() => { modalConfig.onConfirm(); closeModal(); }}
                    onClose={closeModal}
                />
            )}
        </div>
    );
};

export default ConvoStarterView;

