import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FileText, Smartphone, Image as ImageIcon, Reply, Save, Loader2, X, Instagram,
    MessageSquare, AlertCircle, CheckCircle2, Trash2, HelpCircle, Power, Globe,
    MousePointerClick, Share2, Film, Radio, BookText, Plus, ChevronRight, Share2 as ShareIcon,
    Calendar, ChevronDown, Check, Info, Lightbulb, ExternalLink, LayoutTemplate, Mail, Copy
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import ModernConfirmModal from '../ui/ModernConfirmModal';
import ToggleSwitch from '../ui/ToggleSwitch';
import LoadingOverlay from '../ui/LoadingOverlay';
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate, prefetchReplyTemplates } from './TemplateSelector';
import SharedMobilePreview from './SharedMobilePreview';
import AutomationActionBar from './AutomationActionBar';
import LockedFeatureToggle from '../ui/LockedFeatureToggle';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import { normalizeAutomationKeywords } from '../../lib/automationKeywords';

const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_MESSAGE_MAX = 300;
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";
const COLLECT_EMAIL_PROMPT_DEFAULT = '📧 Could you share your best email so we can send the details and updates ✨';
const COLLECT_EMAIL_FAIL_RETRY_DEFAULT = '⚠️ That email looks invalid. Please send a valid email like name@example.com.';
const COLLECT_EMAIL_SUCCESS_DEFAULT = 'Perfect, thank you! Your email has been saved ✅';
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

const createCollectorDestinationState = () => ({
    destination_type: 'sheet',
    sheet_link: '',
    webhook_url: '',
    verified: false,
    verified_at: null as string | null,
    service_account_email: '',
    destination_json: {} as Record<string, unknown>
});

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

