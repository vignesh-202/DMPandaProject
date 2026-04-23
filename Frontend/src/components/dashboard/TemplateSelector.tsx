"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutTemplate,
  Plus,
  Search,
  X,
  CheckCircle2,
  FileText,
  Smartphone,
  Image as ImageIcon,
  Reply,
  MousePointerClick,
  Share2,
  Loader2,
  AlertCircle,
  Grid3x3,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { writeTransientState } from '../../lib/transientState';

export interface ReplyTemplate {
  id: string;
  name: string;
  type: string;
  template_type: string;
  template_data: any;
}

interface TemplateSelectorProps {
  selectedTemplateId?: string;
  onSelect: (template: ReplyTemplate | null) => void;
  onCreateNew?: () => void;
  onTemplatesLoaded?: (templates: ReplyTemplate[]) => void;
  className?: string;
  allowClear?: boolean;
}

// Shared promise to coalesce duplicate list requests
let replyTemplatesListPromise: Promise<{ templates: ReplyTemplate[]; error: string | null }> | null = null;
let replyTemplatesListPromiseKey = '';

// Cache templates by account ID to avoid reloading when switching sections
const templatesCache: Record<string, { templates: ReplyTemplate[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const TEMPLATE_TYPE_ICONS: Record<string, React.ElementType> = {
  template_text: FileText,
  template_buttons: MousePointerClick,
  template_carousel: Smartphone,
  template_quick_replies: Reply,
  template_media: ImageIcon,
  template_share_post: Share2,
};

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  template_text: 'Text',
  template_buttons: 'Button',
  template_carousel: 'Carousel',
  template_quick_replies: 'Quick Replies',
  template_media: 'Media',
  template_share_post: 'Share Post',
};

const loadReplyTemplates = async (
  activeAccountID: string,
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  force = false
) => {
  if (!activeAccountID) {
    return { templates: [], error: null };
  }

  if (!force && templatesCache[activeAccountID]) {
    const cached = templatesCache[activeAccountID];
    if (Date.now() - cached.timestamp < CACHE_DURATION) {
      return { templates: cached.templates, error: null };
    }
  }

  const requestKey = `${activeAccountID}|reply-templates`;
  if (!force && replyTemplatesListPromise && replyTemplatesListPromiseKey === requestKey) {
    return replyTemplatesListPromise;
  }

  replyTemplatesListPromiseKey = requestKey;
  replyTemplatesListPromise = (async () => {
    try {
      const res = await authenticatedFetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates?account_id=${activeAccountID}&full=false`
      );
      if (!res.ok) {
        return { templates: [], error: 'Failed to load templates' };
      }

      const data = await res.json();
      const templates = data.templates || [];
      templatesCache[activeAccountID] = { templates, timestamp: Date.now() };
      return { templates, error: null };
    } catch (_) {
      return { templates: [], error: 'Failed to load templates' };
    } finally {
      if (replyTemplatesListPromiseKey === requestKey) {
        replyTemplatesListPromise = null;
        replyTemplatesListPromiseKey = '';
      }
    }
  })();

  return replyTemplatesListPromise;
};

export const prefetchReplyTemplates = async (
  activeAccountID: string,
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) => {
  const result = await loadReplyTemplates(activeAccountID, authenticatedFetch, false);
  return result.templates;
};

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplateId,
  onSelect,
  onCreateNew,
  onTemplatesLoaded,
  className = '',
  allowClear = true,
}) => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, setCurrentView } = useDashboard();

  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplateIds, setLoadingTemplateIds] = useState<Set<string>>(new Set());

  const fetchTemplates = useCallback(async (force = false) => {
    if (!activeAccountID) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await loadReplyTemplates(activeAccountID, authenticatedFetch, force);
      setTemplates(result.templates);
      setError(result.error);
      onTemplatesLoaded?.(result.templates);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [activeAccountID, authenticatedFetch, onTemplatesLoaded]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    TEMPLATE_TYPE_LABELS[t.template_type]?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = async (template: ReplyTemplate) => {
    // If template doesn't have full data, load it first
    if (!template.template_data || Object.keys(template.template_data).length === 0) {
      setLoadingTemplateIds(prev => new Set(prev).add(template.id));
      try {
        const res = await authenticatedFetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${template.id}?account_id=${activeAccountID}`
        );
        if (res.ok) {
          const fullTemplate = await res.json();
          let nextTemplates: ReplyTemplate[] = [];
          setTemplates(prev => {
            nextTemplates = prev.map(t => t.id === template.id ? fullTemplate : t);
            return nextTemplates;
          });
          if (activeAccountID) {
            templatesCache[activeAccountID] = { templates: nextTemplates, timestamp: Date.now() };
          }
          onTemplatesLoaded?.(nextTemplates);
          onSelect(fullTemplate);
        } else {
          onSelect(template); // Fallback to partial data
        }
      } catch (err) {
        onSelect(template); // Fallback to partial data
      } finally {
        setLoadingTemplateIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(template.id);
          return newSet;
        });
      }
    } else {
      onSelect(template);
    }
  };

  const handleClear = () => {
    onSelect(null);
  };

  const handleTemplateCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, template: ReplyTemplate) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void handleSelect(template);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar with Refresh Button */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-2xl border-2 border-content/70 bg-card/90 py-3 pl-11 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchTemplates(true)}
          disabled={isLoading}
          className="rounded-xl border-2 border-content/70 bg-card p-3 text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title="Refresh templates"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="p-3 rounded-xl border-2 border-blue-200 dark:border-blue-600/40 bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
            title="Create reply template"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Templates Container Box */}
      <div className="relative min-h-[220px] max-h-[420px] overflow-y-auto rounded-[28px] border border-content bg-card/95 p-4 shadow-sm custom-scrollbar">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-center text-sm font-bold text-muted-foreground">{error}</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <LayoutTemplate className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="mb-1 text-center text-sm font-bold text-muted-foreground">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </p>
            <p className="text-center text-xs text-muted-foreground/70">
              {searchQuery ? 'Try a different search term' : 'Create your first template'}
            </p>
            {!searchQuery && onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                Create Reply Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredTemplates.map((template) => {
              const Icon = TEMPLATE_TYPE_ICONS[template.template_type] || FileText;
              const isSelected = template.id === selectedTemplateId;

              const isTemplateLoading = loadingTemplateIds.has(template.id);

              return (
                <div
                  key={template.id}
                  role="button"
                  tabIndex={isTemplateLoading ? -1 : 0}
                  onClick={() => {
                    if (!isTemplateLoading) {
                      void handleSelect(template);
                    }
                  }}
                  onKeyDown={(event) => handleTemplateCardKeyDown(event, template)}
                  aria-disabled={isTemplateLoading}
                  className={`group relative rounded-[24px] border p-4 text-left transition-all ${isSelected
                    ? 'border-primary/40 bg-primary/8 shadow-[0_18px_40px_rgba(108,43,217,0.12)]'
                    : isTemplateLoading
                      ? 'cursor-not-allowed border-content/70 bg-muted/50 opacity-75'
                      : 'cursor-pointer border-content/70 bg-background/70 hover:border-primary/30 hover:bg-primary/5 hover:shadow-md'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-2xl p-2.5 transition-all ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : isTemplateLoading
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-card text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                      }`}>
                      {isTemplateLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`mb-1 truncate text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'
                        }`}>
                        {template.name}
                      </div>
                      <div className={`text-xs font-medium ${isSelected ? 'text-primary/80' : 'text-muted-foreground'
                        }`}>
                        {TEMPLATE_TYPE_LABELS[template.template_type] || template.template_type}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground/80">
                          Click to select
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            writeTransientState('replyTemplateEditId', template.id);
                            setCurrentView('Reply Templates');
                          }}
                          className="inline-flex items-center gap-1 font-bold text-primary transition-colors hover:text-primary/80"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Template Info */}
      {selectedTemplate && allowClear && (
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border-2 border-blue-200 dark:border-blue-500/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                Selected: <span className="font-black">{selectedTemplate.name}</span>
              </p>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">
                {TEMPLATE_TYPE_LABELS[selectedTemplate.template_type]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            title="Clear selection"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateSelector;
