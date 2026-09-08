import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb, ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNotification } from '../../contexts/NotificationContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import AutomationActionBar from '../../components/dashboard/AutomationActionBar';
import LockedFeatureToggle from '../../components/ui/LockedFeatureToggle';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

interface SuggestMoreConfig {
    is_setup: boolean;
    is_active: boolean;
    template_id?: string;
    doc_id?: string;
}

const SuggestMoreView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount, setCurrentView, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges, hasPlanFeature } = useDashboard();

    const [config, setConfig] = useState<SuggestMoreConfig>({ is_setup: false, is_active: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [isSelectedTemplateLoading, setIsSelectedTemplateLoading] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(true);
    const [isActive, setIsActive] = useState(true);
    const { showSuccess, showError } = useNotification();
    useDashboardMainScrollLock(true);

    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', description: '', type: 'info', onConfirm: () => { } });
    const fetchingRef = useRef(false);
    const lastFetchedAccountIdRef = useRef<string | null>(null);
    const templateCacheRef = useRef<Record<string, ReplyTemplate>>({});
    const [initialState, setInitialState] = useState('');
    const suggestMoreAvailable = hasPlanFeature('suggest_more');

    const fetchConfig = useCallback(async () => {
        if (!activeAccountID) return;

        // Prevent duplicate requests
        if (fetchingRef.current) {
            return;
        }

        // Skip if we already fetched for this account
        if (lastFetchedAccountIdRef.current === activeAccountID) {
            setIsLoading(false);
            return;
        }

        fetchingRef.current = true;
        setIsLoading(true);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/suggest-more?account_id=${activeAccountID}`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                setIsActive(data.is_active || false);
                lastFetchedAccountIdRef.current = activeAccountID;

                // If template_id exists, fetch the template
                const templateId = String(data.template_id || '').trim();
                if (templateId) {
                    try {
                        setIsSelectedTemplateLoading(true);
                        if (templateCacheRef.current[templateId]) {
                            setSelectedTemplate(templateCacheRef.current[templateId]);
                            setShowTemplateSelector(false);
                        } else {
                            const templateData = await fetchReplyTemplateById(activeAccountID, authenticatedFetch, templateId);
                            if (templateData) {
                                templateCacheRef.current[templateId] = templateData;
                                setSelectedTemplate(templateData);
                                setShowTemplateSelector(false);
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching template:', err);
                    } finally {
                        setIsSelectedTemplateLoading(false);
                    }
                } else {
                    setSelectedTemplate(null);
                    setIsSelectedTemplateLoading(false);
                    setShowTemplateSelector(true);
                }
            }
        } catch (err) {
            console.error('Error fetching suggest more config:', err);
        } finally {
            setIsLoading(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        // Reset last fetched account ID when account changes
        if (lastFetchedAccountIdRef.current !== activeAccountID) {
            lastFetchedAccountIdRef.current = null;
        }
        fetchConfig();
    }, [activeAccountID, fetchConfig]);

    const currentState = useMemo(() => JSON.stringify({
        template_id: selectedTemplate?.id || null,
        is_active: isActive
    }), [isActive, selectedTemplate?.id]);

    const isDirty = !!initialState && initialState !== currentState;

    useEffect(() => {
        setInitialState(JSON.stringify({
            template_id: config.template_id || null,
            is_active: Boolean(config.is_active)
        }));
    }, [config.is_active, config.template_id]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!activeAccountID) return false;
        if (!suggestMoreAvailable) {
            showError('Suggest More is not included in your current plan.');
            return false;
        }

        if (!selectedTemplate) {
            showError('Please select a reply template');
            return false;
        }

        setIsSaving(true);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/suggest-more`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: activeAccountID,
                    template_id: selectedTemplate.id,
                    is_active: isActive
                })
            });

            if (res.ok) {
                showSuccess('Suggest More saved successfully!');
                setInitialState(currentState);
                setHasUnsavedChanges(false);
                fetchConfig();
                return true;
            } else {
                const data = await res.json().catch(() => ({}));
                showError(data.error || 'Failed to save');
                return false;
            }
        } catch (err) {
            showError('Network error');
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [activeAccountID, authenticatedFetch, currentState, fetchConfig, isActive, selectedTemplate, setHasUnsavedChanges, suggestMoreAvailable]);

    useEffect(() => {
        setHasUnsavedChanges(isDirty);
        setSaveUnsavedChanges(() => handleSave);
        setDiscardUnsavedChanges(() => () => {
            setIsActive(Boolean(config.is_active));
            const restoredTemplate = config.template_id ? (templateCacheRef.current[config.template_id] || null) : null;
            setSelectedTemplate(restoredTemplate);
            setIsSelectedTemplateLoading(false);
            setShowTemplateSelector(!restoredTemplate);
        });
    }, [config.is_active, config.template_id, handleSave, isDirty, setDiscardUnsavedChanges, setHasUnsavedChanges, setSaveUnsavedChanges]);

    const handleDelete = () => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Configuration?',
            description: 'This will remove your Suggest More template. You can always create a new one.',
            type: 'danger',
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                setIsSaving(true);
                try {
                    await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/suggest-more?account_id=${activeAccountID}`, {
                        method: 'DELETE'
                    });
                    setConfig({ is_setup: false, is_active: false });
                    setSelectedTemplate(null);
                    setInitialState(JSON.stringify({ template_id: null, is_active: false }));
                    setHasUnsavedChanges(false);
                } catch (err) {
                    console.error('Error deleting:', err);
                } finally {
                    setIsSaving(false);
                }
            }
        });
    };

    if (isLoading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Suggest More"
                subMessage="Fetching your suggest more template..."
            />
        );
    }

    // Preview data for SharedMobilePreview
    const previewItem = buildPreviewAutomationFromTemplate(selectedTemplate);

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                {/* Editor Section */}
                <div className="xl:col-span-8 w-full min-w-0 space-y-6 xl:overflow-y-auto xl:pr-2 pb-24 md:pb-0">
                    <div className="pb-2">
                        <AutomationActionBar
                            hasExisting={Boolean(config.is_setup)}
                            isSaving={isSaving}
                            onSave={handleSave}
                            onDelete={config.is_setup ? handleDelete : undefined}
                            leftContent={
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('Overview')}
                                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-border bg-card hover:bg-muted/60 text-foreground transition-all active:scale-[0.98]"
                                    title="Back to Overview"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            }
                            centerContent={
                                <div className="min-w-0">
                                    <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Suggest More</h1>
                                    <p className="text-muted-foreground text-xs sm:text-sm font-normal mt-0.5">Show additional reply suggestions to users when an automation finishes.</p>
                                </div>
                            }
                        />
                    </div>
                    {/* Active Toggle */}
                    <LockedFeatureToggle
                        icon={<Lightbulb className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />}
                        title="Enable Suggest More"
                        description="When enabled, users will see this follow-up suggestion."
                        checked={isActive}
                        onToggle={() => setIsActive(!isActive)}
                        locked={!suggestMoreAvailable}
                        note="Suggest More is locked on your current plan. Upgrade to enable this response layer."
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-foreground"
                    />

                    {/* Template Selector */}
                    <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border/60">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Linked Reply Template</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Choose the template sent as a follow-up recommendation.</p>
                            </div>
                            {selectedTemplate && !showTemplateSelector && (
                                <button
                                    type="button"
                                    onClick={() => setShowTemplateSelector(true)}
                                    className="text-xs font-medium text-foreground hover:underline"
                                >
                                    Change Template
                                </button>
                            )}
                        </div>
                        {(!selectedTemplate || showTemplateSelector) && (
                            <TemplateSelector
                                selectedTemplateId={selectedTemplate?.id}
                                onSelect={(template) => {
                                    setIsSelectedTemplateLoading(false);
                                    setSelectedTemplate(template);
                                    setShowTemplateSelector(!template);
                                }}
                                onCreateNew={() => {
                                    setCurrentView('Reply Templates');
                                }}
                            />
                        )}
                        {!selectedTemplate && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Choose an existing template or create a new one to use for Suggest More responses.
                            </p>
                        )}
                        {selectedTemplate && !showTemplateSelector && (
                            <div className="p-4 bg-muted/40 border border-border/80 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-foreground">{selectedTemplate.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{selectedTemplate.template_type.replace('template_', '').replace('_', ' ')}</p>
                                </div>
                                <div className="px-2.5 py-1 bg-muted border border-border/60 text-foreground text-xs font-medium rounded-md">Selected</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview Section */}
                <AutomationPreviewPanel title="Live Preview">
                    {previewItem ? (
                        <SharedMobilePreview
                            mode="automation"
                            automation={previewItem}
                            activeAccountID={activeAccountID}
                            authenticatedFetch={authenticatedFetch}
                            profilePic={activeAccount?.profile_picture_url}
                            displayName={activeAccount?.username || 'username'}
                            lockScroll
                            isLoadingPreview={isSelectedTemplateLoading}
                        />
                    ) : (
                        <SharedMobilePreview
                            mode="automation"
                            automation={{ keyword: 'Suggest More' }}
                            activeAccountID={activeAccountID}
                            authenticatedFetch={authenticatedFetch}
                            profilePic={activeAccount?.profile_picture_url || undefined}
                            displayName={activeAccount?.username || 'username'}
                            lockScroll
                            isLoadingPreview={isSelectedTemplateLoading}
                        />
                    )}
                </AutomationPreviewPanel>
            </div>

            <ModernConfirmModal
                isOpen={modalConfig.isOpen}
                title={modalConfig.title}
                description={modalConfig.description}
                type={modalConfig.type}
                onConfirm={modalConfig.onConfirm}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div >
    );
};

export default SuggestMoreView;