function _mergeReplyTemplate(templateType: string, templateData: Record<string, unknown>): Record<string, unknown> {
    const d = templateData || {};
    switch (templateType) {
        case 'template_text': return { template_type: 'template_text', template_content: String(d.text || '') };
        case 'template_buttons': return { template_type: 'template_buttons', template_content: String(d.text || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
        case 'template_carousel': return { template_type: 'template_carousel', template_elements: Array.isArray(d.elements) ? d.elements : [] };
        case 'template_quick_replies': return { template_type: 'template_quick_replies', template_content: String(d.text || ''), replies: Array.isArray(d.replies) ? d.replies : [] };
        case 'template_media': return { template_type: 'template_media', template_content: String(d.media_url || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
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
                buttons: Array.isArray(d.buttons) ? d.buttons : []
            };
        case 'template_carousel':
            return {
                template_type: 'template_carousel',
                template_elements: Array.isArray(d.elements) ? d.elements : []
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
                buttons: Array.isArray(d.buttons) ? d.buttons : []
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
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showMobilePreviewModal, setShowMobilePreviewModal] = useState(false);
    const [isPlanInvalid, setIsPlanInvalid] = useState(false);
    const [planInvalidFeatures, setPlanInvalidFeatures] = useState<string[]>([]);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

    // Automatically close mobile preview on large screens and ensure scroll position is reset
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setShowMobilePreviewModal(false);
                // When switching to desktop, ensure we scroll to top so the user doesn't stay 
                // in the middle of a long form without realizing the preview is now visible on the right.
                document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        once_per_user_24h: false,
        story_scope: 'shown',
        collect_email_enabled: false,
        collect_email_only_gmail: false,
        followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
        followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
        collect_email_prompt_message: COLLECT_EMAIL_PROMPT_DEFAULT,
        collect_email_fail_retry_message: COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
        collect_email_success_reply_message: COLLECT_EMAIL_SUCCESS_DEFAULT,
        seen_typing_enabled: false,
        media_id: mediaId || '',
        template_elements: [],
        buttons: [],
        replies: [],
        comment_reply_text: ''
    });
    const [collectorDestination, setCollectorDestination] = useState(createCollectorDestinationState);
    const [collectorDestinationLoading, setCollectorDestinationLoading] = useState(false);
    const [collectorDestinationSaving, setCollectorDestinationSaving] = useState(false);
    const [copiedServiceAccountEmail, setCopiedServiceAccountEmail] = useState(false);

    const [suggestMoreSetup, setSuggestMoreSetup] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

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
            collect_email_enabled: Boolean(data?.collect_email_enabled),
            collect_email_only_gmail: Boolean(data?.collect_email_only_gmail),
            followers_only_primary_button_text: String(data?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
            followers_only_secondary_button_text: String(data?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
            collect_email_prompt_message: String(data?.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT),
            collect_email_fail_retry_message: String(data?.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT),
            collect_email_success_reply_message: String(data?.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT),
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
        collect_email_enabled: Boolean(value?.collect_email_enabled),
        collect_email_only_gmail: Boolean(value?.collect_email_only_gmail),
        followers_only_primary_button_text: String(value?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
        followers_only_secondary_button_text: String(value?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
        collect_email_prompt_message: String(value?.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT),
        collect_email_fail_retry_message: String(value?.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT),
        collect_email_success_reply_message: String(value?.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT),
        seen_typing_enabled: Boolean(value?.seen_typing_enabled),
        media_id: String(value?.media_id || ''),
        template_elements: Array.isArray(value?.template_elements) ? value.template_elements : [],
        buttons: Array.isArray(value?.buttons) ? value.buttons : [],
        replies: Array.isArray(value?.replies) ? value.replies : [],
        comment_reply_text: String(value?.comment_reply_text || value?.comment_reply || '')
    });

    const isDirty = !isInitialLoad && !!baselineSnapshot && baselineSnapshot !== serializeAutomationState(automation);

    useEffect(() => {
        setBaselineSnapshot('');
    }, [automationId, mediaId, type]);

    useEffect(() => {
        if (!isInitialLoad && !baselineSnapshot) {
            setBaselineSnapshot(serializeAutomationState(automation));
        }
    }, [automation, baselineSnapshot, isInitialLoad]);

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
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/suggest-more?account_id=${activeAccountID}`);
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
        let alive = true;
        const loadCollectorDestination = async () => {
            if (!automation?.$id || automation.collect_email_enabled !== true) {
                setCollectorDestination(createCollectorDestinationState());
                setCollectorDestinationLoading(false);
                return;
            }

            setCollectorDestinationLoading(true);
            try {
                const res = await authenticatedFetch(
                    `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${automation.$id}/email-collector-destination`
                );
                const data = await res.json();
                if (!alive) return;
                if (res.ok && data?.destination) {
                    setCollectorDestination({
                        destination_type: data.destination.destination_type || 'sheet',
                        sheet_link: data.destination.sheet_link || '',
                        webhook_url: data.destination.webhook_url || '',
                        verified: data.destination.verified === true,
                        verified_at: data.destination.verified_at || null,
                        service_account_email: data.destination.service_account_email || '',
                        destination_json: data.destination.destination_json || {}
                    });
                } else {
                    setCollectorDestination(createCollectorDestinationState());
                }
            } catch (_) {
                if (alive) {
                    setCollectorDestination(createCollectorDestinationState());
                }
            } finally {
                if (alive) {
                    setCollectorDestinationLoading(false);
                }
            }
        };

        loadCollectorDestination();
        return () => {
            alive = false;
        };
    }, [authenticatedFetch, automation?.$id, automation.collect_email_enabled]);

    const persistCollectorDestination = React.useCallback(async (savedAutomationId: string, shouldVerify = false) => {
        if (!savedAutomationId || automation.collect_email_enabled !== true) {
            return true;
        }

        const urlValue = collectorDestination.destination_type === 'webhook'
            ? String(collectorDestination.webhook_url || '').trim()
            : String(collectorDestination.sheet_link || '').trim();

        if (!urlValue) {
            setError(collectorDestination.destination_type === 'webhook'
                ? 'Enter a webhook URL for the email collector.'
                : 'Enter a Google Sheet URL for the email collector.');
            return false;
        }

        setCollectorDestinationSaving(true);
        try {
            const saveRes = await authenticatedFetch(
                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${savedAutomationId}/email-collector-destination`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        destination_type: collectorDestination.destination_type,
                        sheet_link: collectorDestination.destination_type === 'sheet' ? urlValue : '',
                        webhook_url: collectorDestination.destination_type === 'webhook' ? urlValue : ''
                    })
                }
            );
            const saveData = await saveRes.json();
            if (!saveRes.ok) {
                setError(saveData?.error || 'Failed to save email collector destination.');
                return false;
            }

            let nextDestination = saveData?.destination || null;
            if (shouldVerify) {
                const verifyRes = await authenticatedFetch(
                    `${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${savedAutomationId}/email-collector-destination/verify`,
                    { method: 'POST' }
                );
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) {
                    setError(verifyData?.error || 'Failed to verify email collector destination.');
                    return false;
                }
                nextDestination = verifyData?.destination || nextDestination;
            }

            if (nextDestination) {
                setCollectorDestination({
                    destination_type: nextDestination.destination_type || 'sheet',
                    sheet_link: nextDestination.sheet_link || '',
                    webhook_url: nextDestination.webhook_url || '',
                    verified: nextDestination.verified === true,
                    verified_at: nextDestination.verified_at || null,
                    service_account_email: nextDestination.service_account_email || '',
                    destination_json: nextDestination.destination_json || {}
                });
            }

            return true;
        } catch (_) {
            setError('Failed to save email collector destination.');
            return false;
        } finally {
            setCollectorDestinationSaving(false);
        }
    }, [authenticatedFetch, automation.collect_email_enabled, collectorDestination]);

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
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${automationId}?account_id=${activeAccountID}&type=${backendType}`);
                    if (res.ok) {
                        const data = await res.json();
                        let resolvedTemplate: ReplyTemplate | null = null;
                        if (data.template_id) {
                            try {
                                const rr = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${data.template_id}?account_id=${activeAccountID}`);
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
                once_per_user_24h: false,
                story_scope: 'shown',
                collect_email_enabled: false,
                collect_email_only_gmail: false,
                followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                collect_email_prompt_message: COLLECT_EMAIL_PROMPT_DEFAULT,
                collect_email_fail_retry_message: COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
                collect_email_success_reply_message: COLLECT_EMAIL_SUCCESS_DEFAULT,
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
            let url = `${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?account_id=${activeAccountID}`;
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
        // Auto-generate title if hidden and missing
        const isTitleHidden = (type !== 'dm' && type !== 'global');
        let currentTitle = automation.title;
        if (isTitleHidden && !currentTitle.trim()) {
            currentTitle = buildHiddenAutomationTitle(type, mediaId, titleOverride);
        }

        const errors: { [key: string]: string } = {};
        if (!isTitleHidden && !currentTitle.trim()) errors.title = "Identification title is required";

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
                const firstError = document.querySelector('[className*="border-red-500"]');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (firstError instanceof HTMLInputElement || firstError instanceof HTMLTextAreaElement) {
                        firstError.focus();
                    }
                }
            }, 150);
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
                keywordArray = automation.keyword ? [automation.keyword] : [];
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

            if (automation.collect_email_enabled) {
                const promptLength = getUtf8Length(automation.collect_email_prompt_message || '');
                const retryLength = getUtf8Length(automation.collect_email_fail_retry_message || '');
                const successLength = getUtf8Length(automation.collect_email_success_reply_message || '');
                if (promptLength > 1000 || retryLength > 1000 || successLength > 1000) {
                    setError('Each email collector message must stay within 1000 UTF-8 bytes.');
                    setSaving(false);
                    return false;
                }
                const destinationUrl = collectorDestination.destination_type === 'webhook'
                    ? String(collectorDestination.webhook_url || '').trim()
                    : String(collectorDestination.sheet_link || '').trim();
                if (!destinationUrl) {
                    setError(collectorDestination.destination_type === 'webhook'
                        ? 'Add a webhook URL for the email collector.'
                        : 'Add a Google Sheet URL for the email collector.');
                    setSaving(false);
                    return false;
                }
            }

            const payload: any = {
                ...automation,
                title: currentTitle,
                type: backendType,
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
                collect_email_enabled: automation.collect_email_enabled === true,
                collect_email_only_gmail: automation.collect_email_only_gmail === true,
                followers_only_primary_button_text: automation.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                followers_only_secondary_button_text: automation.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                collect_email_prompt_message: automation.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT,
                collect_email_fail_retry_message: automation.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT,
                collect_email_success_reply_message: automation.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT,
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

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations${automation.$id ? `/${automation.$id}` : ''}?account_id=${activeAccountID}${automation.$id ? '' : `&type=${backendType}`}`, {
                method: automation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok) {
                const savedAutomationId = automation.$id || data?.automation_id || data?.$id;
                if (automation.collect_email_enabled) {
                    const collectorSaved = await persistCollectorDestination(savedAutomationId, true);
                    if (!collectorSaved) {
                        return false;
                    }
                }
                const nextSnapshot = serializeAutomationState(payload);
                setBaselineSnapshot(nextSnapshot);
                setSuccess(automation.$id ? "Automation updated successfully!" : "Automation activated successfully!");
                onSave(data);
                if (!isStandalone && autoCloseOnSave) {
                    setTimeout(() => {
                        onClose();
                    }, 1500);
                }
                return true;
            } else {
                setError(data.error || "Failed to save automation.");
                return false;
            }
        } catch (err) {
            setError("Network error occurred.");
            return false;
        } finally {
            setSaving(false);
        }
    }, [activeAccountID, authenticatedFetch, autoCloseOnSave, automation, collectorDestination, isStandalone, mediaId, onClose, onSave, persistCollectorDestination, selectedTemplate, titleOverride, type]);

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
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {success}
                </div>
            )}
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
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Automation Core</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-8">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center gap-2 mb-1 px-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Internal Reference Title</label>
                                            <div className="group relative">
                                                <HelpCircle className="w-3 h-3 text-gray-300 cursor-help" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                    This name is only for you to identify this automation in the dashboard.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        id="field_title"
                                        value={automation.title}
                                        onChange={e => setAutomation({ ...automation, title: e.target.value })}
                                        className={`w-full rounded-2xl border-2 ${fieldErrors['title'] ? 'border-destructive' : 'border-content/70'} bg-card/90 py-4 px-6 text-sm font-black text-foreground transition-all outline-none focus:border-primary`}
                                        placeholder="e.g. Price Check"
                                    />
                                    <p className="text-[9px] text-gray-400 font-medium px-2">Required. This title helps you organize and find your automations easily later.</p>
                                    {fieldErrors['title'] && <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {fieldErrors['title']}</p>}
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trigger Keyword</label>
                                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{keywordInput?.length || 0}/15</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            value={keywordInput || automation.keyword || ''}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                setKeywordInput(val);
                                                setAutomation((prev: any) => ({ ...prev, keyword: val, keywords: val ? [val] : [] }));
                                                setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                            }}
                                            onKeyDown={handleKeywordKeyDown}
                                            className={`w-full bg-blue-50 dark:bg-blue-600/5 border-2 ${fieldErrors['keywords'] ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl py-4 px-6 pr-12 text-sm font-black text-blue-600 dark:text-blue-400 placeholder:text-blue-200 transition-all`}
                                            placeholder="Type keyword and press Enter..."
                                            maxLength={15}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <Globe className="w-4 h-4 text-blue-300" />
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-medium px-2">Required: Set at least one keyword that triggers this reply.</p>
                                    {automation.keyword && (
                                        <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-content">
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider bg-blue-600 text-white">
                                                {automation.keyword}
                                                <button type="button" onClick={() => removeKeyword(automation.keyword)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    )}
                                    {fieldErrors['keywords'] && <p className="text-[9px] font-bold text-red-500 px-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {fieldErrors['keywords']}</p>}
                                </div>
                            </div>
                            <div className="mt-8 flex items-start gap-4 bg-yellow-50/50 dark:bg-yellow-500/5 p-5 rounded-[28px] border border-yellow-100 dark:border-yellow-500/10">
                                <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-yellow-50 dark:border-yellow-500/10 shrink-0">
                                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.15em] mb-1">Important: Matching Rules</p>
                                    <p className="text-[10px] font-medium text-gray-500 leading-relaxed">
                                        <span className="font-bold text-gray-700 dark:text-gray-300">Keywords are case insensitive:</span> All keywords are treated as UPPERCASE.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Internal Reference Title</label>
                                <div className="group relative">
                                    <HelpCircle className="w-3 h-3 text-gray-300 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        This name is only for you to identify this automation in the dashboard.
                                    </div>
                                </div>
                            </div>
                            <input
                                id="field_title"
                                value={automation.title}
                                onChange={e => setAutomation({ ...automation, title: e.target.value })}
                                className={`w-full rounded-2xl border-2 ${fieldErrors['title'] ? 'border-destructive' : 'border-content/70'} bg-card/90 py-4 px-6 text-sm font-black text-foreground transition-all outline-none focus:border-primary`}
                                placeholder="e.g. Price Check"
                            />
                            <p className="text-[9px] text-gray-400 font-medium px-2">Required: This title helps you organize and find your automations easily later.</p>
                            {fieldErrors['title'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['title']}</p>}
                        </div>
                    )
                )}

                {supportsAutomationStatus && (
                    <div className={`flex items-center justify-between rounded-[28px] border border-content/70 bg-muted/40 p-5 transition-all hover:bg-muted/55 ${automation.is_active !== false ? 'ring-1 ring-primary/15' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl shadow-sm border ${automation.is_active !== false
                                ? 'bg-white dark:bg-gray-900 border-emerald-100 dark:border-emerald-500/10'
                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}>
                                <Power className={`w-5 h-5 transition-colors ${automation.is_active !== false ? 'text-emerald-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="mb-0.5 text-[11px] font-black uppercase tracking-[0.15em] text-foreground">Automation Status</p>
                                <p className="text-[10px] font-medium text-muted-foreground">Turn this automation on or off before you publish changes.</p>
                            </div>
                        </div>
                        <ToggleSwitch
                            isChecked={automation.is_active !== false}
                            onChange={() => {
                                const nextIsActive = !(automation.is_active !== false);
                                setAutomation({ ...automation, is_active: nextIsActive, active: nextIsActive });
                            }}
                            variant="plain"
                        />
                    </div>
                )}

                {/* 2. Followers Only Toggle */}
                <LockedFeatureToggle
                    icon={<Power className={`w-5 h-5 ${automation.followers_only ? 'text-blue-500' : 'text-gray-400'}`} />}
                    title="Followers Only Mode"
                    description="Restricts this automation to only trigger for your existing followers."
                    checked={automation.followers_only || false}
                    onToggle={() => {
                        const nextFollowersOnly = !automation.followers_only;
                        setAutomation({
                            ...automation,
                            followers_only: nextFollowersOnly,
                            followers_only_message: nextFollowersOnly
                                ? (automation.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT)
                                : ''
                        });
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
                />
                {automation.followers_only && (
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10 space-y-4">
                        <div className="flex justify-between items-center px-1 mb-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Followers-Only Message</label>
                            <span className={`text-[8px] font-bold ${getUtf8Length(automation.followers_only_message || '') > FOLLOWERS_ONLY_MESSAGE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
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
                            className={`w-full min-h-[88px] resize-y bg-gray-50 dark:bg-gray-950 border-2 ${fieldErrors['followers_only_message'] ? 'border-red-500' : 'border-transparent'} rounded-2xl py-3 px-4 text-xs font-medium transition-all outline-none focus:border-blue-500`}
                            placeholder={FOLLOWERS_ONLY_MESSAGE_DEFAULT}
                        />
                        {fieldErrors['followers_only_message'] && (
                            <p className="mt-2 text-[10px] text-red-500 font-bold">{fieldErrors['followers_only_message']}</p>
                        )}
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Follow Button Text</label>
                                    <span className="text-[8px] font-bold text-gray-400">{getUtf8Length(automation.followers_only_primary_button_text || '')}/40 bytes</span>
                                </div>
                                <input
                                    value={automation.followers_only_primary_button_text || ''}
                                    onChange={(e) => setAutomation({ ...automation, followers_only_primary_button_text: e.target.value })}
                                    className={`w-full rounded-2xl border-2 ${fieldErrors['followers_only_primary_button_text'] ? 'border-red-500' : 'border-transparent'} bg-gray-50 dark:bg-gray-950 px-4 py-3 text-xs font-medium outline-none transition-all focus:border-blue-500`}
                                    placeholder={FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT}
                                />
                                {fieldErrors['followers_only_primary_button_text'] && <p className="text-[10px] text-red-500 font-bold">{fieldErrors['followers_only_primary_button_text']}</p>}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Retry Button Text</label>
                                    <span className="text-[8px] font-bold text-gray-400">{getUtf8Length(automation.followers_only_secondary_button_text || '')}/40 bytes</span>
                                </div>
                                <input
                                    value={automation.followers_only_secondary_button_text || ''}
                                    onChange={(e) => setAutomation({ ...automation, followers_only_secondary_button_text: e.target.value })}
                                    className={`w-full rounded-2xl border-2 ${fieldErrors['followers_only_secondary_button_text'] ? 'border-red-500' : 'border-transparent'} bg-gray-50 dark:bg-gray-950 px-4 py-3 text-xs font-medium outline-none transition-all focus:border-blue-500`}
                                    placeholder={FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT}
                                />
                                {fieldErrors['followers_only_secondary_button_text'] && <p className="text-[10px] text-red-500 font-bold">{fieldErrors['followers_only_secondary_button_text']}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2.5. Suggest More Toggle */}
                {
                    <LockedFeatureToggle
                        icon={<Lightbulb className={`w-5 h-5 ${automation.suggest_more_enabled && suggestMoreSetup ? 'text-yellow-500' : 'text-gray-400'}`} />}
                        title="Include Suggest More"
                        description={suggestMoreSetup ? 'Add "Suggest More" button after this automation reply.' : 'Setup Suggest More first to enable this feature.'}
                        checked={automation.suggest_more_enabled || false}
                        onToggle={() => {
                            if (!suggestMoreSetup) {
                                onClose();
                                setCurrentView('Suggest More');
                                return;
                            }
                            setAutomation({ ...automation, suggest_more_enabled: !automation.suggest_more_enabled })
                        }}
                        locked={getPlanGate('suggest_more').isLocked}
                        note={getPlanGate('suggest_more').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-yellow-500"
                        actionElement={!suggestMoreSetup && !getPlanGate('suggest_more').isLocked ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    setCurrentView('Suggest More');
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all"
                            >
                                Setup <ExternalLink className="w-3 h-3" />
                            </button>
                        ) : undefined}
                    />
                }

                {supportsOncePerUser && (
                    <LockedFeatureToggle
                        icon={<Calendar className={`w-5 h-5 ${automation.once_per_user_24h ? 'text-cyan-500' : 'text-gray-400'}`} />}
                        title="Once Per User (24h)"
                        description="Prevent the same person from retriggering this automation again for 24 hours."
                        checked={automation.once_per_user_24h === true}
                        onToggle={() => setAutomation({ ...automation, once_per_user_24h: !(automation.once_per_user_24h === true) })}
                        locked={getPlanGate('once_per_user_24h').isLocked}
                        note={getPlanGate('once_per_user_24h').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-cyan-500"
                    />
                )}

                {supportsCollectEmail && (
                    <div className="space-y-3">
                        <LockedFeatureToggle
                            icon={<Mail className={`w-5 h-5 ${automation.collect_email_enabled ? 'text-indigo-500' : 'text-gray-400'}`} />}
                            title="Collect Email"
                            description="Ask for an email before finishing the automation flow."
                            checked={automation.collect_email_enabled === true}
                            onToggle={() => setAutomation({
                                ...automation,
                                collect_email_enabled: !(automation.collect_email_enabled === true),
                                collect_email_only_gmail: automation.collect_email_enabled ? false : automation.collect_email_only_gmail
                            })}
                            locked={collectEmailLocked}
                            note={collectEmailGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-indigo-500"
                        />
                        {automation.collect_email_enabled && !collectEmailLocked && (
                            <div className="ml-2 rounded-[24px] border border-indigo-100 dark:border-indigo-500/10 bg-indigo-50/40 dark:bg-indigo-500/5 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-900 dark:text-white">Gmail Only</p>
                                        <p className="text-[10px] text-gray-400">Restrict captured emails to Gmail addresses only.</p>
                                    </div>
                                    <ToggleSwitch
                                        isChecked={automation.collect_email_only_gmail === true}
                                        onChange={() => setAutomation({ ...automation, collect_email_only_gmail: !(automation.collect_email_only_gmail === true) })}
                                        variant="plain"
                                    />
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Prompt Message</p>
                                    <textarea
                                        value={automation.collect_email_prompt_message || ''}
                                        onChange={(e) => setAutomation({ ...automation, collect_email_prompt_message: e.target.value })}
                                        className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                        placeholder={COLLECT_EMAIL_PROMPT_DEFAULT}
                                    />
                                    <p className="text-[9px] text-muted-foreground">{getUtf8Length(automation.collect_email_prompt_message || '')}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Retry Message</p>
                                    <textarea
                                        value={automation.collect_email_fail_retry_message || ''}
                                        onChange={(e) => setAutomation({ ...automation, collect_email_fail_retry_message: e.target.value })}
                                        className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                        placeholder={COLLECT_EMAIL_FAIL_RETRY_DEFAULT}
                                    />
                                    <p className="text-[9px] text-muted-foreground">{getUtf8Length(automation.collect_email_fail_retry_message || '')}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Success Message</p>
                                    <textarea
                                        value={automation.collect_email_success_reply_message || ''}
                                        onChange={(e) => setAutomation({ ...automation, collect_email_success_reply_message: e.target.value })}
                                        className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                        placeholder={COLLECT_EMAIL_SUCCESS_DEFAULT}
                                    />
                                    <p className="text-[9px] text-muted-foreground">{getUtf8Length(automation.collect_email_success_reply_message || '')}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Delivery Destination</p>
                                            <p className="text-[10px] text-muted-foreground">Choose one verified destination for collected emails.</p>
                                        </div>
                                        {collectorDestinationLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => setCollectorDestination((prev) => ({ ...prev, destination_type: 'sheet', verified: false, verified_at: null }))}
                                            className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${collectorDestination.destination_type === 'sheet' ? 'border-primary bg-primary/10 text-primary' : 'border-content/70 bg-card text-foreground'}`}
                                        >
                                            Google Sheets
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCollectorDestination((prev) => ({ ...prev, destination_type: 'webhook', verified: false, verified_at: null }))}
                                            className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${collectorDestination.destination_type === 'webhook' ? 'border-primary bg-primary/10 text-primary' : 'border-content/70 bg-card text-foreground'}`}
                                        >
                                            Webhook
                                        </button>
                                    </div>
                                    {collectorDestination.destination_type === 'sheet' ? (
                                        <div className="space-y-2">
                                            <div className="rounded-2xl border border-content/70 bg-card p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Google Service Account</p>
                                                        <p className="mt-1 text-[10px] text-muted-foreground">Share the target sheet with this email before verifying the destination.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const serviceEmail = String(collectorDestination.service_account_email || '').trim();
                                                            if (!serviceEmail) return;
                                                            await navigator.clipboard.writeText(serviceEmail);
                                                            setCopiedServiceAccountEmail(true);
                                                            window.setTimeout(() => setCopiedServiceAccountEmail(false), 2000);
                                                        }}
                                                        disabled={!collectorDestination.service_account_email}
                                                        className="inline-flex items-center gap-2 rounded-2xl border border-content/70 bg-background px-4 py-2 text-[10px] font-black uppercase tracking-widest text-foreground transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {copiedServiceAccountEmail ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                        {copiedServiceAccountEmail ? 'Copied' : 'Copy Email'}
                                                    </button>
                                                </div>
                                                <div className="mt-3 rounded-2xl bg-muted/40 px-4 py-3 text-xs font-semibold text-foreground break-all">
                                                    {collectorDestination.service_account_email || 'No service account email available yet.'}
                                                </div>
                                            </div>
                                            <input
                                                value={collectorDestination.sheet_link || ''}
                                                onChange={(e) => setCollectorDestination((prev) => ({ ...prev, sheet_link: e.target.value, verified: false, verified_at: null }))}
                                                className="w-full rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-muted-foreground">Paste your webhook URL. Verification will send sample lead data to this endpoint.</p>
                                            <input
                                                value={collectorDestination.webhook_url || ''}
                                                onChange={(e) => setCollectorDestination((prev) => ({ ...prev, webhook_url: e.target.value, verified: false, verified_at: null }))}
                                                className="w-full rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                                placeholder="https://example.com/webhook"
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            disabled={!automation.$id || collectorDestinationSaving}
                                            onClick={async () => {
                                                const ok = await persistCollectorDestination(String(automation.$id || ''), true);
                                                if (ok) {
                                                    setSuccess('Email collector destination verified.');
                                                }
                                            }}
                                            className="rounded-2xl bg-black px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                                        >
                                            {collectorDestinationSaving ? 'Verifying...' : 'Verify Destination'}
                                        </button>
                                        <span className={`text-[10px] font-bold ${collectorDestination.verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                            {collectorDestination.verified
                                                ? `Verified${collectorDestination.verified_at ? ` on ${new Date(collectorDestination.verified_at).toLocaleString()}` : ''}`
                                                : automation.$id ? 'Not verified yet' : 'Save the automation once, then verify the destination'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {supportsSeenTyping && (
                    <LockedFeatureToggle
                        icon={<MessageSquare className={`w-5 h-5 ${automation.seen_typing_enabled ? 'text-violet-500' : 'text-gray-400'}`} />}
                        title="Seen + Typing Reaction"
                        description="Store the seen and typing preference with this automation rule."
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
                    <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Trigger Type</h3>
                        <div className={`grid gap-2 sm:gap-3 ${triggerOptions.length === 2 ? 'grid-cols-1 min-[380px]:grid-cols-2' : 'grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3'}`}>
                            {triggerOptions.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setAutomation({ ...automation, trigger_type: t.id })}
                                    className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${automation.trigger_type === t.id
                                        ? 'border-blue-500 bg-blue-500/5 text-blue-500'
                                        : 'border-transparent bg-gray-50 dark:bg-gray-900 text-gray-400'
                                        }`}
                                >
                                    <t.icon className="w-5 h-5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {automation.trigger_type === 'keywords' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="relative group">
                                    <input
                                        value={keywordInput}
                                        onChange={e => setKeywordInput(e.target.value.toUpperCase())}
                                        onKeyDown={handleKeywordKeyDown}
                                        className={`w-full bg-blue-50 dark:bg-blue-600/5 border-2 ${fieldErrors['keywords'] ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl py-4 px-6 pr-24 text-sm font-black text-blue-600 dark:text-blue-400 placeholder:text-blue-200 transition-all`}
                                        placeholder="Type keyword and press Enter..."
                                        maxLength={15}
                                        disabled={(automation.keywords || []).length >= 5}
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {(automation.keywords || []).length}/5
                                    </div>
                                </div>
                                <p className="text-[9px] text-gray-400 font-medium px-2">Required: Set at least one keyword that customers should type to trigger this reply.</p>

                                <div className="flex flex-wrap gap-2 px-1">
                                    {(automation.keywords || []).map((kw: string) => (
                                        <div key={kw} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-in zoom-in-95">
                                            {kw}
                                            <X className="w-3.5 h-3.5 cursor-pointer hover:scale-110 transition-transform" onClick={() => removeKeyword(kw)} />
                                        </div>
                                    ))}
                                </div>
                                {fieldErrors['keywords'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['keywords']}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* Global Type: Single Keyword Input (hidden when useParentLayout; shown in Automation Core 2-col) */}
                {type === 'global' && !useParentLayout && (
                    <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Trigger Keyword</h3>
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="relative group">
                                <input
                                    value={keywordInput || automation.keyword || ''}
                                    onChange={e => {
                                        const val = e.target.value.toUpperCase();
                                        setKeywordInput(val);
                                        setAutomation((prev: any) => ({
                                            ...prev,
                                            keyword: val,
                                            keywords: val ? [val] : []
                                        }));
                                        setFieldErrors((prev: any) => { const n = { ...prev }; delete n['keywords']; return n; });
                                    }}
                                    onKeyDown={handleKeywordKeyDown}
                                    className={`w-full bg-blue-50 dark:bg-blue-600/5 border-2 ${fieldErrors['keywords'] ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl py-4 px-6 text-sm font-black text-blue-600 dark:text-blue-400 placeholder:text-blue-200 transition-all`}
                                    placeholder="Enter keyword (e.g., PRICE, HELP, INFO)..."
                                    maxLength={15}
                                />
                            </div>
                            <p className="text-[9px] text-gray-400 font-medium px-2">Required: Enter a single keyword that will trigger this automation across all posts, reels, stories, and live.</p>

                            {automation.keyword && (
                                <div className="flex flex-wrap gap-2 px-1">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-in zoom-in-95">
                                        {automation.keyword}
                                        <X className="w-3.5 h-3.5 cursor-pointer hover:scale-110 transition-transform" onClick={() => removeKeyword(automation.keyword)} />
                                    </div>
                                </div>
                            )}
                            {fieldErrors['keywords'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['keywords']}</p>}
                        </div>
                    </div>
                )}

                {automation.trigger_type === 'all_comments' && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Global Mode: This automation will trigger for EVERY comment on this {type}.</p>
                    </div>
                )}

                {automation.trigger_type === 'share_to_admin' && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold">Share Mode: Share the post or reel to the admin, then the reply template will be sent automatically.</p>
                    </div>
                )}

                {/* Comment Reply Field */}
                {supportsCommentReply && (automation.trigger_type === 'keywords' || automation.trigger_type === 'all_comments' || type === 'global') && automation.trigger_type !== 'share_to_admin' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <LockedFeatureToggle
                            icon={<Reply className={`w-5 h-5 transition-colors ${commentReplyEnabled ? 'text-violet-500' : 'text-gray-400'}`} />}
                            title="Comment Reply"
                            description="Post a public reply when this automation is triggered from a comment."
                            checked={commentReplyEnabled}
                            onToggle={() => setAutomation({
                                ...automation,
                                comment_reply_text: commentReplyEnabled ? '' : (automation.comment_reply_text || 'Thanks for your comment! Check your DMs for the details.')
                            })}
                            locked={commentReplyLocked}
                            note={commentReplyGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-violet-500"
                        />
                        {commentReplyEnabled && !commentReplyLocked && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Public Comment Reply</label>
                                </div>
                                <textarea
                                    id="field_comment_reply_text"
                                    value={automation.comment_reply_text || ''}
                                    onChange={e => setAutomation({ ...automation, comment_reply_text: e.target.value })}
                                    className={`w-full min-h-[100px] rounded-2xl border-2 ${fieldErrors['comment_reply_text'] ? 'border-destructive' : 'border-content/70'} bg-card/90 p-4 text-xs font-bold text-foreground shadow-inner outline-none transition-all focus:border-primary`}
                                    placeholder="Enter the public comment reply text (this will be posted as a comment on Instagram)..."
                                />
                                <p className="text-[9px] text-gray-400 font-medium px-2">This reply will be posted publicly on Instagram when the comment-based automation runs.</p>
                                {fieldErrors['comment_reply_text'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['comment_reply_text']}</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Response Settings */}
                <div className="space-y-6 border-t border-border/60 pt-6">
                    <div className="flex items-center justify-between">
                        <h3 className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Response Message</h3>
                        {selectedTemplate && !showTemplateSelector && (
                            <button
                                type="button"
                                onClick={() => setShowTemplateSelector(true)}
                                className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
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
                        <p id="field_template" className="mt-2 flex items-center gap-1 px-2 text-[10px] font-bold text-destructive">
                            <AlertCircle className="w-3 h-3" />
                            {fieldErrors['template']}
                        </p>
                    )}
                    {selectedTemplate && !showTemplateSelector && (
                        <div className="flex min-h-[88px] flex-col gap-3 rounded-[24px] border border-primary/20 bg-primary/8 px-4 py-4 shadow-[0_18px_45px_rgba(108,43,217,0.08)] sm:min-h-[104px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-[30px] sm:px-6 sm:py-5">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-primary/15 text-primary shadow-sm sm:h-12 sm:w-12 sm:rounded-[22px]">
                                    <Reply className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black uppercase tracking-tight text-foreground sm:text-base">{selectedTemplate.name}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                                        {selectedTemplate.template_type.replace('template_', '')}
                                    </p>
                                </div>
                            </div>
                            <div className="w-fit shrink-0 rounded-full bg-success-muted/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-success sm:px-3.5 sm:tracking-[0.22em]">
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
    const supportsCollectEmail = supportsAdvancedToggles;
    const supportsSeenTyping = supportsAdvancedToggles;
    const supportsShareToAdmin = ['posts', 'reel'].includes(type);
    const suggestMoreLocked = !hasPlanFeature('suggest_more');
    const collectEmailGate = getPlanGate('collect_email');
    const seenTypingGate = getPlanGate('seen_typing');
    const shareToAdminGate = getPlanGate(type === 'reel' ? 'share_reel_to_admin' : 'share_post_to_admin', 'Upgrade your plan to unlock Share To Admin.');
    const commentReplyGate = getPlanGate(type === 'reel' ? 'reel_comment_reply_automation' : 'post_comment_reply_automation', 'Upgrade your plan to unlock public comment replies.');
    const collectEmailLocked = collectEmailGate.isLocked;
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
                await onDelete(automation.$id);
                onSave();
                if (!isStandalone && type !== 'global') onClose();
            }
        });
    };

    const renderActionBar = () => (
        <div className="-mx-2 mb-6 px-2 py-2">
            <AutomationActionBar
                hasExisting={Boolean(automation.$id)}
                isSaving={saving}
                saveDisabled={false}
                deleteDisabled={false}
                onSave={handleSave}
                onDelete={automation.$id && onDelete ? handleDeleteClick : undefined}
                onCancel={onClose}
                showCancel={showActionCancel}
                saveLabel={saveButtonLabel}
                leftContent={actionBarLeft}
            />
        </div>
    );

    const renderMobilePreviewToggle = () => (
        <>
            <button
                onClick={() => setShowMobilePreviewModal(true)}
                className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[9999] flex min-h-12 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-primary px-6 py-3 font-bold text-primary-foreground shadow-2xl transition-all active:scale-[0.99] lg:hidden"
            >
                <Smartphone className="w-5 h-5" />
                <span>Live Preview</span>
            </button>
            {showMobilePreviewModal && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/90 p-4 backdrop-blur-xl lg:hidden">
                    <div className="relative flex w-full max-w-md flex-col">
                        <button
                            onClick={() => setShowMobilePreviewModal(false)}
                            className="absolute -right-2 -top-12 flex h-10 w-10 items-center justify-center rounded-full bg-muted/80 text-foreground shadow-lg transition-all hover:bg-muted z-[10010]"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="max-h-[min(78vh,42rem)] overflow-y-auto rounded-3xl">
                            {renderPreview()}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );

    const effectiveVariant = isStandalone ? 'card' : (useParentLayout && type === 'global' ? 'embedded' : variant);

    if (effectiveVariant === 'card') {
        return (
            <div className="w-full overflow-hidden rounded-2xl border border-content bg-card shadow-2xl relative">
                <div className="flex items-center justify-between border-b border-border/70 p-4 sm:p-6 md:p-8">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white uppercase tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="rounded-2xl bg-muted/40 p-2 sm:p-3 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:max-h-[calc(100vh-160px)] lg:min-h-0 lg:overflow-hidden">
                    <div className="p-4 pb-24 sm:p-6 sm:pb-28 md:p-8 md:pb-8 lg:min-h-0 lg:overflow-y-auto">
                        {renderActionBar()}
                        {renderForm()}
                    </div>
                    <div className="hidden lg:flex items-center justify-center border-t border-border/70 p-4 sm:p-6 md:p-8 lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-hidden">
                        <div className="w-full max-w-[320px] lg:max-w-none">
                            {renderPreview()}
                        </div>
                    </div>
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
                {renderMobilePreviewToggle()}
            </div>
        );
    }

    if (effectiveVariant === 'embedded') {
        return (
            <div className="w-full relative">
                <div className="pb-24 sm:pb-28 lg:pb-0">
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
                {renderMobilePreviewToggle()}
            </div>
        );
    }

    // Default 'modal' variant
    return (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
            <div className="w-full sm:max-w-4xl sm:overflow-hidden sm:rounded-[40px] border-0 sm:border border-content bg-card sm:shadow-2xl animate-in zoom-in-95 duration-300 min-h-[100dvh] sm:min-h-0 relative">
                <div className="flex items-center justify-between border-b border-border/70 p-4 sm:p-8 sticky top-0 bg-card z-10">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-white uppercase tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="rounded-2xl bg-muted/40 p-2 sm:p-3 text-muted-foreground transition-all hover:bg-muted hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:max-h-[78vh] lg:min-h-0 lg:overflow-hidden">
                    <div className="p-4 pb-24 sm:p-8 sm:pb-28 lg:min-h-0 lg:overflow-y-auto lg:pb-8">
                        {renderActionBar()}
                        {renderForm()}
                    </div>
                    <div className="hidden lg:flex items-center justify-center border-t border-border/70 p-4 sm:p-8 lg:min-h-0 lg:border-l lg:border-t-0 lg:overflow-hidden bg-muted/10 lg:bg-transparent">
                        <div className="w-full max-w-[320px] lg:max-w-none">
                            {renderPreview()}
                        </div>
                    </div>
                </div>
                {renderMobilePreviewToggle()}
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
