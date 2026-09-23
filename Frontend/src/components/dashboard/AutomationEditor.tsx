import React, { useState, useEffect } from 'react';
import {
    FileText, Image as ImageIcon, Reply, Save, Loader2, X, Instagram,
    MessageSquare, AlertCircle, AlertTriangle, CheckCircle2, Trash2, HelpCircle, Power, Globe,
    MousePointerClick, Share2, Film, Radio, BookText, Plus, ChevronRight, Share2 as ShareIcon,
    Calendar, ChevronDown, Check, Info, Lightbulb, LayoutTemplate
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNotification } from '../../contexts/NotificationContext';
import ModernConfirmModal from '../ui/ModernConfirmModal';
import ToggleSwitch from '../ui/ToggleSwitch';
import LoadingOverlay from '../ui/LoadingOverlay';
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate, prefetchReplyTemplates } from './TemplateSelector';
import SharedMobilePreview from './SharedMobilePreview';
import AutomationActionBar from './AutomationActionBar';
import AutomationPreviewPanel from './AutomationPreviewPanel';
import LockedFeatureToggle from '../ui/LockedFeatureToggle';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import { normalizeAutomationKeywords } from '../../lib/automationKeywords';

const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_MESSAGE_MAX = 300;
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";
const AUTOMATION_TITLE_MAX = 25;
const getUtf8Length = (value: string) => new TextEncoder().encode(String(value || '')).length;

const trimToUtf8Length = (value: string, maxBytes: number) => {
    const input = String(value || '');
    if (getUtf8Length(input) <= maxBytes) return input;
    let result = '';
    for (const char of input) {
        if (getUtf8Length(result + char) > maxBytes) break;
        result += char;
    }
    return result;
};

const buildHiddenAutomationTitle = (type: AutomationEditorProps['type'], mediaId?: string, override?: string) => {
    const overrideValue = String(override || '').trim();
    if (overrideValue) {
        return trimToUtf8Length(overrideValue, AUTOMATION_TITLE_MAX);
    }

    const labels: Record<AutomationEditorProps['type'], string> = {
        dm: 'DM',
        comment: 'Comment',
        share: 'Share',
        mention: 'Mention',
        global: 'Global',
        posts: 'Post',
        reel: 'Reel',
        story: 'Story',
        live: 'Live'
    };

    const label = labels[type] || 'Automation';
    const normalizedId = String(mediaId || '').replace(/[^a-zA-Z0-9]/g, '');
    const suffix = normalizedId ? normalizedId.slice(-6) : '';
    const candidate = suffix ? `${label} ${suffix}` : `${label} Reply`;
    return trimToUtf8Length(candidate, AUTOMATION_TITLE_MAX);
};

function _sanitizeButtonForSave(btn: any) {
    const type = btn?.type || 'web_url';
    if (type === 'postback') {
        return {
            title: String(btn?.title || '').trim(),
            type: 'postback' as const,
            payload: String(btn?.payload || '').trim(),
        };
    }
    return {
        title: String(btn?.title || '').trim(),
        type: 'web_url' as const,
        url: String(btn?.url || '').trim(),
    };
}

function _mergeReplyTemplate(templateType: string, templateData: Record<string, unknown>): Record<string, unknown> {
    const d = templateData || {};
    switch (templateType) {
        case 'template_text': return { template_type: 'template_text', template_content: String(d.text || '') };
        case 'template_buttons': return { template_type: 'template_buttons', template_content: String(d.text || ''), buttons: Array.isArray(d.buttons) ? d.buttons.map(_sanitizeButtonForSave) : [] };
        case 'template_carousel': return {
            template_type: 'template_carousel',
            template_elements: Array.isArray(d.elements) ? d.elements.map((el: any) => ({
                ...el,
                buttons: Array.isArray(el?.buttons) ? el.buttons.map(_sanitizeButtonForSave) : []
            })) : []
        };
        case 'template_quick_replies': return { template_type: 'template_quick_replies', template_content: String(d.text || ''), replies: Array.isArray(d.replies) ? d.replies : [] };
        case 'template_media': return { template_type: 'template_media', template_content: String(d.media_url || ''), buttons: Array.isArray(d.buttons) ? d.buttons.map(_sanitizeButtonForSave) : [] };
        case 'template_share_post': return {
            template_type: 'template_share_post',
            media_id: String(d.media_id || ''),
            media_url: String(d.thumbnail_url || d.media_url || ''),
            thumbnail_url: String(d.thumbnail_url || ''),
            preview_media_url: String(d.preview_media_url || ''),
            linked_media_url: String(d.linked_media_url || ''),
            caption: String(d.caption || ''),
            media_type: String(d.media_type || ''),
            permalink: String(d.permalink || ''),
            use_latest_post: !!(d.use_latest_post),
            latest_post_type: (d.latest_post_type === 'reel' ? 'reel' : 'post')
        };
        default: return { template_type: 'template_text', template_content: String(d.text || '') };
    }
}

function _buildPersistedTemplateFields(templateType: string, templateData: Record<string, unknown>): Record<string, unknown> {
    const d = templateData || {};
    switch (templateType) {
        case 'template_text':
            return { template_type: 'template_text', template_content: String(d.text || '') };
        case 'template_buttons':
            return {
                template_type: 'template_buttons',
                template_content: String(d.text || ''),
                buttons: Array.isArray(d.buttons) ? d.buttons.map(_sanitizeButtonForSave) : []
            };
        case 'template_carousel':
            return {
                template_type: 'template_carousel',
                template_elements: Array.isArray(d.elements) ? d.elements.map((el: any) => ({
                    ...el,
                    buttons: Array.isArray(el?.buttons) ? el.buttons.map(_sanitizeButtonForSave) : []
                })) : []
            };
        case 'template_quick_replies':
            return {
                template_type: 'template_quick_replies',
                template_content: String(d.text || ''),
                replies: Array.isArray(d.replies) ? d.replies : []
            };
        case 'template_media':
            return {
                template_type: 'template_media',
                template_content: String(d.media_url || ''),
                buttons: Array.isArray(d.buttons) ? d.buttons.map(_sanitizeButtonForSave) : []
            };
        case 'template_share_post':
            return {
                template_type: 'template_share_post',
                media_id: String(d.media_id || ''),
                use_latest_post: !!d.use_latest_post,
                latest_post_type: d.latest_post_type === 'reel' ? 'reel' : 'post'
            };
        default:
            return { template_type: 'template_text', template_content: String(d.text || '') };
    }
}

interface AutomationEditorProps {
    type: 'dm' | 'comment' | 'share' | 'mention' | 'global' | 'posts' | 'reel' | 'story' | 'live';
    onClose: () => void;
    onSave: (savedAutomation?: any) => void;
    authenticatedFetch: any;
    activeAccountID: string;
    automationId?: string;
    mediaId?: string;
    onDelete?: (id: string) => Promise<void>;
    isStandalone?: boolean;
    titleOverride?: string;
    onChange?: (dirty: boolean) => void;
    onTemplateSelect?: (templateId: string | null) => void;
    onTemplatesLoaded?: (templates: ReplyTemplate[]) => void;
    /** When true, global type renders only form + footer; parent provides header, grid, and preview (DM-like layout). */
    useParentLayout?: boolean;
    variant?: 'modal' | 'card' | 'embedded';
    existingTitles?: Array<{ id?: string; title?: string }>;
    actionBarLeft?: React.ReactNode;
    initialAutomationData?: any;
    initialSelectedTemplate?: ReplyTemplate | null;
    showActionCancel?: boolean;
    saveButtonLabel?: string;
    registerSaveHandler?: (handler: () => Promise<boolean>) => void;
    autoCloseOnSave?: boolean;
}

