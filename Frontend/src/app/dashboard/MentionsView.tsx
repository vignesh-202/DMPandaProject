import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AtSign, ArrowLeft, Power, Lightbulb, MessageSquare, Calendar, Info, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useNotification } from '../../contexts/NotificationContext';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import AutomationActionBar from '../../components/dashboard/AutomationActionBar';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import LockedFeatureToggle from '../../components/ui/LockedFeatureToggle';
import ModernConfirmModal from '../../components/ui/ModernConfirmModal';
import TemplateSelector, { fetchReplyTemplateById, ReplyTemplate } from '../../components/dashboard/TemplateSelector';
import { buildPreviewAutomationFromTemplate } from '../../lib/templatePreview';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

interface MentionsConfig {
    is_setup: boolean;
    is_active: boolean;
    template_id?: string;
    doc_id?: string;
    followers_only?: boolean;
    followers_only_message?: string;
    followers_only_primary_button_text?: string;
    followers_only_secondary_button_text?: string;
    suggest_more_enabled?: boolean;
    once_per_user_24h?: boolean;
    seen_typing_enabled?: boolean;
}

const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '?? Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "? I've Followed";

const MentionsView: React.FC = () => {
    const { authenticatedFetch } = useAuth();
    const { activeAccountID, activeAccount, setCurrentView, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges, getPlanGate } = useDashboard();

    const [config, setConfig] = useState<MentionsConfig>({ is_setup: false, is_active: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ReplyTemplate | null>(null);
    const [isSelectedTemplateLoading, setIsSelectedTemplateLoading] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(true);
    const [isActive, setIsActive] = useState(true);
    const [followersOnly, setFollowersOnly] = useState(false);
    const [followersOnlyMessage, setFollowersOnlyMessage] = useState(FOLLOWERS_ONLY_MESSAGE_DEFAULT);
    const [followersOnlyPrimaryButtonText, setFollowersOnlyPrimaryButtonText] = useState(FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT);
    const [followersOnlySecondaryButtonText, setFollowersOnlySecondaryButtonText] = useState(FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT);
    const [suggestMoreEnabled, setSuggestMoreEnabled] = useState(false);
    const [oncePerUser, setOncePerUser] = useState(true);
    const [seenTypingEnabled, setSeenTypingEnabled] = useState(false);
    const [followersOnlyCollapsed, setFollowersOnlyCollapsed] = useState(false);
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
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/mentions-config?account_id=${activeAccountID}`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
                setIsActive(data.is_active || false);
                setFollowersOnly(Boolean(data.followers_only));
                setFollowersOnlyMessage(String(data.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT));
                setFollowersOnlyPrimaryButtonText(String(data.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT));
                setFollowersOnlySecondaryButtonText(String(data.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT));
                setSuggestMoreEnabled(Boolean(data.suggest_more_enabled));
                setOncePerUser(data.once_per_user_24h !== undefined ? Boolean(data.once_per_user_24h) : true);
                setSeenTypingEnabled(Boolean(data.seen_typing_enabled));
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
            console.error('Error fetching mentions config:', err);
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
        is_active: isActive,
        followers_only: followersOnly,
        followers_only_message: followersOnly ? followersOnlyMessage : '',
        followers_only_primary_button_text: followersOnlyPrimaryButtonText,
        followers_only_secondary_button_text: followersOnlySecondaryButtonText,
        suggest_more_enabled: suggestMoreEnabled,
        once_per_user_24h: oncePerUser,
        seen_typing_enabled: seenTypingEnabled
    }), [followersOnly, followersOnlyMessage, followersOnlyPrimaryButtonText, followersOnlySecondaryButtonText, isActive, oncePerUser, seenTypingEnabled, selectedTemplate?.id, suggestMoreEnabled]);

    const isDirty = !isLoading && !isSaving && !!initialState && initialState !== currentState;

    useEffect(() => {
        setInitialState(JSON.stringify({
            template_id: config.template_id || null,
            is_active: Boolean(config.is_active),
            followers_only: Boolean(config.followers_only),
            followers_only_message: String(config.followers_only_message || ''),
            followers_only_primary_button_text: String(config.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
            followers_only_secondary_button_text: String(config.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
            suggest_more_enabled: Boolean(config.suggest_more_enabled),
            once_per_user_24h: config.once_per_user_24h !== undefined ? Boolean(config.once_per_user_24h) : true,
            seen_typing_enabled: Boolean(config.seen_typing_enabled)
        }));
    }, [config]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!activeAccountID) return false;

        if (!selectedTemplate) {
            showError('Please select a reply template');
            setTimeout(() => {
                const el = document.getElementById('field_template') || document.querySelector('.border-dashed, [class*="border-dashed"]');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            return false;
        }

        setIsSaving(true);
        try {
            const res = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/mentions-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: activeAccountID,
                    template_id: selectedTemplate.id,
                    template_type: selectedTemplate.template_type,
                    is_active: isActive,
                    followers_only: followersOnly,
                    followers_only_message: followersOnly ? followersOnlyMessage : '',
                    followers_only_primary_button_text: followersOnlyPrimaryButtonText,
                    followers_only_secondary_button_text: followersOnlySecondaryButtonText,
                    suggest_more_enabled: suggestMoreEnabled,
                    once_per_user_24h: oncePerUser,
                    seen_typing_enabled: seenTypingEnabled
                })
            });

            if (res.ok) {
                showSuccess('Mentions template saved successfully!');
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
    }, [activeAccountID, authenticatedFetch, currentState, fetchConfig, followersOnly, followersOnlyMessage, followersOnlyPrimaryButtonText, followersOnlySecondaryButtonText, isActive, oncePerUser, seenTypingEnabled, selectedTemplate, setHasUnsavedChanges, suggestMoreEnabled]);

    useEffect(() => {
        setHasUnsavedChanges(isDirty);
        setSaveUnsavedChanges(() => handleSave);
        setDiscardUnsavedChanges(() => () => {
            setIsActive(Boolean(config.is_active));
            setFollowersOnly(Boolean(config.followers_only));
            setFollowersOnlyMessage(String(config.followers_only_message || FOLLOWERS_ONLY_MESSAGE_DEFAULT));
            setFollowersOnlyPrimaryButtonText(String(config.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT));
            setFollowersOnlySecondaryButtonText(String(config.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT));
            setSuggestMoreEnabled(Boolean(config.suggest_more_enabled));
            setOncePerUser(config.once_per_user_24h !== undefined ? Boolean(config.once_per_user_24h) : true);
            setSeenTypingEnabled(Boolean(config.seen_typing_enabled));
            const restoredTemplate = config.template_id ? (templateCacheRef.current[config.template_id] || null) : null;
            setSelectedTemplate(restoredTemplate);
            setIsSelectedTemplateLoading(false);
            setShowTemplateSelector(!restoredTemplate);
        });
    }, [config, handleSave, isDirty, setDiscardUnsavedChanges, setHasUnsavedChanges, setSaveUnsavedChanges]);

    const handleDelete = () => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Configuration?',
            description: 'This will remove your Mentions template. You can always create a new one.',
            type: 'danger',
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
                setIsSaving(true);
                try {
                    await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/mentions-config?account_id=${activeAccountID}`, {
                        method: 'DELETE'
                    });
                    setConfig({ is_setup: false, is_active: false });
                    setSelectedTemplate(null);
                    setFollowersOnly(false);
                    setFollowersOnlyMessage(FOLLOWERS_ONLY_MESSAGE_DEFAULT);
                    setFollowersOnlyPrimaryButtonText(FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT);
                    setFollowersOnlySecondaryButtonText(FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT);
                    setSuggestMoreEnabled(false);
                    setOncePerUser(false);
                    setSeenTypingEnabled(false);
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
                message="Loading Mentions"
                subMessage="Fetching your mentions response template..."
            />
        );
    }

    // Preview data for SharedMobilePreview
    const previewItem = buildPreviewAutomationFromTemplate(selectedTemplate);
    const suggestMoreGate = getPlanGate('suggest_more', 'Upgrade your plan to enable Suggest More.');
    const seenTypingGate = getPlanGate('seen_typing', 'Upgrade your plan to enable seen and typing reactions.');

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
                            showSave={isDirty}
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
                                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Mentions</h1>
                                    <p className="text-muted-foreground text-sm font-normal">Auto-reply when someone mentions you.</p>
                                </div>
                            }
                        />
                    </div>
                    {/* Active Toggle */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start gap-3 sm:items-center">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                <AtSign className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground">Enable Mentions Response</p>
                                <p className="text-xs font-normal text-muted-foreground">When enabled, auto-reply to story/post mentions</p>
                            </div>
                        </div>
                        <div className="flex w-full justify-end sm:w-auto">
                            <ToggleSwitch
                                isChecked={isActive}
                                onChange={() => setIsActive(!isActive)}
                            />
                        </div>
                    </div>

                    {/* Followers Only Options */}
                    <div className="space-y-3">
                        <LockedFeatureToggle
                            icon={<Power className={`w-5 h-5 ${followersOnly ? 'text-primary' : 'text-muted-foreground'}`} />}
                            title="Followers Only"
                            description="Only trigger reply for users who follow your account."
                            checked={followersOnly}
                            onToggle={() => {
                                const nextVal = !followersOnly;
                                setFollowersOnly(nextVal);
                                if (nextVal) {
                                    setFollowersOnlyCollapsed(false);
                                }
                            }}
                            locked={getPlanGate('followers_only').isLocked}
                            note={getPlanGate('followers_only').note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-primary"
                            isCollapsed={followersOnlyCollapsed}
                            onCollapseToggle={() => setFollowersOnlyCollapsed(!followersOnlyCollapsed)}
                        />

                        {followersOnly && !getPlanGate('followers_only').isLocked && !followersOnlyCollapsed && (
                            <div className="ml-2 rounded-xl border border-border bg-card p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-foreground">Follower Gate Prompt</label>
                                    <textarea
                                        value={followersOnlyMessage}
                                        onChange={(e) => setFollowersOnlyMessage(e.target.value)}
                                        className="input-base min-h-[90px] text-sm"
                                        placeholder={FOLLOWERS_ONLY_MESSAGE_DEFAULT}
                                    />
                                    <p className="text-xs text-muted-foreground">{new Blob([followersOnlyMessage]).size}/1000 bytes</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-foreground">Follow Button Label</label>
                                        <input
                                            value={followersOnlyPrimaryButtonText}
                                            onChange={(e) => setFollowersOnlyPrimaryButtonText(e.target.value)}
                                            className="input-base text-sm"
                                            placeholder={FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-foreground">Verify Button Label</label>
                                        <input
                                            value={followersOnlySecondaryButtonText}
                                            onChange={(e) => setFollowersOnlySecondaryButtonText(e.target.value)}
                                            className="input-base text-sm"
                                            placeholder={FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Suggest More Toggle */}
                    <div className="space-y-3">
                        <LockedFeatureToggle
                            icon={<Lightbulb className={`w-5 h-5 ${suggestMoreEnabled ? 'text-warning' : 'text-muted-foreground'}`} />}
                            title="Suggest More"
                            description="Automatically suggest more products, links, or resources based on your configuration."
                            checked={suggestMoreEnabled}
                            onToggle={() => setSuggestMoreEnabled(!suggestMoreEnabled)}
                            locked={suggestMoreGate.isLocked}
                            note={suggestMoreGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-warning"
                        />
                        {suggestMoreEnabled && !suggestMoreGate.isLocked && (
                            <div className="ml-2 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-muted/20 px-4 py-3">
                                <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                <p className="text-xs font-medium text-foreground">Suggest More must be configured in the <button type="button" onClick={() => setCurrentView('Suggest More')} className="underline hover:no-underline font-semibold text-primary">Suggest More</button> section for this toggle to take effect.</p>
                            </div>
                        )}
                    </div>

                    <LockedFeatureToggle
                        icon={<Calendar className={`w-5 h-5 ${oncePerUser ? 'text-primary' : 'text-muted-foreground'}`} />}
                        title="Once Per User (24h)"
                        description="Prevent the same person from retriggering this automation again for 24 hours. Turn on to save action limits."
                        checked={oncePerUser}
                        onToggle={() => setOncePerUser(!oncePerUser)}
                        locked={getPlanGate('once_per_user_24h').isLocked}
                        note={getPlanGate('once_per_user_24h').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-primary"
                    />

                    <LockedFeatureToggle
                        icon={<MessageSquare className={`w-5 h-5 ${seenTypingEnabled ? 'text-primary' : 'text-muted-foreground'}`} />}
                        title="Seen + Typing Reaction"
                        description="Simulate seen and typing indicators before sending the automated reply."
                        checked={seenTypingEnabled}
                        onToggle={() => setSeenTypingEnabled(!seenTypingEnabled)}
                        locked={seenTypingGate.isLocked}
                        note={seenTypingGate.note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-primary"
                    />

                    {/* Template Selector */}
                    <div id="field_template" className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <label className="block text-xs font-medium text-foreground">
                                Select Reply Action
                            </label>
                            {selectedTemplate && !showTemplateSelector && (
                                <button
                                    type="button"
                                    onClick={() => setShowTemplateSelector(true)}
                                    className="text-xs font-medium text-primary hover:underline"
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
                            <p className="text-xs text-muted-foreground font-normal mt-2">
                                Choose an existing template or create a new one to use for Mentions responses.
                            </p>
                        )}
                        {selectedTemplate && !showTemplateSelector && (
                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{selectedTemplate.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{selectedTemplate.template_type.replace('template_', '').replace('_', ' ')}</p>
                                </div>
                                <div className="self-start sm:self-auto px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-md">Selected</div>
                            </div>
                        )}
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5">
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-normal">
                                Reply templates sent from automations include the workspace watermark unless the account is on a premium plan with watermark removal.
                            </p>
                        </div>
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
                            automation={{ keyword: 'Mentioned you' }}
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
        </div>
    );
};

export default MentionsView;

