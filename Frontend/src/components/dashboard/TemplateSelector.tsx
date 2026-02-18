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

    // Check cache first (unless forcing refresh)
    if (!force && templatesCache[activeAccountID]) {
      const cached = templatesCache[activeAccountID];
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_DURATION) {
        setTemplates(cached.templates);
        setError(null);
        setIsLoading(false);
        onTemplatesLoaded?.(cached.templates);
        return;
      }
    }

    if (replyTemplatesListPromise && !force) {
      try {
        const result = await replyTemplatesListPromise;
        setTemplates(result.templates);
        setError(result.error);
        templatesCache[activeAccountID] = { templates: result.templates, timestamp: Date.now() };
        onTemplatesLoaded?.(result.templates);
      } catch (err) {
        setError('Failed to load templates');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    replyTemplatesListPromise = (async () => {
      try {
        const res = await authenticatedFetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates?account_id=${activeAccountID}&full=false`
        );
        if (res.ok) {
          const data = await res.json();
          const templates = data.templates || [];
          templatesCache[activeAccountID] = { templates, timestamp: Date.now() };
          return { templates, error: null };
        } else {
          return { templates: [], error: 'Failed to load templates' };
        }
      } catch (err) {
        return { templates: [], error: 'Failed to load templates' };
      }
    })();

    try {
      const result = await replyTemplatesListPromise;
      setTemplates(result.templates);
      setError(result.error);
      onTemplatesLoaded?.(result.templates);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
      replyTemplatesListPromise = null;
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
          // Update the template in the templates array
          setTemplates(prev => prev.map(t =>
            t.id === template.id ? fullTemplate : t
          ));
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
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchTemplates(true)}
          disabled={isLoading}
          className="p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm font-bold text-gray-500 text-center">{error}</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <LayoutTemplate className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm font-bold text-gray-400 text-center mb-1">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </p>
            <p className="text-xs text-gray-300 text-center">
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
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelect(template)}
                  disabled={isTemplateLoading}
                  className={`group relative p-4 rounded-xl border-2 transition-all text-left ${isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : isTemplateLoading
                      ? 'border-gray-300 bg-gray-100 dark:bg-gray-700 opacity-75 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/5'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg transition-all ${isSelected
                      ? 'bg-blue-500 text-white shadow-md'
                      : isTemplateLoading
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                        : 'bg-white dark:bg-gray-700 text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-500'
                      }`}>
                      {isTemplateLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold mb-1 truncate ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                        }`}>
                        {template.name}
                      </div>
                      <div className={`text-xs font-medium ${isSelected ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                        {TEMPLATE_TYPE_LABELS[template.template_type] || template.template_type}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 dark:text-gray-500">
                          Click to select
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            try {
                              sessionStorage.setItem('replyTemplateEditId', template.id);
                            } catch {
                              // ignore storage failures, still navigate
                            }
                            setCurrentView('Reply Templates');
                          }}
                          className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-bold"
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
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </button>
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
