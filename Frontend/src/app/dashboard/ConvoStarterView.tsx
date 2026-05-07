import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MessageSquare, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle2, Instagram, MessageCircle, Loader2, Pencil, Image as ImageIcon, Reply, ArrowLeft, X, HelpCircle, List, Calendar, ChevronDown, Film, Globe, PlusSquare, Edit, LayoutGrid, GripVertical, Lock, Sparkles, Mail } from 'lucide-react';
import Card from '../../components/ui/card';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import AutomationActionBar from '../../components/dashboard/AutomationActionBar';
import TemplateSelector, { ReplyTemplate, prefetchReplyTemplates } from '../../components/dashboard/TemplateSelector';
import AutomationToast from '../../components/ui/AutomationToast';
import { useDashboard, ViewType } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import LockedFeatureToggle from '../../components/ui/LockedFeatureToggle';
import { takeTransientState } from '../../lib/transientState';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

// Max 4 Convo Starters per Instagram API limit
const MAX_CONVO_STARTERS = 4;

// Coalesce duplicate share-post media fetches across strict-mode re-mounts
let sharedConvoStarterMediaPromise: Promise<any[]> | null = null;
let sharedConvoStarterMediaKey = '';

interface ConvoStarter {
    question: string;
    payload: string;
    template_name?: string;
    template_type?: 'template_text' | 'template_carousel' | 'template_buttons' | 'template_media' | 'template_share_post' | 'template_quick_replies';
    template_id?: string;
    template_data?: any;
    followers_only?: boolean;
    followers_only_message?: string;
    followers_only_primary_button_text?: string;
    followers_only_secondary_button_text?: string;
    suggest_more_enabled?: boolean;
    once_per_user_24h?: boolean;
    collect_email_enabled?: boolean;
    collect_email_only_gmail?: boolean;
    collect_email_prompt_message?: string;
    collect_email_fail_retry_message?: string;
    collect_email_success_reply_message?: string;
    seen_typing_enabled?: boolean;
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
const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";
const COLLECT_EMAIL_PROMPT_DEFAULT = '📧 Could you share your best email so we can send the details and updates ✨';
const COLLECT_EMAIL_FAIL_RETRY_DEFAULT = '⚠️ That email looks invalid. Please send a valid email like name@example.com.';
const COLLECT_EMAIL_SUCCESS_DEFAULT = 'Perfect, thank you! Your email has been saved ✅';
const createBlankStarter = (): ConvoStarter => ({
    question: '',
    payload: '',
    followers_only: false,
    followers_only_message: FOLLOWERS_ONLY_MESSAGE_DEFAULT,
    followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
    followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
    suggest_more_enabled: false,
    once_per_user_24h: false,
    collect_email_enabled: false,
    collect_email_only_gmail: false,
    collect_email_prompt_message: COLLECT_EMAIL_PROMPT_DEFAULT,
    collect_email_fail_retry_message: COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
    collect_email_success_reply_message: COLLECT_EMAIL_SUCCESS_DEFAULT,
    seen_typing_enabled: false
});
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

    if (item.followers_only) {
        if (!String(item.followers_only_message || '').trim()) {
            errors.followers_only_message = 'Followers-only message is required.';
        }
        if (getByteLength(String(item.followers_only_primary_button_text || '')) > 40) {
            errors.followers_only_primary_button_text = 'Follow button text must be 40 UTF-8 bytes or less.';
        }
        if (getByteLength(String(item.followers_only_secondary_button_text || '')) > 40) {
            errors.followers_only_secondary_button_text = 'Retry button text must be 40 UTF-8 bytes or less.';
        }
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
        setCurrentView,
        getPlanGate
    } = useDashboard();
    const { authenticatedFetch } = useAuth();

    // State
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
    const [isHydratingInitialData, setIsHydratingInitialData] = useState(Boolean(activeAccountID));
    const [isPreparingEditor, setIsPreparingEditor] = useState(false);
    useDashboardMainScrollLock(Boolean(editingIndex !== null || isPreparingEditor));
    const [editorLoadingMessage, setEditorLoadingMessage] = useState('Preparing starter editor');
    const [itemBeforeEdit, setItemBeforeEdit] = useState<ConvoStarter | null>(null);
    const hasFetchedForAccount = useRef<string | null>(null);
    const pendingLinkedTemplateIdRef = useRef<string | null>(takeTransientState<string>('openLinkedTemplateId'));

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

