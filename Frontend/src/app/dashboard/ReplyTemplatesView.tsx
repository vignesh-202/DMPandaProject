"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutTemplate, Plus, Pencil, Trash2, Loader2, X, AlertCircle,
  FileText, Smartphone, Image as ImageIcon, Reply, MousePointerClick, Share2, ArrowLeft,
  Grid3x3, List as ListIcon, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import SharedTemplateEditor, { TemplateType, TemplateData } from '../../components/dashboard/SharedTemplateEditor';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { getDefaultTemplateData } from '../../lib/utils';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';
import {
  getByteLength,
  TEMPLATE_NAME_MAX,
  TEXT_MIN,
  TEXT_MAX,
  BUTTON_TEXT_MAX,
  BUTTON_TITLE_MIN,
  BUTTON_TITLE_MAX,
  BUTTONS_MAX,
  QUICK_REPLIES_MAX,
  QUICK_REPLY_TITLE_MIN,
  QUICK_REPLY_TITLE_MAX,
  QUICK_REPLY_PAYLOAD_MIN,
  QUICK_REPLY_PAYLOAD_MAX,
  QUICK_REPLIES_TEXT_MAX,
  CAROUSEL_TITLE_MIN,
  CAROUSEL_TITLE_MAX,
  CAROUSEL_SUBTITLE_MAX,
  CAROUSEL_ELEMENTS_MAX,
  CAROUSEL_BUTTON_TITLE_MIN,
  CAROUSEL_BUTTON_TITLE_MAX,
  MEDIA_URL_MAX
} from '../../lib/templateLimits';
import { takeTransientState, writeTransientState } from '../../lib/transientState';

const TEMPLATE_TYPE_OPTIONS: { id: TemplateType; label: string; icon: React.ElementType }[] = [
  { id: 'template_text', label: 'Text', icon: FileText },
  { id: 'template_buttons', label: 'Button', icon: MousePointerClick },
  { id: 'template_carousel', label: 'Carousel', icon: Smartphone },
  { id: 'template_quick_replies', label: 'Quick replies', icon: Reply },
  { id: 'template_media', label: 'Media', icon: ImageIcon },
  { id: 'template_share_post', label: 'Share Post', icon: Share2 },
];

function templateDataToPayload(type: TemplateType, d: TemplateData): Record<string, unknown> {
  switch (type) {
    case 'template_text':
      return { text: d.text || '' };
    case 'template_buttons':
      return { text: d.text || '', buttons: d.buttons || [] };
    case 'template_carousel':
      return { elements: d.elements || [] };
    case 'template_quick_replies':
      return { text: d.text || '', replies: d.replies || [] };
    case 'template_media':
      return { media_url: d.media_url || '', buttons: d.buttons || [] };
    case 'template_share_post':
      return {
        media_id: d.media_id || '',
        media_url: d.media_url || '',
        thumbnail_url: d.thumbnail_url || '',
        preview_media_url: d.preview_media_url || '',
        linked_media_url: d.linked_media_url || '',
        caption: d.caption || '',
        media_type: d.media_type || '',
        permalink: d.permalink || '',
        use_latest_post: d.use_latest_post || false,
        latest_post_type: d.latest_post_type || 'post',
      };
    default:
      return { text: d.text || '' };
  }
}

function payloadToTemplateData(type: TemplateType, p: Record<string, unknown>): TemplateData {
  switch (type) {
    case 'template_text':
      return { text: (p.text as string) || '' };
    case 'template_buttons':
      return { text: (p.text as string) || '', buttons: (p.buttons as TemplateData['buttons']) || [] };
    case 'template_carousel':
      return { elements: (p.elements as TemplateData['elements']) || [] };
    case 'template_quick_replies':
      return { text: (p.text as string) || '', replies: (p.replies as TemplateData['replies']) || [] };
    case 'template_media':
      return { media_url: (p.media_url as string) || '', buttons: (p.buttons as TemplateData['buttons']) || [] };
    case 'template_share_post':
      return {
        media_id: (p.media_id as string) || '',
        media_url: (p.media_url as string) || '',
        thumbnail_url: (p.thumbnail_url as string) || '',
        preview_media_url: (p.preview_media_url as string) || '',
        linked_media_url: (p.linked_media_url as string) || '',
        caption: (p.caption as string) || '',
        media_type: (p.media_type as string) || '',
        permalink: (p.permalink as string) || '',
        use_latest_post: (p.use_latest_post as boolean) || false,
        latest_post_type: (p.latest_post_type as 'post' | 'reel') || 'post',
      };
    default:
      return { text: (p.text as string) || '' };
  }
}

function typeLabel(t: string): string {
  return TEMPLATE_TYPE_OPTIONS.find(o => o.id === t)?.label || t.replace('template_', '');
}

function isValidHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function automationTypeLabel(a: string): string {
  const m: Record<string, string> = {
    dm: 'DM',
    comment: 'Comment',
    suggest_more: 'Suggest More',
    mention: 'Mention',
    comment_moderation: 'Comment Moderation',
  };
  return m[a] || a;
}

const suggestUniqueName = (base: string, existing: string[]) => {
  const trimmed = (base || '').trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  const existingSet = new Set(existing.map(n => (n || '').trim().toLowerCase()));
  if (!existingSet.has(lower)) return trimmed;
  let i = 2;
  while (i < 1000) {
    const candidate = `${trimmed} (${i})`;
    if (!existingSet.has(candidate.toLowerCase())) return candidate;
    i += 1;
  }
  return `${trimmed} (${Date.now()})`;
};

