import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb, Loader2, Save, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import { useNavigate } from 'react-router-dom';

interface SuggestMoreConfig {
    is_setup: boolean;
    is_active: boolean;
    template_id?: string;
    doc_id?: string;
}

const SuggestMoreView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount, setCurrentView } = useDashboard();

    const [config, setConfig] = useState<SuggestMoreConfig>({ is_setup: false, is_active: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [isActive, setIsActive] = useState(true);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

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
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/suggest-more?account_id=${activeAccountID}`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                setIsActive(data.is_active || false);
                lastFetchedAccountIdRef.current = activeAccountID;

                // If template_id exists, fetch the template
                if (data.template_id) {
                    try {
                        if (templateCacheRef.current[data.template_id]) {
                            setSelectedTemplate(templateCacheRef.current[data.template_id]);
                        } else {
                            const templateRes = await authenticatedFetch(
                                `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${data.template_id}?account_id=${activeAccountID}`
                            );
                            if (templateRes.ok) {
                                const templateData = await templateRes.json();
                                templateCacheRef.current[data.template_id] = templateData;
                                setSelectedTemplate(templateData);
                            }
                        }
                    } catch (err) {
                        console.error('Error fetching template:', err);
                    }
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

    const handleSave = async () => {
        if (!activeAccountID) return;

        if (!selectedTemplate) {
            setError('Please select a reply template');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/suggest-more`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: activeAccountID,
                    template_id: selectedTemplate.id,
                    is_active: isActive
                })
            });

            if (res.ok) {
                setSuccess('Suggest More saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
                fetchConfig();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setIsSaving(false);
        }
    };

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
                    await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/suggest-more?account_id=${activeAccountID}`, {
                        method: 'DELETE'
                    });
                    setConfig({ is_setup: false, is_active: false });
                    setSelectedTemplate(null);
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
    const previewItem = selectedTemplate ? {
        template_type: selectedTemplate.template_type as any,
        template_content: selectedTemplate.template_type === 'template_text' ? selectedTemplate.template_data?.text :
            selectedTemplate.template_type === 'template_media' ? selectedTemplate.template_data?.media_url :
                selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.text : undefined,
        template_elements: selectedTemplate.template_type === 'template_carousel' ? selectedTemplate.template_data?.elements : undefined,
        replies: selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.replies : undefined,
        buttons: selectedTemplate.template_type === 'template_buttons' ? selectedTemplate.template_data?.buttons : undefined,
        media_id: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_id : undefined,
        media_url: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_url : undefined,
        template_data: selectedTemplate.template_data
    } : null;

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                <div>
                    <div className="flex items-center gap-2 text-warning mb-2">
                        <Lightbulb className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Suggest More</span>
                    </div>
                    <h1 className="text-3xl font-black text-foreground">Suggest More Template</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Configure the response template users receive when they tap "Suggest More"
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {config.is_setup && (
                        <button
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="px-6 py-3 bg-destructive text-destructive-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-xl shadow-destructive/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Template
                    </button>
                </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="flex items-center gap-2 p-4 bg-success-muted/60 border border-success/30 rounded-xl text-success">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-bold">{success}</span>
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-destructive-muted/40 border border-destructive/30 rounded-xl text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Editor Section */}
                <div className="flex-1 space-y-6">
                    {/* Active Toggle */}
                    <div className="flex items-center justify-between bg-primary/10 p-5 rounded-2xl border border-primary/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-card rounded-2xl shadow-sm">
                                <Lightbulb className={`w-5 h-5 ${isActive ? 'text-warning' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-foreground uppercase tracking-[0.15em]">Enable Suggest More</p>
                                <p className="text-[10px] font-medium text-muted-foreground">When enabled, users will see this response</p>
                            </div>
                        </div>
                        <ToggleSwitch
                            isChecked={isActive}
                            onChange={() => setIsActive(!isActive)}
                            variant="plain"
                        />
                    </div>

                    {/* Template Selector */}
                    <div className="bg-card border border-content rounded-2xl p-6 space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                            Select Reply Template
                        </label>
                        <TemplateSelector
                            selectedTemplateId={selectedTemplate?.id}
                            onSelect={setSelectedTemplate}
                            onCreateNew={() => {
                                setCurrentView('Reply Templates');
                            }}
                        />
                        {!selectedTemplate && (
                            <p className="text-xs text-muted-foreground font-medium mt-2">
                                Choose an existing template or create a new one to use for Suggest More responses.
                            </p>
                        )}
                    </div>
                </div>

                {/* Preview Section */}
                <div className="xl:w-[380px]">
                    <div className="sticky top-24">
                        <div className="text-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live Preview</span>
                        </div>
                        {previewItem ? (
                            <SharedMobilePreview
                                mode="automation"
                                automation={previewItem}
                                profilePic={activeAccount?.profile_picture_url}
                                displayName={activeAccount?.username || 'username'}
                            />
                        ) : (

                            <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                                <SharedMobilePreview
                                    mode="automation"
                                    automation={{ keyword: 'Suggest More' }}
                                    profilePic={activeAccount?.profile_picture_url || undefined}
                                    displayName={activeAccount?.username || 'username'}
                                />
                            </div>
                        )}
                    </div>
                </div>
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