    const primeEditorResources = useCallback(async () => {
        if (!activeAccountID) return;
        try {
            await prefetchReplyTemplates(activeAccountID, authenticatedFetch);
        } catch (_) { }
    }, [activeAccountID, authenticatedFetch]);

    const startCreate = useCallback(async () => {
        setEditorLoadingMessage('Opening starter editor');
        setIsPreparingEditor(true);
        try {
            await primeEditorResources();
            const blankStarter = createBlankStarter();
            setNewItem(blankStarter);
            setItemBeforeEdit(blankStarter);
            setEditingIndex(null);
            setSelectedTemplate(null);
            setValidationErrors({});
            setIsCreatingItem(true);
        } finally {
            setIsPreparingEditor(false);
        }
    }, [primeEditorResources]);

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
        setIsHydratingInitialData(Boolean(activeAccountID));
        if (!activeAccountID) {
            setInitialStarters([]);
        }
    }, [activeAccountID]);

    useEffect(() => {
        if (activeAccountID && convoStarterLoading) {
            setIsHydratingInitialData(true);
        }
    }, [activeAccountID, convoStarterLoading]);

    // Fetch data
    useEffect(() => {
        const needsFetch = activeAccountID
            && (!convoStarterData || convoStarterData.account_id !== activeAccountID)
            && hasFetchedForAccount.current !== activeAccountID;

        if (needsFetch) {
            hasFetchedForAccount.current = activeAccountID;
            void fetchConvoStarters();
        }
    }, [activeAccountID, convoStarterData, fetchConvoStarters]);
    useEffect(() => {
        if (hasFetchedForAccount.current && activeAccountID && hasFetchedForAccount.current !== activeAccountID) {
            hasFetchedForAccount.current = null;
        }
    }, [activeAccountID]);

    useEffect(() => {
        if (convoStarterData && convoStarterData.account_id === activeAccountID) {
            const starters = convoStarterData.db_starters?.length > 0
                ? convoStarterData.db_starters
                : convoStarterData.ig_starters || [];
            setConvoStarters(starters);
            setInitialStarters(JSON.parse(JSON.stringify(starters)));
            setIsHydratingInitialData(false);
        }
    }, [convoStarterData, activeAccountID, setConvoStarters]);

    // Unsaved changes tracking
    const hasChanges = useMemo(() => JSON.stringify(convoStarters) !== JSON.stringify(initialStarters), [convoStarters, initialStarters]);
    const itemHasChanges = useMemo(() => {
        if (!isCreatingItem) return false;
        const baseline = itemBeforeEdit || createBlankStarter();
        return JSON.stringify(newItem || createBlankStarter()) !== JSON.stringify(baseline);
    }, [isCreatingItem, itemBeforeEdit, newItem]);

    useEffect(() => {
        setHasUnsavedChanges(hasChanges || itemHasChanges);
    }, [hasChanges, itemHasChanges, setHasUnsavedChanges]);

    // Global Save/Discard Handlers (Protection)
    useEffect(() => {
        const saveHandler = async (): Promise<boolean> => {
            if (isCreatingItem && itemHasChanges) await handleSaveItem();
            return await handleSaveConvoStarters();
        };
        const discardHandler = () => {
            handleCancelEditing();
            setHasUnsavedChanges(false);
        };
        setSaveUnsavedChanges(() => saveHandler);
        setDiscardUnsavedChanges(() => discardHandler);
    }, [isCreatingItem, itemHasChanges, convoStarters, initialStarters, activeAccountID, setSaveUnsavedChanges, setDiscardUnsavedChanges, setHasUnsavedChanges, handleCancelEditing]);

    const loadReplyTemplate = useCallback(async (templateId?: string, fallbackType?: ConvoStarter['template_type'], fallbackData?: any, fallbackName?: string) => {
        if (!templateId || !activeAccountID) {
            return null;
        }

        try {
            const response = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${templateId}?account_id=${activeAccountID}`);
            if (response.ok) {
                const template = await response.json();
                return template as ReplyTemplate;
            }
        } catch (_) { }

        return {
            id: templateId,
            name: fallbackName || 'Selected Reply Template',
            template_type: (fallbackType || 'template_text') as any,
            template_data: fallbackData || {},
            type: 'saved'
        } as ReplyTemplate;
    }, [activeAccountID, authenticatedFetch]);

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

    useEffect(() => {
        if (isCreatingItem) {
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [isCreatingItem]);

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

    const handleCloseEditor = () => {
        setIsCreatingItem(false);
        setSelectedTemplate(null);
        setEditingIndex(null);
        setNewItem(null);
        setValidationErrors({});
        setItemBeforeEdit(null);
    };

    const handleEditStarter = useCallback(async (starter: ConvoStarter, index: number) => {
        setEditorLoadingMessage('Loading starter details');
        setIsPreparingEditor(true);
        try {
            await primeEditorResources();
            const [template] = await Promise.all([
                loadReplyTemplate(starter.template_id, starter.template_type, starter.template_data, starter.template_name)
            ]);
            const draft = JSON.parse(JSON.stringify(starter));
            setEditingIndex(index);
            setNewItem(draft);
            setItemBeforeEdit(draft);
            setSelectedTemplate(template);
            setValidationErrors({});
            setIsCreatingItem(true);
        } finally {
            setIsPreparingEditor(false);
        }
    }, [loadReplyTemplate, primeEditorResources]);

    useEffect(() => {
        const templateId = pendingLinkedTemplateIdRef.current;
        if (!templateId || isCreatingItem || convoStarters.length === 0) return;

        const targetIndex = convoStarters.findIndex(starter => starter.template_id === templateId);
        if (targetIndex === -1) return;

        void handleEditStarter(convoStarters[targetIndex], targetIndex);
        pendingLinkedTemplateIdRef.current = null;
    }, [convoStarters, handleEditStarter, isCreatingItem]);

    const handleDeleteCurrentStarter = async () => {
        if (editingIndex === null) return;
        setConvoStarters(convoStarters.filter((_, idx) => idx !== editingIndex));
        handleCloseEditor();
        setSuccess('Conversation starter removed from the draft.');
    };

    const handlePublish = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const cleanedStarters = convoStarters.map(starter => {
                const templateId = String(starter.template_id || starter.payload || '').trim();
                return {
                    question: starter.question,
                    payload: templateId,
                    template_id: templateId || undefined,
                    template_type: starter.template_type,
                    followers_only: starter.followers_only === true,
                    followers_only_message: starter.followers_only ? (starter.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT) : '',
                    followers_only_primary_button_text: starter.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                    followers_only_secondary_button_text: starter.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                    suggest_more_enabled: starter.suggest_more_enabled === true,
                    once_per_user_24h: starter.once_per_user_24h === true,
                    collect_email_enabled: starter.collect_email_enabled === true,
                    collect_email_only_gmail: starter.collect_email_only_gmail === true,
                    collect_email_prompt_message: starter.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT,
                    collect_email_fail_retry_message: starter.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
                    collect_email_success_reply_message: starter.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT,
                    seen_typing_enabled: starter.seen_typing_enabled === true
                };
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

    const isConvoStarterReady = Boolean(
        activeAccountID
        && convoStarterData
        && convoStarterData.account_id === activeAccountID
    );

    if (activeAccountID && !isCreatingItem && (!isConvoStarterReady || convoStarterLoading || isHydratingInitialData)) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Convo Starters"
                subMessage="Preparing your starter prompts and linked reply templates..."
            />
        );
    }

    if (isPreparingEditor) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message={editorLoadingMessage}
                subMessage="Preparing the starter editor and linked reply templates..."
            />
        );
    }

    const status = convoStarterData?.status || 'none';
    const canShowMainWorkspace = isCreatingItem || isConvoStarterReady;

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-3 sm:space-y-8 sm:px-4 md:px-6">
            <AutomationToast
                message={success}
                variant="success"
                onClose={() => setSuccess(null)}
            />
            <AutomationToast
                message={error}
                variant="error"
                onClose={() => setError(null)}
            />

            {!isCreatingItem && (
                <>
                    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Convo Starters</h1>
                            <p className="text-sm font-medium text-muted-foreground">Help new visitors start a conversation. You can keep up to 4 quick starter prompts live on Instagram.</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-stretch gap-2 sm:justify-end sm:gap-3">
                            <button
                                onClick={() => fetchConvoStarters(true)}
                                className="p-3 bg-secondary text-muted-foreground rounded-xl hover:bg-secondary/80 transition-all"
                            >
                                <RefreshCw className={`w-4 h-4 ${convoStarterLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <div className="flex bg-secondary p-1 rounded-xl border border-border">
                                <button
                                    onClick={() => setLayoutMode('grid')}
                                    className={`p-2 rounded-lg transition-all ${layoutMode === 'grid' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setLayoutMode('rows')}
                                    className={`p-2 rounded-lg transition-all ${layoutMode === 'rows' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                            {convoStarters.length < MAX_CONVO_STARTERS && (
                                <button
                                    onClick={() => {
                                        if (convoStarters.length >= MAX_CONVO_STARTERS) {
                                            setError(`Maximum ${MAX_CONVO_STARTERS} conversation starters allowed.`);
                                            return;
                                        }
                                        void startCreate();
                                    }}
                                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-[10px] font-black uppercase tracking-widest text-background shadow-xl shadow-foreground/10 transition-all sm:w-auto sm:px-8"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Question
                                </button>
                            )}
                            {hasChanges && editingIndex === null && (
                                <button onClick={handlePublish} disabled={saving} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all sm:w-auto sm:px-8">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Publish Changes
                                </button>
                            )}
                            {convoStarters.length > 0 && (
                                <button
                                    onClick={handleDeleteAll}
                                    disabled={isDeleting}
                                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3 text-[10px] font-black uppercase tracking-widest text-destructive-foreground shadow-xl shadow-destructive/20 transition-all disabled:opacity-70 sm:w-auto sm:px-8"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Delete
                                </button>
                            )}
                            {status === 'match' && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-success-muted/60 text-success text-[10px] font-black uppercase tracking-widest rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Synced
                                </span>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Main Workspace */}
            {canShowMainWorkspace && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                    {/* Left: Form */}
                    <div className="order-2 space-y-6 xl:order-1 xl:col-span-8 xl:overflow-y-auto xl:pr-2">
                        {isCreatingItem && newItem ? (
                            /* Edit Form */
                            <div className="space-y-8 rounded-[2rem] border border-content bg-card p-4 shadow-2xl shadow-foreground/10 sm:rounded-[2.25rem] sm:p-6 lg:space-y-10 lg:rounded-[2.5rem] lg:p-8 xl:space-y-12 xl:p-10">
                                <div className="-mx-2 rounded-[2rem] bg-card/95 px-2 py-2">
                                    <div className="flex flex-col gap-4 border border-content/70 rounded-[2rem] bg-card px-5 py-4 shadow-lg md:flex-row md:items-start md:justify-between">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleCloseEditor}
                                                className="p-3 rounded-2xl border-2 border-border hover:bg-muted/40 text-foreground transition-all hover:scale-105"
                                            >
                                                <ArrowLeft className="w-5 h-5" />
                                            </button>
                                            <div className="flex items-center gap-2 text-primary">
                                                <Plus className="w-5 h-5" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">{editingIndex !== null ? 'Edit Question' : 'New Question'}</span>
                                            </div>
                                        </div>
                                        <AutomationActionBar
                                            hasExisting={editingIndex !== null}
                                            isSaving={saving}
                                            onSave={handleSave}
                                            onDelete={handleDeleteCurrentStarter}
                                            saveDisabled={!selectedTemplate}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Question</label>
                                    <input
                                        value={newItem.question}
                                        onChange={(e) => setNewItem({ ...newItem, question: e.target.value })}
                                        className={`w-full bg-muted/40 border-2 ${validationErrors.question ? 'border-destructive' : 'border-content dark:border-border'} focus:border-primary outline-none rounded-2xl px-4 py-4 text-base font-black transition-all shadow-inner sm:px-6 sm:py-5 sm:text-lg`}
                                        placeholder="e.g. How can I help you today?"
                                    />
                                    <div className="flex justify-end items-center px-2">
                                        <span className="text-[10px] font-black text-muted-foreground">{getByteLength(newItem.question)}/80 bytes</span>
                                    </div>
                                    {validationErrors.question && (
                                        <p className="text-[10px] text-destructive font-bold px-2">{validationErrors.question}</p>
                                    )}
                                </div>

                                <div className="space-y-4 pt-6 border-t border-content">
                                    <LockedFeatureToggle
                                        icon={<Lock className={`w-5 h-5 ${newItem.followers_only ? 'text-primary' : 'text-muted-foreground'}`} />}
                                        title="Followers Only"
                                        description="Gate this starter until the sender follows the account."
                                        checked={Boolean(newItem.followers_only)}
                                        onToggle={() => setNewItem({
                                            ...newItem,
                                            followers_only: !newItem.followers_only,
                                            followers_only_message: !newItem.followers_only
                                                ? (newItem.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT)
                                                : ''
                                        })}
                                        locked={getPlanGate('followers_only').isLocked}
                                        note={getPlanGate('followers_only').note}
                                        onUpgrade={() => setCurrentView('My Plan')}
                                    />

                                    {newItem.followers_only && (
                                        <div className="space-y-4 rounded-2xl border border-content bg-card p-4 sm:p-6">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Followers-Only Message</label>
                                                <textarea
                                                    value={newItem.followers_only_message || ''}
                                                    onChange={(e) => setNewItem({ ...newItem, followers_only_message: e.target.value })}
                                                    className="input-base min-h-[96px] text-sm"
                                                    placeholder={FOLLOWERS_ONLY_MESSAGE_DEFAULT}
                                                />
                                                <div className="flex justify-end">
                                                    <span className="text-[10px] font-black text-muted-foreground">{getByteLength(newItem.followers_only_message || '')}/300 bytes</span>
                                                </div>
                                                {validationErrors.followers_only_message && <p className="text-[10px] text-destructive font-bold">{validationErrors.followers_only_message}</p>}
                                            </div>
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follow Button Text</label>
                                                    <input
                                                        value={newItem.followers_only_primary_button_text || ''}
                                                        onChange={(e) => setNewItem({ ...newItem, followers_only_primary_button_text: e.target.value })}
                                                        className="input-base text-sm"
                                                        placeholder={FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT}
                                                    />
                                                    {validationErrors.followers_only_primary_button_text && <p className="text-[10px] text-destructive font-bold">{validationErrors.followers_only_primary_button_text}</p>}
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Retry Button Text</label>
                                                    <input
                                                        value={newItem.followers_only_secondary_button_text || ''}
                                                        onChange={(e) => setNewItem({ ...newItem, followers_only_secondary_button_text: e.target.value })}
                                                        className="input-base text-sm"
                                                        placeholder={FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT}
                                                    />
                                                    {validationErrors.followers_only_secondary_button_text && <p className="text-[10px] text-destructive font-bold">{validationErrors.followers_only_secondary_button_text}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <LockedFeatureToggle
                                        icon={<Sparkles className={`w-5 h-5 ${newItem.suggest_more_enabled ? 'text-primary' : 'text-muted-foreground'}`} />}
                                        title="Suggest More"
                                        description="Send your Suggest More template after this conversation starter reply."
                                        checked={Boolean(newItem.suggest_more_enabled)}
                                        onToggle={() => setNewItem({ ...newItem, suggest_more_enabled: !newItem.suggest_more_enabled })}
                                        locked={getPlanGate('suggest_more').isLocked}
                                        note={getPlanGate('suggest_more').note}
                                        onUpgrade={() => setCurrentView('My Plan')}
                                    />

                                    <LockedFeatureToggle
                                        icon={<Calendar className={`w-5 h-5 ${newItem.once_per_user_24h ? 'text-primary' : 'text-muted-foreground'}`} />}
                                        title="Once Per User (24h)"
                                        description="Prevent the same person from triggering this starter again for 24 hours."
                                        checked={Boolean(newItem.once_per_user_24h)}
                                        onToggle={() => setNewItem({ ...newItem, once_per_user_24h: !newItem.once_per_user_24h })}
                                        locked={getPlanGate('once_per_user_24h').isLocked}
                                        note={getPlanGate('once_per_user_24h').note}
                                        onUpgrade={() => setCurrentView('My Plan')}
                                    />

                                    <LockedFeatureToggle
                                        icon={<Mail className={`w-5 h-5 ${newItem.collect_email_enabled ? 'text-primary' : 'text-muted-foreground'}`} />}
                                        title="Collect Email"
                                        description="Require a valid email before the main reply continues."
                                        checked={Boolean(newItem.collect_email_enabled)}
                                        onToggle={() => setNewItem({ ...newItem, collect_email_enabled: !newItem.collect_email_enabled })}
                                        locked={getPlanGate('collect_email').isLocked}
                                        note={getPlanGate('collect_email').note}
                                        onUpgrade={() => setCurrentView('My Plan')}
                                    />

                                    <LockedFeatureToggle
                                        icon={<MessageSquare className={`w-5 h-5 ${newItem.seen_typing_enabled ? 'text-primary' : 'text-muted-foreground'}`} />}
                                        title="Seen + Typing Reaction"
                                        description="Store the seen and typing preference with this starter."
                                        checked={Boolean(newItem.seen_typing_enabled)}
                                        onToggle={() => setNewItem({ ...newItem, seen_typing_enabled: !newItem.seen_typing_enabled })}
                                        locked={getPlanGate('seen_typing').isLocked}
                                        note={getPlanGate('seen_typing').note}
                                        onUpgrade={() => setCurrentView('My Plan')}
                                    />
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
                                                            template_name: template.name,
                                                            template_type: template.template_type as any,
                                                            template_id: template.id,
                                                            payload: template.id,
                                                            template_data: JSON.parse(JSON.stringify(template.template_data))
                                                        });
                                                    } else {
                                                        setNewItem({
                                                            ...(newItem || createBlankStarter()),
                                                            template_name: undefined,
                                                            template_type: undefined,
                                                            template_id: undefined,
                                                            payload: '',
                                                            template_data: undefined
                                                        });
                                                    }
                                                }}
                                                onCreateNew={() => setCurrentView('Reply Templates')}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3 rounded-[1.5rem] border-2 border-primary/20 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-3xl sm:p-6">
                                            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                                <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground shadow-lg shadow-primary/20 sm:p-3"><Reply className="w-5 h-5" /></div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black uppercase tracking-tight text-foreground">{selectedTemplate.name}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedTemplate.template_type.replace('template_', '')}</p>
                                                </div>
                                            </div>
                                            <div className="w-fit rounded-lg bg-success-muted/60 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-success">Selected</div>
                                        </div>
                                    )}
                                    {validationErrors.template && (
                                        <p className="text-[10px] text-destructive font-bold px-2">{validationErrors.template}</p>
                                    )}
                                </div>

                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Active Starters ({convoStarters.length}/{MAX_CONVO_STARTERS})
                                </p>
                                {convoStarters.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-border bg-muted/30 px-4 py-16 sm:rounded-[3rem] sm:py-24">
                                        <div className="p-6 bg-card rounded-3xl shadow-sm mb-6">
                                            <MessageSquare className="w-8 h-8 text-muted-foreground/60" />
                                        </div>
                                        <h3 className="text-lg font-black text-foreground mb-2">No Starters Yet</h3>
                                        <p className="text-muted-foreground font-medium text-sm text-center px-6">
                                            Create your first conversation starter to help users engage.
                                        </p>
                                        <button
                                            onClick={() => { void startCreate(); }}
                                            className="mt-8 flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-6 py-4 text-[11px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-95 sm:px-10"
                                        >
                                            <Plus className="w-4 h-4" /> Create First Question
                                        </button>
                                    </div>
                                ) : (
                                    <div className={layoutMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6' : 'space-y-4'}>
                                        {convoStarters.map((starter, index) => (
                                            <Card
                                                key={index}
                                                padding="none"
                                                draggable
                                                onDragStart={() => handleDragStart(index)}
                                                onDragOver={(e) => handleDragOver(e, index)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, index)}
                                                className={`group relative cursor-move rounded-[1.5rem] border bg-card p-4 transition-all duration-500 hover:shadow-2xl sm:rounded-[2rem] sm:p-6
                                                    ${dragOverIdx === index ? 'border-primary ring-2 ring-primary/20 scale-[1.02]' : 'border-content'}
                                                    ${dragIdx === index ? 'opacity-50 scale-95' : ''}
                                                `}
                                            >
                                                <div className="mb-4 flex items-start justify-between sm:mb-6">
                                                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                                        <div className="w-7 text-lg font-black text-muted-foreground/60 sm:w-8 sm:text-xl">
                                                            {String(index + 1).padStart(2, '0')}
                                                        </div>
                                                        <div className="p-2 bg-muted text-muted-foreground rounded-lg cursor-grab active:cursor-grabbing">
                                                            <GripVertical className="w-4 h-4" />
                                                        </div>
                                                        <div className="rounded-2xl bg-muted/40 p-3 text-muted-foreground transition-all duration-500 group-hover:bg-primary/10 group-hover:text-primary sm:p-4">
                                                            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                                                        </div>
                                                    </div>
                                                    <div className="ml-2 flex flex-wrap items-center justify-end gap-2">
                                                        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-primary sm:px-3 sm:tracking-widest">
                                                            {starter.template_type?.replace('template_', '') || 'Reply'}
                                                        </span>
                                                        <button
                                                            onClick={() => void handleEditStarter(starter, index)}
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
                                                    <h3 className="line-clamp-2 text-lg font-black text-foreground sm:text-xl">{starter.question}</h3>
                                                    <div className="rounded-2xl border border-content/50 bg-muted/30 p-3 sm:p-4">
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Connected Reply</p>
                                                        <div className="flex items-center gap-2">
                                                            <MessageSquare className="w-3 h-3 text-primary" />
                                                            <p className="text-xs font-bold text-muted-foreground truncate">
                                                                {starter.template_name || `${starter.template_type?.replace('template_', '') || 'Reply'} template`}
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
                    <AutomationPreviewPanel minHeightClassName={!isCreatingItem && convoStarters.length === 0 ? 'min-h-[400px]' : ''}>
                        {isCreatingItem && newItem && selectedTemplate ? (
                            <SharedMobilePreview
                                mode="convo_starter"
                                isEditing={true}
                                newItem={newItem as any}
                                activeAccountID={activeAccountID}
                                authenticatedFetch={authenticatedFetch}
                                displayName={activeAccount?.username || 'Username'}
                                profilePic={activeAccount?.profile_picture_url || null}
                                lockScroll
                            />
                        ) : convoStarters.length > 0 ? (
                            <SharedMobilePreview
                                mode="convo_starter"
                                items={convoStarters.map(starter => ({
                                    question: starter.question,
                                    type: 'postback' as const,
                                    template_name: starter.template_name,
                                    template_id: starter.template_id,
                                    template_type: starter.template_type,
                                    template_data: starter.template_data,
                                    followers_only: starter.followers_only,
                                    followers_only_message: starter.followers_only_message,
                                    followers_only_primary_button_text: starter.followers_only_primary_button_text,
                                    followers_only_secondary_button_text: starter.followers_only_secondary_button_text
                                }))}
                                activeAccountID={activeAccountID}
                                authenticatedFetch={authenticatedFetch}
                                displayName={activeAccount?.username || 'Username'}
                                profilePic={activeAccount?.profile_picture_url || null}
                                lockScroll
                            />
                        ) : (
                            <SharedMobilePreview
                                mode="convo_starter"
                                items={[]}
                                activeAccountID={activeAccountID}
                                authenticatedFetch={authenticatedFetch}
                                displayName={activeAccount?.username || 'Username'}
                                profilePic={activeAccount?.profile_picture_url || null}
                                lockScroll
                            />
                        )}
                    </AutomationPreviewPanel>
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
