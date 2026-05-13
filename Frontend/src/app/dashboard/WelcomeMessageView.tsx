import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Power, Lightbulb, ArrowLeft, Info, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationActionBar from '../../components/dashboard/AutomationActionBar';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import LockedFeatureToggle from '../../components/ui/LockedFeatureToggle';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import AutomationToast from '../../components/ui/AutomationToast';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '👤 Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "✅ I've Followed";

const WelcomeMessageView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount, setCurrentView, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges, getPlanGate } = useDashboard();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [isSelectedTemplateLoading, setIsSelectedTemplateLoading] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(true);
    const [automationId, setAutomationId] = useState<string | null>(null);
    const [followersOnly, setFollowersOnly] = useState(false);
    const [followersOnlyMessage, setFollowersOnlyMessage] = useState(FOLLOWERS_ONLY_MESSAGE_DEFAULT);
    const [followersOnlyPrimaryButtonText, setFollowersOnlyPrimaryButtonText] = useState(FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT);
    const [followersOnlySecondaryButtonText, setFollowersOnlySecondaryButtonText] = useState(FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT);
    const [suggestMoreEnabled, setSuggestMoreEnabled] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialState, setInitialState] = useState('');
    useDashboardMainScrollLock(true);

    const templateCacheRef = useRef<Record<string, ReplyTemplate>>({});
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        type: 'danger' | 'info' | 'warning' | 'success';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', description: '', type: 'info', onConfirm: () => { } });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const fetchConfig = useCallback(async () => {
        if (!activeAccountID) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations?account_id=${activeAccountID}&type=welcome_message`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Failed to load welcome message.');
            }

            const data = await res.json();
            const automation = Array.isArray(data?.automations) ? data.automations[0] : null;
            setAutomationId(automation?.$id || null);
            setIsActive(automation?.is_active !== false);
            setFollowersOnly(Boolean(automation?.followers_only));
            setFollowersOnlyMessage(String(automation?.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT));
            setFollowersOnlyPrimaryButtonText(String(automation?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT));
            setFollowersOnlySecondaryButtonText(String(automation?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT));
            setSuggestMoreEnabled(Boolean(automation?.suggest_more_enabled));
            setInitialState(JSON.stringify({
                template_id: automation?.template_id || null,
                is_active: automation?.is_active !== false,
                followers_only: Boolean(automation?.followers_only),
                followers_only_message: automation?.followers_only ? String(automation?.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT) : '',
                followers_only_primary_button_text: String(automation?.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
                followers_only_secondary_button_text: String(automation?.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
                suggest_more_enabled: Boolean(automation?.suggest_more_enabled)
            }));

            const templateId = String(automation?.template_id || '').trim();
            if (templateId) {
                setIsSelectedTemplateLoading(true);
                if (templateCacheRef.current[templateId]) {
                    setSelectedTemplate(templateCacheRef.current[templateId]);
                    setIsSelectedTemplateLoading(false);
                    setShowTemplateSelector(false);
                } else {
                    const templateData = await fetchReplyTemplateById(activeAccountID, authenticatedFetch, templateId);
                    if (templateData) {
                        templateCacheRef.current[templateId] = templateData;
                        setSelectedTemplate(templateData);
                        setShowTemplateSelector(false);
                    } else {
                        setSelectedTemplate(null);
                        setShowTemplateSelector(true);
                    }
                }
            } else {
                setSelectedTemplate(null);
                setIsSelectedTemplateLoading(false);
                setShowTemplateSelector(true);
            }
        } catch (err: any) {
            setError(String(err?.message || 'Failed to load welcome message.'));
        } finally {
            setIsSelectedTemplateLoading(false);
            setIsLoading(false);
        }
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const currentState = useMemo(() => JSON.stringify({
        template_id: selectedTemplate?.id || null,
        is_active: isActive,
        followers_only: followersOnly,
        followers_only_message: followersOnly ? followersOnlyMessage : '',
        followers_only_primary_button_text: followersOnlyPrimaryButtonText,
        followers_only_secondary_button_text: followersOnlySecondaryButtonText,
        suggest_more_enabled: suggestMoreEnabled
    }), [followersOnly, followersOnlyMessage, followersOnlyPrimaryButtonText, followersOnlySecondaryButtonText, isActive, selectedTemplate?.id, suggestMoreEnabled]);

    const isDirty = !!initialState && initialState !== currentState;

    useEffect(() => {
        setHasUnsavedChanges(isDirty);
        setSaveUnsavedChanges(() => handleSave);
        setDiscardUnsavedChanges(() => () => {
            fetchConfig();
        });
    }, [fetchConfig, isDirty, setDiscardUnsavedChanges, setHasUnsavedChanges, setSaveUnsavedChanges]);

    async function handleSave() {
        if (!activeAccountID) return false;
        if (!selectedTemplate) {
            setError('Please select a reply template for the welcome message.');
            return false;
        }

        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                title: 'Welcome Message',
                template_id: selectedTemplate.id,
                template_type: selectedTemplate.template_type,
                is_active: isActive,
                followers_only: followersOnly,
                followers_only_message: followersOnly ? followersOnlyMessage : '',
                followers_only_primary_button_text: followersOnlyPrimaryButtonText,
                followers_only_secondary_button_text: followersOnlySecondaryButtonText,
                suggest_more_enabled: suggestMoreEnabled,
                private_reply_enabled: true,
                automation_type: 'welcome_message',
                once_per_user_24h: true
            };

            const url = automationId
                ? `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${automationId}?account_id=${activeAccountID}`
                : `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations?account_id=${activeAccountID}&type=welcome_message`;

            const res = await authenticatedFetch(url, {
                method: automationId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Failed to save welcome message.');
            }

            setSuccess(automationId ? 'Welcome message updated.' : 'Welcome message created.');
            setInitialState(currentState);
            setHasUnsavedChanges(false);
            await fetchConfig();
            return true;
        } catch (err: any) {
            setError(String(err?.message || 'Failed to save welcome message.'));
            return false;
        } finally {
            setIsSaving(false);
        }
    }

    const handleDelete = () => {
        if (!automationId || !activeAccountID) return;
        setModalConfig({
            isOpen: true,
            title: 'Delete Welcome Message?',
            description: 'This will remove the welcome message automation for this Instagram account.',
            type: 'danger',
            onConfirm: async () => {
                closeModal();
                setIsSaving(true);
                try {
                    await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${automationId}?account_id=${activeAccountID}`, {
                        method: 'DELETE'
                    });
                    setAutomationId(null);
                    setSelectedTemplate(null);
                    setIsActive(true);
                    setFollowersOnly(false);
                    setFollowersOnlyMessage(FOLLOWERS_ONLY_MESSAGE_DEFAULT);
                    setFollowersOnlyPrimaryButtonText(FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT);
                    setFollowersOnlySecondaryButtonText(FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT);
                    setSuggestMoreEnabled(false);
                    setInitialState(JSON.stringify({
                        template_id: null,
                        is_active: true,
                        followers_only: false,
                        followers_only_message: '',
                        followers_only_primary_button_text: FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT,
                        followers_only_secondary_button_text: FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT,
                        suggest_more_enabled: false
                    }));
                    setHasUnsavedChanges(false);
                } catch (err) {
                    setError('Failed to delete welcome message.');
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
                message="Loading Welcome Message"
                subMessage="Preparing your fallback welcome automation..."
            />
        );
    }

    const previewItem = buildPreviewAutomationFromTemplate(selectedTemplate);
    const suggestMoreGate = getPlanGate('suggest_more', 'Upgrade your plan to enable Suggest More on the welcome flow.');

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8">
            <AutomationToast message={success} variant="success" onClose={() => setSuccess(null)} />
            <AutomationToast message={error} variant="error" onClose={() => setError(null)} />
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                <div className="xl:col-span-8 w-full min-w-0 space-y-6 xl:overflow-y-auto xl:pr-2">
                    <div className="pb-2">
                        <AutomationActionBar
                            hasExisting={Boolean(automationId)}
                            isSaving={isSaving}
                            onSave={handleSave}
                            onDelete={automationId ? handleDelete : undefined}
                            leftContent={
                                <button
                                    type="button"
                                    onClick={() => setCurrentView('Overview')}
                                    className="p-3 rounded-2xl border-2 border-border hover:bg-muted/40 text-foreground transition-all hover:scale-105"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            }
                            centerContent={
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-primary mb-1">
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Welcome Message</span>
                                    </div>
                                    <h1 className="text-xl font-black text-foreground">Welcome Message</h1>
                                    <p className="text-muted-foreground text-sm">Runs when no other automation or global trigger matches.</p>
                                </div>
                            }
                        />
                    </div>
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4">
                        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                            This welcome message is sent only once per user in 24 hours.
                        </p>
                    </div>

                    {/* Active Toggle */}
                    <div className={`flex items-center justify-between rounded-[28px] border border-content/70 bg-muted/40 p-5 transition-all hover:bg-muted/55 ${isActive ? 'ring-1 ring-primary/15' : ''}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-2xl shadow-sm border ${isActive
                                ? 'bg-white dark:bg-gray-900 border-emerald-100 dark:border-emerald-500/10'
                                : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                                <Sparkles className={`w-5 h-5 transition-colors ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-foreground uppercase tracking-[0.15em] mb-0.5">Enable Welcome Message</p>
                                <p className="text-[10px] font-medium text-muted-foreground">When enabled, auto-reply to new conversations with no matching automation.</p>
                            </div>
                        </div>
                        <ToggleSwitch
                            isChecked={isActive}
                            onChange={() => setIsActive(!isActive)}
                            variant="plain"
                        />
                    </div>

                    <LockedFeatureToggle
                        icon={<Power className={`w-5 h-5 ${followersOnly ? 'text-blue-500' : 'text-gray-400'}`} />}
                        title="Followers Only"
                        description="Only respond to users who already follow your account."
                        checked={followersOnly}
                        onToggle={() => setFollowersOnly(!followersOnly)}
                        locked={getPlanGate('followers_only').isLocked}
                        note={getPlanGate('followers_only').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-blue-500"
                    />

                    {followersOnly && (
                        <div className="bg-card border border-content rounded-2xl p-6 space-y-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Followers-Only Message
                            </label>
                            <textarea
                                value={followersOnlyMessage}
                                onChange={(e) => setFollowersOnlyMessage(e.target.value)}
                                className="input-base min-h-[96px] text-sm"
                                placeholder={FOLLOWERS_ONLY_MESSAGE_DEFAULT}
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                                <input
                                    value={followersOnlyPrimaryButtonText}
                                    onChange={(e) => setFollowersOnlyPrimaryButtonText(e.target.value)}
                                    className="input-base text-sm"
                                    placeholder={FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT}
                                />
                                <input
                                    value={followersOnlySecondaryButtonText}
                                    onChange={(e) => setFollowersOnlySecondaryButtonText(e.target.value)}
                                    className="input-base text-sm"
                                    placeholder={FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <LockedFeatureToggle
                            icon={<Lightbulb className={`w-5 h-5 ${suggestMoreEnabled ? 'text-yellow-500' : 'text-gray-400'}`} />}
                            title="Suggest More"
                            description="Add a Suggest More button after this automation reply."
                            checked={suggestMoreEnabled}
                            onToggle={() => setSuggestMoreEnabled(!suggestMoreEnabled)}
                            locked={suggestMoreGate.isLocked}
                            note={suggestMoreGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-yellow-500"
                        />
                        {suggestMoreEnabled && !suggestMoreGate.isLocked && (
                            <div className="ml-2 flex items-center gap-2 rounded-2xl border border-yellow-200 dark:border-yellow-500/20 bg-yellow-50/60 dark:bg-yellow-500/5 px-4 py-3">
                                <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                                <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-300">Suggest More must be configured in the <button type="button" onClick={() => setCurrentView('Suggest More')} className="underline hover:no-underline font-black">Suggest More</button> section for this toggle to take effect.</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-card border border-content rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Select Reply Action
                            </label>
                            {selectedTemplate && !showTemplateSelector && (
                                <button
                                    type="button"
                                    onClick={() => setShowTemplateSelector(true)}
                                    className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
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
                                onCreateNew={() => setCurrentView('Reply Templates')}
                            />
                        )}
                        {!selectedTemplate && (
                            <p className="text-xs text-muted-foreground font-medium">
                                Choose an existing template or create one to use as the welcome reply.
                            </p>
                        )}
                        {selectedTemplate && !showTemplateSelector && (
                            <div className="p-6 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-black text-foreground uppercase tracking-tight">{selectedTemplate.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedTemplate.template_type.replace('template_', '')}</p>
                                </div>
                                <div className="px-3 py-1.5 bg-success-muted/60 text-success text-[9px] font-black uppercase tracking-widest rounded-lg">Selected</div>
                            </div>
                        )}
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                Reply templates sent from automations include the workspace watermark unless the account is on a premium plan with watermark removal.
                            </p>
                        </div>
                    </div>
                </div>

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
                            automation={{ keyword: 'Welcome message' }}
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
                onClose={closeModal}
            />
        </div>
    );
};

export default WelcomeMessageView;

