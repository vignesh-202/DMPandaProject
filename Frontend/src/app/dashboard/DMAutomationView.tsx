// DM Automation View Component
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import {
    MessageSquare, Plus, Trash2, Save, AlertCircle, Radio, BookText,
    MousePointerClick, Smartphone, Loader2, Instagram, CheckCircle2, Globe, Pencil, Lightbulb, PencilLine, HelpCircle, Film, RefreshCcw, Calendar, ChevronDown, Check, Info, ArrowLeft, MoreHorizontal, Settings, X, Search,
    Image as ImageIcon, Video, Music, FileText, Share2, Reply, ChevronRight, Link as LinkIcon, Power, LayoutTemplate
} from 'lucide-react';
import ModernCalendar from '../../components/ui/ModernCalendar';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
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

interface Automation {
    $id?: string;
    keyword: string[]; // Updated for consolidation
    title: string;
    template_type: 'template_text' | 'template_carousel' | 'template_quick_replies' | 'template_media' | 'template_buttons' | 'template_share_post';
    template_id?: string;
    active: boolean;
    followers_only: boolean;
    case_sensitive: boolean;
    template_content?: any; // Can be string or object
    media_type?: string;
    media_size?: number;
    media_format?: string;
    ig_payload?: string;
    automation_type: string;
    data?: any;
    replies?: any;
    buttons?: any;
    text?: string;
    template_elements?: any[];
    media_id?: string;
    media_url?: string;
    use_latest_post?: boolean;
    latest_post_type?: string;
}

