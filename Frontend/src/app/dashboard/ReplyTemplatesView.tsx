"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutTemplate, Plus, Pencil, Trash2, Loader2, X, AlertCircle,
  FileText, Smartphone, Image as ImageIcon, Reply, MousePointerClick, Share2, ArrowLeft,
  Grid3x3, List as ListIcon, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import SharedTemplateEditor, { TemplateType, TemplateData } from '../../components/dashboard/SharedTemplateEditor';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { getDefaultTemplateData } from '../../lib/utils';
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

// Shared promise to coalesce duplicate list requests (e.g. React Strict Mode double-mount)
let replyTemplatesListPromise: Promise<{ templates: unknown[]; error: string | null }> | null = null;

// Cache key for templates list
const TEMPLATES_CACHE_KEY = 'replyTemplatesList';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function templateToPreviewAutomation(type: TemplateType, d: TemplateData): Record<string, unknown> {
  const t = type; const da = d || {};
  return {
    template_type: t,
    template_content: t === 'template_text' ? (da.text as string) : t === 'template_buttons' ? (da.text as string) : t === 'template_quick_replies' ? (da.text as string) : t === 'template_media' ? (da.media_url as string) : undefined,
    template_elements: t === 'template_carousel' ? (da.elements as unknown[]) : undefined,
    replies: t === 'template_quick_replies' ? (da.replies as unknown[]) : undefined,
    buttons: (t === 'template_buttons' || t === 'template_media') ? (da.buttons as unknown[]) : undefined,
    media_url: t === 'template_share_post' ? (da.media_url as string) : undefined,
    media_id: t === 'template_share_post' ? (da.media_id as string) : undefined,
    use_latest_post: t === 'template_share_post' ? da.use_latest_post : undefined,
    latest_post_type: t === 'template_share_post' ? da.latest_post_type : undefined,
  };
}