// Shared promise to coalesce duplicate list requests (e.g. React Strict Mode double-mount)
let replyTemplatesListPromise: Promise<{ templates: unknown[]; error: string | null }> | null = null;

let replyTemplatesListCache: { templates: unknown[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function templateToPreviewAutomation(type: TemplateType, d: TemplateData): Record<string, unknown> {
  return buildPreviewAutomationFromTemplate({ template_type: type, template_data: d }) || {};
}

export default function ReplyTemplatesView() {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, activeAccount, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges, setCurrentView } = useDashboard();
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    type: string;
    template_type: string;
    template_data: Record<string, unknown>;
    linked_automations: Array<{ automation_id: string; title: string; automation_type: string }>;
    automation_count?: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [editorMode, setEditorMode] = useState<null | 'create' | { editId: string }>(null);
  const [saving, setSaving] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorFieldErrors, setEditorFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('template_text');
  const [templateData, setTemplateData] = useState<TemplateData>({ text: '' });
  const [templateValidationErrors, setTemplateValidationErrors] = useState<Record<string, string>>({});

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLinked, setDeleteLinked] = useState<Array<{ id: string; title: string; automation_type: string }>>([]);
  const [linkedModal, setLinkedModal] = useState<{
    open: boolean;
    templateId: string;
    templateName: string;
    automations: Array<{ automation_id: string; title: string; automation_type: string }>;
    loading: boolean;
    error: string | null;
  }>({ open: false, templateId: '', templateName: '', automations: [], loading: false, error: null });

  const initialValuesRef = useRef<{ name: string; type: TemplateType; data: TemplateData } | null>(null);
  useDashboardMainScrollLock(editorMode !== null);

  const fetchList = useCallback(async (force = false) => {
    // Check cache first (unless forcing refresh)
    if (!force) {
      const age = replyTemplatesListCache ? Date.now() - replyTemplatesListCache.timestamp : Number.POSITIVE_INFINITY;
      if (replyTemplatesListCache && age < CACHE_DURATION) {
        setTemplates((replyTemplatesListCache.templates || []) as typeof templates);
        setError(null);
        setLoading(false);
        return;
      }
    }

    // Reuse in-flight request to avoid duplicate calls (e.g. Strict Mode or deps re-run)
    if (!force && replyTemplatesListPromise) {
      try {
        const d = await replyTemplatesListPromise;
        setTemplates((d.templates || []) as typeof templates);
        setError(d.error);
        replyTemplatesListCache = { templates: d.templates, timestamp: Date.now() };
      } catch {
        setError('Network error');
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const doFetch = async (): Promise<{ templates: unknown[]; error: string | null }> => {
      try {
        if (!activeAccountID) return { templates: [], error: null };
        const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates?account_id=${activeAccountID}&full=false`);
        const data = await res.json();
        if (res.ok) return { templates: data.templates || [], error: null };
        return { templates: [], error: data.error || 'Failed to load templates' };
      } catch {
        return { templates: [], error: 'Network error' };
      }
    };
    const p = force ? doFetch() : (replyTemplatesListPromise = doFetch());
    try {
      const d = await p;
      const sortedTemplates = (d.templates || []).sort((a: any, b: any) => {
        const dateA = a.$createdAt || '';
        const dateB = b.$createdAt || '';
        if (dateA && dateB) return dateA.localeCompare(dateB);
        return (a.id || '').localeCompare(b.id || '');
      });
      setTemplates(sortedTemplates as typeof templates);
      setError(d.error);
      replyTemplatesListCache = { templates: d.templates, timestamp: Date.now() };
    } catch {
      setError('Network error');
    } finally {
      if (!force) replyTemplatesListPromise = null;
      setLoading(false);
    }
  }, [activeAccountID, authenticatedFetch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const getAutomationCount = (t: { automation_count?: number }) => {
    const count = Number(t.automation_count ?? 0);
    return Number.isFinite(count) && count >= 0 ? count : 0;
  };

    const resolveAutomationView = useCallback((automationTypeRaw: string) => {
      const automationType = (automationTypeRaw || '').toLowerCase();
      const map: Record<string, import('../../contexts/DashboardContext').ViewType> = {
        dm: 'DM Automation',
        suggest_more: 'Suggest More',
        mention: 'Mentions',
        mentions: 'Mentions',
        comment_moderation: 'Comment Moderation',
        global: 'Global Trigger',
        global_trigger: 'Global Trigger',
        comment: 'Post Automation',
        post: 'Post Automation',
        reel: 'Reel Automation',
        story: 'Story Automation',
        live: 'Live Automation',
        inbox_menu: 'Inbox Menu',
        convo_starter: 'Convo Starter',
        welcome_message: 'Welcome Message'
      };
      return map[automationType] || null;
    }, []);

  const openAutomation = useCallback((item: { automation_id?: string; id?: string; title?: string; automation_type?: string }, linkedTemplateId?: string) => {
    const automationType = item.automation_type || '';
    const view = resolveAutomationView(automationType);
    if (!view) return;

    const automationId = item.automation_id || item.id || '';
    if (automationId) {
      writeTransientState('openAutomationId', automationId);
      writeTransientState('openAutomationType', automationType.toLowerCase());
    }
    if (linkedTemplateId) {
      writeTransientState('openLinkedTemplateId', linkedTemplateId);
    }

    setLinkedModal(prev => ({ ...prev, open: false }));
    setDeleteModal({ open: false, id: '', name: '' });
    setDeleteLinked([]);
    setDeleteError(null);
    setCurrentView(view);
  }, [resolveAutomationView, setCurrentView]);

  const openLinkedAutomations = useCallback(async (t: (typeof templates)[0]) => {
    const count = getAutomationCount(t);
    if (count <= 0) return;

    setLinkedModal({
      open: true,
      templateId: t.id,
      templateName: t.name,
      automations: [],
      loading: true,
      error: null
    });

    let linked = Array.isArray(t.linked_automations) ? t.linked_automations : [];
    if (linked.length === 0) {
      try {
        const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${t.id}?account_id=${activeAccountID}`);
        if (res.ok) {
          const data = await res.json();
          linked = Array.isArray(data.linked_automations) ? data.linked_automations : [];
        }
      } catch {
        setLinkedModal(prev => ({ ...prev, loading: false, error: 'Failed to load linked automations.' }));
        return;
      }
    }

    setLinkedModal(prev => ({
      ...prev,
      automations: linked,
      loading: false,
      error: linked.length === 0 ? 'No linked automations found.' : null
    }));
  }, [authenticatedFetch, getAutomationCount]);

  // If navigated from an automation with a specific template to edit,
  // open that template in the editor view once templates are loaded.
  useEffect(() => {
    if (loading) return;
    const editId = takeTransientState<string>('replyTemplateEditId');
    if (!editId) return;
    const t = templates.find((tpl) => tpl.id === editId);
    if (t) {
      openEdit(t);
    }
  }, [loading, templates]);

  const openCreate = () => {
    setEditorMode('create');
    setName('');
    setTemplateType('template_text');
    // Use same default values as SuggestMoreView
    setTemplateData(getDefaultTemplateData('template_text'));
    setTemplateValidationErrors({});
    setEditorError(null);
    initialValuesRef.current = {
      name: '',
      type: 'template_text',
      data: getDefaultTemplateData('template_text')
    };
    setHasUnsavedChanges(false);
  };

  const openEdit = async (t: (typeof templates)[0]) => {
    setEditorMode({ editId: t.id });
    setEditorLoading(true);
    setName(''); // Clear name until data is loaded
    setTemplateData({ text: '' }); // Clear data until loaded
    setTemplateValidationErrors({});
    setEditorFieldErrors({});
    setEditorError(null);

    const templateType = (t.template_type as TemplateType) || 'template_text';
    setTemplateType(templateType);

    // Always load full data when editing
    try {
      const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${t.id}?account_id=${activeAccountID}`);
      if (res.ok) {
        const fullTemplate = await res.json();
        // Update the template in the templates array
        setTemplates(prev => prev.map(template =>
          template.id === t.id ? fullTemplate : template
        ));
        // Set the loaded data
        setName(fullTemplate.name);
        const payloadData = payloadToTemplateData(templateType, fullTemplate.template_data || {});
        const finalData = Object.keys(payloadData).length > 0 ? payloadData : getDefaultTemplateData(templateType);
        setTemplateData(finalData);

        initialValuesRef.current = {
          name: fullTemplate.name,
          type: templateType,
          data: finalData
        };
        setHasUnsavedChanges(false);
      } else {
        // Fallback to defaults if loading fails
        setName(t.name); // At least show the name from list
        setTemplateData(getDefaultTemplateData(templateType));
        setEditorError('Failed to load template data');
      }
    } catch (err) {
      // Fallback to defaults if loading fails
      setName(t.name); // At least show the name from list
      setTemplateData(getDefaultTemplateData(templateType));
      setEditorError('Failed to load template data');
    } finally {
      setEditorLoading(false);
    }
  };

  const [showBackModal, setShowBackModal] = useState(false);

  const goBack = () => {
    setEditorMode(null);
    setSaving(false);
    setEditorError(null);
    setShowBackModal(false);
    setHasUnsavedChanges(false);
  };

  // Validate template data based on template type
  const validateTemplateData = (type: TemplateType, data: TemplateData): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (type === 'template_text') {
      const text = (data.text || '').trim();
      if (!text) {
        errors.template_text = 'Message must be at least 2 characters.';
      } else {
        const bl = getByteLength(text);
        if (bl < TEXT_MIN) {
          errors.template_text = 'Message must be at least 2 characters.';
        } else if (bl > TEXT_MAX) {
          errors.template_text = `Message must be at most ${TEXT_MAX} UTF-8 bytes.`;
        }
      }
    } else if (type === 'template_buttons') {
      const text = (data.text || '').trim();
      if (!text) {
        errors.button_text = 'Message content is required. This field is important.';
      } else {
        const bl = getByteLength(text);
        if (bl < TEXT_MIN) {
          errors.button_text = 'Message must be at least 2 characters.';
        } else if (bl > BUTTON_TEXT_MAX) {
          errors.button_text = `Message content too long (max ${BUTTON_TEXT_MAX} UTF-8 bytes).`;
        }
      }
      const buttons = data.buttons || [];
      if (buttons.length === 0) {
        errors.buttons = 'At least one button is required.';
      } else if (buttons.length > BUTTONS_MAX) {
        errors.buttons = `At most ${BUTTONS_MAX} buttons allowed.`;
      } else {
        buttons.forEach((btn: any, idx: number) => {
          const title = (btn.title || '').trim();
          const buttonType = String(btn.type || 'web_url').trim();
          if (!title) {
            errors[`btn_${idx}_title`] = 'Button title is required.';
          } else {
            const bl = getByteLength(title);
            if (bl < BUTTON_TITLE_MIN) {
              errors[`btn_${idx}_title`] = 'Button title must be at least 2 characters.';
            } else if (bl > BUTTON_TITLE_MAX) {
              errors[`btn_${idx}_title`] = `Button title must be at most ${BUTTON_TITLE_MAX} UTF-8 bytes.`;
            }
          }
          if (buttonType === 'postback') {
            const payload = (btn.payload || '').trim();
            if (!payload) {
              errors[`btn_${idx}_payload`] = 'Reply text is required. This field is important.';
            } else {
              const bl = getByteLength(payload);
              if (bl < QUICK_REPLY_PAYLOAD_MIN) {
                errors[`btn_${idx}_payload`] = 'Reply text must be at least 2 characters.';
              } else if (bl > QUICK_REPLY_PAYLOAD_MAX) {
                errors[`btn_${idx}_payload`] = `Reply text too long (max ${QUICK_REPLY_PAYLOAD_MAX} UTF-8 bytes).`;
              }
            }
          } else {
            const url = (btn.url || '').trim();
            if (!url) {
              errors[`btn_${idx}_url`] = 'Button URL is required. This field is important.';
            } else if (!isValidHttpUrl(url)) {
              errors[`btn_${idx}_url`] = 'Button URL must start with http:// or https://';
            }
          }
        });
      }
    } else if (type === 'template_carousel') {
      const elements = data.elements || [];
      if (elements.length === 0) {
        errors.elements = 'At least one carousel item is required.';
      } else if (elements.length > CAROUSEL_ELEMENTS_MAX) {
        errors.elements = `At most ${CAROUSEL_ELEMENTS_MAX} carousel items allowed.`;
      } else {
        elements.forEach((el: any, idx: number) => {
          const title = (el.title || '').trim();
          if (!title) {
            errors[`element_${idx}_title`] = 'Title is required.';
          } else {
            const bl = getByteLength(title);
            if (bl < CAROUSEL_TITLE_MIN) {
              errors[`element_${idx}_title`] = 'Title must be at least 2 characters.';
            } else if (bl > CAROUSEL_TITLE_MAX) {
              errors[`element_${idx}_title`] = `Title must be at most ${CAROUSEL_TITLE_MAX} UTF-8 bytes.`;
            }
          }
          const subtitle = (el.subtitle || '').trim();
          if (subtitle && getByteLength(subtitle) > CAROUSEL_SUBTITLE_MAX) {
            errors[`element_${idx}_subtitle`] = `Subtitle must be at most ${CAROUSEL_SUBTITLE_MAX} UTF-8 bytes.`;
          }
          if (!(el.image_url || '').trim()) {
            errors[`element_${idx}_image`] = 'Image URL is required.';
          }
          const buttons = el.buttons || [];
          if (buttons.length > BUTTONS_MAX) {
            errors[`element_${idx}_buttons`] = `At most ${BUTTONS_MAX} buttons per carousel item.`;
          } else {
            buttons.forEach((btn: any, bidx: number) => {
              const btitle = (btn.title || '').trim();
              if (btitle) {
                const bl = getByteLength(btitle);
                if (bl < CAROUSEL_BUTTON_TITLE_MIN) {
                  errors[`element_${idx}_btn_${bidx}_title`] = 'Button title must be at least 2 characters.';
                } else if (bl > CAROUSEL_BUTTON_TITLE_MAX) {
                  errors[`element_${idx}_btn_${bidx}_title`] = `Button title must be at most ${CAROUSEL_BUTTON_TITLE_MAX} UTF-8 bytes.`;
                }
              }
              const url = (btn.url || '').trim();
              if (!url) {
                errors[`element_${idx}_btn_${bidx}_url`] = 'Button URL is required. This field is important.';
              } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
                errors[`element_${idx}_btn_${bidx}_url`] = 'Button URL must start with http:// or https://';
              }
            });
          }
        });
      }
    } else if (type === 'template_quick_replies') {
      const text = (data.text || '').trim();
      if (!text) {
        errors.template_content = 'Title text is required. This field is important.';
      } else {
        const bl = getByteLength(text);
        if (bl < TEXT_MIN) {
          errors.template_content = 'Title text must be at least 2 characters.';
        } else if (bl > QUICK_REPLIES_TEXT_MAX) {
          errors.template_content = `Title text too long (max ${QUICK_REPLIES_TEXT_MAX} UTF-8 bytes).`;
        }
      }
      const replies = data.replies || [];
      if (replies.length === 0) {
        errors.replies = 'At least one quick reply is required.';
      } else if (replies.length > QUICK_REPLIES_MAX) {
        errors.replies = `At most ${QUICK_REPLIES_MAX} quick replies allowed.`;
      } else {
        replies.forEach((reply: any, idx: number) => {
          const title = (reply.title || '').trim();
          if (!title) {
            errors[`reply_${idx}`] = 'Button text is required. This field is important.';
          } else {
            const bl = getByteLength(title);
            if (bl < QUICK_REPLY_TITLE_MIN) {
              errors[`reply_${idx}`] = 'Button text must be at least 2 characters.';
            } else if (bl > QUICK_REPLY_TITLE_MAX) {
              errors[`reply_${idx}`] = `Button text too long (max ${QUICK_REPLY_TITLE_MAX} UTF-8 bytes).`;
            }
          }
          const payload = (reply.payload || '').trim();
          if (!payload) {
            errors[`reply_${idx}_payload`] = 'Reply message is required. This field is important.';
          } else {
            const bl = getByteLength(payload);
            if (bl < QUICK_REPLY_PAYLOAD_MIN) {
              errors[`reply_${idx}_payload`] = 'Reply message must be at least 2 characters.';
            } else if (bl > QUICK_REPLY_PAYLOAD_MAX) {
              errors[`reply_${idx}_payload`] = `Reply message too long (max ${QUICK_REPLY_PAYLOAD_MAX} UTF-8 bytes).`;
            }
          }
        });
      }
    } else if (type === 'template_media') {
      const url = (data.media_url || '').trim();
      if (!url) {
        errors.media_url = 'Media URL is required. This field is important.';
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        errors.media_url = 'Media URL must start with http:// or https://';
      } else if (getByteLength(url) > MEDIA_URL_MAX) {
        errors.media_url = `Media URL must be at most ${MEDIA_URL_MAX} UTF-8 bytes.`;
      }
      const buttons = data.buttons || [];
      if (buttons.length > BUTTONS_MAX) {
        errors.buttons = `At most ${BUTTONS_MAX} buttons allowed.`;
      } else {
        buttons.forEach((btn: any, idx: number) => {
          const title = (btn.title || '').trim();
          if (title && getByteLength(title) > BUTTON_TITLE_MAX) {
            errors[`btn_${idx}_title`] = `Button title must be at most ${BUTTON_TITLE_MAX} UTF-8 bytes.`;
          }
        });
      }
    } else if (type === 'template_share_post') {
      const useLatest = data.use_latest_post || false;
      if (!useLatest) {
        if (!(data.media_id || '').trim() && !(data.media_url || '').trim()) {
          errors.media_id = 'Media ID or URL is required, or enable Use Latest Post/Reel.';
        }
      }
    }

    return errors;
  };

  const handleSave = async (): Promise<boolean> => {
    if (!activeAccountID) {
      setEditorError('Select an Instagram account first.');
      return false;
    }
    // Clear previous errors first
    setEditorFieldErrors({});
    setTemplateValidationErrors({});

    const errs: Record<string, string> = {};

    // Validate template name
    if (!(name || '').trim()) {
      errs.name = 'Name is required';
    } else {
      const nameBytes = getByteLength(name.trim());
      if (nameBytes < 2) {
        errs.name = 'Name must be at least 2 characters.';
      } else if (nameBytes > TEMPLATE_NAME_MAX) {
        errs.name = `Name must be at most ${TEMPLATE_NAME_MAX} UTF-8 bytes.`;
      }
    }

    // Duplicate name validation (case-insensitive, ignore current edit)
    const normalizedName = (name || '').trim().toLowerCase();
    const editId = (editorMode !== null && editorMode !== 'create' && typeof editorMode === 'object') ? editorMode.editId : null;
    if (normalizedName) {
      const existingNames = templates.filter(t => t.id !== editId).map(t => t.name || '');
      const hasDuplicate = existingNames.some(n => (n || '').trim().toLowerCase() === normalizedName);
      if (hasDuplicate) {
        const suggested = suggestUniqueName(name, existingNames);
        if (suggested && suggested !== name) setName(suggested);
        errs.name = `Template name already exists. Suggested: ${suggested}`;
      }
    }

    // Re-validate template data fresh (don't rely on cached validation errors)
    const templateErrors = validateTemplateData(templateType, templateData);
    Object.assign(errs, templateErrors);
    if (Object.keys(errs).length) {
      setEditorFieldErrors(errs);
      setTemplateValidationErrors(errs);
      // Scroll to first error field
      setTimeout(() => {
        const firstErrorKey = Object.keys(errs)[0];
        // Try multiple possible field ID patterns
        const errorElement = document.getElementById(`field_${firstErrorKey}`) ||
          document.getElementById(`field_name`) ||
          document.getElementById(`field_template_text`) ||
          document.getElementById(`field_button_text`) ||
          document.getElementById(`field_template_content`) ||
          document.getElementById(`field_media_url`) ||
          document.querySelector(`[id*="${firstErrorKey}"]`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Focus if it's an input/textarea
          if (errorElement instanceof HTMLInputElement || errorElement instanceof HTMLTextAreaElement) {
            errorElement.focus();
          }
        }
      }, 100);
      return false;
    }
    setSaving(true);
    setEditorError(null);
    setEditorFieldErrors({});
    const isEdit = editorMode !== null && editorMode !== 'create';
    try {
      const payload = {
        name: name.trim(),
        template_type: templateType,
        account_id: activeAccountID,
        template_data: templateDataToPayload(templateType, templateData),
      };
      const url = editId
        ? `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${editId}?account_id=${activeAccountID}`
        : `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates`;
      const res = await authenticatedFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const rec = { id: data.id, name: data.name, type: data.type, template_type: data.template_type, template_data: data.template_data, linked_automations: data.linked_automations || [], automation_count: data.automation_count || 0 };
        if (!isEdit) setTemplates(prev => [...prev, rec]);
        else setTemplates(prev => prev.map(t => t.id === data.id ? { ...t, ...rec } : t));
        return true;
      }
      if (data.field === 'name') {
        const existingNames = templates.filter(t => t.id !== editId).map(t => t.name || '');
        const suggested = suggestUniqueName(name, existingNames);
        if (suggested && suggested !== name) setName(suggested);
        setEditorFieldErrors({ name: `Template name already exists. Suggested: ${suggested}` });
      }
      setEditorError(data.error || 'Save failed');
      if (data.fields) {
        // Backend now returns correct field keys (button_text, template_text, etc.)
        setEditorFieldErrors(data.fields);
        setTemplateValidationErrors(data.fields);
        // Scroll to first error field from backend
        setTimeout(() => {
          const firstErrorKey = Object.keys(data.fields)[0];
          // Try multiple possible field ID patterns
          const errorElement = document.getElementById(`field_${firstErrorKey}`) ||
            document.getElementById(`field_name`) ||
            document.getElementById(`field_template_text`) ||
            document.getElementById(`field_button_text`) ||
            document.getElementById(`field_template_content`) ||
            document.getElementById(`field_media_url`) ||
            document.querySelector(`[id*="${firstErrorKey}"]`);
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (errorElement instanceof HTMLInputElement || errorElement instanceof HTMLTextAreaElement) {
              errorElement.focus();
            }
          }
        }, 100);
      }
      return false;
    } catch (e) {
      setEditorError('Network error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Register unsaved-changes handlers when in editor; clear when in list
  useEffect(() => {
    if (editorMode !== null && initialValuesRef.current) {
      const isNameChanged = name.trim() !== initialValuesRef.current.name.trim();
      const isTypeChanged = templateType !== initialValuesRef.current.type;
      const isDataChanged = JSON.stringify(templateData) !== JSON.stringify(initialValuesRef.current.data);

      const hasChanges = isNameChanged || isTypeChanged || isDataChanged;

      setHasUnsavedChanges(hasChanges);
      setSaveUnsavedChanges(() => async () => {
        const ok = await handleSave();
        if (ok) goBack();
        return ok;
      });
      setDiscardUnsavedChanges(() => goBack);
    } else {
      setHasUnsavedChanges(false);
      setSaveUnsavedChanges(() => async () => true);
      setDiscardUnsavedChanges(() => () => { });
    }
  }, [editorMode, name, templateType, templateData, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

  const requestBack = () => {
    if (editorMode !== null) {
      const isNameChanged = name.trim() !== (initialValuesRef.current?.name?.trim() || '');
      const isTypeChanged = templateType !== initialValuesRef.current?.type;
      const isDataChanged = JSON.stringify(templateData) !== JSON.stringify(initialValuesRef.current?.data);

      if (isNameChanged || isTypeChanged || isDataChanged) {
        setShowBackModal(true);
      } else {
        goBack();
      }
    } else {
      goBack();
    }
  };

  const requestDelete = (t: (typeof templates)[0]) => {
    setDeleteModal({ open: true, id: t.id, name: t.name });
    setDeleteError(null);
    const linked = Array.isArray(t.linked_automations)
      ? t.linked_automations.map((a) => ({
        id: a.automation_id,
        title: a.title,
        automation_type: a.automation_type
      }))
      : [];
    setDeleteLinked(linked);
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    if (!activeAccountID) return;
    setDeleteError(null);
    try {
      const res = await authenticatedFetch(
        `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/reply-templates/${deleteModal.id}?account_id=${activeAccountID}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok) {
        setDeleteModal({ open: false, id: '', name: '' });
        fetchList(true);
      } else {
        setDeleteError(data.error || 'Delete failed');
        if (data.linked && Array.isArray(data.linked)) {
          setDeleteLinked(data.linked.map((a: any) => ({
            id: a.automation_id || a.id,
            title: a.title,
            automation_type: a.automation_type
          })));
        }
      }
    } catch (e) {
      setDeleteError('Network error');
    }
  };

  const activeEditId = editorMode !== null && editorMode !== 'create' && typeof editorMode === 'object'
    ? editorMode.editId
    : null;
  const isEditorEdit = editorMode !== null && editorMode !== 'create';
  const previewAutomation = useMemo(() => templateToPreviewAutomation(templateType, templateData), [templateType, templateData]);
  const currentEditedTemplate = useMemo(
    () => (activeEditId ? templates.find((template) => template.id === activeEditId) || null : null),
    [activeEditId, templates]
  );

  useEffect(() => {
    if (editorMode !== null) {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [editorMode]);

  const deleteLinkedDescription = useMemo(() => {
    if (deleteLinked.length === 0) {
      return (
        <div className="space-y-3">
          <p>{`Delete "${deleteModal.name}"? This cannot be undone.`}</p>
          {deleteError && (
            <p className="text-destructive font-bold">{deleteError}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p>This template is used by the following automations. Open one to edit/unlink.</p>
        <div className="flex flex-col gap-2">
          {deleteLinked.map((a) => (
            <button
              key={`${a.automation_type}-${a.id}`}
              type="button"
              onClick={() => openAutomation({ id: a.id, title: a.title, automation_type: a.automation_type }, deleteModal.id)}
              className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {automationTypeLabel(a.automation_type)}
              </span>
              <div className="text-sm font-bold text-foreground truncate">
                {a.title || 'Untitled'}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }, [deleteError, deleteLinked, deleteModal.name, openAutomation]);

  // Editor page (new page in section instead of popup)
  if (editorMode !== null) {
    return (
      <div className="relative mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Loading overlay */}
        {editorLoading && (
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-foreground">Loading Template...</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
          {/* Form column */}
          <div className="w-full min-w-0 space-y-4 xl:col-span-8 xl:space-y-6 xl:overflow-y-auto xl:pr-2">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  onClick={requestBack}
                  disabled={editorLoading}
                  className="shrink-0 p-3 rounded-2xl border-2 border-border hover:bg-muted/40 text-foreground transition-all hover:scale-105 disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-black uppercase tracking-tight text-foreground">
                    {editorMode === 'create' ? 'Create New Template' : 'Edit Template'}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {editorMode === 'create' ? 'Build a reusable template for your automations' : 'Update your template settings'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
                {isEditorEdit && currentEditedTemplate && (
                  <button
                    type="button"
                    onClick={() => requestDelete(currentEditedTemplate)}
                    disabled={saving || editorLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-destructive px-5 py-3 text-[10px] font-black uppercase tracking-widest text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:bg-destructive/90 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => { const ok = await handleSave(); if (ok) goBack(); }}
                  disabled={saving || editorLoading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editorMode === 'create' ? 'Create' : 'Update'}
                </button>
              </div>
            </div>

            {editorError && (
              <div className="p-4 rounded-2xl bg-destructive-muted/40 border-2 border-destructive/30 text-destructive text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-bold">{editorError}</span>
              </div>
            )}

            {/* Template Name */}
            <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-black text-foreground uppercase tracking-widest">
                  Template Name
                </label>
                <span className={`text-xs font-bold ${getByteLength(name || '') > TEMPLATE_NAME_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {getByteLength(name || '')}/{TEMPLATE_NAME_MAX} bytes
                </span>
              </div>
              <input
                id="field_name"
                value={name}
                onChange={e => {
                  const val = e.target.value;
                  // Enforce TEMPLATE_NAME_MAX UTF-8 byte limit
                  if (getByteLength(val) <= TEMPLATE_NAME_MAX) {
                    setName(val);
                    // Clear error when user types
                    if (editorFieldErrors['name']) {
                      setEditorFieldErrors(prev => {
                        const next = { ...prev };
                        delete next['name'];
                        return next;
                      });
                    }
                  }
                }}
                className={`w-full px-5 py-3.5 rounded-xl border-2 bg-muted/40 text-foreground font-bold transition-all ${editorFieldErrors['name']
                  ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                  : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20'
                  }`}
                placeholder="e.g. Welcome Message"
              />
              {editorFieldErrors['name'] && (
                <p className="mt-2 text-sm font-bold text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {editorFieldErrors['name']}
                </p>
              )}
            </div>

            {/* Template Type */}
            <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:p-6">
              <label className="block text-sm font-black text-foreground uppercase tracking-widest mb-4">
                Template Type
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                {TEMPLATE_TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = templateType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTemplateType(opt.id);
                        setTemplateData(getDefaultTemplateData(opt.id));
                        setTemplateValidationErrors({});
                      }}
                        className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border-2 p-3 text-center transition-all sm:p-4 ${isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10'
                        : 'border-border hover:border-border/70 hover:bg-muted/40'
                        }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Editor */}
            <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm sm:p-6">
              <label className="block text-sm font-black text-foreground uppercase tracking-widest mb-4">
                Template Content
              </label>
              <SharedTemplateEditor
                templateType={templateType}
                templateData={templateData}
                validationErrors={templateValidationErrors}
                activeAccountID={activeAccountID || undefined}
                authenticatedFetch={authenticatedFetch}
                onUpdate={setTemplateData}
                onValidationErrorChange={setTemplateValidationErrors}
              />
            </div>

          </div>

          {/* Live Preview - Sticky */}
          <AutomationPreviewPanel
            title="Live Preview"
            wrapperClassName="order-1 hidden min-h-0 w-full lg:block xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)]"
          >
            <SharedMobilePreview
              mode="automation"
              automation={previewAutomation as any}
              displayName={activeAccount?.username || 'Username'}
              profilePic={activeAccount?.profile_picture_url || undefined}
              lockScroll
              hideAutomationPrompt
            />
          </AutomationPreviewPanel>
        </div>

        {/* Unsaved changes when Back/Cancel or leaving */}
        <ModernConfirmModal
          isOpen={showBackModal}
          onClose={() => setShowBackModal(false)}
          onConfirm={async () => { const ok = await handleSave(); if (ok) goBack(); }}
          onSecondary={() => goBack()}
          title="Unsaved changes"
          description="Do you want to save before leaving?"
          confirmLabel="Save"
          secondaryLabel="Leave without saving"
          cancelLabel="Cancel"
          type="warning"
          isLoading={saving}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tight mb-2">
            Reply Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Create reusable templates for DM, Post, Reel, Story, and Live automations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {/* View Mode Toggle */}
          <div className="flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
              title="List view"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => fetchList(true)}
            disabled={loading}
            className="flex flex-1 sm:flex-none items-center justify-center gap-2 p-3 rounded-xl border-2 border-border bg-card text-foreground hover:bg-muted/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh templates"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sm:hidden text-sm font-semibold">Refresh</span>
          </button>
          {/* Create Button */}
          <button
            onClick={openCreate}
            className="flex w-full sm:w-auto min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 sm:px-6 sm:tracking-widest"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-destructive-muted/40 border-2 border-destructive/30 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingOverlay variant="fullscreen" message="Loading Reply Templates" subMessage="Fetching your templates..." />
      ) : templates.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border-2 border-dashed border-border bg-muted/40">
          <div className="inline-flex p-4 bg-primary/10 rounded-2xl mb-6">
            <LayoutTemplate className="w-12 h-12 text-primary" />
          </div>
          <h3 className="text-xl font-black text-foreground mb-2">No Templates Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Create your first reply template to reuse across all your automations
          </p>
          <button
            onClick={openCreate}
            className="px-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6'
          : 'space-y-4'
        }>
          {templates.map((t, index) => {
            const Icon = TEMPLATE_TYPE_OPTIONS.find(opt => opt.id === t.template_type)?.icon || FileText;
            return (
              <div
                key={t.id}
                className={`group rounded-2xl border-2 border-border bg-card shadow-sm transition-all hover:border-primary hover:shadow-xl ${viewMode === 'list' ? 'flex flex-col gap-4 p-4 sm:flex-row sm:items-center' : 'p-4 sm:p-6'
                  }`}
              >
                {viewMode === 'list' ? (
                  <>
                    {/* Serial Number */}
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                      {index + 1}
                    </div>
                    {/* Icon */}
                    <div className="flex-shrink-0 p-3 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-foreground mb-1 truncate">
                        {t.name}
                      </h3>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {typeLabel(t.template_type)}
                      </span>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => openLinkedAutomations(t)}
                          disabled={getAutomationCount(t) === 0}
                          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/15 transition-colors"
                          title={getAutomationCount(t) === 0 ? 'No linked automations' : 'View linked automations'}
                        >
                          {getAutomationCount(t)} Automations
                        </button>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="grid flex-shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
                      <button
                        onClick={() => openEdit(t)}
                        className="rounded-xl border-2 border-border bg-card px-4 py-2.5 font-bold text-foreground transition-all hover:bg-muted/40"
                      >
                        <Pencil className="w-4 h-4 inline mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(t)}
                        className="rounded-xl border-2 border-destructive/30 bg-destructive-muted/40 px-4 py-2.5 font-bold text-destructive transition-all hover:bg-destructive-muted/60"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Serial Number */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-black text-xs">
                          {index + 1}
                        </div>
                        <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="mb-1 truncate text-lg font-black text-foreground">
                            {t.name}
                          </h3>
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            {typeLabel(t.template_type)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Usage Count Badge */}
                    <div className="mb-4 border-b border-border pb-4">
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">
                        Used By
                      </p>
                      <div className="flex flex-wrap gap-1.5 align-middle">
                        <button
                          type="button"
                          onClick={() => openLinkedAutomations(t)}
                          disabled={getAutomationCount(t) === 0}
                          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/15 transition-colors"
                          title={getAutomationCount(t) === 0 ? 'No linked automations' : 'View linked automations'}
                        >
                          {getAutomationCount(t)} Automations
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="flex-1 rounded-xl border-2 border-border bg-card px-4 py-2.5 font-bold text-foreground transition-all hover:bg-muted/40"
                      >
                        <Pencil className="w-4 h-4 inline mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(t)}
                        className="px-4 py-2.5 rounded-xl border-2 border-destructive/30 bg-destructive-muted/40 text-destructive font-bold hover:bg-destructive-muted/60 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      <ModernConfirmModal
        isOpen={deleteModal.open}
        onClose={() => { setDeleteModal({ open: false, id: '', name: '' }); setDeleteLinked([]); setDeleteError(null); }}
        onConfirm={deleteLinked.length > 0 ? () => {
          setDeleteModal({ open: false, id: '', name: '' });
          setDeleteLinked([]);
          setDeleteError(null);
        } : confirmDelete}
        title="Delete template?"
        description={deleteLinkedDescription}
        type="danger"
        confirmLabel={deleteLinked.length > 0 ? 'Close' : 'Delete'}
        cancelLabel={deleteLinked.length > 0 ? 'Close' : 'Cancel'}
        oneButton={deleteLinked.length > 0}
      />

      {/* Linked automations list */}
      <ModernConfirmModal
        isOpen={linkedModal.open}
        onClose={() => setLinkedModal(prev => ({ ...prev, open: false }))}
        onConfirm={() => setLinkedModal(prev => ({ ...prev, open: false }))}
        title={linkedModal.templateName ? `${linkedModal.templateName} Automations` : 'Linked Automations'}
        description={
          linkedModal.loading ? (
            <div className="text-center py-2">Loading linked automations...</div>
          ) : linkedModal.error ? (
            <div className="text-destructive text-center">{linkedModal.error}</div>
          ) : (
            <div className="space-y-3">
              <p>Click an automation to open it.</p>
              <div className="flex flex-col gap-2">
                {linkedModal.automations.map((a) => (
                  <button
                    key={`${a.automation_type}-${a.automation_id}`}
                    type="button"
                    onClick={() => openAutomation(a, linkedModal.templateId)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {automationTypeLabel(a.automation_type)}
                    </span>
                    <div className="text-sm font-bold text-foreground truncate">
                      {a.title || 'Untitled'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        }
        type="info"
        confirmLabel="Close"
        cancelLabel="Cancel"
        oneButton
      />
    </div>
  );
}