function mergeReplyTemplateIntoAutomation(templateType: string, templateData: Record<string, unknown>): Partial<Automation> {
    const d = templateData || {};
    switch (templateType) {
        case 'template_text': return { template_type: 'template_text', template_content: String(d.text || '') };
        case 'template_buttons': return { template_type: 'template_buttons', template_content: String(d.text || ''), text: String(d.text || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
        case 'template_carousel': return { template_type: 'template_carousel', template_elements: Array.isArray(d.elements) ? d.elements : [] };
        case 'template_quick_replies': return { template_type: 'template_quick_replies', template_content: String(d.text || ''), replies: Array.isArray(d.replies) ? d.replies : [] };
        case 'template_media': return { template_type: 'template_media', template_content: String(d.media_url || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
        case 'template_share_post': return { template_type: 'template_share_post', media_id: String(d.media_id || ''), media_url: String(d.media_url || ''), use_latest_post: !!(d.use_latest_post), latest_post_type: (d.latest_post_type === 'reel' ? 'reel' : 'post') };
        default: return { template_type: 'template_text', template_content: String(d.text || '') };
    }
}

const isRestrictedMediaUrl = (url?: string | null) => !!url && /scontent\.cdninstagram\.com/i.test(url);

const validateMediaUrl = async (url: string, type: string): Promise<{ valid: boolean; error?: string; size?: number; format?: string }> => {
    if (!url || !url.startsWith('http')) return { valid: false, error: "Invalid URL" };

    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) return { valid: false, error: "Media URL is unreachable" };

        const contentType = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const extension = url.split('.').pop()?.split('?')[0].toLowerCase() || '';

        // Validation logic
        if (type === 'image') {
            const validFormats = ['png', 'jpg', 'jpeg', 'webp'];
            if (!validFormats.includes(extension) && !contentType.includes('image')) return { valid: false, error: "Invalid image format. Use PNG, JPG, or WEBP." };
            if (contentLength > 8 * 1024 * 1024) return { valid: false, error: "Image size exceeds 8MB limit." };
            return { valid: true, size: contentLength, format: extension || 'image' };
        }

        if (type === 'video') {
            const validFormats = ['mp4', 'ogg', 'avi', 'mov', 'webm'];
            if (!validFormats.includes(extension) && !contentType.includes('video')) return { valid: false, error: "Invalid video format. Use MP4, OGG, AVI, MOV, or WEBM." };
            if (contentLength > 25 * 1024 * 1024) return { valid: false, error: "Video size exceeds 25MB limit." };
            return { valid: true, size: contentLength, format: extension || 'video' };
        }

        if (type === 'audio') {
            const validFormats = ['aac', 'm4a', 'wav', 'mp4', 'mp3'];
            if (!validFormats.includes(extension) && !contentType.includes('audio') && !contentType.includes('mpeg')) return { valid: false, error: "Invalid audio format. Use AAC, M4A, WAV, or MP3." };
            if (contentLength > 25 * 1024 * 1024) return { valid: false, error: "Audio size exceeds 25MB limit." };
            return { valid: true, size: contentLength, format: extension || 'audio' };
        }

        if (type === 'pdf') {
            if (extension !== 'pdf' && !contentType.includes('pdf')) return { valid: false, error: "Invalid file format. Only PDFs are allowed." };
            if (contentLength > 25 * 1024 * 1024) return { valid: false, error: "PDF size exceeds 25MB limit." };
            return { valid: true, size: contentLength, format: 'pdf' };
        }

        return { valid: true, size: contentLength, format: extension };
    } catch (e) {
        // Fallback for CORS issues - simple extension check
        const extension = url.split('.').pop()?.split('?')[0].toLowerCase() || '';
        const formats: Record<string, string[]> = {
            'image': ['png', 'jpg', 'jpeg', 'webp'],
            'video': ['mp4', 'ogg', 'avi', 'mov', 'webm'],
            'audio': ['aac', 'm4a', 'wav', 'mp4', 'mp3'],
            'pdf': ['pdf']
        };

        if (formats[type] && !formats[type].includes(extension)) {
            return { valid: false, error: `Invalid ${type} extension.` };
        }
        return { valid: true, format: extension };
    }
};

const suggestUniqueTitle = (base: string, existing: string[]) => {
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

const DMAutomationView: React.FC = () => {
    const { activeAccountID, dmAutomations, setDmAutomations, automationInitialLoaded, setAutomationInitialLoaded, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges, setCurrentView } = useDashboard();
    const { authenticatedFetch, user } = useAuth();
    const [loading, setLoading] = useState(!automationInitialLoaded['dm']);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingAutomation, setEditingAutomation] = useState<any>(null);
    const [keywordWarnings, setKeywordWarnings] = useState<{ [key: number]: string }>({});
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
    const [originalAutomation, setOriginalAutomation] = useState<any>(null);
    const [preparing, setPreparing] = useState(false);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
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

    const showAlert = (title: string, description: string, type: 'danger' | 'info' | 'warning' | 'success' = 'info') => {
        setModalConfig({
            isOpen: true,
            title,
            description,
            type,
            confirmLabel: 'Understood',
            oneButton: true,
            onConfirm: () => closeModal()
        });
    };
    const [keywordInput, setKeywordInput] = useState("");
    const [mediaCache, setMediaCache] = useState<{ post: any[], reel: any[], all: any[] }>({ post: [], reel: [], all: [] });
    const [mediaTab, setMediaTab] = useState<'post' | 'reel' | 'all'>('all');
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [isMediaDeleted, setIsMediaDeleted] = useState(false);
    const [mediaDateFilter, setMediaDateFilter] = useState<'all' | '7days' | '30days' | '90days' | 'custom'>('all');
    const [mediaStartDate, setMediaStartDate] = useState<string>('');
    const [mediaEndDate, setMediaEndDate] = useState<string>('');
    const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
    const [mediaHasNext, setMediaHasNext] = useState(false);
    const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);

    const [mediaDateDropdownOpen, setMediaDateDropdownOpen] = useState(false);
    const [mediaSortOrder, setMediaSortOrder] = useState<'recent' | 'oldest'>('recent');
    const [mediaSortDropdownOpen, setMediaSortDropdownOpen] = useState(false);

    // Reply template: use existing only (create via Reply Templates)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [selectedTemplateData, setSelectedTemplateData] = useState<any | null>(null);
    const templateCacheRef = useRef<Map<string, any>>(new Map());
    const [globalAutomations, setGlobalAutomations] = useState<any[]>([]);

    // Memoized filtered media list for optimized display
    const filteredMedia = useMemo(() => {
        let results = mediaCache.all || [];

        // Apply media type filter
        if (mediaTab === 'post') results = results.filter(m => m.media_product_type === 'FEED');
        else if (mediaTab === 'reel') results = results.filter(m => m.media_product_type === 'REELS');

        // Apply date filter
        if (mediaDateFilter === '7days') {
            const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
            results = results.filter(m => new Date(m.timestamp).getTime() >= since);
        } else if (mediaDateFilter === '30days') {
            const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
            results = results.filter(m => new Date(m.timestamp).getTime() >= since);
        } else if (mediaDateFilter === '90days') {
            const since = Date.now() - 90 * 24 * 60 * 60 * 1000;
            results = results.filter(m => new Date(m.timestamp).getTime() >= since);
        } else if (mediaDateFilter === 'custom' && mediaStartDate) {
            const since = new Date(mediaStartDate).getTime();
            results = results.filter(m => new Date(m.timestamp).getTime() >= since);
            if (mediaEndDate) {
                const until = new Date(mediaEndDate).getTime() + 86399000;
                results = results.filter(m => new Date(m.timestamp).getTime() <= until);
            }
        }

        // Apply sort logic
        if (mediaSortOrder === 'recent') {
            results = [...results].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } else {
            results = [...results].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }

        return results;
    }, [mediaCache.all, mediaTab, mediaDateFilter, mediaStartDate, mediaEndDate, mediaSortOrder]);

    const fetchingRef = useRef(false);
    const carouselTabsRef = useRef<HTMLDivElement>(null);

    const fetchAutomations = useCallback(async (isManual = false, silent = false) => {
        if (!activeAccountID) {
            setLoading(false);
            return;
        }

        // Prevent parallel fetches
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        if (!silent) setLoading(true);
        if (isManual) setRefreshing(true);

        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=dm`);
            const data = await res.json();
            if (res.ok) {
                setDmAutomations(data.automations || data.documents || []);
                setAutomationInitialLoaded(prev => ({ ...prev, dm: true }));
            }
        } catch (err) {
            console.error("Failed to fetch automations", err);
            setError("Could not load your DM automations.");
        } finally {
            setLoading(false);
            setRefreshing(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, authenticatedFetch, setDmAutomations, setAutomationInitialLoaded]);

    // Clear success/error messages when account changes
    useEffect(() => {
        setSuccess(null);
        setError(null);
    }, [activeAccountID]);

    useEffect(() => {
        if (!automationInitialLoaded['dm'] && activeAccountID) {
            fetchAutomations();
        }
    }, [fetchAutomations, automationInitialLoaded, activeAccountID]);

    useEffect(() => {
        if (activeAccountID) {
            setSelectedTemplateData(null);
            templateCacheRef.current.clear();
        }
    }, [activeAccountID]);

    useEffect(() => {
        if (!activeAccountID) {
            setGlobalAutomations([]);
            return;
        }
        let alive = true;
        (async () => {
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations?account_id=${activeAccountID}&type=global`);
                if (!res.ok) return;
                const data = await res.json();
                if (!alive) return;
                setGlobalAutomations(data.automations || data.documents || []);
            } catch (_) {
                if (alive) setGlobalAutomations([]);
            }
        })();
        return () => { alive = false; };
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        if (!selectedTemplateId) {
            setSelectedTemplateData(null);
            return;
        }

        const cached = templateCacheRef.current.get(selectedTemplateId);
        if (cached) {
            setSelectedTemplateData(cached);
            return;
        }

        let alive = true;
        (async () => {
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${selectedTemplateId}?account_id=${activeAccountID}`);
                if (!res.ok) return;
                const data = await res.json();
                if (!alive) return;
                templateCacheRef.current.set(selectedTemplateId, data);
                setSelectedTemplateData(data);
            } catch (_) { }
        })();

        return () => { alive = false; };
    }, [selectedTemplateId, authenticatedFetch]);

    const handleCreate = () => {
        setPreparing(true);
        setTimeout(() => {
            setEditingAutomation({
                title: 'New Automation',
                keyword: [],
                template_type: 'template_text',
                template_content: '',
                text: '',
                buttons: [],
                template_elements: [
                    {
                        title: '',
                        subtitle: '',
                        image_url: '',
                        buttons: [{ title: '', url: '', type: 'web_url' }]
                    }
                ],
                active: true,
                followers_only: false,
                case_sensitive: false,
                is_global: false,
                global_posts: false,
                global_reels: false,
                global_live: false,
                global_stories: false
            });
            setOriginalAutomation(null);
            setKeywordWarnings({});
            setKeywordInput("");
            setFieldErrors({});
            setDuplicateErrorKeywords(new Set());
            setSelectedTemplateId(null);
            setSuccess(null);
            setError(null);
            setPreparing(false);
        }, 600);
    };

    const openingRef = useRef<string | null>(null);

    const handleEdit = async (auto: any) => {
        if (!auto?.$id || openingRef.current === auto.$id) return;
        openingRef.current = auto.$id;
        setPreparing(true);
        setError(null);

        try {
            const useLocal = auto && auto.template_type;
            let targetAuto = auto;

            if (!useLocal) {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${auto.$id}?account_id=${activeAccountID}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("Automation not found. It may have been deleted.");
                        setPreparing(false);
                        fetchAutomations(true);
                        openingRef.current = null;
                        return;
                    }
                    throw new Error("Failed to load");
                }
                const freshAuto = await res.json();
                targetAuto = freshAuto || auto;
            }

            let sid: string | null = null;
            if (targetAuto.template_id) {
                sid = targetAuto.template_id;
            }

            setTimeout(() => {
                let elements = [];
                if (targetAuto.template_type === 'template_carousel' && targetAuto.template_content) {
                    try {
                        elements = typeof targetAuto.template_content === 'string' ? JSON.parse(targetAuto.template_content) : targetAuto.template_content;
                        // Ensure buttons array exists for each element
                        if (Array.isArray(elements)) {
                            elements = elements.map((el: any) => ({
                                ...el,
                                buttons: el.buttons || [{ title: '', url: '', type: 'web_url' }]
                            }));
                        } else { elements = []; }
                    } catch (e) {
                        console.error("Failed to parse existing carousel template:", e);
                        elements = [{
                            title: '',
                            subtitle: '',
                            image_url: '',
                            buttons: [{ title: '', url: '', type: 'web_url' }]
                        }];
                    }
                } else if (targetAuto.template_type === 'template_media') {
                    // For single media, template_content might be url
                }
                const kws = Array.isArray(targetAuto.keyword) ? targetAuto.keyword : (targetAuto.keyword ? targetAuto.keyword.split(',').map((s: string) => s.trim()) : ['']);

                // Parse buttons for template_buttons if needed
                let buttons = [];
                let text = '';
                if (targetAuto.template_type === 'template_buttons') {
                    if (targetAuto.buttons && typeof targetAuto.buttons === 'string') {
                        try { buttons = JSON.parse(targetAuto.buttons); } catch (e) { }
                    } else if (Array.isArray(targetAuto.buttons)) {
                        buttons = targetAuto.buttons;
                    }
                    text = targetAuto.text || targetAuto.template_content || '';
                }

                const loaded = {
                    is_global: false,
                    global_posts: true,
                    global_reels: true,
                    global_live: false,
                    global_stories: false,
                    ...targetAuto,
                    keyword: kws,
                    template_elements: elements,
                    buttons,
                    text
                };
                setEditingAutomation(loaded);
                setOriginalAutomation(JSON.parse(JSON.stringify(loaded))); // Deep copy for comparison
                setSelectedTemplateId(sid);
                setKeywordWarnings({});
                setFieldErrors({});
                setDuplicateErrorKeywords(new Set());
                setSuccess(null);
                setError(null);
                setPreparing(false);
                openingRef.current = null;
            }, 600);
        } catch (err) {
            console.error(err);
            setError("Could not load rule details.");
            setPreparing(false);
            fetchAutomations(true, true);
            openingRef.current = null;
        }
    };

    useEffect(() => {
        if (!activeAccountID) return;
        const targetId = sessionStorage.getItem('openAutomationId');
        const targetType = sessionStorage.getItem('openAutomationType');
        if (!targetId || targetType !== 'dm') return;

        sessionStorage.removeItem('openAutomationId');
        sessionStorage.removeItem('openAutomationType');
        handleEdit({ $id: targetId });
    }, [activeAccountID]);

    const [activeElementIdx, setActiveElementIdx] = useState(0);

    // Auto-scroll to active carousel tab
    useEffect(() => {
        if (carouselTabsRef.current && editingAutomation?.template_type === 'template_carousel') {
            const activeTab = document.getElementById(`carousel-tab-${activeElementIdx}`);
            if (activeTab) {
                activeTab.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest'
                });
            }
        }
    }, [activeElementIdx, editingAutomation?.template_type]);

    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [duplicateErrorKeywords, setDuplicateErrorKeywords] = useState<Set<string>>(new Set());

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        setFieldErrors({});

        const errors: { [key: string]: string } = {};
        let hasError = false;

        // Title Validation (UTF-8 byte limit)
        const titleBytes = getByteLength(editingAutomation.title || '');
        if (!editingAutomation.title || editingAutomation.title.trim().length < 2) {
            errors['title'] = "Title must be at least 2 characters.";
            hasError = true;
        } else if (titleBytes > AUTOMATION_TITLE_MAX) {
            errors['title'] = `Title must be at most ${AUTOMATION_TITLE_MAX} UTF-8 bytes.`;
            hasError = true;
        } else {
            const normalizedTitle = editingAutomation.title.trim().toLowerCase();
            const existingTitles = (dmAutomations || []).filter((a: any) => !editingAutomation.$id || a.$id !== editingAutomation.$id).map((a: any) => a.title || '');
            const duplicate = existingTitles.some(t => (t || '').trim().toLowerCase() === normalizedTitle);
            if (duplicate) {
                const suggested = suggestUniqueTitle(editingAutomation.title, existingTitles);
                if (suggested && suggested !== editingAutomation.title) {
                    setEditingAutomation({ ...editingAutomation, title: suggested });
                }
                errors['title'] = `Title already exists. Suggested: ${suggested}`;
                hasError = true;
            }
        }

        // Global Trigger Validation
        if (editingAutomation.is_global) {
            const hasOption = editingAutomation.global_posts || editingAutomation.global_reels || editingAutomation.global_live || editingAutomation.global_stories;
            if (!hasOption) {
                errors['global_options'] = "Select at least one global trigger option.";
                hasError = true;
                // scroll to error
                setTimeout(() => document.getElementById('field_global_options')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
        }

        // Keyword Validation
        const rawKeywords = (editingAutomation.keywords || editingAutomation.keyword || []) as Array<string | null | undefined>;
        const kws = Array.from(new Set(rawKeywords
            .map((k) => String(k || '').trim().toUpperCase())
            .filter((k: string) => k.length > 0)));
        if (kws.length === 0) {
            errors['keywords'] = "At least one keyword is required.";
            hasError = true;
        } else {
            // Check for duplicates within current automation
            const processedKws = kws.map((k: string) => k.trim().toUpperCase());
            const uniqueKws = new Set(processedKws);

            if (uniqueKws.size !== kws.length) {
                const duplicates = processedKws.filter((item: string, index: number) => processedKws.indexOf(item) !== index);
                const uniqueDuplicates = Array.from(new Set(duplicates)) as string[];
                errors['keywords'] = `Duplicate keywords within this rule: ${uniqueDuplicates.join(', ')}`;
                hasError = true;
            } else {
                const conflicts = processedKws.filter((k: string) => keywordConflictSet.has(k));
                if (conflicts.length > 0) {
                    const uniqueConflicts = Array.from(new Set(conflicts)) as string[];
                    errors['keywords'] = `Keywords already used: ${uniqueConflicts.join(', ')}`;
                    hasError = true;
                }
            }
        }

        // Require a reply template: no inline editor.
        if (!selectedTemplateId) {
            errors['template'] = "Please select a reply template or create one in Reply Templates.";
            hasError = true;
        }

        if (false) {
            if (editingAutomation.template_type === 'template_text') {
                const rawText = editingAutomation.template_content || '';
                if (rawText.replace(/\s/g, '').length < 2) {
                    errors['template_content'] = "Message must be at least 2 characters.";
                    hasError = true;
                }
            } else if (editingAutomation.template_type === 'template_media') {
                const url = editingAutomation.template_content?.trim();
                if (!url) {
                    errors['media_url'] = "Media URL is required.";
                    hasError = true;
                } else {
                    // Perform final validation on save
                    const result = await validateMediaUrl(url, editingAutomation.media_type || 'image');
                    if (!result.valid) {
                        errors['media_url'] = result.error || "Invalid media";
                        hasError = true;
                    } else {
                        // Update editingAutomation with verified details just before payload creation
                        setEditingAutomation((prev: any) => ({
                            ...prev,
                            media_size: result.size,
                            media_format: result.format
                        }));
                    }
                }

            } else if (editingAutomation.template_type === 'template_buttons') {
                if (!editingAutomation.text?.trim()) { errors['button_text'] = "Text is required."; hasError = true; }
                if (!editingAutomation.buttons?.length) { errors['buttons'] = "Buttons required."; hasError = true; }
                else {
                    editingAutomation.buttons.forEach((btn: any, idx: number) => {
                        if (!btn.title?.trim()) { errors[`btn_${idx}_title`] = "Required"; hasError = true; }
                        if (!btn.url?.trim()) { errors[`btn_${idx}_url`] = "Required"; hasError = true; }
                    });
                }
            } else if (editingAutomation.template_type === 'template_carousel') {
                if (!editingAutomation.template_elements?.length) { errors['elements'] = "Carousel items required."; hasError = true; }
                else {
                    editingAutomation.template_elements.forEach((el: any, i: number) => {
                        if (!el.title?.trim()) { errors[`element_${i}_title`] = "Title required"; hasError = true; }
                        if (!el.image_url?.trim()) { errors[`element_${i}_image`] = "Image is required"; hasError = true; }
                        (el.buttons || []).forEach((btn: any, b: number) => {
                            if (!btn.title?.trim()) { errors[`element_${i}_btn_${b}_title`] = "Required"; hasError = true; }
                            else if (getByteLength(btn.title) > BUTTON_TITLE_MAX) { errors[`element_${i}_btn_${b}_title`] = `Max ${BUTTON_TITLE_MAX} bytes`; hasError = true; }
                            if (!btn.url?.trim()) { errors[`element_${i}_btn_${b}_url`] = "Required"; hasError = true; }
                        });
                    });
                }
            } else if (editingAutomation.template_type === 'template_share_post') {
                if (!editingAutomation.use_latest_post && !editingAutomation.media_id?.trim()) {
                    errors['media_id'] = "Media ID is required, or enable 'Use Latest Post/Reel'.";
                    hasError = true;
                }
            } else if (editingAutomation.template_type === 'template_quick_replies') {
                if (!editingAutomation.template_content?.trim() || editingAutomation.template_content.trim().length < 2) {
                    errors['template_content'] = "Title text must be at least 2 characters.";
                    hasError = true;
                } else if (getByteLength(editingAutomation.template_content) > TEXT_MAX) {
                    errors['template_content'] = `Title text exceeds ${TEXT_MAX} byte limit.`;
                    hasError = true;
                }
                if (!editingAutomation.replies?.length) {
                    errors['replies'] = "At least one button is required.";
                    hasError = true;
                } else {
                    editingAutomation.replies.forEach((reply: any, idx: number) => {
                        const titleTrimmed = reply.title?.trim() || '';
                        const payloadTrimmed = reply.payload?.trim() || '';

                        if (titleTrimmed.length < 2) {
                            errors[`reply_${idx}`] = "Button text must be at least 2 characters.";
                            hasError = true;
                        } else if (getByteLength(reply.title) > QUICK_REPLY_TITLE_MAX) {
                            errors[`reply_${idx}`] = `Button text exceeds ${QUICK_REPLY_TITLE_MAX} byte limit.`;
                            hasError = true;
                        }

                        if (payloadTrimmed.length < 2) {
                            errors[`reply_${idx}`] = errors[`reply_${idx}`] ? `${errors[`reply_${idx}`]} & Reply must be at least 2 chars.` : "Reply must be at least 2 characters.";
                            hasError = true;
                        } else if (getByteLength(reply.payload) > QUICK_REPLY_PAYLOAD_MAX) {
                            errors[`reply_${idx}`] = errors[`reply_${idx}`] ? `${errors[`reply_${idx}`]} & Reply exceeds ${QUICK_REPLY_PAYLOAD_MAX} byte limit.` : `Reply exceeds ${QUICK_REPLY_PAYLOAD_MAX} byte limit.`;
                            hasError = true;
                        }
                    });
                }
            }
        }

        if (hasError) {
            setFieldErrors(errors);
            setSaving(false);

            // Scroll to top-most error
            const firstErrorKey = Object.keys(errors)[0];

            // If the error is in a carousel element, we must switch to it first
            const carouselMatch = firstErrorKey.match(/^element_(\d+)_/);
            if (carouselMatch) {
                setActiveElementIdx(parseInt(carouselMatch[1]));
            }

            const elementId = `field_${firstErrorKey}`;
            setTimeout(() => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // If it's an input/textarea, focus it
                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                        (element as any).focus();
                    }
                } else {
                    // Fallback to scrolling the modal top or main window
                    const modalEl = document.querySelector('.modal-content') || window;
                    modalEl.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);
            return;
        }

        try {
            // Always send as 'keyword' to backend (backend expects singular)
            const payload = { ...editingAutomation, keyword: kws, type: 'dm' };
            // Remove keywords field if it exists to avoid confusion
            delete payload.keywords;
            delete payload.automation_type;
            if (selectedTemplateId) {
                payload.template_id = selectedTemplateId;
            }
            if (payload.template_type === 'template_carousel') {
                payload.template_content = JSON.stringify(payload.template_elements);
            }
            delete payload.template_elements;

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations${editingAutomation.$id ? '/' + editingAutomation.$id : ''}?account_id=${activeAccountID}&type=dm`, {
                method: editingAutomation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSuccess(editingAutomation.$id ? "Automation updated!" : "Automation published!");
                setEditingAutomation(null);
                fetchAutomations(true);
            } else {
                const data = await res.json();


                // Handle Multi-Field Errors (New Format)
                if (data.fields) {
                    setFieldErrors(data.fields);

                    if (data.duplicate_keywords && Array.isArray(data.duplicate_keywords)) {
                        setDuplicateErrorKeywords(new Set(data.duplicate_keywords));
                    }

                    // Scroll to first error
                    const firstErrorKey = Object.keys(data.fields)[0];
                    if (firstErrorKey) {
                        // If the error is in a carousel element, we must switch to it first
                        const carouselMatch = firstErrorKey.match(/^element_(\d+)_/);
                        if (carouselMatch) {
                            setActiveElementIdx(parseInt(carouselMatch[1]));
                        }

                        const elementId = `field_${firstErrorKey}`;
                        setTimeout(() => {
                            const element = document.getElementById(elementId);
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                                    (element as any).focus();
                                }
                            }
                        }, 100);
                    }
                }
                // Handle Single Field Error (Legacy/Fallback)
                else if (data.field) {
                    if (data.duplicate_keywords && Array.isArray(data.duplicate_keywords)) {
                        setDuplicateErrorKeywords(new Set(data.duplicate_keywords));
                    }
                    const fieldError = { [data.field]: data.error || "Validation failed" };
                    setFieldErrors(fieldError);

                    // If the error is in a carousel element, we must switch to it first
                    const carouselMatch = data.field.match(/^element_(\d+)_/);
                    if (carouselMatch) {
                        setActiveElementIdx(parseInt(carouselMatch[1]));
                    }

                    const elementId = `field_${data.field}`;
                    setTimeout(() => {
                        const element = document.getElementById(elementId);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                                (element as any).focus();
                            }
                        }
                    }, 100);
                } else {
                    setError(data.error || "Failed to save.");
                }
            }
            // Clear notifications after 5s
            setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
        } catch (err) {
            setError("Network error.");
        } finally {
            setSaving(false);
        }
    };

    const handleBack = () => {
        if (hasDirtyChanges()) {
            setModalConfig({
                isOpen: true,
                title: 'Unsaved Changes',
                description: 'You have unsaved changes in your automation. Do you want to save them before leaving?',
                type: 'warning',
                confirmLabel: 'Save Changes',
                secondaryLabel: 'Discard & Leave',
                cancelLabel: 'Keep Editing',
                onConfirm: () => {
                    closeModal();
                    handleSave();
                },
                onSecondary: () => {
                    closeModal();
                    setEditingAutomation(null);
                    setOriginalAutomation(null);
                }
            });
            return;
        }
        setEditingAutomation(null);
        setOriginalAutomation(null);
    };

    // Check if there are unsaved changes
    const hasDirtyChanges = useCallback(() => {
        if (!editingAutomation) return false;
        if (originalAutomation) {
            return JSON.stringify(editingAutomation) !== JSON.stringify(originalAutomation);
        }
        return editingAutomation.title !== 'New Automation' || (editingAutomation.keywords || []).length > 0;
    }, [editingAutomation, originalAutomation]);

    // Register global unsaved changes tracking
    useEffect(() => {
        if (editingAutomation) {
            setHasUnsavedChanges(hasDirtyChanges());
        } else {
            setHasUnsavedChanges(false);
        }
    }, [editingAutomation, originalAutomation, hasDirtyChanges, setHasUnsavedChanges]);

    // Register Save Handler for global navigation
    useEffect(() => {
        if (editingAutomation) {
            const saveHandler = async (): Promise<boolean> => {
                // Trigger the save logic - we need to call the inline save function
                // Since save() has side effects and uses local state, we trigger it indirectly
                // For simplicity, we'll just try to save and return the result
                // Note: This is a simplified version - full validation happens in save()
                return new Promise((resolve) => {
                    // We can't easily call save() here due to closure issues
                    // Best approach: show modal for DM editing since it's complex
                    setModalConfig(prev => ({
                        ...prev,
                        isOpen: true,
                        title: 'Unsaved Changes',
                        description: 'You have unsaved changes in your automation. Do you want to save them before leaving?',
                        type: 'warning',
                        confirmLabel: 'Save Changes',
                        secondaryLabel: 'Discard & Leave',
                        cancelLabel: 'Keep Editing',
                        onConfirm: () => {
                            closeModal();
                            handleSave();
                            resolve(true); // Assume save will eventually succeed or user will be notified
                        },
                        onSecondary: () => {
                            closeModal();
                            setEditingAutomation(null);
                            setOriginalAutomation(null);
                            resolve(true); // Discarded, safe to navigate
                        },
                        onCancel: () => {
                            closeModal();
                            resolve(false); // User chose to keep editing
                        }
                    }));
                });
            };
            setSaveUnsavedChanges(() => saveHandler);
        }
        return () => {
            if (editingAutomation) {
                setSaveUnsavedChanges(() => async () => true);
            }
        };
    }, [editingAutomation, setSaveUnsavedChanges, handleSave]);

    // Register Discard Handler for global navigation
    useEffect(() => {
        if (editingAutomation) {
            const discardHandler = () => {
                setEditingAutomation(null);
                setOriginalAutomation(null);
                setKeywordWarnings({});
                setFieldErrors({});
            };
            setDiscardUnsavedChanges(() => discardHandler);
        }
        return () => {
            if (editingAutomation) {
                setDiscardUnsavedChanges(() => () => { });
            }
        };
    }, [editingAutomation, setDiscardUnsavedChanges]);

    // Ref for media cache to keep fetchMedia stable
    const mediaCacheRef = React.useRef(mediaCache);
    const mediaNextCursorRef = React.useRef(mediaNextCursor);
    const mediaLastFetchRef = React.useRef<number>(0);
    React.useEffect(() => {
        mediaCacheRef.current = mediaCache;
        mediaNextCursorRef.current = mediaNextCursor;
    }, [mediaCache, mediaNextCursor]);

    const fetchMedia = useCallback(async (type: 'post' | 'reel' | 'all', force = false, isLoadMore = false, filter?: string, start?: string, end?: string) => {
        if (!activeAccountID) return;

        const currentFilter = filter || mediaDateFilter;
        const currentStart = start || mediaStartDate;
        const currentEnd = end || mediaEndDate;

        // Perfected Cache Check: Determine if the requested date range is already fully covered by the cache
        if (!force && !isLoadMore && mediaCacheRef.current.all && mediaCacheRef.current.all.length > 0) {
            const cache = [...mediaCacheRef.current.all].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const now = Math.floor(Date.now() / 1000);
            const isFresh = (Date.now() - mediaLastFetchRef.current) < 300000; // 5 minutes freshness

            if (currentFilter === 'all' && cache.length >= 100) return; // Already have default initial set

            let neededSince = 0;
            let neededUntil = now;

            if (currentFilter === '7days') neededSince = now - (7 * 24 * 60 * 60);
            else if (currentFilter === '30days') neededSince = now - (30 * 24 * 60 * 60);
            else if (currentFilter === '90days') neededSince = now - (90 * 24 * 60 * 60);
            else if (currentFilter === 'custom' && currentStart) {
                neededSince = Math.floor(new Date(currentStart).getTime() / 1000);
                if (currentEnd) neededUntil = Math.floor(new Date(currentEnd).getTime() / 1000) + 86399;
            }

            const newestInCache = Math.floor(new Date(cache[0].timestamp).getTime() / 1000);
            const oldestInCache = Math.floor(new Date(cache[cache.length - 1].timestamp).getTime() / 1000);

            // Coverage Logic:
            // 1. We must have data older than the requested start (neededSince)
            // 2. For presets (7,30,90), if we just fetched 'all' recently, we assume 'now' is covered.
            // 3. For custom, we check if our newest item in cache is >= the requested end.
            const coversStart = oldestInCache <= (neededSince + 60);
            const isPreset = ['7days', '30days', '90days'].includes(currentFilter);

            if (coversStart) {
                if (isPreset && isFresh) return; // Recent 'all' fetch covers presets if it goes back far enough
                if (!isPreset && newestInCache >= (neededUntil - 3600)) return; // Custom range covered
            }
        }

        if (isLoadMore) setLoadingMoreMedia(true);
        else {
            setMediaLoading(true);
            setMediaNextCursor(null);
            setMediaHasNext(false);
        }

        setMediaError(null);
        try {
            const params = new URLSearchParams();
            params.append('account_id', activeAccountID);
            params.append('type', type);
            params.append('limit', '100'); // Standard page size as requested

            if (isLoadMore && mediaNextCursorRef.current) {
                params.append('after', mediaNextCursorRef.current);
            }

            if (currentFilter === '7days') {
                const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
                params.append('since', since.toString());
            } else if (currentFilter === '30days') {
                const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
                params.append('since', since.toString());
            } else if (currentFilter === '90days') {
                const since = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
                params.append('since', since.toString());
            } else if (currentFilter === 'custom' && currentStart) {
                const since = Math.floor(new Date(currentStart).getTime() / 1000);
                params.append('since', since.toString());
                if (currentEnd) {
                    const until = Math.floor(new Date(currentEnd).getTime() / 1000) + 86399; // End of day
                    params.append('until', until.toString());
                }
            }

            let allResults: any[] = [];
            let currentCursor = isLoadMore ? mediaNextCursorRef.current : null;
            let hasMorePages = true;
            let pageCount = 0;
            const isDateRange = currentFilter !== 'all';

            while (hasMorePages && pageCount < 20) { // Safety cap of 20 pages (2000 items)
                const currentParams = new URLSearchParams(params);
                if (currentCursor) {
                    currentParams.set('after', currentCursor);
                }

                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?${currentParams.toString()}`);
                const data = await res.json();

                if (!res.ok) {
                    if (allResults.length === 0) throw new Error(data.error || "Failed to fetch media");
                    break;
                }

                const pageData = data.data || [];
                allResults = [...allResults, ...pageData];

                const nextCursor = data.paging?.cursors?.after;

                // If it's a date range, we MUST load everything. 
                // If it's "all items" or manual "load more", we only load one page at a time.
                if (isDateRange && nextCursor && !isLoadMore) {
                    currentCursor = nextCursor;
                    pageCount++;
                } else {
                    hasMorePages = false;
                    // For manual load more or "all" items, update the cursor for future use
                    if (nextCursor) {
                        setMediaNextCursor(nextCursor);
                        setMediaHasNext(true);
                    } else {
                        setMediaNextCursor(null);
                        setMediaHasNext(false);
                    }
                }
            }

            mediaLastFetchRef.current = Date.now();
            setMediaCache(prev => {
                const existingIds = new Set(prev.all.map(m => m.id));
                const newItems = allResults.filter((m: any) => !existingIds.has(m.id));
                const combined = [...prev.all, ...newItems].sort((a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                return {
                    ...prev,
                    all: combined
                };
            });
        } catch (err) {
            setMediaError("Network error fetching media");
        } finally {
            setMediaLoading(false);
            setLoadingMoreMedia(false);
        }
    }, [activeAccountID, authenticatedFetch, mediaDateFilter, mediaStartDate, mediaEndDate]);

    useEffect(() => {
        if (editingAutomation?.template_type === 'template_share_post' && !selectedTemplateId) {
            fetchMedia('all', false); // Use cached 'all' if available, don't force refetch on tab change
        }
    }, [editingAutomation?.template_type, mediaDateFilter, mediaStartDate, mediaEndDate, fetchMedia, selectedTemplateId]);

    useEffect(() => {
        if (editingAutomation?.template_type === 'template_share_post' && editingAutomation.media_url) {
            const img = new window.Image();
            img.src = editingAutomation.media_url;
            img.onload = () => setIsMediaDeleted(false);
            img.onerror = () => setIsMediaDeleted(true);
        } else {
            setIsMediaDeleted(false);
        }
    }, [editingAutomation?.template_type, editingAutomation?.media_url]);

    const isKeywordDuplicate = useCallback((kw: string) => {
        const kws = editingAutomation?.keywords || [];
        const target = kw.trim().toUpperCase();

        let count = 0;
        kws.forEach((k: string) => {
            const current = k.trim().toUpperCase();
            if (current === target) count++;
        });
        return count > 1;
    }, [editingAutomation?.keywords]);

    const keywordConflictSet = useMemo(() => {
        const set = new Set<string>();
        const addFrom = (auto: any) => {
            const raw = Array.isArray(auto?.keyword) ? auto.keyword : (auto?.keyword ? String(auto.keyword).split(',') : []);
            raw.forEach((k: string) => {
                const norm = String(k || '').trim().toUpperCase();
                if (norm) set.add(norm);
            });
        };
        (dmAutomations || []).forEach((a: any) => {
            if (editingAutomation?.$id && a.$id === editingAutomation.$id) return;
            addFrom(a);
        });
        (globalAutomations || []).forEach((a: any) => addFrom(a));
        duplicateErrorKeywords.forEach(k => set.add(String(k || '').trim().toUpperCase()));
        return set;
    }, [duplicateErrorKeywords, dmAutomations, globalAutomations, editingAutomation?.$id]);

    const validateKeywordsList = useCallback((newKeywords: string[]) => {
        const kws = newKeywords.filter((k: string) => k.trim().length > 0);
        let errorMsg = "";

        const processedKws = kws.map((k: string) => k.trim().toUpperCase());
        const uniqueKws = new Set(processedKws);

        if (uniqueKws.size !== kws.length) {
            const duplicates = processedKws.filter((item, index) => processedKws.indexOf(item) !== index);
            const uniqueDuplicates = Array.from(new Set(duplicates));
            errorMsg = `Duplicate keywords within this rule: ${uniqueDuplicates.join(', ')}`;
        } else {
            const conflicts = processedKws.filter((k) => keywordConflictSet.has(k));
            if (conflicts.length > 0) {
                errorMsg = `Keywords already used: ${Array.from(new Set(conflicts)).join(', ')}`;
            }
        }

        return errorMsg;
    }, [keywordConflictSet]);

    const hasTitleConflict = useMemo(() => {
        const title = (editingAutomation?.title || '').trim().toLowerCase();
        if (!title) return false;
        const existingTitles = (dmAutomations || [])
            .filter((a: any) => !editingAutomation?.$id || a.$id !== editingAutomation.$id)
            .map((a: any) => (a.title || '').trim().toLowerCase());
        return existingTitles.includes(title);
    }, [editingAutomation?.title, editingAutomation?.$id, dmAutomations]);

    const hasKeywordConflict = useMemo(() => {
        const kws = (editingAutomation?.keywords || []).map((k: string) => String(k || '').trim().toUpperCase()).filter(Boolean);
        return kws.some((k: string) => keywordConflictSet.has(k));
    }, [editingAutomation?.keywords, keywordConflictSet]);

    const handleAddKeyword = () => {
        let val = keywordInput.trim().toUpperCase();
        if (!val) return;

        const currentKws = editingAutomation.keywords || [];
        if (currentKws.length >= 5) {
            setFieldErrors(prev => ({ ...prev, keywords: "Max 5 keywords." }));
            return;
        }
        if (val.length > 15) {
            setFieldErrors(prev => ({ ...prev, keywords: "Max 15 chars." }));
            return;
        }

        const nextKeywords = [...currentKws, val];
        setEditingAutomation({ ...editingAutomation, keywords: nextKeywords });
        setKeywordInput("");
        setDuplicateErrorKeywords(new Set()); // Clear backend errors on edit

        const kwError = validateKeywordsList(nextKeywords);
        if (kwError) {
            setFieldErrors(prev => ({ ...prev, keywords: kwError }));
        } else {
            setFieldErrors(prev => {
                const n = { ...prev };
                delete n.keywords;
                return n;
            });
        }
    };

    const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddKeyword();
        }
    };

    const removeKeywordTag = (idx: number) => {
        const next = (editingAutomation.keywords || []).filter((_: any, i: number) => i !== idx);
        setEditingAutomation({ ...editingAutomation, keywords: next });

        const kwError = validateKeywordsList(next);
        if (kwError) {
            setFieldErrors(prev => ({ ...prev, keywords: kwError }));
        } else {
            setFieldErrors(prev => { const n = { ...prev }; delete n['keywords']; return n; });
        }
    };

    useEffect(() => {
        if (!editingAutomation) return;
        const kwError = validateKeywordsList(editingAutomation.keywords || []);
        if (kwError) {
            setFieldErrors(prev => ({ ...prev, keywords: kwError }));
        } else {
            setFieldErrors(prev => { const n = { ...prev }; delete n['keywords']; return n; });
        }

        if (hasTitleConflict) {
            setFieldErrors(prev => ({ ...prev, title: "Title already exists." }));
        }
    }, [editingAutomation?.keywords, validateKeywordsList, hasTitleConflict, editingAutomation]);

    const addTemplateElement = () => {
        if (editingAutomation.template_elements.length >= 10) return;
        const newElements = [...editingAutomation.template_elements, { title: '', subtitle: '', image_url: '', buttons: [{ title: '', url: '', type: 'web_url' }] }];
        setEditingAutomation({ ...editingAutomation, template_elements: newElements });
        setActiveElementIdx(newElements.length - 1);
    };

    const removeTemplateElement = (index: number) => {
        if (editingAutomation.template_elements.length <= 1) return;
        const newElements = editingAutomation.template_elements.filter((_: any, i: number) => i !== index);
        setEditingAutomation({ ...editingAutomation, template_elements: newElements });
        setActiveElementIdx(prev => Math.min(prev, newElements.length - 1));
    };

    const addElementButton = (elIdx: number) => {
        const els = [...editingAutomation.template_elements];
        if (els[elIdx].buttons.length < 3) {
            els[elIdx].buttons.push({ title: '', url: '', type: 'web_url' });
            setEditingAutomation({ ...editingAutomation, template_elements: els });
        }
    };

    const removeElementButton = (elIdx: number, btnIdx: number) => {
        const els = [...editingAutomation.template_elements];
        if (els[elIdx].buttons.length > 1) {
            els[elIdx].buttons = els[elIdx].buttons.filter((_: any, i: number) => i !== btnIdx);
            setEditingAutomation({ ...editingAutomation, template_elements: els });
        }
    };

    const updateElement = (idx: number, field: string, val: any) => {
        const els = [...editingAutomation.template_elements];
        els[idx] = { ...els[idx], [field]: val };
        setEditingAutomation({ ...editingAutomation, template_elements: els });
    };

    const handleDelete = async (id: string) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Rule?',
            description: 'This action cannot be undone. This automation rule will be permanently removed from your account.',
            type: 'danger',
            confirmLabel: 'Delete Now',
            onConfirm: async () => {
                closeModal();
                setDeletingIds(prev => new Set(prev).add(id));
                try {
                    const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (editingAutomation?.$id === id) setEditingAutomation(null);
                        fetchAutomations(true, true);
                        showAlert('Deleted', 'The automation rule has been successfully removed.', 'success');
                    } else {
                        const err = await res.json();
                        showAlert('Delete Failed', err.error || 'Failed to delete automation.', 'danger');
                    }
                } catch (error) {
                    showAlert('Error', 'A network error occurred while deleting.', 'danger');
                } finally {
                    setDeletingIds(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }
            }
        });
    };

    const handleToggleActive = async (auto: any) => {
        setTogglingIds(prev => new Set(prev).add(auto.$id));
        const originalStatus = auto.active;
        setDmAutomations(prev => prev.map(a => a.$id === auto.$id ? { ...a, active: !originalStatus } : a));
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${auto.$id}?account_id=${activeAccountID}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !originalStatus })
            });
            if (!res.ok) throw new Error();
        } catch (e) {
            setDmAutomations(prev => prev.map(a => a.$id === auto.$id ? { ...a, active: originalStatus } : a));
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(auto.$id); return n; });
        }
    };

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-primary rounded-[28%] flex items-center justify-center text-primary-foreground mb-6 shadow-2xl shadow-primary/20">
                    <MessageSquare className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-foreground mb-3">Select Instagram Account</h2>
                <p className="text-muted-foreground max-w-md mb-8 font-medium">Keywords-based DM Automation requires an active Instagram Business link.</p>

            </div>
        );
    }

    if (preparing || loading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message={preparing ? 'Preparing Editor...' : 'Loading DM Automation'}
                subMessage={preparing ? 'Loading your automation...' : 'Fetching your rules...'}
            />
        );
    }

    if (editingAutomation) {
        const titleBytes = getByteLength(editingAutomation.title || '');
        const keywordsCount = (editingAutomation.keywords || []).filter((k: string) => String(k || '').trim().length > 0).length;
        const isPublishDisabled = saving
            || !selectedTemplateId
            || !editingAutomation.title?.trim()
            || titleBytes > AUTOMATION_TITLE_MAX
            || keywordsCount === 0
            || !!fieldErrors['title']
            || !!fieldErrors['keywords']
            || !!fieldErrors['template']
            || hasTitleConflict
            || hasKeywordConflict;

        return (
            <div className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-screen">
                <div className="flex items-center justify-between border border-content/60 bg-background/90 backdrop-blur px-4 py-3 rounded-2xl sticky top-4 z-40">
                    <button onClick={handleBack} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
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
                        <button
                            onClick={handleSave}
                            disabled={isPublishDisabled}
                            className="group relative px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_14px_28px_-12px_rgba(37,99,235,0.45)] flex items-center gap-3 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 transition-transform group-hover:rotate-6" />}
                            {saving ? 'Processing...' : (editingAutomation.$id ? 'Update Changes' : 'Publish Automation')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:h-[calc(100vh-11rem)] xl:min-h-0">
                    {/* Left: Editor - scrollable on xl */}
                    <div className="xl:col-span-8 space-y-8 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
                        <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Automation Core</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center gap-2 mb-1 px-1">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internal Reference Title</label>
                                                <div className="group relative">
                                                    <HelpCircle className="w-3 h-3 text-muted-foreground/60 cursor-help" />
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-foreground text-background text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                        This name is only for you to identify this automation in the dashboard. Max {AUTOMATION_TITLE_MAX} UTF-8 bytes.
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] font-bold ${getByteLength(editingAutomation.title || '') > AUTOMATION_TITLE_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                {getByteLength(editingAutomation.title || '')}/{AUTOMATION_TITLE_MAX}
                                            </span>
                                        </div>
                                        <input
                                            id="field_title"
                                            value={editingAutomation.title}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (getByteLength(val) <= AUTOMATION_TITLE_MAX) {
                                                    setEditingAutomation({ ...editingAutomation, title: val });
                                                    const trimmed = val.trim();
                                                    if (!trimmed) {
                                                        setFieldErrors((prev: any) => ({ ...prev, title: "Title must be at least 2 characters." }));
                                                    } else {
                                                        const normalizedTitle = trimmed.toLowerCase();
                                                        const existingTitles = (dmAutomations || [])
                                                            .filter((a: any) => !editingAutomation?.$id || a.$id !== editingAutomation.$id)
                                                            .map((a: any) => (a.title || '').trim().toLowerCase());
                                                        if (existingTitles.includes(normalizedTitle)) {
                                                            setFieldErrors((prev: any) => ({ ...prev, title: "Title already exists." }));
                                                        } else {
                                                            setFieldErrors((prev: any) => { const n = { ...prev }; delete n['title']; return n; });
                                                        }
                                                    }
                                                }
                                            }}
                                            className={`w-full bg-muted/40  border-2 ${fieldErrors['title'] ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl py-4 px-6 text-sm font-black text-foreground transition-all`}
                                            placeholder="e.g. Price Check"
                                        />
                                        <p className="text-[9px] text-muted-foreground font-medium px-2">Required. Max {AUTOMATION_TITLE_MAX} UTF-8 bytes. This title helps you organize and find your automations easily later.</p>
                                        {fieldErrors['title'] && (
                                            <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> {fieldErrors['title']}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Trigger Keywords (Max 5)</label>
                                            <span className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                                    {(editingAutomation.keywords || []).length}/5
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); handleAddKeyword(); }}
                                                    disabled={!keywordInput.trim() || (editingAutomation.keywords || []).length >= 5}
                                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 active:scale-95"
                                                >
                                                    Add
                                                </button>
                                            </span>
                                        </div>
                                        <div className="space-y-4" id="field_keywords">
                                            <div className="relative">
                                                <input
                                                    value={keywordInput}
                                                    onChange={e => setKeywordInput(e.target.value.toUpperCase())}
                                                    onKeyDown={handleKeywordKeyDown}
                                                    className={`w-full bg-primary/10  border-2 ${fieldErrors['keywords'] ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl py-4 px-6 pr-12 text-sm font-black text-primary  placeholder:text-muted-foreground/70 transition-all`}
                                                    placeholder="Type keyword and press Enter..."
                                                    maxLength={15}
                                                    disabled={(editingAutomation.keywords || []).length >= 5}
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    <Smartphone className="w-4 h-4 text-primary/60" />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-2">
                                                <p className="text-[9px] text-muted-foreground font-medium">Required: Set at least one keyword that customers should type to trigger this reply.</p>
                                                <span className={`text-[9px] font-bold ${keywordInput.length > 15 ? 'text-destructive' : 'text-muted-foreground'}`}>{keywordInput.length}/15</span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-muted/40 rounded-2xl border border-content">
                                                {(editingAutomation.keywords || []).map((kw: string, idx: number) => {
                                                    const isLocalDuplicate = isKeywordDuplicate(kw);
                                                    const isBackendDuplicate = keywordConflictSet.has(String(kw || '').trim().toUpperCase());
                                                    const isError = isLocalDuplicate || isBackendDuplicate;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider transition-all animate-in zoom-in-95 duration-200 ${isError
                                                                ? 'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20'
                                                                : 'bg-primary text-primary-foreground'
                                                                }`}
                                                        >
                                                            <span>{kw}</span>
                                                            <button
                                                                onClick={() => removeKeywordTag(idx)}
                                                                className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {fieldErrors['keywords'] && (
                                                <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> {fieldErrors['keywords']}
                                                </p>
                                            )}


                                        </div>
                                    </div>
                                </div>
                                {/* Case Sensitivity Note - MOVED UP */}
                                <div className="mt-8 flex items-start gap-4 bg-warning-muted/40 p-5 rounded-[28px] border border-warning/20">
                                    <div className="p-3 bg-card rounded-2xl shadow-sm border border-warning/20 shrink-0">
                                        <Lightbulb className="w-5 h-5 text-yellow-500" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-foreground uppercase tracking-[0.15em] mb-1">Important: Matching Rules</p>
                                        <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                                            <span className="font-bold text-muted-foreground ">Titles are Case Sensitive:</span> "Promo" and "promo" are different rules.<br />
                                            <span className="font-bold text-muted-foreground ">Keywords are Case Insensitive:</span> All keywords are treated as UPPERCASE. "Price", "price", and "PRICE" are considered the same trigger.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border/60 mt-6 lg:mt-8">
                                    <div className="flex items-center justify-between bg-primary/10  p-5 rounded-[28px] border border-primary/20 transition-all hover:bg-primary/10 ">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-card rounded-2xl shadow-sm border border-primary/20">
                                                <Power className={`w-5 h-5 transition-colors ${editingAutomation.followers_only ? 'text-primary' : 'text-muted-foreground'}`} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-foreground uppercase tracking-[0.15em] mb-0.5">Followers Only Mode</p>
                                                <p className="text-[10px] font-medium text-muted-foreground">Restricts this automation to only trigger for your existing followers.</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            isChecked={editingAutomation.followers_only}
                                            onChange={() => setEditingAutomation({ ...editingAutomation, followers_only: !editingAutomation.followers_only })}
                                            variant="plain"
                                        />
                                    </div>
                                </div>

                            </div>

                            <div className="pt-8 border-t border-border/60">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">Response Message</h3>
                                <TemplateSelector
                                    selectedTemplateId={selectedTemplateId || undefined}
                                    onSelect={async (template: ReplyTemplate | null) => {
                                        if (template) {
                                            setEditingAutomation((prev: any) => ({
                                                ...prev,
                                                ...mergeReplyTemplateIntoAutomation(template.template_type, template.template_data || {}),
                                                template_id: template.id
                                            }));
                                            setSelectedTemplateId(template.id);
                                            setSelectedTemplateData(template);
                                            templateCacheRef.current.set(template.id, template);
                                        } else {
                                            setSelectedTemplateId(null);
                                            setSelectedTemplateData(null);
                                            setEditingAutomation((prev: any) => ({
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
                                    onCreateNew={() => setCurrentView('Reply Templates')}
                                    className="mb-6"
                                />
                                {fieldErrors['template'] && <p id="field_template" className="text-[10px] text-destructive font-bold px-2">{fieldErrors['template']}</p>}
                                {false && !selectedTemplateId && (
                                    <>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                            {[
                                                { id: 'template_text', icon: FileText, label: 'Text' },
                                                { id: 'template_carousel', icon: Smartphone, label: 'Carousel' },
                                                { id: 'template_buttons', icon: MousePointerClick, label: 'Button' },
                                                { id: 'template_media', icon: ImageIcon, label: 'Media' },
                                                { id: 'template_share_post', icon: Share2, label: 'Share Post' },
                                                { id: 'template_quick_replies', icon: Reply, label: 'Quick replies' },
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => {
                                                        if (editingAutomation.template_type === type.id) return;

                                                        const nextData: any = { ...editingAutomation, template_type: type.id };

                                                        // Initialize fields if they don't exist, but don't wipe existing ones
                                                        if (type.id === 'template_text' && nextData.template_content === undefined) {
                                                            nextData.template_content = '';
                                                        } else if (type.id === 'template_carousel' && (nextData.template_elements === undefined || nextData.template_elements.length === 0)) {
                                                            nextData.template_elements = [{
                                                                title: '',
                                                                subtitle: '',
                                                                image_url: '',
                                                                buttons: [{ title: '', url: '', type: 'web_url' }]
                                                            }];
                                                            setActiveElementIdx(0);
                                                        } else if (type.id === 'template_buttons') {
                                                            if (nextData.text === undefined) nextData.text = '';
                                                            if (nextData.buttons === undefined || nextData.buttons.length === 0) {
                                                                nextData.buttons = [{ title: '', url: '', type: 'web_url' }];
                                                            }
                                                        } else if (type.id === 'template_media') {
                                                            if (nextData.template_content === undefined) nextData.template_content = '';
                                                            if (nextData.buttons === undefined || nextData.buttons.length === 0) {
                                                                nextData.buttons = [{ title: '', url: '', type: 'web_url' }];
                                                            }
                                                        } else if (type.id === 'template_share_post') {
                                                            if (nextData.media_id === undefined) nextData.media_id = '';
                                                        } else if (type.id === 'template_quick_replies') {
                                                            if (nextData.template_content === undefined) nextData.template_content = '';
                                                            if (!nextData.replies || nextData.replies.length === 0) {
                                                                nextData.replies = [{ title: '', payload: '', content_type: 'text' }];
                                                            }
                                                        }

                                                        setEditingAutomation(nextData);
                                                    }}
                                                    className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${editingAutomation.template_type === type.id
                                                        ? 'border-primary bg-primary/10  text-primary'
                                                        : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted  group'
                                                        }`}
                                                >
                                                    <type.icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${editingAutomation.template_type === type.id ? 'scale-110' : ''}`} />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-center">{type.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {editingAutomation.template_type === 'template_text' && (
                                                <div className="bg-muted/30 p-6 rounded-[32px] border border-content relative">
                                                    <div className="flex justify-between items-center px-1 mb-2">
                                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Message Content</label>
                                                        <span className={`text-[8px] font-bold ${getByteLength(editingAutomation.template_content || '') > TEXT_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                            {getByteLength(editingAutomation.template_content || '')}/{TEXT_MAX} bytes
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        id="field_template_content"
                                                        value={editingAutomation.template_content}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            if (getByteLength(val) <= TEXT_MAX) {
                                                                setEditingAutomation({ ...editingAutomation, template_content: val });
                                                            }
                                                        }}
                                                        className={`w-full bg-card border-2 ${fieldErrors['template_content'] ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl p-6 text-xs font-bold text-foreground min-h-[160px] shadow-sm transition-all resize-none`}
                                                        placeholder="Hello! Thanks for your message. You can use text or links here.
(Enter checks for line breaks)"
                                                    />
                                                    <p className="text-[9px] text-muted-foreground font-medium px-2 mt-2">Required: This is the main message that will be sent to the user when the automation is triggered.</p>
                                                    {fieldErrors['template_content'] && (
                                                        <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> {fieldErrors['template_content']}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {editingAutomation.template_type === 'template_carousel' && (
                                                <div className="space-y-6">
                                                    {/* Element Tabs */}
                                                    <div
                                                        ref={carouselTabsRef}
                                                        className="flex items-center gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide no-scrollbar flex-nowrap snap-x snap-mandatory scroll-smooth"
                                                    >
                                                        {(editingAutomation.template_elements || []).map((_: any, idx: number) => (
                                                            <button
                                                                key={idx}
                                                                id={`carousel-tab-${idx}`}
                                                                onClick={() => setActiveElementIdx(idx)}
                                                                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 snap-center shrink-0 ${activeElementIdx === idx
                                                                    ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/30 ring-4 ring-primary/10'
                                                                    : 'bg-card text-muted-foreground hover:text-foreground  border border-content'
                                                                    }`}
                                                            >
                                                                Item {idx + 1}
                                                                {editingAutomation.template_elements.length > 1 && activeElementIdx === idx && (
                                                                    <Trash2
                                                                        className="w-3 h-3 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeTemplateElement(idx);
                                                                        }}
                                                                    />
                                                                )}
                                                            </button>
                                                        ))}
                                                        {editingAutomation.template_elements.length < 10 && (
                                                            <button
                                                                onClick={addTemplateElement}
                                                                className="px-5 py-2.5 rounded-2xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 border border-primary/20 shrink-0 flex items-center justify-center transition-all active:scale-95"
                                                                title="Add Carousel Item"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Active Element Editor */}
                                                    {editingAutomation.template_elements[activeElementIdx] && (
                                                        <div className="bg-muted/30 p-8 rounded-[32px] border border-content space-y-8 animate-in zoom-in-95">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                                <div className="space-y-6">
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center px-1">
                                                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Headline</label>
                                                                            <span className={`text-[8px] font-bold ${getByteLength(editingAutomation.template_elements[activeElementIdx].title || '') > 80 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                                {getByteLength(editingAutomation.template_elements[activeElementIdx].title || '')}/{CAROUSEL_TITLE_MAX} bytes
                                                                            </span>
                                                                        </div>
                                                                        <input
                                                                            id={`field_element_${activeElementIdx}_title`}
                                                                            value={editingAutomation.template_elements[activeElementIdx].title}
                                                                            onChange={e => {
                                                                                const v = e.target.value;
                                                                                if (getByteLength(v) <= CAROUSEL_TITLE_MAX) updateElement(activeElementIdx, 'title', v);
                                                                            }}
                                                                            className={`w-full bg-card border-2 ${fieldErrors[`element_${activeElementIdx}_title`] ? 'border-destructive' : 'border-border'} focus:border-primary focus:border-primary outline-none rounded-2xl p-4 text-xs font-bold text-foreground shadow-sm`}
                                                                            placeholder="Premium Panda Pack"
                                                                        />
                                                                        {fieldErrors[`element_${activeElementIdx}_title`] && (
                                                                            <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                                <AlertCircle className="w-3 h-3" /> {fieldErrors[`element_${activeElementIdx}_title`]}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between items-center px-1">
                                                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Description <span className="text-muted-foreground/60 ">(Optional)</span></label>
                                                                            <span className={`text-[8px] font-bold ${getByteLength(editingAutomation.template_elements[activeElementIdx].subtitle || '') > 80 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                                {getByteLength(editingAutomation.template_elements[activeElementIdx].subtitle || '')}/{CAROUSEL_SUBTITLE_MAX} bytes
                                                                            </span>
                                                                        </div>
                                                                        <textarea
                                                                            value={editingAutomation.template_elements[activeElementIdx].subtitle}
                                                                            onChange={e => {
                                                                                const v = e.target.value;
                                                                                if (getByteLength(v) <= CAROUSEL_SUBTITLE_MAX) updateElement(activeElementIdx, 'subtitle', v);
                                                                            }}
                                                                            className="w-full bg-card border-2 border-border focus:border-primary focus:border-primary outline-none rounded-2xl p-4 text-xs font-bold text-foreground min-h-[100px] shadow-sm"
                                                                            placeholder="Get the best of DMPanda today..."
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-6">
                                                                    <div className="space-y-4">
                                                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Visual Asset Preview & image URL</label>
                                                                        <div className="space-y-4">
                                                                            <div className={`aspect-video relative rounded-2xl overflow-hidden border-2 ${fieldErrors[`element_${activeElementIdx}_image`] ? 'border-destructive' : 'border-dashed border-border'} bg-card group`}>
                                                                                {editingAutomation.template_elements[activeElementIdx].image_url && !isRestrictedMediaUrl(editingAutomation.template_elements[activeElementIdx].image_url) ? (
                                                                                    <div className="h-full w-full">
                                                                                        <img
                                                                                            src={editingAutomation.template_elements[activeElementIdx].image_url}
                                                                                            referrerPolicy="no-referrer"
                                                                                            className="w-full h-full object-cover"
                                                                                            alt=""
                                                                                            onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                                                                                        />
                                                                                        <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                                                            <button onClick={() => updateElement(activeElementIdx, 'image_url', '')} className="p-3 bg-destructive/40 hover:bg-destructive/60 rounded-xl text-destructive-foreground backdrop-blur-md transition-all">
                                                                                                <Trash2 className="w-4 h-4" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                                                        <ImageIcon className="w-8 h-8" />
                                                                                        <span className="text-[9px] font-black uppercase">
                                                                                            {isRestrictedMediaUrl(editingAutomation.template_elements[activeElementIdx].image_url)
                                                                                                ? 'Preview unavailable'
                                                                                                : 'No Image Set'}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                <div className="relative">
                                                                                    <input
                                                                                        id={`field_element_${activeElementIdx}_image`}
                                                                                        value={editingAutomation.template_elements[activeElementIdx].image_url}
                                                                                        onChange={e => {
                                                                                            updateElement(activeElementIdx, 'image_url', e.target.value);
                                                                                            if (fieldErrors[`element_${activeElementIdx}_image`]) {
                                                                                                const updatedErrors = { ...fieldErrors };
                                                                                                delete updatedErrors[`element_${activeElementIdx}_image`];
                                                                                                setFieldErrors(updatedErrors);
                                                                                            }
                                                                                        }}
                                                                                        className={`w-full bg-card border-2 ${fieldErrors[`element_${activeElementIdx}_image`] ? 'border-destructive' : 'border-border'} focus:border-primary focus:border-primary outline-none rounded-xl py-3 px-10 text-[10px] font-bold text-foreground shadow-sm`}
                                                                                        placeholder="Paste high-res image URL here..."
                                                                                    />
                                                                                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/70" />
                                                                                </div>
                                                                                {fieldErrors[`element_${activeElementIdx}_image`] && (
                                                                                    <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" /> {fieldErrors[`element_${activeElementIdx}_image`]}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-8 border-t border-content space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Buttons Configuration <span className="text-muted-foreground/60 ">(Optional - Max 3)</span></h4>
                                                                    <button
                                                                        onClick={() => addElementButton(activeElementIdx)}
                                                                        disabled={editingAutomation.template_elements[activeElementIdx].buttons?.length >= 3}
                                                                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-20"
                                                                    >
                                                                        + Add Button
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    {(editingAutomation.template_elements[activeElementIdx].buttons || []).map((btn: any, bidx: number) => (
                                                                        <div key={bidx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-in slide-in-from-left-2 transition-all p-4 bg-card rounded-2xl shadow-sm border border-content">
                                                                            <div className="md:col-span-4 space-y-1.5">
                                                                                <div className="flex justify-between items-center px-1 block mb-1">
                                                                                    <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Button Title</label>
                                                                                    <span className={`text-[8px] font-bold ${getByteLength(btn.title || '') > BUTTON_TITLE_MAX ? 'text-destructive' : 'text-muted-foreground/60'}`}>{getByteLength(btn.title || '')}/{BUTTON_TITLE_MAX} bytes</span>
                                                                                </div>
                                                                                <input
                                                                                    id={`field_element_${activeElementIdx}_btn_${bidx}_title`}
                                                                                    value={btn.title}
                                                                                    onChange={e => {
                                                                                        const v = e.target.value;
                                                                                        if (getByteLength(v) <= BUTTON_TITLE_MAX) {
                                                                                            const newBtns = [...editingAutomation.template_elements[activeElementIdx].buttons];
                                                                                            newBtns[bidx].title = v;
                                                                                            updateElement(activeElementIdx, 'buttons', newBtns);
                                                                                        }
                                                                                    }}
                                                                                    className={`w-full bg-muted/40  border-2 ${fieldErrors[`element_${activeElementIdx}_btn_${bidx}_title`] ? 'border-destructive' : 'border-border'} focus:border-primary focus:border-primary rounded-xl p-3 text-[11px] font-black text-foreground shadow-inner`}
                                                                                    placeholder="Buy Now"
                                                                                />
                                                                                {fieldErrors[`element_${activeElementIdx}_btn_${bidx}_title`] && (
                                                                                    <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" /> {fieldErrors[`element_${activeElementIdx}_btn_${bidx}_title`]}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="md:col-span-7 space-y-1.5">
                                                                                <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 block">Button Action (Link)</label>
                                                                                <input
                                                                                    id={`field_element_${activeElementIdx}_btn_${bidx}_url`}
                                                                                    value={btn.url}
                                                                                    onChange={e => {
                                                                                        const newBtns = [...editingAutomation.template_elements[activeElementIdx].buttons];
                                                                                        newBtns[bidx].url = e.target.value;
                                                                                        updateElement(activeElementIdx, 'buttons', newBtns);
                                                                                    }}
                                                                                    className={`w-full bg-muted/40  border-2 ${fieldErrors[`element_${activeElementIdx}_btn_${bidx}_url`] ? 'border-destructive' : 'border-border'} focus:border-primary focus:border-primary rounded-xl p-3 text-[11px] font-bold text-foreground shadow-inner`}
                                                                                    placeholder="https://..."
                                                                                />
                                                                                {fieldErrors[`element_${activeElementIdx}_btn_${bidx}_url`] && (
                                                                                    <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                                        <AlertCircle className="w-3 h-3" /> {fieldErrors[`element_${activeElementIdx}_btn_${bidx}_url`]}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                            <div className="md:col-span-1 pb-1">
                                                                                {editingAutomation.template_elements[activeElementIdx].buttons.length > 1 && (
                                                                                    <button
                                                                                        onClick={() => removeElementButton(activeElementIdx, bidx)}
                                                                                        className="p-3 text-destructive hover:bg-destructive-muted/60  rounded-xl transition-all"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {editingAutomation.template_type === 'template_buttons' && (
                                                <div className="bg-muted/30 p-8 rounded-[32px] border border-content space-y-8 animate-in zoom-in-95">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center px-1">
                                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Message Content</label>
                                                            <span className={`text-[8px] font-bold ${getByteLength(editingAutomation.text || '') > 640 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                {getByteLength(editingAutomation.text || '')}/640 bytes
                                                            </span>
                                                        </div>
                                                        <textarea
                                                            id="field_button_text"
                                                            value={editingAutomation.text || ''}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if (getByteLength(val) <= 640) setEditingAutomation({ ...editingAutomation, text: val });
                                                            }}
                                                            className={`w-full bg-card border-2 ${fieldErrors['button_text'] ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl p-6 text-xs font-bold text-foreground min-h-[120px] shadow-sm transition-all resize-none`}
                                                            placeholder="Enter your message here..."
                                                        />
                                                        {fieldErrors['button_text'] && (
                                                            <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> {fieldErrors['button_text']}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="pt-8 border-t border-content space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Buttons (Max 3)</h4>
                                                            <button
                                                                onClick={() => {
                                                                    if ((editingAutomation.buttons || []).length >= 3) return;
                                                                    setEditingAutomation({
                                                                        ...editingAutomation,
                                                                        buttons: [...(editingAutomation.buttons || []), { title: '', url: '', type: 'web_url' }]
                                                                    });
                                                                }}
                                                                disabled={(editingAutomation.buttons || []).length >= 3}
                                                                className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-20"
                                                            >
                                                                + Add Button
                                                            </button>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {(editingAutomation.buttons || []).map((btn: any, idx: number) => (
                                                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-in slide-in-from-left-2 transition-all p-4 bg-card rounded-2xl shadow-sm border border-content">
                                                                    <div className="md:col-span-4 space-y-1.5">
                                                                        <div className="flex justify-between items-center">
                                                                            <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Button Title</label>
                                                                            <span className={`text-[8px] font-bold ${getByteLength(btn.title || '') > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{getByteLength(btn.title || '')}/20 bytes</span>
                                                                        </div>
                                                                        <input
                                                                            id={`field_btn_${idx}_title`}
                                                                            value={btn.title}
                                                                            onChange={e => {
                                                                                const val = e.target.value;
                                                                                if (getByteLength(val) <= 20) {
                                                                                    const next = [...editingAutomation.buttons];
                                                                                    next[idx].title = val;
                                                                                    setEditingAutomation({ ...editingAutomation, buttons: next });
                                                                                }
                                                                            }}
                                                                            className={`w-full bg-muted/40  border-2 ${fieldErrors[`btn_${idx}_title`] ? 'border-destructive' : 'border-transparent'} rounded-xl p-3 text-[11px] font-black text-foreground shadow-inner`}
                                                                            placeholder="Button Text"
                                                                        />
                                                                    </div>
                                                                    <div className="md:col-span-7 space-y-1.5">
                                                                        <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Button Link</label>
                                                                        <input
                                                                            id={`field_btn_${idx}_url`}
                                                                            value={btn.url}
                                                                            onChange={e => {
                                                                                const next = [...editingAutomation.buttons];
                                                                                next[idx].url = e.target.value;
                                                                                setEditingAutomation({ ...editingAutomation, buttons: next });
                                                                            }}
                                                                            className={`w-full bg-muted/40  border-2 ${fieldErrors[`btn_${idx}_url`] ? 'border-destructive' : 'border-transparent'} rounded-xl p-3 text-[11px] font-bold text-foreground shadow-inner`}
                                                                            placeholder="https://..."
                                                                        />
                                                                    </div>
                                                                    <div className="md:col-span-1 pb-1">
                                                                        {(editingAutomation.buttons.length > 1 || idx > 0) && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    const next = editingAutomation.buttons.filter((_: any, i: number) => i !== idx);
                                                                                    setEditingAutomation({ ...editingAutomation, buttons: next });
                                                                                }}
                                                                                className="p-3 text-destructive hover:bg-destructive-muted/60  rounded-xl transition-all"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {fieldErrors['buttons'] && (
                                                                <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                    <AlertCircle className="w-3 h-3" /> {fieldErrors['buttons']}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {editingAutomation.template_type === 'template_quick_replies' && (
                                                <div className="space-y-6">
                                                    <div className="bg-muted/30 p-6 rounded-[32px] border border-content relative">
                                                        <div className="flex justify-between items-center px-1 mb-2">
                                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Title Text (Prompt Message)</label>
                                                            <span className={`text-[8px] font-bold ${getByteLength(editingAutomation.template_content || '') > 950 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                {getByteLength(editingAutomation.template_content || '')}/950 bytes
                                                            </span>
                                                        </div>
                                                        <textarea
                                                            id="field_template_content"
                                                            value={editingAutomation.template_content}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (getByteLength(val) <= 950) setEditingAutomation({ ...editingAutomation, template_content: val });
                                                            }}
                                                            placeholder="Enter the title text that will prompt a person to click a quick reply..."
                                                            className="w-full bg-card border-none rounded-2xl p-4 text-xs text-foreground focus:ring-2 focus:ring-primary min-h-[100px] shadow-sm resize-none"
                                                        />
                                                        {fieldErrors['template_content'] && (
                                                            <p className="mt-2 text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> {fieldErrors['template_content']}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4" id="field_replies">
                                                        <div className="flex items-center justify-between px-2">
                                                            <div className="flex items-center gap-2">
                                                                <Reply className="w-4 h-4 text-primary" />
                                                                <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ">Quick Reply Buttons ({editingAutomation.replies?.length || 0}/13)</h4>
                                                            </div>
                                                            {(editingAutomation.replies?.length || 0) < 13 && (
                                                                <button
                                                                    onClick={() => {
                                                                        const next = [...(editingAutomation.replies || []), { title: '', payload: '', content_type: 'text' }];
                                                                        setEditingAutomation({ ...editingAutomation, replies: next });
                                                                    }}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-primary/20 active:scale-95"
                                                                >
                                                                    <Plus className="w-3 h-3" /> Add Button
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="grid gap-4">
                                                            {(editingAutomation.replies || []).map((reply: any, idx: number) => (
                                                                <div key={idx} className="bg-card p-5 rounded-[24px] border border-content shadow-sm relative group animate-in fade-in slide-in-from-top-2">
                                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                                                        <div className="md:col-span-5 space-y-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <label className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.15em]">Button Text</label>
                                                                                <span className={`text-[7px] font-bold ${getByteLength(reply.title) > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                                    {getByteLength(reply.title)}/20 bytes
                                                                                </span>
                                                                            </div>
                                                                            <input
                                                                                id={`field_reply_${idx}`}
                                                                                type="text"
                                                                                value={reply.title}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (getByteLength(val) <= 20) {
                                                                                        const next = [...editingAutomation.replies];
                                                                                        next[idx] = { ...next[idx], title: val };
                                                                                        setEditingAutomation({ ...editingAutomation, replies: next });
                                                                                    }
                                                                                }}
                                                                                placeholder="e.g. Yes please!"
                                                                                className="w-full bg-muted/40 border-none rounded-xl p-3 text-[11px] font-semibold text-foreground focus:ring-2 focus:ring-primary"
                                                                            />
                                                                        </div>
                                                                        <div className="md:col-span-6 space-y-2">
                                                                            <div className="flex justify-between items-center">
                                                                                <label className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.15em]">Reply</label>
                                                                                <span className={`text-[7px] font-bold ${getByteLength(reply.payload) > 950 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                                                    {getByteLength(reply.payload)}/950 bytes
                                                                                </span>
                                                                            </div>
                                                                            <textarea
                                                                                value={reply.payload}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value;
                                                                                    if (getByteLength(val) <= 950) {
                                                                                        const next = [...editingAutomation.replies];
                                                                                        next[idx] = { ...next[idx], payload: val };
                                                                                        setEditingAutomation({ ...editingAutomation, replies: next });
                                                                                    }
                                                                                }}
                                                                                placeholder="Message to send when clicked..."
                                                                                className="w-full bg-muted/40 border-none rounded-xl p-3 text-[11px] font-medium text-foreground focus:ring-2 focus:ring-primary h-[64px] resize-none"
                                                                            />
                                                                        </div>
                                                                        <div className="md:col-span-1 pt-4 md:pt-6 flex justify-end">
                                                                            {(editingAutomation.replies?.length || 0) > 1 && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const next = editingAutomation.replies.filter((_: any, i: number) => i !== idx);
                                                                                        setEditingAutomation({ ...editingAutomation, replies: next });
                                                                                    }}
                                                                                    className="p-3 text-destructive hover:bg-destructive-muted/60  rounded-xl transition-all"
                                                                                    title="Remove button"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {fieldErrors[`reply_${idx}`] && (
                                                                        <p className="mt-3 text-[9px] font-bold text-destructive px-2 flex items-center gap-1">
                                                                            <AlertCircle className="w-3 h-3" /> {fieldErrors[`reply_${idx}`]}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {fieldErrors['replies'] && (
                                                                <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1 text-center justify-center">
                                                                    <AlertCircle className="w-3 h-3" /> {fieldErrors['replies']}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {editingAutomation.template_type === 'template_media' && (
                                                <div className="space-y-6 animate-in zoom-in-95">
                                                    <div className="bg-muted/30 p-6 rounded-[32px] border border-content relative space-y-4">

                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center px-1">
                                                                <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Media URL</label>
                                                                {editingAutomation.media_size && (
                                                                    <span className="text-[9px] font-black text-primary uppercase tracking-wider">
                                                                        {(editingAutomation.media_size / (1024 * 1024)).toFixed(2)} MB â€¢ {editingAutomation.media_format?.toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="relative">
                                                                <input
                                                                    id="field_media_url"
                                                                    value={editingAutomation.template_content || ''}
                                                                    onChange={e => {
                                                                        const url = e.target.value;
                                                                        setEditingAutomation({ ...editingAutomation, template_content: url });
                                                                        // Debounced or simple validation trigger could go here
                                                                    }}
                                                                    onBlur={async () => {
                                                                        const url = editingAutomation.template_content;
                                                                        const type = editingAutomation.media_type || 'image';
                                                                        if (url?.startsWith('http')) {
                                                                            const result = await validateMediaUrl(url, type);
                                                                            if (!result.valid) {
                                                                                setFieldErrors({ ...fieldErrors, media_url: result.error || "Unknown error" });
                                                                            } else {
                                                                                const updatedErrors = { ...fieldErrors };
                                                                                delete updatedErrors.media_url;
                                                                                setFieldErrors(updatedErrors);
                                                                                setEditingAutomation({
                                                                                    ...editingAutomation,
                                                                                    media_size: result.size,
                                                                                    media_format: result.format
                                                                                });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className={`w-full bg-card border-2 ${fieldErrors['media_url'] ? 'border-destructive' : 'border-transparent'} focus:border-primary outline-none rounded-2xl p-4 text-xs font-bold text-foreground shadow-sm transition-all`}
                                                                    placeholder={`Enter ${editingAutomation.media_type || 'image'} URL...`}
                                                                />
                                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {editingAutomation.template_content && !fieldErrors['media_url'] && (
                                                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {fieldErrors['media_url'] && (
                                                            <p className="text-[9px] font-bold text-destructive px-2 flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
                                                                <AlertCircle className="w-3 h-3" /> {fieldErrors['media_url']}
                                                            </p>
                                                        )}

                                                        <div className="space-y-4 pt-4 border-t border-border/60">
                                                            <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest tracking-[0.1em]">Visual Asset Preview</label>
                                                            <div className="aspect-video relative rounded-2xl overflow-hidden border-2 border-dashed border-border bg-card group">
                                                                {editingAutomation.template_content && !fieldErrors['media_url'] ? (
                                                                    <div className="h-full w-full flex items-center justify-center">
                                                                        {(editingAutomation.media_type || 'image') === 'image' && !isRestrictedMediaUrl(editingAutomation.template_content) && (
                                                                            <img
                                                                                src={editingAutomation.template_content}
                                                                                referrerPolicy="no-referrer"
                                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                                alt="Preview"
                                                                            />
                                                                        )}
                                                                        {(editingAutomation.media_type || 'image') === 'image' && isRestrictedMediaUrl(editingAutomation.template_content) && (
                                                                            <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                                                                Preview unavailable
                                                                            </div>
                                                                        )}
                                                                        {(editingAutomation.media_type || 'image') === 'video' && (
                                                                            <div className="flex flex-col items-center gap-3">
                                                                                <Video className="w-12 h-12 text-primary animate-pulse" />
                                                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Video Content Ready</p>
                                                                            </div>
                                                                        )}
                                                                        {(editingAutomation.media_type || 'image') === 'audio' && (
                                                                            <div className="flex flex-col items-center gap-3">
                                                                                <Music className="w-12 h-12 text-primary animate-pulse" />
                                                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Audio Stream Ready</p>
                                                                            </div>
                                                                        )}
                                                                        {(editingAutomation.media_type || 'image') === 'pdf' && (
                                                                            <div className="flex flex-col items-center gap-3">
                                                                                <FileText className="w-12 h-12 text-destructive" />
                                                                                <p className="text-[10px] font-black text-destructive uppercase tracking-widest">PDF Document Ready</p>
                                                                            </div>
                                                                        )}

                                                                        {/* Hover Overlay */}
                                                                        <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                                            <span className="px-4 py-2 bg-card rounded-full text-[10px] font-black text-foreground uppercase tracking-widest">Verified {editingAutomation.media_format?.toUpperCase()}</span>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/60">
                                                                        <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Asset</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {editingAutomation.template_type === 'template_share_post' && (
                                                <div className="space-y-6 animate-in zoom-in-95">
                                                    <div id="field_media_id" className="bg-muted/30 p-8 rounded-[32px] border border-content space-y-8">
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Media to Share</h3>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex bg-card p-1.5 rounded-2xl shadow-sm border border-content">
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setMediaTab('post'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${mediaTab === 'post' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                                                                    >
                                                                        <ImageIcon className="w-3.5 h-3.5" />
                                                                        Posts
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setMediaTab('reel'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${mediaTab === 'reel' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                                                                    >
                                                                        <Film className="w-3.5 h-3.5" />
                                                                        Reels
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setMediaTab('all'); }}
                                                                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${mediaTab === 'all' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                                                                    >
                                                                        <Globe className="w-3.5 h-3.5" />
                                                                        All
                                                                    </button>
                                                                    <div className="w-[1px] h-6 bg-border  mx-2" />
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); fetchMedia('all', true); }}
                                                                        disabled={mediaLoading}
                                                                        className="px-4 py-2 text-muted-foreground hover:text-primary rounded-xl transition-all disabled:opacity-50 group"
                                                                        title="Refresh media"
                                                                    >
                                                                        <RefreshCcw className={`w-4 h-4 ${mediaLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-6">
                                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card rounded-3xl border border-content shadow-sm relative z-50">
                                                                {/* Modern Date Dropdown */}
                                                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                                                    <div className="relative w-full sm:w-64">
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); setMediaDateDropdownOpen(!mediaDateDropdownOpen); setMediaSortDropdownOpen(false); }}
                                                                            className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted  rounded-2xl transition-all border border-content group shadow-sm"
                                                                        >
                                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                                <Calendar className={`w-4 h-4 shrink-0 ${mediaDateFilter !== 'all' ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                                                                <div className="flex flex-col items-start overflow-hidden">
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground truncate">
                                                                                        {mediaDateFilter === 'all' ? 'All Time' :
                                                                                            mediaDateFilter === '7days' ? 'Last 7 Days' :
                                                                                                mediaDateFilter === '30days' ? 'Last 30 Days' :
                                                                                                    mediaDateFilter === '90days' ? 'Last 90 Days' : 'Custom Range'}
                                                                                    </span>
                                                                                    {mediaDateFilter === 'custom' && mediaStartDate && (
                                                                                        <span className="text-[8px] font-bold text-primary uppercase tracking-tighter truncate">
                                                                                            {mediaStartDate} {mediaEndDate ? `to ${mediaEndDate}` : ''}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <ChevronDown className={`w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform duration-300 ${mediaDateDropdownOpen ? 'rotate-180' : ''}`} />
                                                                        </button>

                                                                        {mediaDateDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-10" onClick={() => setMediaDateDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-content rounded-[28px] shadow-2xl z-20 animate-in zoom-in-95 duration-200">
                                                                                    {[
                                                                                        { id: 'all', label: 'All Time', icon: <Calendar className="w-3.5 h-3.5" /> },
                                                                                        { id: '7days', label: 'Last 7 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: '30days', label: 'Last 30 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: '90days', label: 'Last 90 Days', icon: <RefreshCcw className="w-3.5 h-3.5" /> },
                                                                                        { id: 'custom', label: 'Custom Range', icon: <Plus className="w-3.5 h-3.5" /> }
                                                                                    ].map((filter) => (
                                                                                        <button
                                                                                            key={filter.id}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                setMediaDateFilter(filter.id as any);
                                                                                                if (filter.id !== 'custom') setMediaDateDropdownOpen(false);
                                                                                            }}
                                                                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${mediaDateFilter === filter.id
                                                                                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                                                                                : 'text-muted-foreground hover:bg-muted/60 '}`}
                                                                                        >
                                                                                            {filter.icon}
                                                                                            {filter.label}
                                                                                        </button>
                                                                                    ))}

                                                                                    {mediaDateFilter === 'custom' && (
                                                                                        <div className="mt-2 p-1 bg-card rounded-2xl border border-content animate-in slide-in-from-top-2">
                                                                                            <ModernCalendar
                                                                                                startDate={mediaStartDate}
                                                                                                endDate={mediaEndDate}
                                                                                                onSelect={(start: string, end: string) => {
                                                                                                    setMediaStartDate(start);
                                                                                                    setMediaEndDate(end);
                                                                                                    setMediaDateDropdownOpen(false);
                                                                                                }}
                                                                                                onClose={() => setMediaDateDropdownOpen(false)}
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>

                                                                    {/* Sort Dropdown */}
                                                                    <div className="relative w-full sm:w-48">
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); setMediaSortDropdownOpen(!mediaSortDropdownOpen); setMediaDateDropdownOpen(false); }}
                                                                            className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted  rounded-2xl transition-all border border-content group shadow-sm"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <RefreshCcw className="w-4 h-4 text-muted-foreground/60 group-hover:rotate-180 transition-transform duration-500" />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                                                    {mediaSortOrder === 'recent' ? 'Most Recent' : 'Oldest First'}
                                                                                </span>
                                                                            </div>
                                                                            <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-300 ${mediaSortDropdownOpen ? 'rotate-180' : ''}`} />
                                                                        </button>

                                                                        {mediaSortDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-10" onClick={() => setMediaSortDropdownOpen(false)} />
                                                                                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-card border border-content rounded-[28px] shadow-2xl z-20 animate-in zoom-in-95 duration-200">
                                                                                    {[
                                                                                        { id: 'recent', label: 'Most Recent' },
                                                                                        { id: 'oldest', label: 'Oldest First' }
                                                                                    ].map((option) => (
                                                                                        <button
                                                                                            key={option.id}
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                setMediaSortOrder(option.id as any);
                                                                                                setMediaSortDropdownOpen(false);
                                                                                            }}
                                                                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${mediaSortOrder === option.id
                                                                                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                                                                                : 'text-muted-foreground hover:bg-muted/60 '}`}
                                                                                        >
                                                                                            {option.id === 'recent' ? <RefreshCcw className="w-3.5 h-3.5 rotate-180" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                                                                            {option.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    {mediaLoading && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                                                                    <div className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] px-3 py-1 bg-muted/40 rounded-full border border-content">
                                                                        {mediaTab === 'post' ? 'Feed Posts' : mediaTab === 'reel' ? 'Reels Library' : 'All Media'}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Main Content Area */}
                                                            <div className="flex-1 min-h-[400px] relative">
                                                                {mediaLoading && !filteredMedia.length ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fetching your content...</p>
                                                                    </div>
                                                                ) : mediaError ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                                                                        <div className="w-16 h-16 bg-destructive-muted/40 rounded-3xl flex items-center justify-center text-destructive/50">
                                                                            <AlertCircle className="w-8 h-8" />
                                                                        </div>
                                                                        <div className="space-y-4 flex flex-col items-center">
                                                                            <p className="text-[10px] font-black text-destructive uppercase tracking-widest text-center">{mediaError}</p>
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); fetchMedia('all', true); }}
                                                                                className="px-5 py-2.5 bg-destructive-muted/40 text-destructive rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-destructive hover:text-primary-foreground shadow-sm flex items-center gap-2"
                                                                            >
                                                                                <RefreshCcw className="w-3.5 h-3.5" />
                                                                                Retry
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : !filteredMedia.length ? (
                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                                                                        <div className="w-16 h-16 bg-muted/40  rounded-3xl flex items-center justify-center text-muted-foreground/60">
                                                                            {mediaTab === 'reel' ? <Film className="w-8 h-8" /> : mediaTab === 'post' ? <ImageIcon className="w-8 h-8" /> : <Globe className="w-8 h-8" />}
                                                                        </div>
                                                                        <div className="space-y-4 flex flex-col items-center">
                                                                            <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">No {mediaTab === 'all' ? 'media' : mediaTab + 's'} found in this range</p>
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); fetchMedia('all', true); }}
                                                                                className="px-5 py-2.5 bg-muted  text-foreground rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-muted hover:bg-muted shadow-sm flex items-center gap-2"
                                                                            >
                                                                                <RefreshCcw className="w-3.5 h-3.5" />
                                                                                Try Again
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div key={mediaTab + mediaDateFilter + mediaSortOrder} className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 scrollbar-thin overflow-y-auto max-h-[600px] pr-2">
                                                                        {[...filteredMedia]
                                                                            .sort((a, b) => {
                                                                                const timeA = new Date(a.timestamp).getTime();
                                                                                const timeB = new Date(b.timestamp).getTime();
                                                                                return mediaSortOrder === 'recent' ? timeB - timeA : timeA - timeB;
                                                                            })
                                                                            .map((item: any) => (
                                                                                <button
                                                                                    key={item.id}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        setEditingAutomation({
                                                                                            ...editingAutomation,
                                                                                            media_id: item.id,
                                                                                            media_url: item.thumbnail_url || item.media_url,
                                                                                            caption: item.caption || ''
                                                                                        });
                                                                                    }}
                                                                                    className={`group relative aspect-[4/5] rounded-3xl overflow-hidden border-4 transition-all duration-300 ${editingAutomation.media_id === item.id
                                                                                        ? 'border-primary ring-4 ring-primary/20 shadow-xl'
                                                                                        : 'border-transparent hover:border-border shadow-md hover:shadow-lg'
                                                                                        }`}
                                                                                >
                                                                                    {!isRestrictedMediaUrl(item.thumbnail_url || item.media_url) ? (
                                                                                        <img
                                                                                            src={item.thumbnail_url || item.media_url}
                                                                                            referrerPolicy="no-referrer"
                                                                                            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${editingAutomation.media_id === item.id ? 'brightness-75' : ''}`}
                                                                                            alt={item.caption || ''}
                                                                                            loading="lazy"
                                                                                        />
                                                                                    ) : (
                                                                                        <div className="w-full h-full flex items-center justify-center bg-muted/50 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                                                                                            Preview unavailable
                                                                                        </div>
                                                                                    )}
                                                                                    {editingAutomation.media_id === item.id && (
                                                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                                                            <div className="bg-primary text-primary-foreground rounded-full p-2.5 shadow-2xl scale-125 animate-in zoom-in duration-300">
                                                                                                <Check className="w-5 h-5 stroke-[4]" />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                                                        <div className="flex items-center gap-1.5 mb-1 text-[8px] font-black text-primary/70 uppercase tracking-widest">
                                                                                            <Calendar className="w-2.5 h-2.5" />
                                                                                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                                        </div>
                                                                                        <p className="text-[9px] text-primary-foreground font-bold line-clamp-2 leading-relaxed">{item.caption || 'Untitled Media'}</p>
                                                                                    </div>
                                                                                    {!item.has_automation && (
                                                                                        <div className="absolute top-2 right-2 px-2 py-1 bg-foreground/50 backdrop-blur-md rounded-lg text-primary-foreground text-[7px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                            Available
                                                                                        </div>
                                                                                    )}
                                                                                </button>
                                                                            ))}
                                                                        {mediaHasNext && (
                                                                            <div className="col-span-full pt-4 pb-8 flex justify-center">
                                                                                <button
                                                                                    onClick={(e) => { e.preventDefault(); fetchMedia(mediaTab, true, true); }}
                                                                                    disabled={loadingMoreMedia}
                                                                                    className="px-8 py-3 bg-card text-muted-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-muted/60 hover:bg-muted shadow-sm border border-content flex items-center gap-3 disabled:opacity-50 group"
                                                                                >
                                                                                    {loadingMoreMedia ? (
                                                                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                                                    ) : (
                                                                                        <Plus className="w-4 h-4 text-primary group-hover:scale-125 transition-transform" />
                                                                                    )}
                                                                                    {loadingMoreMedia ? 'Loading...' : 'Load More Content'}
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {editingAutomation.media_id && (
                                                            <div className="pt-6 border-t border-border/60 space-y-4 animate-in slide-in-from-bottom-4">
                                                                {isMediaDeleted && (
                                                                    <div className="p-4 bg-destructive-muted/40 border border-destructive/20 rounded-2xl flex items-center gap-3">
                                                                        <div className="p-2 bg-destructive-muted/40 text-destructive rounded-lg">
                                                                            <AlertCircle className="w-5 h-5" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[11px] font-black text-destructive uppercase tracking-widest mb-0.5">Media Deleted or Unavailable</p>
                                                                            <p className="text-[10px] text-destructive font-medium">The selected Instagram post/reel appears to be deleted. Please select a new one.</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-success-muted/60 text-success rounded-lg">
                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-black text-foreground uppercase tracking-widest mb-0.5">Media Selected</p>
                                                                            <p className="text-[9px] text-muted-foreground font-bold">Selected ID: {editingAutomation.media_id}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); setEditingAutomation({ ...editingAutomation, media_id: '' }); }}
                                                                        className="text-[9px] font-black uppercase tracking-widest text-destructive hover:text-destructive transition-colors"
                                                                    >
                                                                        Change Selection
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="p-8 bg-primary/10  rounded-[32px] border border-primary/20">
                                                            <div className="flex items-start gap-4">
                                                                <div className="p-3 bg-card rounded-2xl shadow-sm border border-primary/20">
                                                                    <Info className="w-5 h-5 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[11px] font-black text-foreground uppercase tracking-widest mb-1">Live Instagram Sync</p>
                                                                    <p className="text-[10px] font-medium text-muted-foreground leading-relaxed mb-3">
                                                                        {mediaDateFilter === 'all'
                                                                            ? `Showing your most recent ${mediaTab === 'all' ? 'media' : mediaTab + 's'} directly from Instagram. Select the one you'd like to automate.`
                                                                            : `Showing ${mediaTab === 'all' ? 'media' : mediaTab + 's'} from ${mediaDateFilter} directly from Instagram.`
                                                                        }
                                                                    </p>
                                                                    <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-2xl border border-primary/10">
                                                                        <AlertCircle className="w-3.5 h-3.5 text-primary mt-0.5" />
                                                                        <p className="text-[9px] font-bold text-primary/80 uppercase tracking-widest leading-relaxed">
                                                                            Note: Instagram allows fetching up to 10,000 recently created posts and reels via DM Panda.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </section>

                        <div className="flex justify-center items-center gap-4 pt-4">
                            {editingAutomation.$id && (
                                <button
                                    onClick={() => handleDelete(editingAutomation.$id)}
                                    disabled={saving || (editingAutomation?.$id && deletingIds.has(editingAutomation.$id))}
                                    className="flex-1 px-8 py-4 bg-destructive-muted/40 text-destructive rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-destructive hover:text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {editingAutomation?.$id && deletingIds.has(editingAutomation.$id) ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        "Delete Rule"
                                    )}
                                </button>
                            )}
                        </div>
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
                                    const { activeAccount } = useDashboard();
                                    const displayName = activeAccount?.username || 'your_account';
                                    const profilePic = activeAccount?.profile_picture_url || null;

                                    if (selectedTemplateId && selectedTemplateData) {
                                        const template = selectedTemplateData;
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
                                                media_url: template.template_type === 'template_share_post' ? (template.template_data?.media_url || template.template_data?.thumbnail_url) : undefined,
                                                use_latest_post: template.template_type === 'template_share_post' ? template.template_data?.use_latest_post : undefined,
                                                latest_post_type: template.template_type === 'template_share_post' ? template.template_data?.latest_post_type : undefined,
                                                keyword: editingAutomation.keywords?.[0] || editingAutomation.keyword?.[0] || editingAutomation.title || 'Trigger message',
                                                template_data: template.template_data
                                            };

                                            return (
                                                <SharedMobilePreview
                                                    mode="automation"
                                                    automation={previewAutomation}
                                                    displayName={displayName}
                                                    profilePic={profilePic ?? undefined}
                                                />
                                            );
                                        }
                                    }

                                    // Show empty state with MobilePreview (big screen)
                                    const emptyAutomation = {
                                        keyword: editingAutomation.keywords?.[0] || editingAutomation.keyword?.[0] || editingAutomation.title || 'Trigger message',
                                    };

                                    return (
                                        <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                                            <SharedMobilePreview mode="automation" automation={emptyAutomation} displayName={displayName} profilePic={profilePic} />
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div >

                <ModernConfirmModal
                    isOpen={modalConfig.isOpen}
                    onClose={closeModal}
                    onConfirm={modalConfig.onConfirm}
                    onSecondary={modalConfig.onSecondary}
                    title={modalConfig.title}
                    description={modalConfig.description}
                    type={modalConfig.type}
                    confirmLabel={modalConfig.confirmLabel}
                    cancelLabel={modalConfig.cancelLabel}
                    secondaryLabel={modalConfig.secondaryLabel}
                    oneButton={modalConfig.oneButton}
                />

            </div >
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-12">
            {/* Global Success Notification */}
            {success && !editingAutomation && (
                <div className="fixed bottom-8 right-8 z-[100] px-6 py-4 bg-success text-success-foreground rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-500 cursor-pointer" onClick={() => setSuccess(null)}>
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-black text-sm uppercase tracking-wider">Success</h4>
                        <p className="text-xs font-medium text-green-50">Your automation has been updated.</p>
                    </div>
                </div>
            )}

            {/* Global Error Notification */}
            {error && !editingAutomation && (
                <div className="fixed bottom-8 right-8 z-[100] px-6 py-4 bg-destructive text-destructive-foreground rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-500 cursor-pointer" onClick={() => setError(null)}>
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-black text-sm uppercase tracking-wider">Error</h4>
                        <p className="text-xs font-medium text-destructive-foreground/90">{error}</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Direct Messaging</span>
                    </div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight">DM Automation</h1>
                    <p className="text-muted-foreground font-medium max-w-xl">
                        Keywords-based responses. When a user sends a keyword, DMPanda replies automatically.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => fetchAutomations(true)}
                        disabled={refreshing || loading}
                        className="p-3 bg-muted/40  text-muted-foreground hover:text-primary rounded-2xl transition-all border border-content disabled:opacity-50"
                    >
                        <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleCreate}
                        className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                    >
                        <Plus className="w-3 h-3" /> Create New Rule
                    </button>
                </div>
            </div>

            {loading ? (
                <LoadingOverlay variant="fullscreen" message="Loading DM Automation" subMessage="Fetching your rules..." />
            ) : dmAutomations.length === 0 ? (
                <div className="bg-muted/40 border-2 border-dashed border-border rounded-3xl p-20 text-center">
                    <Lightbulb className="w-12 h-12 text-muted-foreground/60 mx-auto mb-6" />
                    <h4 className="text-foreground font-black text-xl mb-2">No active rules</h4>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">Click "Create New" to start automating your Instagram inbox with powered responses.</p>
                    <button
                        onClick={() => fetchAutomations(true)}
                        disabled={refreshing}
                        className="mx-auto px-8 py-4 bg-card text-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 hover:scale-105"
                    >
                        <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {dmAutomations.map((auto) => (
                        <div key={auto.$id} className="relative group bg-card border border-content rounded-3xl p-6 shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-500 overflow-hidden">
                            {deletingIds.has(auto.$id!) && (
                                <div className="absolute inset-0 z-20 bg-card/80 backdrop-blur-md rounded-3xl flex items-center justify-center animate-in fade-in duration-300">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary transition-all">Removing Rule...</span>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10  flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                        {auto.template_type === 'template_text' && <FileText className="w-7 h-7" />}
                                        {auto.template_type === 'template_carousel' && <Smartphone className="w-7 h-7" />}
                                        {auto.template_type === 'template_buttons' && <MousePointerClick className="w-7 h-7" />}
                                        {auto.template_type === 'template_media' && <ImageIcon className="w-7 h-7" />}
                                        {auto.template_type === 'template_quick_replies' && <Reply className="w-7 h-7" />}
                                        {auto.template_type === 'template_share_post' && <Share2 className="w-7 h-7" />}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-foreground">{auto.title || 'Untitled Rule'}</h4>
                                        {auto.template_content && auto.template_type === 'template_text' && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">"{auto.template_content}"</p>
                                        )}
                                        {auto.template_content && auto.template_type === 'template_carousel' && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">
                                                {(() => {
                                                    try {
                                                        const el = typeof auto.template_content === 'string' ? JSON.parse(auto.template_content) : auto.template_content;
                                                        const count = Array.isArray(el) ? el.length : (el ? 1 : 0);
                                                        return `${count} Carousel Element${count !== 1 ? 's' : ''}`;
                                                    } catch (e) { return 'Carousel Template'; }
                                                })()}
                                            </p>
                                        )}
                                        {auto.template_content && auto.template_type === 'template_media' && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1 font-medium italic">
                                                Image/Video Attachment
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            {(Array.isArray(auto.keyword) ? auto.keyword : [auto.keyword]).map((kw: string, ki: number) => (
                                                <span key={ki} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-lg tracking-wider">{kw}</span>
                                            ))}
                                            {auto.followers_only && (
                                                <span className="px-2 py-0.5 bg-warning-muted/60 text-warning text-[10px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Followers Only
                                                </span>
                                            )}

                                            <span className="text-[10px] font-bold text-muted-foreground capitalize">{auto.template_type?.replace('template_', '').replace('_', ' ')} Response</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleEdit(auto)}
                                        className="p-3 bg-muted/40  text-muted-foreground hover:text-primary rounded-xl transition-all"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(auto.$id!)}
                                        className="p-3 bg-destructive-muted/40 text-destructive hover:bg-destructive hover:text-primary-foreground rounded-xl transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <div className="h-8 w-[1px] bg-border  mx-2" />
                                    {togglingIds.has(auto.$id) ? (
                                        <div className="w-[44px] h-[24px] flex items-center justify-center bg-muted  rounded-full">
                                            <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                                        </div>
                                    ) : (
                                        <ToggleSwitch
                                            isChecked={auto.active}
                                            onChange={() => handleToggleActive(auto)}
                                            variant="plain"
                                        />
                                    )}
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
                onSecondary={modalConfig.onSecondary}
                title={modalConfig.title}
                description={modalConfig.description}
                type={modalConfig.type}
                confirmLabel={modalConfig.confirmLabel}
                cancelLabel={modalConfig.cancelLabel}
                secondaryLabel={modalConfig.secondaryLabel}
                oneButton={modalConfig.oneButton}
            />
        </div>
    );
};

export default DMAutomationView;