const AutomationEditor: React.FC<AutomationEditorProps> = ({
    type, onClose, onSave, authenticatedFetch, activeAccountID, onDelete, automationId, mediaId, isStandalone, titleOverride, onChange, onTemplateSelect, onTemplatesLoaded, useParentLayout, variant = 'modal', existingTitles: _existingTitles, actionBarLeft, initialAutomationData, initialSelectedTemplate, showActionCancel = true, saveButtonLabel, registerSaveHandler, autoCloseOnSave = true
}) => {
    const { activeAccount, setCurrentView, hasPlanFeature, getPlanGate } = useDashboard();
    const { showSuccess, showError } = useNotification();
    const setError = React.useCallback((msg: string | null) => {
        if (msg) showError(msg);
    }, [showError]);
    const setSuccess = React.useCallback((msg: string | null) => {
        if (msg) showSuccess(msg);
    }, [showSuccess]);
    const [saving, setSaving] = useState(false);
    const [isPlanInvalid, setIsPlanInvalid] = useState(false);
    const [planInvalidFeatures, setPlanInvalidFeatures] = useState<string[]>([]);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [followersOnlyCollapsed, setFollowersOnlyCollapsed] = useState(false);
    const [commentReplyCollapsed, setCommentReplyCollapsed] = useState(false);

    const [automation, setAutomation] = useState<any>({
        title: '',
        trigger_type: type === 'global' ? 'keywords' : 'keywords', // 'keywords', 'all_comments', 'share_to_admin'
        keywords: type === 'global' ? [] : [], // For global, we'll use single keyword
        keyword: type === 'global' ? '' : '', // Single keyword for global
        template_type: 'template_text',
        template_content: '',
        active: true,
        is_active: true,
        followers_only: false,
        followers_only_message: FOLLOWERS_ONLY_MESSAGE_DEFAULT,
        suggest_more_enabled: false,
        private_reply_enabled: true,
        share_to_admin_enabled: false,
        once_per_user_24h: true,
        story_scope: 'shown',
        followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
        followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
        seen_typing_enabled: false,
        media_id: mediaId || '',
        template_elements: [],
        buttons: [],
        replies: [],
        comment_reply_text: ''
    });

    const [suggestMoreSetup, setSuggestMoreSetup] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');
    const [isEditingKeyword, setIsEditingKeyword] = useState(true);
    const [keywordConflicts, setKeywordConflicts] = useState<{ keyword: string; reason: string; automation_title?: string | null; automation_type?: string }[]>([]);
    const [duplicateKeywords, setDuplicateKeywords] = useState<Set<string>>(new Set());

    // Media Sharing states
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [isFetchingMedia, setIsFetchingMedia] = useState(false);
    const [sharePostContentType, setSharePostContentType] = useState<'all' | 'posts' | 'reels'>('all');
    const [sharePostDateRange, setSharePostDateRange] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
    const [sharePostSortBy, setSharePostSortBy] = useState<'recent' | 'oldest'>('recent');
    const [sharePostCustomRange, setSharePostCustomRange] = useState<{ from: Date | null, to: Date | null }>({ from: null, to: null });
    const [mediaDateDropdownOpen, setMediaDateDropdownOpen] = useState(false);
    const [mediaSortDropdownOpen, setMediaSortDropdownOpen] = useState(false);

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

    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [isSelectedTemplateLoading, setIsSelectedTemplateLoading] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isAutomationLoading, setIsAutomationLoading] = useState(Boolean(automationId));
    const [baselineSnapshot, setBaselineSnapshot] = useState('');
    const onChangeRef = React.useRef(onChange);
    const onTemplateSelectRef = React.useRef(onTemplateSelect);
    const onTemplatesLoadedRef = React.useRef(onTemplatesLoaded);
    const emitDirtyChange = React.useCallback((dirty: boolean) => {
        onChangeRef.current?.(dirty);
    }, []);
    const emitTemplateSelect = React.useCallback((templateId: string | null) => {
        onTemplateSelectRef.current?.(templateId);
    }, []);
    const emitTemplatesLoaded = React.useCallback((templates: ReplyTemplate[]) => {
        onTemplatesLoadedRef.current?.(templates);
    }, []);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onTemplateSelectRef.current = onTemplateSelect;
    }, [onTemplateSelect]);

    useEffect(() => {
        onTemplatesLoadedRef.current = onTemplatesLoaded;
    }, [onTemplatesLoaded]);

    const applyAutomationData = React.useCallback((data: any, template: ReplyTemplate | null = null) => {
        let templateElements: any[] = [];
        if (data.template_type === 'template_carousel' && data.template_content) {
            try {
                templateElements = typeof data.template_content === 'string'
                    ? JSON.parse(data.template_content)
                    : data.template_content;
                if (!Array.isArray(templateElements)) templateElements = [];
            } catch (e) {
                console.error('Failed to parse carousel template_content:', e);
                templateElements = [];
            }
        }

        let buttons: any[] = [];
        if (data.buttons) {
            buttons = typeof data.buttons === 'string' ? JSON.parse(data.buttons) : data.buttons;
        }

        let replies: any[] = [];
        if (data.replies) {
            replies = Array.isArray(data.replies) ? data.replies : (typeof data.replies === 'string' ? JSON.parse(data.replies) : []);
        }

        const { keywords: keywordArray, primaryKeyword } = normalizeAutomationKeywords(data);
        const automationData = {
            ...data,
            active: data?.is_active !== false,
            is_active: data?.is_active !== false,
            followers_only_message: data.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT,
            private_reply_enabled: data.private_reply_enabled !== false,
            share_to_admin_enabled: Boolean(data?.share_to_admin_enabled),
            once_per_user_24h: Boolean(data?.once_per_user_24h),
            story_scope: String(data?.story_scope || 'shown'),
            followers_only_primary_button_text: String(data?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
            followers_only_secondary_button_text: String(data?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
            seen_typing_enabled: Boolean(data?.seen_typing_enabled),
            keywords: keywordArray,
            keyword: type === 'global' ? primaryKeyword : '',
            template_elements: templateElements,
            buttons,
            replies,
            comment_reply_text: String(data.comment_reply_text || data.comment_reply || '')
        };

        setAutomation(automationData);
        const hasPlanInvalidState = String(data?.plan_validation_state || '').trim().toLowerCase() === 'invalid_due_to_plan';
        const nextInvalidFeatures = (() => {
            if (!hasPlanInvalidState) {
                return [];
            }
            if (Array.isArray(data?.invalid_features)) {
                return data.invalid_features.map((item: unknown) => String(item || '').trim()).filter(Boolean);
            }
            if (typeof data?.invalid_features === 'string') {
                try {
                    const parsed = JSON.parse(data.invalid_features);
                    if (Array.isArray(parsed)) {
                        return parsed.map((item: unknown) => String(item || '').trim()).filter(Boolean);
                    }
                } catch (_) { }
            }
            return [];
        })();
        setIsPlanInvalid(hasPlanInvalidState);
        setPlanInvalidFeatures(nextInvalidFeatures);
        if (type === 'global' && keywordArray.length > 0) {
            setKeywordInput(keywordArray[0]);
            setIsEditingKeyword(false);
        } else if (type === 'global') {
            setIsEditingKeyword(true);
        }

        if (template) {
            setSelectedTemplate(template);
            setIsSelectedTemplateLoading(false);
            setShowTemplateSelector(false);
            emitTemplateSelect(template.id || data.template_id || null);
            emitTemplatesLoaded([template]);
        } else if (data.template_id) {
            setSelectedTemplate(null);
            setIsSelectedTemplateLoading(true);
            setShowTemplateSelector(false);
            emitTemplateSelect(data.template_id);
        } else {
            setSelectedTemplate(null);
            setIsSelectedTemplateLoading(false);
            setShowTemplateSelector(true);
            emitTemplateSelect(null);
        }

        setIsInitialLoad(false);
    }, [emitTemplateSelect, emitTemplatesLoaded, type]);

    const serializeAutomationState = (value: any) => JSON.stringify({
        title: String(value?.title || ''),
        trigger_type: String(value?.trigger_type || ''),
        keywords: Array.isArray(value?.keywords) ? value.keywords : [],
        keyword: String(value?.keyword || ''),
        template_type: String(value?.template_type || ''),
        template_id: String(value?.template_id || ''),
        template_content: value?.template_content ?? '',
        active: value?.is_active !== undefined ? Boolean(value?.is_active) : Boolean(value?.active),
        is_active: value?.is_active !== false,
        followers_only: Boolean(value?.followers_only),
        followers_only_message: String(value?.followers_only_message || ''),
        suggest_more_enabled: Boolean(value?.suggest_more_enabled),
        private_reply_enabled: value?.private_reply_enabled !== false,
        share_to_admin_enabled: Boolean(value?.share_to_admin_enabled),
        once_per_user_24h: Boolean(value?.once_per_user_24h),
        story_scope: String(value?.story_scope || 'shown'),
        followers_only_primary_button_text: String(value?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
        followers_only_secondary_button_text: String(value?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
        seen_typing_enabled: Boolean(value?.seen_typing_enabled),
        media_id: String(value?.media_id || ''),
        template_elements: Array.isArray(value?.template_elements) ? value.template_elements : [],
        buttons: Array.isArray(value?.buttons) ? value.buttons : [],
        replies: Array.isArray(value?.replies) ? value.replies : [],
        comment_reply_text: String(value?.comment_reply_text || value?.comment_reply || '')
    });

    const isDirty = !isInitialLoad && !isAutomationLoading && !!baselineSnapshot && baselineSnapshot !== serializeAutomationState(automation);

    useEffect(() => {
        setBaselineSnapshot('');
    }, [automationId, mediaId, type]);

    useEffect(() => {
        if (!isInitialLoad && !isAutomationLoading && !baselineSnapshot) {
            setBaselineSnapshot(serializeAutomationState(automation));
        }
    }, [automation, baselineSnapshot, isInitialLoad, isAutomationLoading]);

    useEffect(() => {
        emitDirtyChange(isDirty);
    }, [emitDirtyChange, isDirty]);

    useEffect(() => {
        let alive = true;

        if (!activeAccountID) {
            setSuggestMoreSetup(false);
            return;
        }

        (async () => {
            try {
                const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/suggest-more?account_id=${activeAccountID}`);
                if (!res.ok) throw new Error('Failed to fetch suggest more');
                const data = await res.json();
                if (alive) setSuggestMoreSetup(Boolean(data?.is_setup));
            } catch (_) {
                if (alive) setSuggestMoreSetup(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [activeAccountID, authenticatedFetch]);



    useEffect(() => {
        if (!activeAccountID || !authenticatedFetch) return;

        void prefetchReplyTemplates(activeAccountID, authenticatedFetch)
            .then((templates) => {
                if (templates.length > 0) {
                    emitTemplatesLoaded(templates);
                }
            })
            .catch(() => { });
    }, [activeAccountID, authenticatedFetch, emitTemplatesLoaded]);

    useEffect(() => {
        setFieldErrors({});
        setError(null);
        setSuccess(null);

        if (automationId) {
            if (initialAutomationData) {
                applyAutomationData(initialAutomationData, initialSelectedTemplate || null);
                setIsAutomationLoading(false);
                return;
            }

            const fetchDetails = async () => {
                setIsAutomationLoading(true);
                try {
                    // Map frontend type to backend type for API call
                    const backendType = type === 'posts' ? 'post'
                        : type === 'reel' ? 'reel'
                            : type === 'story' ? 'story'
                                : type === 'live' ? 'live'
                                    : type;
                    const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${automationId}?account_id=${activeAccountID}&type=${backendType}`);
                    if (res.ok) {
                        const data = await res.json();
                        let resolvedTemplate: ReplyTemplate | null = null;
                        if (data.template_id) {
                            try {
                                const rr = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${data.template_id}?account_id=${activeAccountID}`);
                                if (rr.ok) {
                                    resolvedTemplate = await rr.json();
                                }
                            } catch (_) { }
                        }
                        applyAutomationData(data, resolvedTemplate);
                    } else {
                        setError("Failed to load automation details.");
                    }
                } catch (e) {
                    setError("Network error loading details.");
                } finally {
                    setIsAutomationLoading(false);
                }
            };
            fetchDetails();
        } else {
            setSelectedTemplate(null);
            setIsSelectedTemplateLoading(false);
            setShowTemplateSelector(true);
            emitTemplateSelect(null);
            setIsPlanInvalid(false);
            setPlanInvalidFeatures([]);
            setIsEditingKeyword(true);
            setKeywordInput('');
            setAutomation({
                title: '',
                keyword: '',
                keywords: [],
                trigger_type: 'keywords',
                template_type: 'template_text',
                template_content: '',
                active: true,
                is_active: true,
                followers_only: false,
                followers_only_message: FOLLOWERS_ONLY_MESSAGE_DEFAULT,
                suggest_more_enabled: false,
                private_reply_enabled: true,
                share_to_admin_enabled: false,
                once_per_user_24h: true,
                story_scope: 'shown',
                followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                seen_typing_enabled: false,
                media_id: mediaId || '',
                template_elements: [],
                buttons: [],
                replies: [],
                comment_reply_text: ''
            });
            setIsInitialLoad(false);
            setIsAutomationLoading(false);
        }
    }, [activeAccountID, applyAutomationData, authenticatedFetch, automationId, emitTemplateSelect, initialAutomationData, initialSelectedTemplate, mediaId]);

    // Load template when automation has template_id
    useEffect(() => {
        if (automation.template_id && !selectedTemplate) {
            (async () => {
                try {
                    setIsSelectedTemplateLoading(true);
                    const d = await fetchReplyTemplateById(activeAccountID, authenticatedFetch, automation.template_id);
                    if (d) {
                        setSelectedTemplate(d);
                        setShowTemplateSelector(false);
                        emitTemplateSelect(d.id || automation.template_id);
                        emitTemplatesLoaded([d]);
                    }
                } catch (_) { }
                finally {
                    setIsSelectedTemplateLoading(false);
                }
            })();
        }
    }, [activeAccountID, automation.template_id, authenticatedFetch, emitTemplateSelect, emitTemplatesLoaded, selectedTemplate]);

    useEffect(() => {
        if ((type === 'posts' || type === 'reel' || type === 'story') && automation.trigger_type === 'share_to_admin') {
            setAutomation((prev: any) => (
                prev.trigger_type === 'share_to_admin'
                    ? { ...prev, trigger_type: 'keywords' }
                    : prev
            ));
        }
    }, [automation.trigger_type, type]);

    const fetchMedia = async () => {
        if (!activeAccountID) return;
        setIsFetchingMedia(true);
        try {
            let url = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/media?account_id=${activeAccountID}`;
            if (sharePostContentType !== 'all') url += `&type=${sharePostContentType}`;
            if (sharePostDateRange !== 'all') url += `&range=${sharePostDateRange}`;
            if (sharePostSortBy) url += `&sort=${sharePostSortBy}`;
            if (sharePostDateRange === 'custom' && sharePostCustomRange.from && sharePostCustomRange.to) {
                url += `&from=${sharePostCustomRange.from.toISOString()}&to=${sharePostCustomRange.to.toISOString()}`;
            }

            const res = await authenticatedFetch(url);
            if (res.ok) {
                const data = await res.json();
                setMediaItems(data.data || []);
            }
        } catch (e) {
            console.error('Error fetching media:', e);
        } finally {
            setIsFetchingMedia(false);
        }
    };

    useEffect(() => {
        if (automation.template_type === 'template_share_post' && activeAccountID) {
            fetchMedia();
        }
    }, [automation.template_type, sharePostContentType, sharePostDateRange, sharePostSortBy, sharePostCustomRange, activeAccountID]);

    const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
        if (type === 'global') {
            // For global, just update the single keyword field
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = keywordInput.trim().toUpperCase();
                if (val) {
                    setAutomation((prev: any) => ({
                        ...prev,
                        keyword: val,
                        keywords: [val] // Keep keywords array for compatibility
                    }));
                    setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                    setIsEditingKeyword(false);
                }
            }
        } else {
            // For other types, use multiple keywords
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = keywordInput.trim().toUpperCase();
                if (val && !(automation.keywords || []).includes(val) && (automation.keywords || []).length < 5) {
                    setAutomation((prev: any) => ({
                        ...prev,
                        keywords: [...(prev.keywords || []), val]
                    }));
                    setKeywordInput('');
                    setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                }
            }
        }
    };

    const removeKeyword = (kw: string) => {
        const upper = String(kw || '').trim().toUpperCase();
        setDuplicateKeywords((prev) => {
            const next = new Set(prev);
            next.delete(upper);
            return next;
        });
        setKeywordConflicts((prev) => prev.filter((c) => String(c.keyword).trim().toUpperCase() !== upper));
        setFieldErrors((prev: any) => {
            const next = { ...prev };
            delete next['keywords'];
            return next;
        });

        if (type === 'global') {
            setAutomation((prev: any) => ({
                ...prev,
                keyword: '',
                keywords: []
            }));
        } else {
            setAutomation((prev: any) => ({
                ...prev,
                keywords: (prev.keywords || []).filter((k: string) => k !== kw)
            }));
        }
    };

    const handleSave = React.useCallback(async () => {
        if (saving) return false;
        // Auto-generate title if hidden and missing or invalid length
        const isTitleHidden = (type !== 'dm' && type !== 'global');
        let currentTitle = automation.title || '';
        if (isTitleHidden) {
            if (!currentTitle.trim() || getUtf8Length(currentTitle) > AUTOMATION_TITLE_MAX) {
                currentTitle = buildHiddenAutomationTitle(type, mediaId, titleOverride);
            } else {
                currentTitle = trimToUtf8Length(currentTitle.trim(), AUTOMATION_TITLE_MAX);
            }
        }

        const errors: { [key: string]: string } = {};
        if (!isTitleHidden) {
            if (!currentTitle.trim()) {
                errors.title = "Identification title is required";
            } else if (getUtf8Length(currentTitle) > AUTOMATION_TITLE_MAX) {
                errors.title = `Identification title must be at most ${AUTOMATION_TITLE_MAX} UTF-8 bytes`;
            } else if (getUtf8Length(currentTitle) < 2) {
                errors.title = `Identification title must be at least 2 UTF-8 bytes`;
            }
        }

        if (type === 'global') {
            // For global, check single keyword
            if (!automation.keyword || !automation.keyword.trim()) {
                errors.keywords = "Keyword is required";
            }
        } else if (automation.trigger_type === 'keywords' && (automation.keywords || []).length === 0) {
            errors.keywords = "At least one trigger keyword is required";
        }

        if (!selectedTemplate) {
            errors.template = "Please select a reply template or create one in Reply Templates.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setError("Please fill in all required fields.");
            setTimeout(() => {
                const firstErrorKey = Object.keys(errors)[0];
                const target = document.getElementById(`field_${firstErrorKey}`) ||
                    document.getElementById('field_title') ||
                    document.getElementById('field_keywords') ||
                    document.getElementById('field_template') ||
                    document.querySelector('.border-destructive, [class*="border-destructive"], .border-red-500, [class*="border-red-500"]');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                        target.focus();
                    }
                }
            }, 100);
            return false;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            // Uniqueness checks could be added here if needed

            // Map frontend type to backend type
            const backendType = type === 'posts' ? 'post'
                : type === 'reel' ? 'reel'
                    : type === 'story' ? 'story'
                        : type === 'live' ? 'live'
                            : type;

            // Prepare payload: backend expects 'keyword' (array), not 'keywords'
            let keywordArray: string[] = [];
            if (type === 'global') {
                // For global, use single keyword
                const kw = isEditingKeyword && keywordInput.trim() ? keywordInput.trim().toUpperCase() : automation.keyword;
                keywordArray = kw ? [kw] : [];
            } else {
                keywordArray = automation.keywords || automation.keyword || [];
            }
            keywordArray = (keywordArray || []).map((k: string) => String(k || '').trim().toUpperCase()).filter(Boolean);

            const followersOnlyMessage = String(automation.followers_only_message || '').trim();
            if (automation.followers_only) {
                if (!followersOnlyMessage) {
                    setFieldErrors((prev) => ({ ...prev, followers_only_message: 'Followers-only message is required.' }));
                    setSaving(false);
                    return false;
                }
                if (getUtf8Length(followersOnlyMessage) > FOLLOWERS_ONLY_MESSAGE_MAX) {
                    setFieldErrors((prev) => ({ ...prev, followers_only_message: `Followers-only message must be at most ${FOLLOWERS_ONLY_MESSAGE_MAX} UTF-8 bytes.` }));
                    setSaving(false);
                    return false;
                }
            }

            const followersPrimaryButton = String(automation.followers_only_primary_button_text || '').trim();
            const followersSecondaryButton = String(automation.followers_only_secondary_button_text || '').trim();
            if (followersPrimaryButton && getUtf8Length(followersPrimaryButton) > 40) {
                setFieldErrors((prev) => ({ ...prev, followers_only_primary_button_text: 'Primary button text must be at most 40 UTF-8 bytes.' }));
                setSaving(false);
                return false;
            }
            if (followersSecondaryButton && getUtf8Length(followersSecondaryButton) > 40) {
                setFieldErrors((prev) => ({ ...prev, followers_only_secondary_button_text: 'Retry button text must be at most 40 UTF-8 bytes.' }));
                setSaving(false);
                return false;
            }

            const payload: any = {
                ...automation,
                title: currentTitle,
                type: backendType,
                automation_type: backendType,
                keyword: keywordArray,
                is_active: automation.is_active !== false,
                comment_reply: automation.comment_reply_text || '',
                trigger_type: automation.trigger_type || 'keywords',
                followers_only_message: automation.followers_only
                    ? (followersOnlyMessage || FOLLOWERS_ONLY_MESSAGE_DEFAULT)
                    : '',
                share_to_admin_enabled: automation.share_to_admin_enabled === true,
                once_per_user_24h: automation.once_per_user_24h === true,
                story_scope: automation.story_scope || 'shown',
                followers_only_primary_button_text: automation.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                followers_only_secondary_button_text: automation.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                seen_typing_enabled: automation.seen_typing_enabled === true,
            };
            if (selectedTemplate) {
                payload.template_id = selectedTemplate.id;
                // Persist only the fields the automation runtime actually needs.
                Object.assign(payload, _buildPersistedTemplateFields(selectedTemplate.template_type, selectedTemplate.template_data || {}));
            }
            // Remove frontend-specific fields that backend doesn't need
            delete payload.keywords;
            delete payload.active;
            delete payload.comment_reply_text;

            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations${automation.$id ? `/${automation.$id}` : ''}?account_id=${activeAccountID}${automation.$id ? '' : `&type=${backendType}`}`, {
                method: automation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                // Reset baseline to current automation state so isDirty becomes false.
                // We must use `automation` (not `payload`) because isDirty compares
                // against serializeAutomationState(automation), and payload has fields
                // deleted/transformed (keywords, active, comment_reply_text) that would
                // cause a permanent mismatch.
                setBaselineSnapshot(serializeAutomationState(automation));
                showSuccess(automation.$id ? "Automation updated successfully!" : "Automation activated successfully!");
                onSave(data);
                return true;
            } else {
                if (data.conflicts && Array.isArray(data.conflicts) && data.conflicts.length > 0) {
                    setKeywordConflicts(data.conflicts);
                } else if (data.duplicate_keywords && Array.isArray(data.duplicate_keywords) && data.duplicate_keywords.length > 0) {
                    setKeywordConflicts(data.duplicate_keywords.map((kw: string) => ({
                        keyword: kw,
                        reason: data.error || `Keyword "${kw}" is already used in another automation or global trigger.`
                    })));
                }

                if (data.duplicate_keywords && Array.isArray(data.duplicate_keywords)) {
                    setDuplicateKeywords(new Set(data.duplicate_keywords.map((kw: string) => String(kw).trim().toUpperCase())));
                }

                if (data.field === 'keywords' || data.fields?.keywords || (data.duplicate_keywords && data.duplicate_keywords.length > 0)) {
                    setFieldErrors((prev: any) => ({
                        ...prev,
                        keywords: data.error || "Duplicate keywords detected"
                    }));

                    setTimeout(() => {
                        const kwEl = document.getElementById('field_keywords');
                        if (kwEl) {
                            kwEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            kwEl.focus();
                        }
                    }, 100);
                }

                showError(data.error || "Failed to save automation.");
                return false;
            }
        } catch (err) {
            showError("Network error occurred.");
            return false;
        } finally {
            setSaving(false);
        }
    }, [activeAccountID, authenticatedFetch, autoCloseOnSave, automation, isStandalone, mediaId, onClose, onSave, selectedTemplate, titleOverride, type]);

    useEffect(() => {
        registerSaveHandler?.(handleSave);
    }, [handleSave, registerSaveHandler]);

    if (automationId && isAutomationLoading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Preparing Automation Editor"
                subMessage="Loading the latest automation settings..."
            />
        );
    }

    const renderForm = () => (
        <div className={`space-y-6 pb-16 sm:space-y-8 ${type === 'global' && useParentLayout ? '' : 'border-r border-slate-100 p-4 dark:border-slate-900 sm:p-6 lg:p-8'}`}>
            {isPlanInvalid && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-700 dark:text-amber-300 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>This automation is currently invalid due to plan restrictions.</span>
                    </div>
                    <p className="mt-2 font-medium break-words">Blocked features: {planInvalidFeatures.length ? planInvalidFeatures.join(', ') : 'Not specified'}</p>
                </div>
            )}

            <div className="space-y-6">
                {/* 1. Automation Core (DM-like): Title + Keyword in 2-col for global useParentLayout */}
                {(type === 'dm' || type === 'global') && (
                    (type === 'global' && useParentLayout) ? (
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Automation Core</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center gap-2 mb-1 px-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium text-foreground">Internal Reference Title</label>
                                            <div className="group relative">
                                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground border border-border text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md">
                                                    This name is only for you to identify this automation in the dashboard.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        id="field_title"
                                        value={automation.title}
                                        onChange={e => setAutomation({ ...automation, title: e.target.value })}
                                        className={`w-full rounded-xl border ${fieldErrors['title'] ? 'border-destructive' : 'border-border'} bg-background py-2.5 px-3.5 text-sm font-normal text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary`}
                                        placeholder="e.g. Price Check"
                                    />
                                    <p className="text-xs text-muted-foreground px-1">Required. This title helps you organize and find your automations easily later.</p>
                                    {fieldErrors['title'] && <p className="text-xs font-medium text-destructive px-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {fieldErrors['title']}</p>}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                        <label className="text-xs font-medium text-foreground">Trigger Keyword</label>
                                        <span className="text-xs font-normal text-muted-foreground">{keywordInput?.length || 0}/15</span>
                                    </div>
                                    <div className="relative flex items-center gap-2">
                                        <input
                                            id="field_keywords"
                                            value={isEditingKeyword ? keywordInput : (automation.keyword || '')}
                                            disabled={!isEditingKeyword}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                setKeywordInput(val);
                                                if (keywordConflicts.length > 0) {
                                                    setKeywordConflicts([]);
                                                    setDuplicateKeywords(new Set());
                                                    setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                                }
                                            }}
                                            onKeyDown={handleKeywordKeyDown}
                                            className={`w-full bg-background border ${
                                                fieldErrors['keywords'] || keywordConflicts.length > 0 ? 'border-destructive ring-1 ring-destructive/20' : 'border-border'
                                            } focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-xl py-2.5 px-3.5 pr-20 text-sm font-medium text-foreground transition-all ${
                                                !isEditingKeyword ? 'opacity-70 cursor-not-allowed bg-muted/40' : ''
                                            }`}
                                            placeholder="Type keyword and press Enter..."
                                            maxLength={15}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                                            {isEditingKeyword ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const val = keywordInput.trim().toUpperCase();
                                                        if (val) {
                                                            setAutomation((prev: any) => ({
                                                                ...prev,
                                                                keyword: val,
                                                                keywords: [val]
                                                            }));
                                                            setIsEditingKeyword(false);
                                                            setKeywordConflicts([]);
                                                            setDuplicateKeywords(new Set());
                                                            setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                                        }
                                                    }}
                                                    className="h-8 px-3 bg-foreground text-background hover:bg-foreground/90 rounded-lg text-xs font-medium transition-all"
                                                >
                                                    Add
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingKeyword(true)}
                                                    className="h-8 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-medium transition-all"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-medium px-2">Required: Set a single keyword that triggers this reply.</p>
                                    {keywordConflicts.length > 0 && (
                                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                                                <span>Cannot Save: Keyword Conflict</span>
                                            </div>
                                            <div className="space-y-1 pl-5">
                                                {keywordConflicts.map((c, idx) => (
                                                    <p key={idx} className="text-xs text-destructive/90 leading-relaxed font-medium">
                                                        • {c.reason}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {fieldErrors['keywords'] && keywordConflicts.length === 0 && (
                                        <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3 shrink-0" /> {fieldErrors['keywords']}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 flex items-start gap-3 bg-muted/40 p-4 rounded-xl border border-border">
                                <div className="p-2 bg-card rounded-lg border border-border shrink-0">
                                    <Lightbulb className="w-4 h-4 text-warning" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-foreground mb-0.5">Important: Matching Rules</p>
                                    <p className="text-xs font-normal text-muted-foreground leading-relaxed">
                                        <span className="font-medium text-foreground">Keywords are case insensitive:</span> All keywords are treated as uppercase.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-medium text-foreground">Internal Reference Title</label>
                                <div className="group relative">
                                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground border border-border text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md">
                                        This name is only for you to identify this automation in the dashboard.
                                    </div>
                                </div>
                            </div>
                            <input
                                id="field_title"
                                value={automation.title}
                                onChange={e => setAutomation({ ...automation, title: e.target.value })}
                                className={`w-full rounded-xl border ${fieldErrors['title'] ? 'border-destructive' : 'border-border'} bg-background py-2.5 px-3.5 text-sm font-normal text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary`}
                                placeholder="e.g. Price Check"
                            />
                            <p className="text-xs text-muted-foreground px-1">Required: This title helps you organize and find your automations easily later.</p>
                            {fieldErrors['title'] && <p className="text-xs text-destructive font-medium px-1">{fieldErrors['title']}</p>}
                        </div>
                    )
                )}

                {supportsAutomationStatus && (
                    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 transition-all ${automation.is_active !== false ? 'ring-1 ring-primary/20' : ''}`}>
                        <div className="flex items-start gap-3 sm:items-center">
                            <div className={`p-2 rounded-lg border ${automation.is_active !== false
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-muted border-border text-muted-foreground'
                                }`}>
                                <Power className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground">Automation Status</p>
                                <p className="text-xs font-normal text-muted-foreground">Turn this automation on or off before you publish changes.</p>
                            </div>
                        </div>
                        <div className="flex w-full justify-end sm:w-auto">
                            <ToggleSwitch
                                isChecked={automation.is_active !== false}
                                onChange={() => {
                                    const nextIsActive = !(automation.is_active !== false);
                                    setAutomation({ ...automation, is_active: nextIsActive, active: nextIsActive });
                                }}
                                variant="plain"
                            />
                        </div>
                    </div>
                )}

                {/* 2. Followers Only Toggle */}
                <LockedFeatureToggle
                    icon={<Power className={`w-5 h-5 ${automation.followers_only ? 'text-blue-500' : 'text-gray-400'}`} />}
                    title="Followers Only"
                    description="Only respond to users who already follow your account."
                    checked={automation.followers_only || false}
                    onToggle={() => {
                        const nextFollowersOnly = !automation.followers_only;
                        setAutomation({
                            ...automation,
                            followers_only: nextFollowersOnly,
                            followers_only_message: automation.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT
                        });
                        if (nextFollowersOnly) {
                            setFollowersOnlyCollapsed(false);
                        }
                        if (!nextFollowersOnly && fieldErrors['followers_only_message']) {
                            setFieldErrors((prev: any) => {
                                const next = { ...prev };
                                delete next['followers_only_message'];
                                return next;
                            });
                        }
                    }}
                    locked={getPlanGate('followers_only').isLocked}
                    note={getPlanGate('followers_only').note}
                    onUpgrade={() => setCurrentView('My Plan')}
                    activeIconClassName="text-blue-500"
                    isCollapsed={followersOnlyCollapsed}
                    onCollapseToggle={() => setFollowersOnlyCollapsed(!followersOnlyCollapsed)}
                />
                {automation.followers_only && !followersOnlyCollapsed && (
                    <div className="bg-card p-4 sm:p-5 rounded-xl border border-border space-y-4">
                        <div className="flex justify-between items-center px-0.5">
                            <label className="text-xs font-medium text-foreground">Followers-Only Message</label>
                            <span className={`text-xs ${getUtf8Length(automation.followers_only_message || '') > FOLLOWERS_ONLY_MESSAGE_MAX ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {getUtf8Length(automation.followers_only_message || '')}/{FOLLOWERS_ONLY_MESSAGE_MAX} bytes
                            </span>
                        </div>
                        <textarea
                            value={automation.followers_only_message || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (getUtf8Length(val) <= FOLLOWERS_ONLY_MESSAGE_MAX) {
                                    setAutomation({ ...automation, followers_only_message: val });
                                    if (fieldErrors['followers_only_message']) {
                                        setFieldErrors((prev: any) => {
                                            const next = { ...prev };
                                            delete next['followers_only_message'];
                                            return next;
                                        });
                                    }
                                }
                            }}
                            className={`w-full min-h-[88px] resize-y bg-background border ${fieldErrors['followers_only_message'] ? 'border-destructive' : 'border-border'} rounded-xl p-3 text-xs font-normal text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary`}
                            placeholder={FOLLOWERS_ONLY_MESSAGE_DEFAULT}
                        />
                        {fieldErrors['followers_only_message'] && (
                            <p className="text-xs text-destructive font-medium">{fieldErrors['followers_only_message']}</p>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-0.5">
                                    <label className="text-xs font-medium text-foreground">Follow Button Text</label>
                                    <span className="text-xs text-muted-foreground">{getUtf8Length(automation.followers_only_primary_button_text || '')}/40 bytes</span>
                                </div>
                                <input
                                    value={automation.followers_only_primary_button_text || ''}
                                    onChange={(e) => setAutomation({ ...automation, followers_only_primary_button_text: e.target.value })}
                                    className={`w-full rounded-xl border ${fieldErrors['followers_only_primary_button_text'] ? 'border-destructive' : 'border-border'} bg-background px-3 py-2 text-xs font-normal text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary`}
                                    placeholder={FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT}
                                />
                                {fieldErrors['followers_only_primary_button_text'] && <p className="text-xs text-destructive font-medium">{fieldErrors['followers_only_primary_button_text']}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-0.5">
                                    <label className="text-xs font-medium text-foreground">Retry Button Text</label>
                                    <span className="text-xs text-muted-foreground">{getUtf8Length(automation.followers_only_secondary_button_text || '')}/40 bytes</span>
                                </div>
                                <input
                                    value={automation.followers_only_secondary_button_text || ''}
                                    onChange={(e) => setAutomation({ ...automation, followers_only_secondary_button_text: e.target.value })}
                                    className={`w-full rounded-xl border ${fieldErrors['followers_only_secondary_button_text'] ? 'border-destructive' : 'border-border'} bg-background px-3 py-2 text-xs font-normal text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary`}
                                    placeholder={FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT}
                                />
                                {fieldErrors['followers_only_secondary_button_text'] && <p className="text-xs text-destructive font-medium">{fieldErrors['followers_only_secondary_button_text']}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2.5. Suggest More Toggle */}
                {
                    <div className="space-y-2">
                        <LockedFeatureToggle
                            icon={<Lightbulb className={`w-5 h-5 ${automation.suggest_more_enabled ? 'text-yellow-500' : 'text-gray-400'}`} />}
                            title="Suggest More"
                            description="Add a Suggest More button after this automation reply."
                            checked={automation.suggest_more_enabled || false}
                            onToggle={() => setAutomation({ ...automation, suggest_more_enabled: !automation.suggest_more_enabled })}
                            locked={getPlanGate('suggest_more').isLocked}
                            note={getPlanGate('suggest_more').note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-yellow-500"
                        />
                        {automation.suggest_more_enabled && !suggestMoreSetup && !getPlanGate('suggest_more').isLocked && (
                            <div className="ml-2 flex items-center gap-2 rounded-2xl border border-yellow-200 dark:border-yellow-500/20 bg-yellow-50/60 dark:bg-yellow-500/5 px-4 py-3">
                                <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                                <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-300">Suggest More is not configured yet. <button type="button" onClick={() => { onClose(); setCurrentView('Suggest More'); }} className="underline hover:no-underline font-black">Set it up now</button> for this toggle to take effect.</p>
                            </div>
                        )}
                    </div>
                }

                {supportsOncePerUser && (
                    <LockedFeatureToggle
                        icon={<Calendar className={`w-5 h-5 ${automation.once_per_user_24h ? 'text-cyan-500' : 'text-gray-400'}`} />}
                        title="Once Per User (24h)"
                        description="Prevent the same person from retriggering this automation again for 24 hours. Turn on to save action limits."
                        checked={automation.once_per_user_24h === true}
                        onToggle={() => setAutomation({ ...automation, once_per_user_24h: !(automation.once_per_user_24h === true) })}
                        locked={getPlanGate('once_per_user_24h').isLocked}
                        note={getPlanGate('once_per_user_24h').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-cyan-500"
                    />
                )}



                {supportsSeenTyping && (
                    <LockedFeatureToggle
                        icon={<MessageSquare className={`w-5 h-5 ${automation.seen_typing_enabled ? 'text-violet-500' : 'text-gray-400'}`} />}
                        title="Seen + Typing Reaction"
                        description="Simulate seen and typing indicators before sending the automated reply."
                        checked={automation.seen_typing_enabled === true}
                        onToggle={() => setAutomation({ ...automation, seen_typing_enabled: !(automation.seen_typing_enabled === true) })}
                        locked={seenTypingLocked}
                        note={seenTypingGate.note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-violet-500"
                    />
                )}

                {supportsShareToAdmin && (
                    <LockedFeatureToggle
                        icon={<Share2 className={`w-5 h-5 ${automation.share_to_admin_enabled ? 'text-emerald-500' : 'text-gray-400'}`} />}
                        title="Share To Admin"
                        description="Share the post or reel to the admin, then the reply template will be sent automatically."
                        checked={automation.share_to_admin_enabled === true}
                        onToggle={() => setAutomation({ ...automation, share_to_admin_enabled: !(automation.share_to_admin_enabled === true) })}
                        locked={shareToAdminLocked}
                        note={shareToAdminGate.note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-emerald-500"
                    />
                )}

                {/* 3. Trigger Selection - Hidden for Global Type */}
                {type !== 'global' && (
                    <div className="space-y-4 pt-6 border-t border-border">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger Type</h3>
                        <div className={`grid gap-2 sm:gap-3 ${triggerOptions.length === 2 ? 'grid-cols-1 min-[380px]:grid-cols-2' : 'grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3'}`}>
                            {triggerOptions.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setAutomation({ ...automation, trigger_type: t.id })}
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                                        automation.trigger_type === t.id
                                            ? 'border-primary bg-primary/10 text-primary font-medium'
                                            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 font-normal'
                                    }`}
                                >
                                    <t.icon className="w-4 h-4" />
                                    <span className="text-xs text-center leading-tight">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {automation.trigger_type === 'keywords' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="relative group">
                                    <input
                                        id="field_keywords"
                                        value={keywordInput}
                                        onChange={e => {
                                            setKeywordInput(e.target.value.toUpperCase());
                                            if (keywordConflicts.length > 0) {
                                                setKeywordConflicts([]);
                                                setDuplicateKeywords(new Set());
                                                setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                            }
                                        }}
                                        onKeyDown={handleKeywordKeyDown}
                                        className={`w-full bg-background border ${fieldErrors['keywords'] || keywordConflicts.length > 0 ? 'border-destructive ring-1 ring-destructive/20' : 'border-border'} focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-xl py-2.5 px-3.5 pr-20 text-sm font-normal text-foreground transition-all`}
                                        placeholder="Type keyword and press Enter..."
                                        maxLength={15}
                                        disabled={(automation.keywords || []).length >= 5}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                        {(automation.keywords || []).length}/5
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground px-1">Required: Set at least one keyword that customers should type to trigger this reply.</p>

                                <div className="flex flex-wrap gap-1.5 px-0.5">
                                    {(automation.keywords || []).map((kw: string) => {
                                        const isConflict = duplicateKeywords.has(String(kw || '').trim().toUpperCase());
                                        return (
                                            <div
                                                key={kw}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium animate-in zoom-in-95 transition-all ${
                                                    isConflict
                                                        ? 'bg-destructive/15 border border-destructive text-destructive font-semibold shadow-2xs'
                                                        : 'bg-muted border border-border text-foreground'
                                                }`}
                                            >
                                                <span>{kw}</span>
                                                <X className="w-3.5 h-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => removeKeyword(kw)} />
                                            </div>
                                        );
                                    })}
                                </div>

                                {keywordConflicts.length > 0 && (
                                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                                            <span>Cannot Save: Keyword Conflict Detected</span>
                                        </div>
                                        <div className="space-y-1 pl-5">
                                            {keywordConflicts.map((c, idx) => (
                                                <p key={idx} className="text-xs text-destructive/90 leading-relaxed font-medium">
                                                    • {c.reason}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {fieldErrors['keywords'] && keywordConflicts.length === 0 && (
                                    <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors['keywords']}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Global Type: Single Keyword Input (hidden when useParentLayout; shown in Automation Core 2-col) */}
                {type === 'global' && !useParentLayout && (
                    <div className="space-y-4 pt-6 border-t border-border">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger Keyword</h3>
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="relative flex items-center gap-2">
                                <input
                                    id="field_keywords"
                                    value={isEditingKeyword ? keywordInput : (automation.keyword || '')}
                                    disabled={!isEditingKeyword}
                                    onChange={e => {
                                        const val = e.target.value.toUpperCase();
                                        setKeywordInput(val);
                                        if (keywordConflicts.length > 0) {
                                            setKeywordConflicts([]);
                                            setDuplicateKeywords(new Set());
                                            setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                        }
                                    }}
                                    onKeyDown={handleKeywordKeyDown}
                                    className={`w-full bg-background border ${
                                        fieldErrors['keywords'] || keywordConflicts.length > 0 ? 'border-destructive ring-1 ring-destructive/20' : 'border-border'
                                    } focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-xl py-2.5 px-3.5 pr-20 text-sm font-normal text-foreground transition-all ${
                                        !isEditingKeyword ? 'opacity-70 cursor-not-allowed bg-muted/40' : ''
                                    }`}
                                    placeholder="Enter keyword (e.g., PRICE, HELP, INFO)..."
                                    maxLength={15}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
                                    {isEditingKeyword ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const val = keywordInput.trim().toUpperCase();
                                                if (val) {
                                                    setAutomation((prev: any) => ({
                                                        ...prev,
                                                        keyword: val,
                                                        keywords: [val]
                                                    }));
                                                    setIsEditingKeyword(false);
                                                    setKeywordConflicts([]);
                                                    setDuplicateKeywords(new Set());
                                                    setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                                }
                                            }}
                                            className="h-8 px-3 bg-foreground text-background hover:bg-foreground/90 rounded-lg text-xs font-medium transition-all"
                                        >
                                            Add
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingKeyword(true)}
                                            className="h-8 px-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-medium transition-all"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground px-1">Required: Enter a single keyword that will trigger this automation across all posts, reels, stories, and live.</p>
                            {keywordConflicts.length > 0 && (
                                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                                        <span>Cannot Save: Keyword Conflict Detected</span>
                                    </div>
                                    <div className="space-y-1 pl-5">
                                        {keywordConflicts.map((c, idx) => (
                                            <p key={idx} className="text-xs text-destructive/90 leading-relaxed font-medium">
                                                • {c.reason}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {fieldErrors['keywords'] && keywordConflicts.length === 0 && (
                                <p className="text-xs text-destructive font-medium px-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {fieldErrors['keywords']}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {automation.trigger_type === 'all_comments' && (
                    <div className="p-3.5 bg-muted/30 border border-border rounded-xl animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-muted-foreground">Global Mode: This automation will trigger for every comment on this {type}.</p>
                    </div>
                )}

                {automation.trigger_type === 'share_to_admin' && (
                    <div className="p-3.5 bg-muted/30 border border-border rounded-xl animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-muted-foreground">Share Mode: Share the post or reel to the admin, then the reply template will be sent automatically.</p>
                    </div>
                )}

                {/* Comment Reply Field */}
                {supportsCommentReply && (automation.trigger_type === 'keywords' || automation.trigger_type === 'all_comments' || type === 'global') && automation.trigger_type !== 'share_to_admin' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-6 border-t border-border">
                        <LockedFeatureToggle
                            icon={<Reply className={`w-5 h-5 transition-colors ${commentReplyEnabled ? 'text-violet-500' : 'text-gray-400'}`} />}
                            title="Comment Reply"
                            description="Post a public reply when this automation is triggered from a comment."
                            checked={commentReplyEnabled}
                            onToggle={() => {
                                const nextCommentReplyEnabled = !commentReplyEnabled;
                                setAutomation({
                                    ...automation,
                                    comment_reply_text: nextCommentReplyEnabled ? (automation.comment_reply_text || 'Thanks for your comment! Check your DMs for the details.') : ''
                                });
                                if (nextCommentReplyEnabled) {
                                    setCommentReplyCollapsed(false);
                                }
                                if (!nextCommentReplyEnabled && fieldErrors['comment_reply_text']) {
                                    setFieldErrors((prev: any) => {
                                        const next = { ...prev };
                                        delete next['comment_reply_text'];
                                        return next;
                                    });
                                }
                            }}
                            locked={commentReplyLocked}
                            note={commentReplyGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-violet-500"
                            isCollapsed={commentReplyCollapsed}
                            onCollapseToggle={() => setCommentReplyCollapsed(!commentReplyCollapsed)}
                        />
                        {commentReplyEnabled && !commentReplyLocked && !commentReplyCollapsed && (
                            <div className="bg-card p-4 rounded-xl border border-border space-y-2">
                                <div className="flex justify-between items-center px-0.5">
                                    <label className="text-xs font-medium text-foreground">Public Comment Reply</label>
                                </div>
                                <textarea
                                    id="field_comment_reply_text"
                                    value={automation.comment_reply_text || ''}
                                    onChange={e => setAutomation({ ...automation, comment_reply_text: e.target.value })}
                                    className={`w-full min-h-[90px] rounded-xl border ${fieldErrors['comment_reply_text'] ? 'border-destructive' : 'border-border'} bg-background p-3 text-xs font-normal text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary`}
                                    placeholder="Enter the public comment reply text (this will be posted as a comment on Instagram)..."
                                />
                                <p className="text-xs text-muted-foreground px-1">This reply will be posted publicly on Instagram when the comment-based automation runs.</p>
                                {fieldErrors['comment_reply_text'] && <p className="text-xs text-destructive font-medium px-1">{fieldErrors['comment_reply_text']}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Response Settings */}
                <div className="space-y-4 border-t border-border pt-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response Message</h3>
                        {selectedTemplate && !showTemplateSelector && (
                            <button
                                type="button"
                                onClick={() => setShowTemplateSelector(true)}
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                Change Template
                            </button>
                        )}
                    </div>
                    {(!selectedTemplate || showTemplateSelector) && (
                        <TemplateSelector
                            selectedTemplateId={selectedTemplate?.id || automation.template_id}
                            onSelect={(template) => {
                                setIsSelectedTemplateLoading(false);
                                setSelectedTemplate(template);
                                setShowTemplateSelector(!template);
                                emitTemplateSelect(template?.id || null);
                                if (template) {
                                    setAutomation((prev: any) => ({
                                        ...prev,
                                        ..._mergeReplyTemplate(template.template_type, template.template_data || {}),
                                        template_id: template.id
                                    }));
                                } else {
                                    setAutomation((prev: any) => ({
                                        ...prev,
                                        template_id: undefined,
                                        template_type: 'template_text',
                                        template_content: '',
                                        template_elements: [],
                                        buttons: [],
                                        replies: []
                                    }));
                                }
                            }}
                            onCreateNew={() => {
                                setCurrentView('Reply Templates');
                            }}
                            onTemplatesLoaded={emitTemplatesLoaded}
                            className="mb-6"
                        />
                    )}
                    {fieldErrors['template'] && (
                        <p id="field_template" className="mt-2 flex items-center gap-1 px-2 text-xs font-medium text-destructive">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {fieldErrors['template']}
                        </p>
                    )}
                    {selectedTemplate && !showTemplateSelector && (
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                                    <Reply className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{selectedTemplate.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                        {selectedTemplate.template_type.replace('template_', '').replace('_', ' ')}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-medium">
                                Selected
                            </div>
                        </div>
                    )}
                    {selectedTemplate && false && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border-2 border-blue-200 dark:border-blue-500/20">
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                ✓ Using template: <span className="font-black">{selectedTemplate?.name}</span>
                            </p>
                            <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">
                                Edit this template in Reply Templates to update it across all automations.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderPreview = () => {
        const displayName = activeAccount?.username || 'your_account';
        const profilePic = activeAccount?.profile_picture_url || null;

        // If a template is selected, show the full chat preview
        if (selectedTemplate) {
            const previewAutomation = buildPreviewAutomationFromTemplate(selectedTemplate);

            return (
                <SharedMobilePreview
                    mode="automation"
                    automation={previewAutomation as any}
                    activeAccountID={activeAccountID}
                    authenticatedFetch={authenticatedFetch}
                    displayName={displayName}
                    profilePic={profilePic}
                    lockScroll
                    hideAutomationPrompt
                    isLoadingPreview={isSelectedTemplateLoading}
                />
            );
        }

        if (automation.template_id) {
            return (
                <SharedMobilePreview
                    mode="automation"
                    automation={{ template_type: 'template_text', template_content: 'Loading selected reply template...' }}
                    activeAccountID={activeAccountID}
                    authenticatedFetch={authenticatedFetch}
                    displayName={displayName}
                    profilePic={profilePic}
                    lockScroll
                    hideAutomationPrompt
                    isLoadingPreview
                />
            );
        }

        if (automation.template_type) {
            return (
                <SharedMobilePreview
                    mode="automation"
                    automation={automation}
                    activeAccountID={activeAccountID}
                    authenticatedFetch={authenticatedFetch}
                    displayName={displayName}
                    profilePic={profilePic}
                    lockScroll
                    hideAutomationPrompt
                    isLoadingPreview={isSelectedTemplateLoading}
                />
            );
        }

        // Default empty state when nothing is configured yet - show empty chat screen
        return (
            <div className="flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted/30 p-4">
                <SharedMobilePreview
                    mode="automation"
                    automation={automation}
                    activeAccountID={activeAccountID}
                    authenticatedFetch={authenticatedFetch}
                    displayName={displayName}
                    profilePic={profilePic}
                    lockScroll
                    hideAutomationPrompt
                />
            </div>
        );
    };

    const supportsAutomationStatus = ['posts', 'reel', 'story', 'live', 'global'].includes(type);
    const supportsCommentReply = ['posts', 'reel', 'live', 'global'].includes(type);
    const supportsAdvancedToggles = ['dm', 'posts', 'reel', 'story', 'live', 'global'].includes(type);
    const supportsOncePerUser = supportsAdvancedToggles;
    const supportsSeenTyping = supportsAdvancedToggles;
    const supportsShareToAdmin = ['posts', 'reel'].includes(type);
    const suggestMoreLocked = !hasPlanFeature('suggest_more');
    const seenTypingGate = getPlanGate('seen_typing');
    const shareToAdminGate = getPlanGate(type === 'reel' ? 'share_reel_to_admin' : 'share_post_to_admin', 'Upgrade your plan to unlock Share To Admin.');
    const commentReplyGate = getPlanGate(type === 'reel' ? 'reel_comment_reply_automation' : 'post_comment_reply_automation', 'Upgrade your plan to unlock public comment replies.');
    const seenTypingLocked = seenTypingGate.isLocked;
    const shareToAdminLocked = shareToAdminGate.isLocked;
    const commentReplyLocked = commentReplyGate.isLocked;
    const commentReplyEnabled = Boolean(String(automation.comment_reply_text || '').trim());
    const triggerOptions = [
        { id: 'keywords', icon: MessageSquare, label: 'Keywords' },
        { id: 'all_comments', icon: Globe, label: 'All Comments' },
        ...((type === 'live' || type === 'posts' || type === 'reel' || type === 'story') ? [] : [{
            id: 'share_to_admin',
            icon: ShareIcon,
            label: type === 'comment' ? 'Share to Admin' : 'Share Post'
        }]),
    ];

    const handleDeleteClick = () => {
        if (!automation.$id || !onDelete) return;
        setModalConfig({
            isOpen: true,
            title: 'Delete Automation?',
            description: 'Are you sure you want to delete this automation? This action cannot be undone.',
            type: 'danger',
            confirmLabel: 'Delete Now',
            onConfirm: async () => {
                closeModal();
                if (automation.$id && onDelete) {
                    await onDelete(automation.$id);
                }
                onClose();
            }
        });
    };

    const renderActionBar = () => {
        const isNew = !automation.$id && !automationId;
        const isCompletelyEmpty = (
            (!automation.title || !automation.title.trim()) &&
            (!automation.keywords || automation.keywords.length === 0) &&
            (!automation.keyword || !automation.keyword.trim()) &&
            (!automation.template_content || !automation.template_content.trim()) &&
            (!automation.comment_reply_text || !automation.comment_reply_text.trim()) &&
            (!selectedTemplate)
        );
        const shouldShowSave = isNew ? (!isCompletelyEmpty && isDirty) : isDirty;

        return (
            <div className="sticky top-0 z-[60] -mx-4 -mt-4 mb-6 bg-card/95 backdrop-blur px-4 py-3 border-b border-border shadow-sm sm:-mx-6 sm:-mt-6 sm:px-6 md:-mx-8 md:-mt-8 md:px-8">
                <AutomationActionBar
                    hasExisting={Boolean(automation.$id)}
                    isSaving={saving}
                    saveDisabled={false}
                    deleteDisabled={false}
                    onSave={handleSave}
                    onDelete={automation.$id && onDelete ? handleDeleteClick : undefined}
                    onCancel={onClose}
                    showCancel={showActionCancel}
                    showSave={shouldShowSave}
                    saveLabel={saveButtonLabel}
                    leftContent={actionBarLeft}
                />
            </div>
        );
    };

    const effectiveVariant = isStandalone ? 'card' : (useParentLayout && type === 'global' ? 'embedded' : variant);

    if (effectiveVariant === 'card') {
        return (
            <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm relative">
                <div className="flex items-center justify-between border-b border-border/70 p-4 sm:p-6">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg bg-muted/60 p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:max-h-[calc(100vh-160px)] lg:min-h-0 lg:overflow-hidden">
                    <div className="p-4 pb-28 sm:p-6 sm:pb-32 md:p-6 md:pb-32 lg:pb-6 lg:min-h-0 lg:overflow-y-auto">
                        {renderActionBar()}
                        {renderForm()}
                    </div>
                    <AutomationPreviewPanel
                        title="Live Preview"
                        breakpoint="lg"
                        wrapperClassName="hidden lg:flex lg:flex-col items-center justify-center border-t border-border/70 p-4 sm:p-6 md:p-6 lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-hidden"
                        minHeightClassName="min-h-0 w-full"
                    >
                        {renderPreview()}
                    </AutomationPreviewPanel>
                </div>
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
    }

    if (effectiveVariant === 'embedded') {
        return (
            <div className="w-full relative">
                <div className="pb-28 sm:pb-32 lg:pb-0">
                    {renderActionBar()}
                    {renderForm()}
                </div>
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
    }

    // Default 'modal' variant
    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="w-full sm:max-w-4xl sm:overflow-hidden sm:rounded-2xl border-0 sm:border border-border bg-card sm:shadow-xl animate-in zoom-in-95 duration-200 min-h-[100dvh] sm:min-h-0 relative">
                <div className="flex items-center justify-between border-b border-border p-4 sm:p-6 sticky top-0 bg-card z-10">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg bg-muted/60 p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:max-h-[78vh] lg:min-h-0 lg:overflow-hidden">
                    <div className="p-4 pb-28 sm:p-6 sm:pb-32 lg:min-h-0 lg:overflow-y-auto lg:pb-6">
                        {renderActionBar()}
                        {renderForm()}
                    </div>
                    <div className="hidden lg:flex items-center justify-center border-t border-border/70 p-4 sm:p-8 lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-hidden bg-muted/10 lg:bg-transparent">
                        <div className="w-full max-w-[320px] lg:max-w-none">
                            {renderPreview()}
                        </div>
                    </div>
                </div>
                <AutomationPreviewPanel
                    title="Live Preview"
                    breakpoint="lg"
                    wrapperClassName="hidden"
                    minHeightClassName="min-h-0"
                >
                    {renderPreview()}
                </AutomationPreviewPanel>
            </div>
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

export default AutomationEditor;

