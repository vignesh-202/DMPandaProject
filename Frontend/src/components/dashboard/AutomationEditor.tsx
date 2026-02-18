import React, { useState, useEffect } from 'react';
import {
    FileText, Smartphone, Image as ImageIcon, Reply, Save, Loader2, X, Instagram,
    MessageSquare, AlertCircle, CheckCircle2, Trash2, HelpCircle, Power, Globe,
    MousePointerClick, Share2, Film, Radio, BookText, Plus, ChevronRight, Share2 as ShareIcon,
    Calendar, ChevronDown, Check, Info, RefreshCw, Lightbulb, ExternalLink, LayoutTemplate
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import ModernConfirmModal from '../ui/ModernConfirmModal';
import ToggleSwitch from '../ui/ToggleSwitch';
import TemplateSelector, { ReplyTemplate } from './TemplateSelector';
import SharedMobilePreview from './SharedMobilePreview';
import { useNavigate } from 'react-router-dom';

function _mergeReplyTemplate(templateType: string, templateData: Record<string, unknown>): Record<string, unknown> {
    const d = templateData || {};
    switch (templateType) {
        case 'template_text': return { template_type: 'template_text', template_content: String(d.text || '') };
        case 'template_buttons': return { template_type: 'template_buttons', template_content: String(d.text || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
        case 'template_carousel': return { template_type: 'template_carousel', template_elements: Array.isArray(d.elements) ? d.elements : [] };
        case 'template_quick_replies': return { template_type: 'template_quick_replies', template_content: String(d.text || ''), replies: Array.isArray(d.replies) ? d.replies : [] };
        case 'template_media': return { template_type: 'template_media', template_content: String(d.media_url || ''), buttons: Array.isArray(d.buttons) ? d.buttons : [] };
        case 'template_share_post': return { template_type: 'template_share_post', media_id: String(d.media_id || ''), media_url: String(d.media_url || ''), use_latest_post: !!(d.use_latest_post), latest_post_type: (d.latest_post_type === 'reel' ? 'reel' : 'post') };
        default: return { template_type: 'template_text', template_content: String(d.text || '') };
    }
}

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

interface AutomationEditorProps {
    type: 'dm' | 'comment' | 'share' | 'mention' | 'global' | 'posts' | 'reel' | 'story' | 'live';
    onClose: () => void;
    onSave: () => void;
    authenticatedFetch: any;
    activeAccountID: string;
    automationId?: string;
    mediaId?: string;
    onDelete?: (id: string) => Promise<void>;
    isStandalone?: boolean;
    titleOverride?: string;
    onChange?: () => void;
    onTemplateSelect?: (templateId: string | null) => void;
    onTemplatesLoaded?: (templates: ReplyTemplate[]) => void;
    /** When true, global type renders only form + footer; parent provides header, grid, and preview (DM-like layout). */
    useParentLayout?: boolean;
    variant?: 'modal' | 'card' | 'embedded';
    existingTitles?: Array<{ id?: string; title?: string }>;
}

const AutomationEditor: React.FC<AutomationEditorProps> = ({
    type, onClose, onSave, authenticatedFetch, activeAccountID, onDelete, automationId, mediaId, isStandalone, titleOverride, onChange, onTemplateSelect, onTemplatesLoaded, useParentLayout, variant = 'modal', existingTitles
}) => {
    const { activeAccount, setCurrentView } = useDashboard();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [automation, setAutomation] = useState<any>({
        title: '',
        trigger_type: type === 'global' ? 'keywords' : 'keywords', // 'keywords', 'all_comments', 'share_to_admin'
        keywords: type === 'global' ? [] : [], // For global, we'll use single keyword
        keyword: type === 'global' ? '' : '', // Single keyword for global
        template_type: 'template_text',
        template_content: '',
        active: true,
        followers_only: false,
        suggest_more_enabled: false,
        media_id: mediaId || '',
        template_elements: [],
        buttons: [],
        replies: [],
        comment_reply_text: ''
    });

    // Check if Suggest More is set up for this account
    const suggestMoreSetup = activeAccount?.suggest_more_setup || false;
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
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Track changes for unsaved changes detection
    useEffect(() => {
        if (!isInitialLoad && onChange) {
            onChange();
        }
    }, [automation, isInitialLoad, onChange]);

    useEffect(() => {
        setFieldErrors({});
        setError(null);
        setSuccess(null);

        if (automationId) {
            const fetchDetails = async () => {
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

                        // Convert backend data to frontend format
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

                        // Parse buttons/replies if they're strings
                        let buttons: any[] = [];
                        if (data.buttons) {
                            buttons = typeof data.buttons === 'string' ? JSON.parse(data.buttons) : data.buttons;
                        }

                        let replies: any[] = [];
                        if (data.replies) {
                            replies = Array.isArray(data.replies) ? data.replies : (typeof data.replies === 'string' ? JSON.parse(data.replies) : []);
                        }

                        // Convert backend 'keyword' array to frontend format
                        const keywordArray = Array.isArray(data.keyword) ? data.keyword : (data.keyword ? data.keyword.split(',').map((k: string) => k.trim()) : []);
                        const automationData = {
                            ...data,
                            keywords: keywordArray,
                            keyword: type === 'global' ? (keywordArray[0] || '') : '', // For global, use first keyword as single keyword
                            template_elements: templateElements,
                            buttons: buttons,
                            replies: replies
                        };
                        setAutomation(automationData);
                        if (type === 'global' && keywordArray.length > 0) {
                            setKeywordInput(keywordArray[0]);
                        }
                        if (data.template_id) {
                            try {
                                const rr = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${data.template_id}?account_id=${activeAccountID}`);
                                if (rr.ok) {
                                    const templateData = await rr.json();
                                    setSelectedTemplate(templateData);
                                }
                            } catch (_) { }
                        } else setSelectedTemplate(null);
                        setIsInitialLoad(false);
                    } else {
                        setError("Failed to load automation details.");
                    }
                } catch (e) {
                    setError("Network error loading details.");
                }
            };
            fetchDetails();
        } else {
            setSelectedTemplate(null);
            setAutomation({
                title: '',
                keyword: '',
                keywords: [],
                trigger_type: 'keywords',
                template_type: 'template_text',
                template_content: '',
                active: true,
                followers_only: false,
                suggest_more_enabled: false,
                media_id: mediaId || '',
                template_elements: [],
                buttons: [],
                replies: [],
                comment_reply_text: ''
            });
            setIsInitialLoad(false);
        }
    }, [automationId, activeAccountID, authenticatedFetch, mediaId]);

    // Load template when automation has template_id
    useEffect(() => {
        if (automation.template_id && !selectedTemplate) {
            (async () => {
                try {
                    const r = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${automation.template_id}?account_id=${activeAccountID}`);
                    if (r.ok) {
                        const d = await r.json();
                        setSelectedTemplate(d);
                    }
                } catch (_) { }
            })();
        }
    }, [automation.template_id, authenticatedFetch, selectedTemplate]);

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

    const handleSave = async () => {
        // Auto-generate title if hidden and missing
        const isTitleHidden = (type !== 'dm' && type !== 'global');
        let currentTitle = automation.title;
        if (isTitleHidden && !currentTitle.trim()) {
            currentTitle = (titleOverride || `${type.toUpperCase()} Automation ${mediaId ? `(${mediaId})` : ''}`).trim();
        }

        const errors: { [key: string]: string } = {};
        if (!isTitleHidden && !currentTitle.trim()) errors.title = "Identification title is required";

        if (!isTitleHidden && currentTitle.trim() && Array.isArray(existingTitles) && existingTitles.length > 0) {
            const normalizedTitle = currentTitle.trim().toLowerCase();
            const otherTitles = existingTitles.filter((t) => !automation.$id || t.id !== automation.$id).map((t) => t.title || '');
            const duplicate = otherTitles.some((t) => (t || '').trim().toLowerCase() === normalizedTitle);
            if (duplicate) {
                const suggested = suggestUniqueTitle(currentTitle, otherTitles);
                if (suggested && suggested !== currentTitle) {
                    setAutomation((prev: any) => ({ ...prev, title: suggested }));
                }
                errors.title = `Title already exists. Suggested: ${suggested}`;
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
                const firstError = document.querySelector('[className*="border-red-500"]');
                if (firstError) {
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (firstError instanceof HTMLInputElement || firstError instanceof HTMLTextAreaElement) {
                        firstError.focus();
                    }
                }
            }, 150);
            return;
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

            const payload: any = {
                ...automation,
                title: currentTitle,
                type: backendType,
                keyword: keywordArray,
            };
            if (selectedTemplate) {
                payload.template_id = selectedTemplate.id;
                // Merge template data into automation for preview/display
                Object.assign(payload, _mergeReplyTemplate(selectedTemplate.template_type, selectedTemplate.template_data || {}));
            }
            // Remove frontend-specific fields that backend doesn't need
            delete payload.keywords;
            delete payload.trigger_type; // Backend doesn't store trigger_type
            delete payload.template_elements; // Backend uses template_content instead

            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations${automation.$id ? `/${automation.$id}` : ''}?account_id=${activeAccountID}${automation.$id ? '' : `&type=${backendType}`}`, {
                method: automation.$id ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSuccess(automation.$id ? "Automation updated successfully!" : "Automation activated successfully!");
                onSave();
                if (!isStandalone) {
                    setTimeout(() => {
                        onClose();
                    }, 1500);
                }
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

    const renderForm = () => (
        <div className={`space-y-8 ${type === 'global' && useParentLayout ? '' : 'p-8 border-r border-slate-100 dark:border-slate-900'}`}>
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

            <div className="space-y-6">
                {/* 1. Automation Core (DM-like): Title + Keyword in 2-col for global useParentLayout */}
                {(type === 'dm' || type === 'global') && (
                    (type === 'global' && useParentLayout) ? (
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Automation Core</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                        className={`w-full bg-gray-50 dark:bg-gray-900 border-2 ${fieldErrors['title'] ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl py-4 px-6 text-sm font-black text-gray-900 dark:text-gray-100 transition-all`}
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
                                className={`w-full bg-gray-50 dark:bg-gray-900 border-2 ${fieldErrors['title'] ? 'border-red-500' : 'border-transparent'} rounded-2xl py-4 px-6 text-sm font-black transition-all`}
                                placeholder="e.g. Price Check"
                            />
                            <p className="text-[9px] text-gray-400 font-medium px-2">Required: This title helps you organize and find your automations easily later.</p>
                            {fieldErrors['title'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['title']}</p>}
                        </div>
                    )
                )}

                {/* 2. Followers Only Toggle */}
                <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5 p-5 rounded-[28px] border border-blue-100 dark:border-blue-500/10 transition-all hover:bg-blue-50 dark:hover:bg-blue-500/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-blue-50 dark:border-blue-500/10">
                            <Power className={`w-5 h-5 transition-colors ${automation.followers_only ? 'text-blue-500' : 'text-gray-400'}`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.15em] mb-0.5">Followers Only Mode</p>
                            <p className="text-[10px] font-medium text-gray-400">Restricts this automation to only trigger for your existing followers.</p>
                        </div>
                    </div>
                    <ToggleSwitch
                        isChecked={automation.followers_only || false}
                        onChange={() => setAutomation({ ...automation, followers_only: !automation.followers_only })}
                        variant="plain"
                    />
                </div>

                {/* 2.5. Suggest More Toggle (hidden for global useParentLayout to match DM) */}
                {!(type === 'global' && useParentLayout) && (
                    <div className={`flex items-center justify-between p-5 rounded-[28px] border transition-all ${suggestMoreSetup
                        ? 'bg-yellow-50/50 dark:bg-yellow-500/5 border-yellow-100 dark:border-yellow-500/10 hover:bg-yellow-50 dark:hover:bg-yellow-500/10'
                        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl shadow-sm border ${suggestMoreSetup
                                ? 'bg-white dark:bg-gray-900 border-yellow-50 dark:border-yellow-500/10'
                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}>
                                <Lightbulb className={`w-5 h-5 transition-colors ${automation.suggest_more_enabled && suggestMoreSetup ? 'text-yellow-500' : 'text-gray-400'
                                    }`} />
                            </div>
                            <div>
                                <p className={`text-[11px] font-black uppercase tracking-[0.15em] mb-0.5 ${suggestMoreSetup ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                                    }`}>Include Suggest More</p>
                                <p className="text-[10px] font-medium text-gray-400">
                                    {suggestMoreSetup
                                        ? 'Add "Suggest More" button after this automation reply.'
                                        : 'Setup Suggest More first to enable this feature.'
                                    }
                                </p>
                            </div>
                        </div>
                        {suggestMoreSetup ? (
                            <ToggleSwitch
                                isChecked={automation.suggest_more_enabled || false}
                                onChange={() => setAutomation({ ...automation, suggest_more_enabled: !automation.suggest_more_enabled })}
                                variant="plain"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => { onClose(); setCurrentView('Suggest More'); }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all"
                            >
                                Setup <ExternalLink className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                )}

                {/* 3. Trigger Selection - Hidden for Global Type */}
                {type !== 'global' && (
                    <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Trigger Type</h3>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'keywords', icon: MessageSquare, label: 'Keywords' },
                                { id: 'all_comments', icon: Globe, label: 'All Comments' },
                                { id: 'share_to_admin', icon: ShareIcon, label: (type === 'comment' || type === 'posts' || type === 'reel') ? 'Share to Admin' : 'Share Post' },
                            ].map(t => (
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
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold">Share Mode: Triggered when someone shares this {type} to your DMs.</p>
                    </div>
                )}

                {/* Comment Reply Field - Only for Post/Reel automations in Keywords or All Comments mode */}
                {(type === 'posts' || type === 'reel') && (automation.trigger_type === 'keywords' || automation.trigger_type === 'all_comments') && automation.trigger_type !== 'share_to_admin' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Public Comment Reply (Optional)</label>
                            </div>
                            <textarea
                                id="field_comment_reply_text"
                                value={automation.comment_reply_text || ''}
                                onChange={e => setAutomation({ ...automation, comment_reply_text: e.target.value })}
                                className={`w-full bg-gray-50 dark:bg-gray-900 border-2 ${fieldErrors['comment_reply_text'] ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 outline-none rounded-2xl p-4 text-xs font-bold min-h-[100px] shadow-inner`}
                                placeholder="Enter the public comment reply text (this will be posted as a comment on Instagram)..."
                            />
                            <p className="text-[9px] text-gray-400 font-medium px-2">Optional: A public comment reply that will be posted on Instagram when this automation triggers.</p>
                            {fieldErrors['comment_reply_text'] && <p className="text-[10px] text-red-500 font-bold px-2">{fieldErrors['comment_reply_text']}</p>}
                        </div>
                    </div>
                )}

                {/* 4. Response Settings */}
                <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Response Message</h3>
                    <TemplateSelector
                        selectedTemplateId={selectedTemplate?.id}
                        onSelect={(template) => {
                            setSelectedTemplate(template);
                            onTemplateSelect?.(template?.id || null);
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
                        onTemplatesLoaded={onTemplatesLoaded}
                        className="mb-4"
                    />
                    {fieldErrors['template'] && (
                        <p id="field_template" className="text-[10px] text-red-500 font-bold px-2 flex items-center gap-1 mt-2">
                            <AlertCircle className="w-3 h-3" />
                            {fieldErrors['template']}
                        </p>
                    )}
                    {/* All inline template editing removed - use Reply Templates only */}
                    {selectedTemplate && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border-2 border-blue-200 dark:border-blue-500/20">
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                ✓ Using template: <span className="font-black">{selectedTemplate.name}</span>
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
        const { activeAccount } = useDashboard();
        const displayName = activeAccount?.username || 'your_account';
        const profilePic = activeAccount?.profile_picture_url || null;

        // If a template is selected, show the full chat preview
        if (selectedTemplate) {
            const previewAutomation = {
                template_type: selectedTemplate.template_type,
                template_content: selectedTemplate.template_type === 'template_text' ? selectedTemplate.template_data?.text :
                    selectedTemplate.template_type === 'template_media' ? selectedTemplate.template_data?.media_url :
                        selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.text : undefined,
                template_elements: selectedTemplate.template_type === 'template_carousel' ? selectedTemplate.template_data?.elements : undefined,
                replies: selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.replies : undefined,
                buttons: selectedTemplate.template_type === 'template_buttons' ? selectedTemplate.template_data?.buttons : undefined,
                media_id: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_id : undefined,
                media_url: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_url : undefined,
                use_latest_post: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.use_latest_post : undefined,
                latest_post_type: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.latest_post_type : undefined,
                template_data: selectedTemplate.template_data
            };

            return (
                <SharedMobilePreview
                    mode="automation"
                    automation={previewAutomation as any}
                    displayName={displayName}
                    profilePic={profilePic}
                />
            );
        }

        // When editing an existing automation that already has template fields but
        // selectedTemplate is not loaded yet, fall back to automation data so the
        // live preview still shows the reply template content.
        if (automation.template_type) {
            return (
                <SharedMobilePreview
                    mode="automation"
                    automation={automation}
                    displayName={displayName}
                    profilePic={profilePic}
                />
            );
        }

        // Default empty state when nothing is configured yet - show empty chat screen
        return (
            <div className="bg-gray-50 dark:bg-black p-4 flex flex-col items-center justify-center overflow-hidden">
                <SharedMobilePreview
                    mode="automation"
                    automation={automation}
                    displayName={displayName}
                    profilePic={profilePic}
                />
            </div>
        );
    };

    const isDmStyleFooter = type === 'global' && useParentLayout;
    const renderFooter = () => (
        <div className={`${type === 'global' && !isDmStyleFooter ? 'pt-6 border-t border-slate-200 dark:border-slate-800' : isDmStyleFooter ? 'pt-8 border-t border-slate-100 dark:border-slate-800' : 'p-8 bg-gray-50 dark:bg-gray-900/50'} flex ${isDmStyleFooter ? 'justify-center items-center' : 'items-center justify-end'} gap-4`}>
            {type !== 'global' && !isStandalone && (
                <button
                    onClick={onClose}
                    className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                    Cancel
                </button>
            )}
            <div className={`flex items-center gap-3 ${isDmStyleFooter ? 'w-full sm:w-auto sm:flex-initial' : ''}`}>
                {automation.$id && onDelete && (
                    <button
                        onClick={() => {
                            setModalConfig({
                                isOpen: true,
                                title: 'Delete Automation?',
                                description: 'Are you sure you want to delete this automation? This action cannot be undone.',
                                type: 'danger',
                                confirmLabel: 'Delete Now',
                                onConfirm: async () => {
                                    closeModal();
                                    onDelete(automation.$id).then(() => {
                                        onSave();
                                        if (!isStandalone && type !== 'global') onClose();
                                    });
                                }
                            });
                        }}
                        disabled={saving}
                        className={isDmStyleFooter ? 'flex-1 px-8 py-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-500 hover:text-white disabled:opacity-50 flex items-center justify-center gap-2' : 'px-6 py-3 bg-red-500/10 hover:bg-red-50 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-red-500/10'}
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDmStyleFooter ? 'Delete Rule' : 'Delete'}
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={isDmStyleFooter ? 'group relative px-16 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] text-[12px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_20px_40px_-15px_rgba(37,99,235,0.4)] flex items-center gap-4 hover:scale-[1.02] active:scale-95 disabled:opacity-50' : 'px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2'}
                >
                    {saving ? <Loader2 className={isDmStyleFooter ? 'w-5 h-5 animate-spin' : 'w-4 h-4 animate-spin'} /> : <Save className={isDmStyleFooter ? 'w-5 h-5 transition-transform group-hover:rotate-6' : 'w-4 h-4'} />}
                    {saving ? (isDmStyleFooter ? 'Processing...' : 'Saving...') : (automation.$id ? (isDmStyleFooter ? 'Update Changes' : 'Update Automation') : (isDmStyleFooter ? 'Publish Automation' : 'Activate Automation'))}
                </button>
            </div>
        </div>
    );

    const effectiveVariant = isStandalone ? 'card' : (useParentLayout && type === 'global' ? 'embedded' : variant);

    if (effectiveVariant === 'card') {
        return (
            <div className="bg-white dark:bg-gray-950 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-900">
                    <div>
                        <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-h-[calc(100vh-200px)] overflow-hidden">
                    <div className="overflow-y-auto">
                        {renderForm()}
                    </div>
                    <div className="overflow-y-auto">
                        {renderPreview()}
                    </div>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (effectiveVariant === 'embedded') {
        return (
            <div className="w-full">
                {renderForm()}
                {renderFooter()}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-950 w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-900">
                    <div>
                        <h2 className="text-2xl font-black text-black dark:text-white uppercase tracking-tight">{titleOverride || "Configure Automation"}</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Type: {type.replace('_', ' ')}</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-y-auto max-h-[70vh]">
                    {renderForm()}
                    {renderPreview()}
                </div>
                {renderFooter()}
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