export default function ReplyTemplatesView() {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, activeAccount, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
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

  const fetchList = useCallback(async (force = false) => {
    // Check cache first (unless forcing refresh)
    if (!force) {
      try {
        const cached = sessionStorage.getItem(TEMPLATES_CACHE_KEY);
        if (cached) {
          const { templates: cachedTemplates, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < CACHE_DURATION) {
            setTemplates((cachedTemplates || []) as typeof templates);
            setError(null);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Ignore cache read errors
      }
    }

    // Reuse in-flight request to avoid duplicate calls (e.g. Strict Mode or deps re-run)
    if (!force && replyTemplatesListPromise) {
      try {
        const d = await replyTemplatesListPromise;
        setTemplates((d.templates || []) as typeof templates);
        setError(d.error);
        // Update cache
        try {
          sessionStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify({
            templates: d.templates,
            timestamp: Date.now()
          }));
        } catch {
          // Ignore storage errors
        }
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
        const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates?full=false`);
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
      setTemplates((d.templates || []) as typeof templates);
      setError(d.error);
      // Update cache
      try {
        sessionStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify({
          templates: d.templates,
          timestamp: Date.now()
        }));
      } catch {
        // Ignore storage errors
      }
    } catch {
      setError('Network error');
    } finally {
      if (!force) replyTemplatesListPromise = null;
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // If navigated from an automation with a specific template to edit,
  // open that template in the editor view once templates are loaded.
  useEffect(() => {
    if (loading) return;
    try {
      const editId = sessionStorage.getItem('replyTemplateEditId');
      if (!editId) return;
      const t = templates.find((tpl) => tpl.id === editId);
      if (t) {
        openEdit(t);
      }
      sessionStorage.removeItem('replyTemplateEditId');
    } catch {
      // Ignore storage errors
    }
  }, [loading, templates]);

  const openCreate = () => {
    setEditorMode('create');
    setName('');
    setTemplateType('template_text');
    // Use same default values as SuggestMoreView
    setTemplateData(getDefaultTemplateData('template_text'));
    setTemplateValidationErrors({});
    setEditorFieldErrors({});
    setEditorError(null);
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
      const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${t.id}`);
      if (res.ok) {
        const fullTemplate = await res.json();
        // Update the template in the templates array
        setTemplates(prev => prev.map(template =>
          template.id === t.id ? fullTemplate : template
        ));
        // Set the loaded data
        setName(fullTemplate.name);
        const payloadData = payloadToTemplateData(templateType, fullTemplate.template_data || {});
        setTemplateData(Object.keys(payloadData).length > 0 ? payloadData : getDefaultTemplateData(templateType));
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
          const url = (btn.url || '').trim();
          if (!url) {
            errors[`btn_${idx}_url`] = 'Button URL is required. This field is important.';
          } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
            errors[`btn_${idx}_url`] = 'Button URL must start with http:// or https://';
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
    const editId = isEdit && typeof editorMode === 'object' ? editorMode.editId : null;
    try {
      const payload = {
        name: name.trim(),
        template_type: templateType,
        template_data: templateDataToPayload(templateType, templateData),
      };
      const url = editId
        ? `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${editId}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates`;
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
    if (editorMode !== null) {
      setHasUnsavedChanges(true);
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
  }, [editorMode]);

  const requestBack = () => {
    setShowBackModal(true);
  };

  const requestDelete = (id: string, n: string) => {
    setDeleteModal({ open: true, id, name: n });
    setDeleteError(null);
    setDeleteLinked([]);
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    setDeleteError(null);
    try {
      const res = await authenticatedFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${deleteModal.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok) {
        setDeleteModal({ open: false, id: '', name: '' });
        fetchList(true);
      } else {
        setDeleteError(data.error || 'Delete failed');
        if (data.linked && Array.isArray(data.linked)) setDeleteLinked(data.linked);
      }
    } catch (e) {
      setDeleteError('Network error');
    }
  };

  const previewAutomation = useMemo(() => templateToPreviewAutomation(templateType, templateData), [templateType, templateData]);

  // Editor page (new page in section instead of popup)
  if (editorMode !== null) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 relative">
        {/* Loading overlay */}
        {editorLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">Loading Template...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={requestBack}
            disabled={editorLoading}
            className="p-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
              {editorMode === 'create' ? 'Create New Template' : 'Edit Template'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {editorMode === 'create' ? 'Build a reusable template for your automations' : 'Update your template settings'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
          {/* Form column */}
          <div className="space-y-6">
            {editorError && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-bold">{editorError}</span>
              </div>
            )}

            {/* Template Name */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                  Template Name
                </label>
                <span className={`text-xs font-bold ${getByteLength(name || '') > TEMPLATE_NAME_MAX ? 'text-red-500' : 'text-gray-400'}`}>
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
                className={`w-full px-5 py-3.5 rounded-xl border-2 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-bold transition-all ${editorFieldErrors['name']
                  ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                placeholder="e.g. Welcome Message"
              />
              {editorFieldErrors['name'] && (
                <p className="mt-2 text-sm font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {editorFieldErrors['name']}
                </p>
              )}
            </div>

            {/* Template Type */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-4">
                Template Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-lg shadow-blue-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Editor */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-4">
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

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={requestBack}
                className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => { const ok = await handleSave(); if (ok) goBack(); }}
                disabled={saving}
                className="flex-1 px-6 py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                {editorMode === 'create' ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Live Preview - Sticky */}
          <div className="xl:sticky xl:top-8 self-start">
            <div className="rounded-3xl border-2 border-blue-200 dark:border-blue-500/30 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-500/5 dark:to-gray-900 p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-blue-200 dark:border-blue-500/20">
                <div className="p-2 bg-blue-500 rounded-xl">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Live Preview</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">See how it looks on Instagram</p>
                </div>
              </div>
              <div className="flex justify-center bg-white dark:bg-gray-950 rounded-2xl p-4 shadow-inner">
                <SharedMobilePreview
                  mode="automation"
                  automation={previewAutomation as any}
                  displayName={activeAccount?.username || 'Username'}
                  profilePic={activeAccount?.profile_picture_url || undefined}
                />
              </div>
            </div>
          </div>
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
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
            Reply Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create reusable templates for DM, Post, Reel, Story, and Live automations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
            className="p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh templates"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Create Button */}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/20 flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingOverlay variant="fullscreen" message="Loading Reply Templates" subMessage="Fetching your templates..." />
      ) : templates.length === 0 ? (
        <div className="py-20 text-center rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="inline-flex p-4 bg-blue-100 dark:bg-blue-500/20 rounded-2xl mb-6">
            <LayoutTemplate className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Templates Yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create your first reply template to reuse across all your automations
          </p>
          <button
            onClick={openCreate}
            className="px-6 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'space-y-4'
        }>
          {templates.map((t, index) => {
            const Icon = TEMPLATE_TYPE_OPTIONS.find(opt => opt.id === t.template_type)?.icon || FileText;
            return (
              <div
                key={t.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-xl group ${viewMode === 'list' ? 'p-4 flex items-center gap-4' : 'p-6'
                  }`}
              >
                {viewMode === 'list' ? (
                  <>
                    {/* Serial Number */}
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-sm">
                      {index + 1}
                    </div>
                    {/* Icon */}
                    <div className="flex-shrink-0 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
                      <Icon className="w-6 h-6 text-blue-500" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1 truncate">
                        {t.name}
                      </h3>
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                        {typeLabel(t.template_type)}
                      </span>
                      {t.linked_automations && t.linked_automations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.linked_automations.slice(0, 3).map((a) => (
                            <span
                              key={a.automation_id}
                              className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            >
                              {automationTypeLabel(a.automation_type)}
                            </span>
                          ))}
                          {t.linked_automations.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              +{t.linked_automations.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                      >
                        <Pencil className="w-4 h-4 inline mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(t.id, t.name)}
                        className="px-4 py-2.5 rounded-xl border-2 border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* Serial Number */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs">
                          {index + 1}
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
                          <Icon className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
                            {t.name}
                          </h3>
                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            {typeLabel(t.template_type)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Show Usage Count */}
                    {(t.automation_count !== undefined ? t.automation_count > 0 : (t.linked_automations && t.linked_automations.length > 0)) && (
                      <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                          Used By
                        </p>
                        <div className="flex flex-wrap gap-1.5 align-middle">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {t.automation_count !== undefined ? t.automation_count : t.linked_automations?.length} Automations
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                      >
                        <Pencil className="w-4 h-4 inline mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(t.id, t.name)}
                        className="px-4 py-2.5 rounded-xl border-2 border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
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
        onConfirm={deleteLinked.length > 0 ? () => { setDeleteModal({ open: false, id: '', name: '' }); setDeleteLinked([]); setDeleteError(null); } : confirmDelete}
        title="Delete template?"
        description={
          deleteLinked.length > 0
            ? `This template is used by: ${deleteLinked.map(a => `${automationTypeLabel(a.automation_type)}: ${a.title || 'Untitled'}`).join(', ')}. Unlink them first.`
            : `Delete "${deleteModal.name}"? This cannot be undone.`
        }
        type="danger"
        confirmLabel={deleteLinked.length > 0 ? 'OK' : 'Delete'}
        cancelLabel="Cancel"
        oneButton={deleteLinked.length > 0}
      />
      {deleteError && deleteLinked.length === 0 && deleteModal.open && (
        <p className="mt-2 text-sm text-destructive">{deleteError}</p>
      )}
    </div>
  );
}
