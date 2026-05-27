import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AtSign, ArrowLeft, Power, Lightbulb, Mail, MessageSquare, Calendar, Info, Loader2 } from 'lucide-react';
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
    collect_email_enabled?: boolean;
    collect_email_only_gmail?: boolean;
    collect_email_prompt_message?: string;
    collect_email_fail_retry_message?: string;
    collect_email_success_reply_message?: string;
    seen_typing_enabled?: boolean;
}

type CollectorDestinationState = {
    destination_type: 'webhook';
    webhook_url: string;
    verified: boolean;
    verified_at: string | null;
    destination_json: Record<string, unknown>;
    verification_token: string | null;
    verification_expires_at: string | null;
};

const FOLLOWERS_ONLY_MESSAGE_DEFAULT = 'Please follow this account first, then send your message again.';
const FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT = '?? Follow Account';
const FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT = "? I've Followed";
const COLLECT_EMAIL_PROMPT_DEFAULT = '?? Could you share your best email so we can send the details and updates ?';
const COLLECT_EMAIL_FAIL_RETRY_DEFAULT = '?? That email looks invalid. Please send a valid email like name@example.com.';
const COLLECT_EMAIL_SUCCESS_DEFAULT = 'Perfect, thank you! Your email has been saved ?';
const createCollectorDestinationState = (): CollectorDestinationState => ({
    destination_type: 'webhook',
    webhook_url: '',
    verified: false,
    verified_at: null,
    destination_json: {},
    verification_token: null,
    verification_expires_at: null
});

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
    const [oncePerUser, setOncePerUser] = useState(false);
    const [collectEmailEnabled, setCollectEmailEnabled] = useState(false);
    const [collectEmailOnlyGmail, setCollectEmailOnlyGmail] = useState(false);
    const [collectEmailPromptMessage, setCollectEmailPromptMessage] = useState(COLLECT_EMAIL_PROMPT_DEFAULT);
    const [collectEmailFailRetryMessage, setCollectEmailFailRetryMessage] = useState(COLLECT_EMAIL_FAIL_RETRY_DEFAULT);
    const [collectEmailSuccessReplyMessage, setCollectEmailSuccessReplyMessage] = useState(COLLECT_EMAIL_SUCCESS_DEFAULT);
    const [seenTypingEnabled, setSeenTypingEnabled] = useState(false);
    const [followersOnlyCollapsed, setFollowersOnlyCollapsed] = useState(false);
    const [collectEmailCollapsed, setCollectEmailCollapsed] = useState(false);
    const [collectorDestination, setCollectorDestination] = useState<CollectorDestinationState>(createCollectorDestinationState());
    const [collectorDestinationLoading, setCollectorDestinationLoading] = useState(false);
    const [collectorDestinationSaving, setCollectorDestinationSaving] = useState(false);
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
                setOncePerUser(Boolean(data.once_per_user_24h));
                setCollectEmailEnabled(Boolean(data.collect_email_enabled));
                setCollectEmailOnlyGmail(Boolean(data.collect_email_only_gmail));
                setCollectEmailPromptMessage(String(data.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT));
                setCollectEmailFailRetryMessage(String(data.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT));
                setCollectEmailSuccessReplyMessage(String(data.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT));
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

    useEffect(() => {
        let alive = true;
        const loadCollectorDestination = async () => {
            if (!config.doc_id) {
                setCollectorDestination(createCollectorDestinationState());
                setCollectorDestinationLoading(false);
                return;
            }

            setCollectorDestinationLoading(true);
            try {
                const res = await authenticatedFetch(
                    `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${config.doc_id}/email-collector-destination`
                );
                const data = await res.json();
                if (!alive) return;
                if (res.ok && data?.destination) {
                    setCollectorDestination({
                        destination_type: data.destination.destination_type || 'webhook',
                        webhook_url: data.destination.webhook_url || '',
                        verified: data.destination.verified === true,
                        verified_at: data.destination.verified_at || null,
                        destination_json: data.destination.destination_json || {},
                        verification_token: data.destination.verification_token || data.destination.destination_json?.verification_token || null,
                        verification_expires_at: data.destination.verification_expires_at || data.destination.destination_json?.verification_expires_at || null
                    });
                } else {
                    setCollectorDestination(createCollectorDestinationState());
                }
            } catch (_) {
                if (alive) setCollectorDestination(createCollectorDestinationState());
            } finally {
                if (alive) setCollectorDestinationLoading(false);
            }
        };

        loadCollectorDestination();
        return () => { alive = false; };
    }, [authenticatedFetch, config.doc_id]);

    const verifyCollectorDestination = useCallback(async (automationId: string) => {
        if (!automationId || collectEmailEnabled !== true) return false;
        const urlValue = String(collectorDestination.webhook_url || '').trim();
        if (!urlValue) {
            showError('Enter a webhook URL for the email collector.');
            return false;
        }
        if (!/^https:\/\//i.test(urlValue)) {
            showError('Webhook URL must start with https://');
            return false;
        }

        setCollectorDestinationSaving(true);
        try {
            const verifyRes = await authenticatedFetch(
                `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${automationId}/email-collector-destination/verify`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination_type: 'webhook', webhook_url: urlValue })
                }
            );
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
                showError(verifyData?.error || 'Failed to verify email collector destination.');
                return false;
            }
            const nextDestination = verifyData?.destination || null;
            if (nextDestination) {
                setCollectorDestination({
                    destination_type: nextDestination.destination_type || 'webhook',
                    webhook_url: nextDestination.webhook_url || '',
                    verified: nextDestination.verified === true,
                    verified_at: nextDestination.verified_at || null,
                    destination_json: nextDestination.destination_json || {},
                    verification_token: nextDestination.verification_token || nextDestination.destination_json?.verification_token || null,
                    verification_expires_at: nextDestination.verification_expires_at || nextDestination.destination_json?.verification_expires_at || null
                });
            }
            return true;
        } catch (_) {
            showError('Failed to verify email collector destination.');
            return false;
        } finally {
            setCollectorDestinationSaving(false);
        }
    }, [authenticatedFetch, collectEmailEnabled, collectorDestination.webhook_url]);

    const persistCollectorDestination = useCallback(async (automationId: string) => {
        if (!automationId || collectEmailEnabled !== true) return true;
        const urlValue = String(collectorDestination.webhook_url || '').trim();
        if (!urlValue) {
            showError('Enter a webhook URL for the email collector.');
            return false;
        }
        if (!/^https:\/\//i.test(urlValue)) {
            showError('Webhook URL must start with https://');
            return false;
        }
        if (collectorDestination.verified !== true || !collectorDestination.verification_token) {
            showError('Verify the webhook URL before saving the mentions automation.');
            return false;
        }

        setCollectorDestinationSaving(true);
        try {
            const saveRes = await authenticatedFetch(
                `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/instagram/automations/${automationId}/email-collector-destination`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        destination_type: 'webhook',
                        webhook_url: urlValue,
                        verification_token: collectorDestination.verification_token
                    })
                }
            );
            const saveData = await saveRes.json();
            if (!saveRes.ok) {
                showError(saveData?.error || 'Failed to save email collector destination.');
                return false;
            }
            const nextDestination = saveData?.destination || null;
            if (nextDestination) {
                setCollectorDestination({
                    destination_type: nextDestination.destination_type || 'webhook',
                    webhook_url: nextDestination.webhook_url || '',
                    verified: nextDestination.verified === true,
                    verified_at: nextDestination.verified_at || null,
                    destination_json: nextDestination.destination_json || {},
                    verification_token: nextDestination.verification_token || nextDestination.destination_json?.verification_token || null,
                    verification_expires_at: nextDestination.verification_expires_at || nextDestination.destination_json?.verification_expires_at || null
                });
            }
            return true;
        } catch (_) {
            showError('Failed to save email collector destination.');
            return false;
        } finally {
            setCollectorDestinationSaving(false);
        }
    }, [authenticatedFetch, collectEmailEnabled, collectorDestination]);

    const currentState = useMemo(() => JSON.stringify({
        template_id: selectedTemplate?.id || null,
        is_active: isActive,
        followers_only: followersOnly,
        followers_only_message: followersOnly ? followersOnlyMessage : '',
        followers_only_primary_button_text: followersOnlyPrimaryButtonText,
        followers_only_secondary_button_text: followersOnlySecondaryButtonText,
        suggest_more_enabled: suggestMoreEnabled,
        once_per_user_24h: oncePerUser,
        collect_email_enabled: collectEmailEnabled,
        collect_email_only_gmail: collectEmailOnlyGmail,
        collect_email_prompt_message: collectEmailPromptMessage,
        collect_email_fail_retry_message: collectEmailFailRetryMessage,
        collect_email_success_reply_message: collectEmailSuccessReplyMessage,
        seen_typing_enabled: seenTypingEnabled
    }), [collectEmailEnabled, collectEmailFailRetryMessage, collectEmailOnlyGmail, collectEmailPromptMessage, collectEmailSuccessReplyMessage, followersOnly, followersOnlyMessage, followersOnlyPrimaryButtonText, followersOnlySecondaryButtonText, isActive, oncePerUser, seenTypingEnabled, selectedTemplate?.id, suggestMoreEnabled]);

    const isDirty = !!initialState && initialState !== currentState;

    useEffect(() => {
        setInitialState(JSON.stringify({
            template_id: config.template_id || null,
            is_active: Boolean(config.is_active),
            followers_only: Boolean(config.followers_only),
            followers_only_message: String(config.followers_only_message || ''),
            followers_only_primary_button_text: String(config.followers_only_primary_button_text || FOLLOWERS_ONLY_PRIMARY_BUTTON_DEFAULT),
            followers_only_secondary_button_text: String(config.followers_only_secondary_button_text || FOLLOWERS_ONLY_SECONDARY_BUTTON_DEFAULT),
            suggest_more_enabled: Boolean(config.suggest_more_enabled),
            once_per_user_24h: Boolean(config.once_per_user_24h),
            collect_email_enabled: Boolean(config.collect_email_enabled),
            collect_email_only_gmail: Boolean(config.collect_email_only_gmail),
            collect_email_prompt_message: String(config.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT),
            collect_email_fail_retry_message: String(config.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT),
            collect_email_success_reply_message: String(config.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT),
            seen_typing_enabled: Boolean(config.seen_typing_enabled)
        }));
    }, [config]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!activeAccountID) return false;

        if (!selectedTemplate) {
            showError('Please select a reply template');
            return false;
        }
        if (collectEmailEnabled) {
            const webhookUrl = String(collectorDestination.webhook_url || '').trim();
            if (!webhookUrl) {
                showError('Enter a webhook URL for the email collector.');
                return false;
            }
            if (!/^https:\/\//i.test(webhookUrl)) {
                showError('Webhook URL must start with https://');
                return false;
            }
            if (collectorDestination.verified !== true || !collectorDestination.verification_token) {
                showError('Verify the webhook URL before saving the mentions automation.');
                return false;
            }
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
                    collect_email_enabled: collectEmailEnabled,
                    collect_email_only_gmail: collectEmailOnlyGmail,
                    collect_email_prompt_message: collectEmailPromptMessage,
                    collect_email_fail_retry_message: collectEmailFailRetryMessage,
                    collect_email_success_reply_message: collectEmailSuccessReplyMessage,
                    seen_typing_enabled: seenTypingEnabled
                })
            });

            if (res.ok) {
                const data = await res.json();
                const savedDocId = String(data?.doc_id || config.doc_id || '').trim();
                if (collectEmailEnabled) {
                    const destinationSaved = await persistCollectorDestination(savedDocId);
                    if (!destinationSaved) {
                        return false;
                    }
                }
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
    }, [activeAccountID, authenticatedFetch, collectEmailEnabled, collectEmailFailRetryMessage, collectEmailOnlyGmail, collectEmailPromptMessage, collectEmailSuccessReplyMessage, config.doc_id, currentState, fetchConfig, followersOnly, followersOnlyMessage, followersOnlyPrimaryButtonText, followersOnlySecondaryButtonText, isActive, oncePerUser, persistCollectorDestination, seenTypingEnabled, selectedTemplate, setHasUnsavedChanges, suggestMoreEnabled]);

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
            setOncePerUser(Boolean(config.once_per_user_24h));
            setCollectEmailEnabled(Boolean(config.collect_email_enabled));
            setCollectEmailOnlyGmail(Boolean(config.collect_email_only_gmail));
            setCollectEmailPromptMessage(String(config.collect_email_prompt_message || COLLECT_EMAIL_PROMPT_DEFAULT));
            setCollectEmailFailRetryMessage(String(config.collect_email_fail_retry_message || COLLECT_EMAIL_FAIL_RETRY_DEFAULT));
            setCollectEmailSuccessReplyMessage(String(config.collect_email_success_reply_message || COLLECT_EMAIL_SUCCESS_DEFAULT));
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
                    setCollectEmailEnabled(false);
                    setCollectEmailOnlyGmail(false);
                    setCollectEmailPromptMessage(COLLECT_EMAIL_PROMPT_DEFAULT);
                    setCollectEmailFailRetryMessage(COLLECT_EMAIL_FAIL_RETRY_DEFAULT);
                    setCollectEmailSuccessReplyMessage(COLLECT_EMAIL_SUCCESS_DEFAULT);
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
    const collectEmailGate = getPlanGate('collect_email', 'Upgrade your plan to enable email collection.');
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
                                        <AtSign className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Mentions</span>
                                    </div>
                                    <h1 className="text-xl font-black text-foreground">Mentions</h1>
                                    <p className="text-muted-foreground text-sm">Auto-reply when someone mentions you.</p>
                                </div>
                            }
                        />
                    </div>
                    {/* Active Toggle */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[28px] border border-content/70 bg-muted/40 p-5">
                        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                            <div className="p-2.5 sm:p-3 bg-card rounded-xl sm:rounded-2xl shadow-sm">
                                <AtSign className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] sm:text-[11px] font-black text-foreground uppercase tracking-[0.14em] sm:tracking-[0.15em]">Enable Mentions Response</p>
                                <p className="text-[11px] sm:text-[10px] leading-5 sm:leading-normal font-medium text-muted-foreground">When enabled, auto-reply to story/post mentions</p>
                            </div>
                        </div>
                        <div className="flex w-full justify-end sm:w-auto">
                            <ToggleSwitch
                                isChecked={isActive}
                                onChange={() => setIsActive(!isActive)}
                                variant="plain"
                            />
                        </div>
                    </div>

                    <LockedFeatureToggle
                        icon={<Power className={`w-5 h-5 ${followersOnly ? 'text-blue-500' : 'text-gray-400'}`} />}
                        title="Followers Only"
                        description="Only respond to users who already follow your account."
                        checked={followersOnly}
                        onToggle={() => {
                            const nextFollowersOnly = !followersOnly;
                            setFollowersOnly(nextFollowersOnly);
                            if (nextFollowersOnly) {
                                setFollowersOnlyCollapsed(false);
                            }
                        }}
                        locked={getPlanGate('followers_only').isLocked}
                        note={getPlanGate('followers_only').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-blue-500"
                        isCollapsed={followersOnlyCollapsed}
                        onCollapseToggle={() => setFollowersOnlyCollapsed(!followersOnlyCollapsed)}
                    />

                    {followersOnly && !followersOnlyCollapsed && (
                        <div className="bg-card border border-content rounded-2xl p-6 space-y-3">
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

                    <LockedFeatureToggle
                        icon={<Calendar className={`w-5 h-5 ${oncePerUser ? 'text-cyan-500' : 'text-gray-400'}`} />}
                        title="Once Per User (24h)"
                        description="Prevent the same person from retriggering this automation again for 24 hours."
                        checked={oncePerUser}
                        onToggle={() => setOncePerUser(!oncePerUser)}
                        locked={getPlanGate('once_per_user_24h').isLocked}
                        note={getPlanGate('once_per_user_24h').note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-cyan-500"
                    />

                    <div className="space-y-3">
                        <LockedFeatureToggle
                            icon={<Mail className={`w-5 h-5 ${collectEmailEnabled ? 'text-indigo-500' : 'text-gray-400'}`} />}
                            title="Collect Email"
                            description="Prompt users for their email address before completing the automation flow."
                            checked={collectEmailEnabled}
                            onToggle={() => {
                                const nextVal = !collectEmailEnabled;
                                setCollectEmailEnabled(nextVal);
                                if (nextVal) {
                                    setCollectEmailCollapsed(false);
                                }
                            }}
                            locked={collectEmailGate.isLocked}
                            note={collectEmailGate.note}
                            onUpgrade={() => setCurrentView('My Plan')}
                            activeIconClassName="text-indigo-500"
                            isCollapsed={collectEmailCollapsed}
                            onCollapseToggle={() => setCollectEmailCollapsed(!collectEmailCollapsed)}
                        />

                        {collectEmailEnabled && !collectEmailGate.isLocked && !collectEmailCollapsed && (
                            <div className="ml-2 rounded-[24px] border border-indigo-100 dark:border-indigo-500/10 bg-indigo-50/40 dark:bg-indigo-500/5 p-4 space-y-3">
                                <LockedFeatureToggle
                                    icon={<Mail className={`w-5 h-5 ${collectEmailOnlyGmail ? 'text-indigo-500' : 'text-gray-400'}`} />}
                                    title="Allow Only Gmail"
                                    description="Only accept @gmail.com email addresses."
                                    checked={collectEmailOnlyGmail}
                                    onToggle={() => setCollectEmailOnlyGmail(!collectEmailOnlyGmail)}
                                    activeIconClassName="text-indigo-500"
                                />
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Prompt Message</p>
                                    <textarea value={collectEmailPromptMessage} onChange={(e) => setCollectEmailPromptMessage(e.target.value)} className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary" placeholder={COLLECT_EMAIL_PROMPT_DEFAULT} />
                                    <p className="text-[9px] text-muted-foreground">{new Blob([collectEmailPromptMessage]).size}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Retry Message</p>
                                    <textarea value={collectEmailFailRetryMessage} onChange={(e) => setCollectEmailFailRetryMessage(e.target.value)} className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary" placeholder={COLLECT_EMAIL_FAIL_RETRY_DEFAULT} />
                                    <p className="text-[9px] text-muted-foreground">{new Blob([collectEmailFailRetryMessage]).size}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Success Message</p>
                                    <textarea value={collectEmailSuccessReplyMessage} onChange={(e) => setCollectEmailSuccessReplyMessage(e.target.value)} className="w-full min-h-[90px] rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary" placeholder={COLLECT_EMAIL_SUCCESS_DEFAULT} />
                                    <p className="text-[9px] text-muted-foreground">{new Blob([collectEmailSuccessReplyMessage]).size}/1000 bytes</p>
                                </div>
                                <div className="rounded-2xl border border-content/70 bg-card/80 p-4 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Delivery Destination</p>
                                            <p className="text-[10px] text-muted-foreground mt-1 sm:mt-0">Paste a webhook URL, then verify it with a sample lead payload.</p>
                                        </div>
                                        {collectorDestinationLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                    <input
                                        value={collectorDestination.webhook_url || ''}
                                        onChange={(e) => setCollectorDestination((prev) => ({ ...prev, destination_type: 'webhook', webhook_url: e.target.value, verified: false, verified_at: null, verification_token: null, verification_expires_at: null }))}
                                        className="w-full rounded-2xl border border-content/70 bg-card px-4 py-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                                        placeholder="https://example.com/webhook"
                                    />
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            disabled={!config.doc_id || collectorDestinationSaving}
                                            onClick={async () => {
                                                const ok = await verifyCollectorDestination(String(config.doc_id || ''));
                                                if (ok) showSuccess('Email collector destination verified.');
                                            }}
                                            className="rounded-2xl bg-black px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                                        >
                                            {collectorDestinationSaving ? 'Verifying...' : 'Verify Destination'}
                                        </button>
                                        <span className={`text-[10px] font-bold ${collectorDestination.verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                            {collectorDestination.verified
                                                ? `Verified${collectorDestination.verified_at ? ` on ${new Date(collectorDestination.verified_at).toLocaleString()}` : ''}`
                                                : config.doc_id ? 'Not verified yet' : 'Save the mentions automation once, then verify the destination'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <LockedFeatureToggle
                        icon={<MessageSquare className={`w-5 h-5 ${seenTypingEnabled ? 'text-violet-500' : 'text-gray-400'}`} />}
                        title="Seen + Typing Reaction"
                        description="Simulate seen and typing indicators before sending the automated reply."
                        checked={seenTypingEnabled}
                        onToggle={() => setSeenTypingEnabled(!seenTypingEnabled)}
                        locked={seenTypingGate.isLocked}
                        note={seenTypingGate.note}
                        onUpgrade={() => setCurrentView('My Plan')}
                        activeIconClassName="text-violet-500"
                    />

                    {/* Template Selector */}
                    <div className="bg-card border border-content rounded-2xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                                onCreateNew={() => {
                                    setCurrentView('Reply Templates');
                                }}
                            />
                        )}
                        {!selectedTemplate && (
                            <p className="text-xs text-muted-foreground font-medium mt-2">
                                Choose an existing template or create a new one to use for Mentions responses.
                            </p>
                        )}
                        {selectedTemplate && !showTemplateSelector && (
                            <div className="p-4 sm:p-6 bg-primary/10 border-2 border-primary/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-black text-foreground uppercase tracking-tight">{selectedTemplate.name}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{selectedTemplate.template_type.replace('template_', '')}</p>
                                </div>
                                <div className="self-start sm:self-auto px-3 py-1.5 bg-success-muted/60 text-success text-[9px] font-black uppercase tracking-widest rounded-lg">Selected</div>
                            </div>
                        )}
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
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

