import React, { useState, useEffect, useCallback } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ArrowLeft } from 'lucide-react';
import { takeTransientState } from '../../lib/transientState';
import AutomationToast from '../../components/ui/AutomationToast';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import { prefetchReplyTemplates, type ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

const LiveAutomationView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
    const [selectedMedia, setSelectedMedia] = useState<any>(null);
    const [editorDirty, setEditorDirty] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [replyTemplatesList, setReplyTemplatesList] = useState<ReplyTemplate[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPreparingEditor, setIsPreparingEditor] = useState(false);
    const [editorLoadingMessage, setEditorLoadingMessage] = useState('Preparing live automation editor');
    const [prefetchedAutomation, setPrefetchedAutomation] = useState<any>(null);
    const [prefetchedTemplate, setPrefetchedTemplate] = useState<ReplyTemplate | null>(null);
    const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
    const saveHandlerRef = React.useRef<() => Promise<boolean>>(async () => true);
    useDashboardMainScrollLock(Boolean(selectedMedia || isPreparingEditor));
    const previewTemplate = React.useMemo(() => {
        if (selectedTemplateId) {
            return replyTemplatesList.find((template) => template.id === selectedTemplateId) || prefetchedTemplate;
        }
        return prefetchedTemplate;
    }, [prefetchedTemplate, replyTemplatesList, selectedTemplateId]);

    const previewAutomation = React.useMemo(() => {
        if (previewTemplate) {
            return {
                ...(buildPreviewAutomationFromTemplate(previewTemplate) || {}),
                keyword: selectedMedia?.caption || 'Live reply'
            };
        }

        if (prefetchedAutomation?.template_type) {
            return {
                ...prefetchedAutomation,
                keyword: selectedMedia?.caption || 'Live reply'
            };
        }

        return { template_type: 'template_text', template_content: 'Select a reply template to see preview...' };
    }, [prefetchedAutomation, previewTemplate, selectedMedia?.caption]);

    const handleTemplatesLoaded = useCallback((templates: ReplyTemplate[]) => {
        setReplyTemplatesList((current) => {
            const merged = new Map(current.map((template) => [template.id, template]));
            templates.forEach((template) => {
                merged.set(template.id, {
                    ...(merged.get(template.id) || {}),
                    ...template,
                    template_data: template.template_data && Object.keys(template.template_data || {}).length > 0
                        ? template.template_data
                        : merged.get(template.id)?.template_data
                });
            });
            return Array.from(merged.values());
        });
    }, []);

    const primeEditorResources = useCallback(async () => {
        if (!activeAccountID) return;
        await prefetchReplyTemplates(activeAccountID, authenticatedFetch);
    }, [activeAccountID, authenticatedFetch]);

    const handleDeletedAutomationFallback = useCallback(() => {
        setSelectedMedia(null);
        setEditorDirty(false);
        setShowLeaveModal(false);
        setSelectedTemplateId('');
        setPrefetchedAutomation(null);
        setPrefetchedTemplate(null);
        setHasUnsavedChanges(false);
        setMediaRefreshKey((value) => value + 1);
        setError('Automation not found. It may have been deleted.');
    }, [setHasUnsavedChanges]);

    const handleCreateAutomation = useCallback(async (media: any) => {
        const isEditingExisting = Boolean(media?.automation_id);
        setEditorLoadingMessage(isEditingExisting ? 'Loading live automation' : 'Opening live automation');
        setIsPreparingEditor(true);
        try {
            await primeEditorResources();
            let resolvedAutomation: any = null;
            let resolvedTemplate: ReplyTemplate | null = null;
            if (isEditingExisting && media?.automation_id) {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${media.automation_id}?account_id=${activeAccountID}&type=live`);
                if (!res.ok) {
                    if (res.status === 404) {
                        handleDeletedAutomationFallback();
                        return;
                    }
                    throw new Error('Failed to load automation.');
                }
                resolvedAutomation = await res.json();
                if (resolvedAutomation?.template_id) {
                    const templateRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${resolvedAutomation.template_id}?account_id=${activeAccountID}`);
                    if (templateRes.ok) {
                        resolvedTemplate = await templateRes.json();
                    }
                }
            }
            setPrefetchedAutomation(resolvedAutomation);
            setPrefetchedTemplate(resolvedTemplate);
            setSelectedMedia(media);
            setEditorDirty(false);
            setShowLeaveModal(false);
            setSelectedTemplateId('');
            setError(null);
            setSuccess(null);
        } catch (_) {
            setError('Could not open automation.');
        } finally {
            setIsPreparingEditor(false);
        }
    }, [activeAccountID, authenticatedFetch, handleDeletedAutomationFallback, primeEditorResources]);

    const closeEditor = useCallback(() => {
        setSelectedMedia(null);
        setEditorDirty(false);
        setShowLeaveModal(false);
        setSelectedTemplateId('');
        setPrefetchedAutomation(null);
        setPrefetchedTemplate(null);
        setHasUnsavedChanges(false);
    }, [setHasUnsavedChanges]);

    const requestClose = useCallback(() => {
        if (editorDirty) {
            setShowLeaveModal(true);
            return;
        }
        closeEditor();
    }, [closeEditor, editorDirty]);

    const handleEditorChange = (dirty: boolean) => {
        setEditorDirty(dirty);
        setHasUnsavedChanges(dirty);
    };

    const handleSave = useCallback(() => {
        setSelectedMedia(null);
        setEditorDirty(false);
        setShowLeaveModal(false);
        setSelectedTemplateId('');
        setPrefetchedAutomation(null);
        setPrefetchedTemplate(null);
        setHasUnsavedChanges(false);
        setSuccess('Automation saved successfully!');
    }, [setHasUnsavedChanges]);

    useEffect(() => {
        if (selectedMedia) {
            setSaveUnsavedChanges(() => async () => saveHandlerRef.current());
            setDiscardUnsavedChanges(() => () => {
                closeEditor();
            });
        } else {
            setEditorDirty(false);
            setShowLeaveModal(false);
            setHasUnsavedChanges(false);
            setSaveUnsavedChanges(() => async () => true);
            setDiscardUnsavedChanges(() => () => { });
        }
    }, [closeEditor, selectedMedia, setDiscardUnsavedChanges, setHasUnsavedChanges, setSaveUnsavedChanges]);

    useEffect(() => {
        if (!activeAccountID) return;
        const targetId = takeTransientState<string>('openAutomationId');
        const targetType = takeTransientState<string>('openAutomationType');
        if (!targetId || (targetType || '').toLowerCase() !== 'live') return;

        (async () => {
            setEditorLoadingMessage('Loading live automation');
            setIsPreparingEditor(true);
            try {
                const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${targetId}?account_id=${activeAccountID}&type=live`);
                if (res.ok) {
                    const data = await res.json();
                    const mediaId = data.media_id || data.mediaId || data.media?.id;
                    if (!mediaId) {
                        setError('Could not open automation: media not found.');
                        return;
                    }
                    await primeEditorResources();
                    let resolvedTemplate: ReplyTemplate | null = null;
                    if (data.template_id) {
                        const templateRes = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${data.template_id}?account_id=${activeAccountID}`);
                        if (templateRes.ok) {
                            resolvedTemplate = await templateRes.json();
                        }
                    }
                    setPrefetchedAutomation(data);
                    setPrefetchedTemplate(resolvedTemplate);
                    setSelectedMedia({
                        id: mediaId,
                        automation_id: targetId,
                        caption: data.caption || data.media_caption || ''
                    });
                    setError(null);
                } else {
                    if (res.status === 404) {
                        handleDeletedAutomationFallback();
                        return;
                    }
                    setError('Could not open automation.');
                }
            } catch (_) {
                setError('Could not open automation.');
            } finally {
                setIsPreparingEditor(false);
            }
        })();
    }, [activeAccountID, authenticatedFetch, handleDeletedAutomationFallback, primeEditorResources]);

    useEffect(() => {
        if (selectedMedia) {
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [selectedMedia]);

    if (isPreparingEditor) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message={editorLoadingMessage}
                subMessage="Preparing the automation editor and linked reply templates..."
            />
        );
    }

    if (selectedMedia && activeAccountID) {
        return (
            <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-screen">
                <AutomationToast message={success} variant="success" onClose={() => setSuccess(null)} />
                <AutomationToast message={error} variant="error" onClose={() => setError(null)} />
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                    <div className="xl:col-span-8 w-full min-w-0 space-y-8 xl:overflow-y-auto xl:pr-2">
                        <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8 xl:min-h-0">
                            <AutomationEditor
                                type="live"
                                variant="embedded"
                                activeAccountID={activeAccountID}
                                authenticatedFetch={authenticatedFetch}
                                automationId={selectedMedia?.automation_id}
                                mediaId={selectedMedia?.id}
                                initialAutomationData={prefetchedAutomation}
                                initialSelectedTemplate={prefetchedTemplate}
                                onClose={requestClose}
                                onSave={handleSave}
                                registerSaveHandler={(handler) => {
                                    saveHandlerRef.current = handler;
                                }}
                                onDelete={selectedMedia?.automation_id ? async (id) => {
                                    await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}&type=live`, {
                                        method: 'DELETE'
                                    });
                                    handleSave();
                                } : undefined}
                                onChange={handleEditorChange}
                                onTemplateSelect={(templateId) => setSelectedTemplateId(templateId || '')}
                                onTemplatesLoaded={handleTemplatesLoaded}
                                titleOverride=""
                                actionBarLeft={
                                    <button
                                        type="button"
                                        onClick={requestClose}
                                        className="p-3 rounded-2xl border-2 border-border hover:bg-muted/40 text-foreground transition-all hover:scale-105"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                }
                            />
                        </section>
                    </div>

                    <AutomationPreviewPanel minHeightClassName="min-h-[720px]">
                        <SharedMobilePreview
                            mode="automation"
                            automation={previewAutomation}
                            activeAccountID={activeAccountID}
                            authenticatedFetch={authenticatedFetch}
                            displayName={activeAccount?.username || 'your_account'}
                            profilePic={activeAccount?.profile_picture_url || undefined}
                            lockScroll
                            hideAutomationPrompt
                        />
                    </AutomationPreviewPanel>
                </div>
                <ModernConfirmModal
                    isOpen={showLeaveModal}
                    onClose={() => setShowLeaveModal(false)}
                    onConfirm={async () => {
                        const ok = await saveHandlerRef.current();
                        if (ok) {
                            setShowLeaveModal(false);
                        }
                    }}
                    onSecondary={() => {
                        setShowLeaveModal(false);
                        closeEditor();
                    }}
                    title="Unsaved changes"
                    description="Do you want to save before leaving?"
                    type="warning"
                    confirmLabel="Save"
                    secondaryLabel="Leave without saving"
                    cancelLabel="Cancel"
                />
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <AutomationToast message={success} variant="success" onClose={() => setSuccess(null)} />
            <AutomationToast message={error} variant="error" onClose={() => setError(null)} />
            <MediaSection
                key={`live-media-${activeAccountID || 'none'}-${mediaRefreshKey}`}
                title="Live Automation"
                type="live"
                onCreateAutomation={(media) => void handleCreateAutomation(media)}
            />
        </div>
    );
};

export default LiveAutomationView;
