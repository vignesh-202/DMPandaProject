import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Plus, AlertCircle, Trash2, Link as LinkIcon, ExternalLink, Copy, CheckCircle2, ChevronDown, X, MoreVertical } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';
import { SOCIAL_ICONS, SocialIcon } from '../../lib/superProfileIcons';
import { toBrowserPreviewUrl } from '../../lib/templatePreview';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import AutomationActionBar from '../../components/dashboard/AutomationActionBar';
import AutomationPreviewPanel from '../../components/dashboard/AutomationPreviewPanel';
import useDashboardMainScrollLock from '../../hooks/useDashboardMainScrollLock';

interface Button {
    id: string;
    title: string;
    url: string;
    icon?: string;
}

const SuperProfileView: React.FC = () => {
    const {
        activeAccountID,
        activeAccount,
        setHasUnsavedChanges,
        setSaveUnsavedChanges,
        setDiscardUnsavedChanges
    } = useDashboard();
    const { authenticatedFetch } = useAuth();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    const [slug, setSlug] = useState('');
    const [buttons, setButtons] = useState<Button[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    const [openButtonId, setOpenButtonId] = useState<string | null>(null);
    const fetchingRef = useRef(false);
    const lastFetchedAccountIdRef = useRef<string | null>(null);
    const initialProfileRef = useRef<{ buttons: Button[]; isActive: boolean } | null>(null);

    useDashboardMainScrollLock(true);

    const buildSnapshot = useCallback((buttonsState: Button[], isActiveState: boolean) => {
        return JSON.stringify({
            isActive: isActiveState,
            buttons: buttonsState.map((b) => ({
                id: b.id,
                title: b.title,
                url: b.url,
                icon: b.icon || 'internet'
            }))
        });
    }, []);

    const isValidUrl = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return false;
        return /^https?:\/\/\S+$/i.test(trimmed);
    }, []);

    const fetchProfile = useCallback(async () => {
        if (!activeAccountID) {
            setLoading(false);
            return;
        }

        // Prevent duplicate requests
        if (fetchingRef.current) {
            return;
        }

        // Skip if we already fetched for this account
        if (lastFetchedAccountIdRef.current === activeAccountID) {
            return;
        }

        fetchingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await authenticatedFetch(
                `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/super-profile?account_id=${activeAccountID}`
            );
            if (res.ok) {
                const data = await res.json();
                setSlug(activeAccount?.ig_user_id || data.slug || '');
                const normalizedButtons = (data.buttons || []).map((btn: Button) => ({
                    ...btn,
                    icon: btn.icon || 'internet'
                }));
                const nextIsActive = data.is_active !== false;
                setButtons(normalizedButtons);
                setIsActive(nextIsActive);
                setPublicUrl(data.public_url || '');
                initialProfileRef.current = {
                    buttons: normalizedButtons,
                    isActive: nextIsActive
                };
                setHasUnsavedChanges(false);
                lastFetchedAccountIdRef.current = activeAccountID;
            } else if (res.status === 404) {
                // Profile doesn't exist yet
                setSlug(activeAccount?.ig_user_id || '');
                setButtons([]);
                setIsActive(true);
                setPublicUrl('');
                initialProfileRef.current = {
                    buttons: [],
                    isActive: true
                };
                setHasUnsavedChanges(false);
                lastFetchedAccountIdRef.current = activeAccountID;
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to load profile.');
            }
        } catch (e) {
            setError('Network error.');
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [activeAccountID, activeAccount?.ig_user_id, authenticatedFetch, setHasUnsavedChanges]);

    useEffect(() => {
        // Reset last fetched account ID when account changes
        if (lastFetchedAccountIdRef.current !== activeAccountID) {
            lastFetchedAccountIdRef.current = null;
        }
        fetchProfile();
    }, [activeAccountID, fetchProfile]);

    useEffect(() => {
        if (activeAccount?.ig_user_id) {
            setSlug(activeAccount.ig_user_id);
        }
    }, [activeAccount?.ig_user_id]);

    useEffect(() => {
        if (!buttons.length) {
            setOpenButtonId(null);
            return;
        }

        setOpenButtonId((current) => (
            current && buttons.some((button) => button.id === current)
                ? current
                : buttons[0].id
        ));
    }, [buttons]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!activeAccountID) return false;

        if (!slug.trim()) {
            setError('Instagram account ID is required.');
            return false;
        }

        if (buttons.length === 0) {
            setError('At least one button is required.');
            return false;
        }

        // Validate buttons
        for (const btn of buttons) {
            if (!btn.title.trim()) {
                setError('All buttons must have a title.');
                return false;
            }
            if (!btn.url.trim()) {
                setError('All buttons must have a URL.');
                return false;
            }
            if (!isValidUrl(btn.url)) {
                setError('All URLs must start with http:// or https://');
                return false;
            }
        }

        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const url = `${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/super-profile?account_id=${activeAccountID}`;
            const method = publicUrl ? 'PATCH' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: '1',
                    buttons: buttons,
                    is_active: isActive
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPublicUrl(data.public_url);
                setSuccess('Profile saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
                initialProfileRef.current = {
                    buttons: buttons.map((b) => ({ ...b })),
                    isActive
                };
                setHasUnsavedChanges(false);
                return true;
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save profile.');
            }
        } catch (e) {
            setError('Network error occurred.');
        } finally {
            setSaving(false);
        }
        return false;
    }, [activeAccountID, buttons, isActive, publicUrl, setHasUnsavedChanges, slug, authenticatedFetch, isValidUrl]);

    const discardChanges = useCallback(() => {
        if (!initialProfileRef.current) return;
        setButtons(initialProfileRef.current.buttons.map((b) => ({ ...b })));
        setIsActive(initialProfileRef.current.isActive);
        setError(null);
        setSuccess(null);
        setHasUnsavedChanges(false);
    }, [setHasUnsavedChanges]);

    const addButton = () => {
        if (buttons.length >= 50) {
            setError('Maximum 50 buttons allowed.');
            return;
        }
        const nextId = Date.now().toString();
        setButtons([...buttons, { id: nextId, title: '', url: '', icon: 'internet' }]);
        setOpenButtonId(nextId);
    };

    const removeButton = (id: string) => {
        setButtons(buttons.filter(b => b.id !== id));
    };

    const updateButton = (id: string, field: keyof Button, value: string) => {
        setButtons(buttons.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const toggleButtonPanel = (id: string) => {
        setOpenButtonId((current) => current === id ? null : id);
    };

    const getDisplayUrl = () => {
        if (publicUrl) {
            return publicUrl.startsWith('http://') || publicUrl.startsWith('https://')
                ? publicUrl
                : `${origin}${publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`}`;
        }
        if (!slug) return '';
        return `${origin}/superprofile/${slug}`;
    };

    const previewDomain = useMemo(() => {
        const candidateUrl = publicUrl
            ? (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')
                ? publicUrl
                : `${origin}${publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`}`)
            : (slug ? `${origin}/superprofile/${slug}` : origin);
        if (!candidateUrl) return 'dmpanda.com';

        try {
            return new URL(candidateUrl).host.replace(/^www\./i, '');
        } catch {
            return 'dmpanda.com';
        }
    }, [origin, publicUrl, slug]);

    const copyUrl = () => {
        const url = getDisplayUrl();
        if (url) {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const hasAnyChanges = useMemo(() => {
        if (!initialProfileRef.current) return false;
        const currentSnapshot = buildSnapshot(buttons, isActive);
        const initialSnapshot = buildSnapshot(initialProfileRef.current.buttons, initialProfileRef.current.isActive);
        return currentSnapshot !== initialSnapshot;
    }, [buttons, isActive, buildSnapshot]);

    const isFormValid = useMemo(() => {
        if (!slug.trim() || buttons.length === 0) return false;
        return buttons.every((btn) => btn.title.trim() && isValidUrl(btn.url));
    }, [buttons, slug, isValidUrl]);

    useEffect(() => {
        setHasUnsavedChanges(hasAnyChanges);
    }, [hasAnyChanges, setHasUnsavedChanges]);

    useEffect(() => {
        setSaveUnsavedChanges(() => handleSave);
        setDiscardUnsavedChanges(() => discardChanges);
    }, [discardChanges, handleSave, setDiscardUnsavedChanges, setSaveUnsavedChanges]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasAnyChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasAnyChanges]);

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-primary rounded-[28%] flex items-center justify-center text-primary-foreground mb-6 shadow-2xl shadow-primary/20">
                    <Users className="w-10 h-10" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-3">Select Instagram Account</h2>
                <p className="text-muted-foreground max-w-md mb-8 font-medium">Super Profile requires an active Instagram Business account.</p>
            </div>
        );
    }

    if (activeAccountID && loading) {
        return (
            <LoadingOverlay
                variant="fullscreen"
                message="Loading Super Profile"
                subMessage="Fetching your link page configuration and public URL..."
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 space-y-8">
            {error && (
                <div className="p-4 bg-destructive-muted/40 border border-destructive/30 rounded-2xl flex items-center gap-3 text-destructive text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 bg-success-muted/60 border border-success/30 rounded-2xl flex items-center gap-3 text-success text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 xl:gap-10 xl:h-[calc(100vh-7rem)] xl:overflow-hidden">
                <div className="xl:col-span-8 w-full min-w-0 space-y-6 xl:min-h-0 xl:overflow-y-auto xl:pr-2 pb-24 md:pb-0">
                    <div className="pb-2">
                        <AutomationActionBar
                            hasExisting={Boolean(publicUrl)}
                            isSaving={saving}
                            onSave={handleSave}
                            saveDisabled={!isFormValid}
                            showCancel={false}
                            saveLabel="Save"
                            centerContent={(
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-primary mb-0.5">
                                        <Users className="w-4 h-4" />
                                        <span className="text-xs font-semibold uppercase tracking-wider">Super Profile</span>
                                    </div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Super Profile</h1>
                                    <p className="text-muted-foreground text-sm font-normal">Create a high-converting link-in-bio page for your Instagram account.</p>
                                </div>
                            )}
                        />
                    </div>

                    {/* Active Toggle */}
                    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <label className="text-sm font-bold text-foreground">Profile Active</label>
                                <p className="text-xs text-muted-foreground mt-1">Make your profile publicly accessible</p>
                            </div>
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none shrink-0 !min-h-0 ${
                                    isActive ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-700'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                    isActive ? 'translate-x-6' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    </div>

                    {getDisplayUrl() && (
                        <div className="bg-card border border-primary/20 dark:border-primary/30 rounded-2xl p-4 sm:p-6 space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <LinkIcon className="w-5 h-5 shrink-0" />
                                <span className="text-sm font-bold text-foreground">Your Public URL</span>
                            </div>
                            <div className="flex items-center gap-2 bg-muted/60 dark:bg-muted/30 border border-border rounded-xl p-3">
                                <code className="flex-1 text-sm font-mono truncate text-foreground/90">{getDisplayUrl()}</code>
                                <button
                                    onClick={copyUrl}
                                    className="p-2 hover:bg-muted dark:hover:bg-slate-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
                                    title="Copy URL"
                                >
                                    {copied ? <CheckCircle2 className="w-4.5 h-4.5 text-success" /> : <Copy className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">Add this URL to your Instagram bio</p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-foreground">Buttons ({buttons.length}/50)</label>
                            <button
                                onClick={addButton}
                                disabled={buttons.length >= 50}
                                className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                Add Button
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {buttons.map((button, index) => {
                                const isExpanded = openButtonId === button.id;
                                return (
                                    <div key={button.id} className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => toggleButtonPanel(button.id)}
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            >
                                                <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                                                    <SocialIcon id={button.icon || 'internet'} className="h-4 w-4 text-slate-800 dark:text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-muted-foreground">Button {index + 1}</p>
                                                    <p className="truncate text-sm font-semibold text-foreground">
                                                        {button.title.trim() || 'Untitled button'}
                                                    </p>
                                                    <p className="truncate text-[11px] text-muted-foreground">
                                                        {button.url.trim() || 'Add a destination URL'}
                                                    </p>
                                                </div>
                                                <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeButton(button.id)}
                                                className="ml-3 p-1.5 hover:bg-destructive-muted/60 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="space-y-2">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Button Title *</label>
                                                    <input
                                                        type="text"
                                                        value={button.title}
                                                        onChange={(e) => updateButton(button.id, 'title', e.target.value)}
                                                        className={`w-full px-3 py-2 bg-card border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${!button.title.trim() ? 'border-destructive' : 'border-border'}`}
                                                        placeholder="e.g., Visit My Website"
                                                    />
                                                    {!button.title.trim() && (
                                                        <p className="mt-1 text-[11px] font-semibold text-destructive">Title is required.</p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground mb-1 block">URL *</label>
                                                    <input
                                                        type="url"
                                                        value={button.url}
                                                        onChange={(e) => updateButton(button.id, 'url', e.target.value)}
                                                        className={`w-full px-3 py-2 bg-card border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${!button.url.trim() || !isValidUrl(button.url) ? 'border-destructive' : 'border-border'}`}
                                                        placeholder="https://example.com"
                                                    />
                                                    {!button.url.trim() ? (
                                                        <p className="mt-1 text-[11px] font-semibold text-destructive">URL is required.</p>
                                                    ) : !isValidUrl(button.url) ? (
                                                        <p className="mt-1 text-[11px] font-semibold text-destructive">Enter a valid URL starting with http:// or https://</p>
                                                    ) : null}
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground mb-2 block">Icon</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {SOCIAL_ICONS.slice(0, 15).map((icon) => (
                                                            <button
                                                                key={icon.id}
                                                                type="button"
                                                                onClick={() => updateButton(button.id, 'icon', icon.id)}
                                                                className={`h-9 w-9 rounded-lg border flex items-center justify-center transition-all ${
                                                                    (button.icon || 'internet') === icon.id
                                                                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                                                        : 'border-border bg-card hover:border-primary/60 dark:bg-slate-900'
                                                                }`}
                                                                title={icon.label}
                                                                aria-label={icon.label}
                                                            >
                                                                <SocialIcon id={icon.id} className="h-4 w-4 text-slate-800 dark:text-white" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground mt-2">Pick a logo that matches your link.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <AutomationPreviewPanel
                    title="Live Preview"
                    wrapperClassName="order-1 hidden min-h-0 w-full xl:block xl:order-2 xl:col-span-4 xl:self-start xl:max-h-[calc(100vh-7rem)]"
                >
                    <div className="mx-auto w-full max-w-[300px] flex-shrink-0 animate-in fade-in slide-in-from-right-8 duration-700 xl:ml-auto overflow-hidden">
                        <div className="h-fit flex flex-col items-center w-full overflow-hidden">
                            <div className="relative flex w-full max-w-[300px] h-[540px] sm:h-[550px] flex-col overflow-hidden rounded-[44px] sm:rounded-[55px] border-[8px] sm:border-[10px] border-slate-950 bg-white shadow-[0_24px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-black/10 dark:border-zinc-800 dark:bg-black dark:ring-zinc-800 dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
                                {/* Notch / Dynamic Island */}
                                <div className="absolute top-2.5 left-1/2 z-40 flex h-5 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-slate-950 shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:bg-zinc-900">
                                    <div className="h-1.5 w-8 rounded-full bg-slate-800/80 dark:bg-zinc-800" />
                                </div>

                                <div className="z-30 flex h-12 items-center justify-between px-9 pt-6 text-[11px] font-bold text-slate-900 dark:text-white">
                                    <span>9:41</span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-4 w-4 rounded-[3px] border-2 border-current" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                    </div>
                                </div>

                                <div className="mt-2 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 text-slate-900 dark:border-slate-800 dark:bg-black dark:text-white">
                                    <button
                                        type="button"
                                        aria-label="Close preview"
                                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                    <div className="min-w-0 px-3 text-center">
                                        <div className="truncate text-[13px] font-bold">{previewDomain}</div>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="More actions"
                                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                                    {/* Ambient floating blobs */}
                                    <div className="sp-blob absolute -top-16 -right-16 h-36 w-36 rounded-full blur-2xl bg-amber-300/15 dark:bg-amber-300/10 pointer-events-none" />
                                    <div className="sp-blob sp-blob-delayed absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-2xl bg-sky-300/15 dark:bg-sky-300/10 pointer-events-none" />

                                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-5 pt-3 relative z-10">
                                        {/* DM Panda branding logo */}
                                        <div className="flex items-center justify-center mb-3">
                                            <img
                                                src="/images/logo.png"
                                                alt="DM Panda"
                                                className="h-5 w-auto opacity-80"
                                            />
                                        </div>

                                        {/* Super Profile Card matching public page design */}
                                        <div className="rounded-[24px] border border-border/70 bg-card/85 backdrop-blur-xl p-4 sm:p-5 shadow-md text-center">
                                            {/* Profile Picture with ambient ring */}
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative">
                                                    <div className="absolute -inset-1.5 rounded-full blur-md bg-gradient-to-tr from-[#405DE6]/30 via-[#833AB4]/30 to-[#FD1D1D]/30" />
                                                    <div className="relative h-16 w-16 rounded-full p-[2px] shadow-md bg-card border border-border">
                                                        <img
                                                            src={toBrowserPreviewUrl(activeAccount?.profile_picture_url || '') || '/images/logo.png'}
                                                            alt={activeAccount?.username || 'Super Profile'}
                                                            className="h-full w-full rounded-full object-cover"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-center">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">SUPER PROFILE</p>
                                                    <h3 className="mt-0.5 text-sm font-bold text-foreground truncate max-w-[200px]">
                                                        {activeAccount?.name || (activeAccount?.username ? `@${activeAccount.username}` : 'Super Profile')}
                                                    </h3>
                                                    {activeAccount?.username && (
                                                        <p className="text-[11px] font-semibold text-muted-foreground">@{activeAccount.username}</p>
                                                    )}
                                                </div>

                                                {isActive && (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[10px] font-bold">Live</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Links / Buttons matching public design */}
                                            <div className="mt-4 space-y-2">
                                                {buttons.length > 0 ? (
                                                    buttons.map((button) => (
                                                        <a
                                                            key={button.id}
                                                            href={button.url || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="group flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-background/80 hover:bg-background hover:border-border transition-all duration-200 shadow-2xs w-full text-left"
                                                        >
                                                            <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-foreground text-background shrink-0 group-hover:scale-105 transition-transform">
                                                                <SocialIcon id={button.icon || 'internet'} className="h-3.5 w-3.5" />
                                                            </div>
                                                            <span className="flex-1 min-w-0 text-xs font-semibold truncate text-foreground">
                                                                {button.title || 'Visit Link'}
                                                            </span>
                                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                                                        </a>
                                                    ))
                                                ) : (
                                                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-5 text-center text-xs text-muted-foreground">
                                                        No links added yet. Add buttons in the editor.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Powered by DM Panda Footer */}
                                            <div className="mt-4 text-center">
                                                <span className="text-[10px] font-medium text-muted-foreground">
                                                    Powered by <strong className="font-bold text-foreground">DM Panda</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </AutomationPreviewPanel>
            </div>
        </div>
    );
};

export default SuperProfileView;


