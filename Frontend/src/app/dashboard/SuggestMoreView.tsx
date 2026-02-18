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
    const { activeAccountID, activeAccount } = useDashboard();
    const navigate = useNavigate();
    
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
    }>({ isOpen: false, title: '', description: '', type: 'info', onConfirm: () => {} });
    const fetchingRef = useRef(false);
    const lastFetchedAccountIdRef = useRef<string | null>(null);

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
                        const templateRes = await authenticatedFetch(
                            `${import.meta.env.VITE_API_BASE_URL}/api/instagram/reply-templates/${data.template_id}`
                        );
                        if (templateRes.ok) {
                            const templateData = await templateRes.json();
                            setSelectedTemplate(templateData);
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
        template_type: selectedTemplate.template_type,
        template_content: selectedTemplate.template_type === 'template_text' ? selectedTemplate.template_data?.text : 
                          selectedTemplate.template_type === 'template_media' ? selectedTemplate.template_data?.media_url :
                          selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.text : undefined,
        template_elements: selectedTemplate.template_type === 'template_carousel' ? selectedTemplate.template_data?.elements : undefined,
        replies: selectedTemplate.template_type === 'template_quick_replies' ? selectedTemplate.template_data?.replies : undefined,
        buttons: selectedTemplate.template_type === 'template_buttons' ? selectedTemplate.template_data?.buttons : undefined,
        media_id: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_id : undefined,
        media_url: selectedTemplate.template_type === 'template_share_post' ? selectedTemplate.template_data?.media_url : undefined,
    } : null;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 dark:border-slate-700 pb-8">
                <div>
                    <div className="flex items-center gap-2 text-yellow-500 mb-2">
                        <Lightbulb className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Suggest More</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Suggest More Template</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Configure the response template users receive when they tap "Suggest More"
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {config.is_setup && (
                        <button
                            onClick={handleDelete}
                            disabled={isSaving}
                            className="px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 flex items-center gap-2 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-70"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Template
                    </button>
                </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-bold">{success}</span>
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            {/* Main Content */}
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Editor Section */}
                <div className="flex-1 space-y-6">
                    {/* Active Toggle */}
                    <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5 p-5 rounded-2xl border border-blue-100 dark:border-blue-500/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
                                <Lightbulb className={`w-5 h-5 ${isActive ? 'text-yellow-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-[0.15em]">Enable Suggest More</p>
                                <p className="text-[10px] font-medium text-gray-400">When enabled, users will see this response</p>
                            </div>
                        </div>
                        <ToggleSwitch
                            isChecked={isActive}
                            onChange={() => setIsActive(!isActive)}
                            variant="plain"
                        />
                    </div>

                    {/* Template Selector */}
                    <div className="bg-white dark:bg-gray-950 border border-content rounded-2xl p-6 space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                            Select Reply Template
                        </label>
                        <TemplateSelector
                            selectedTemplateId={selectedTemplate?.id}
                            onSelect={setSelectedTemplate}
                            onCreateNew={() => {
                                navigate('/dashboard?view=Reply Templates');
                            }}
                        />
                        {!selectedTemplate && (
                            <p className="text-xs text-gray-400 font-medium mt-2">
                                Choose an existing template or create a new one to use for Suggest More responses.
                            </p>
                        )}
                    </div>
                </div>

                {/* Preview Section */}
                <div className="xl:w-[380px]">
                    <div className="sticky top-24">
                        <div className="text-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Preview</span>
                        </div>
                        {previewItem ? (
                            <SharedMobilePreview
                                mode="automation"
                                automation={previewItem}
                                profilePic={activeAccount?.profile_picture_url}
                                displayName={activeAccount?.username || 'username'}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-sm font-bold text-gray-400 text-center">
                                    Select a template to see preview
                                </p>
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
        </div>
    );
};

export default SuggestMoreView;
