import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, RefreshCw, AlertCircle, Trash2, Loader2, Save, X, Link as LinkIcon, Instagram, Facebook, Twitter, Youtube, Music, Globe, Mail, Phone, MapPin, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuth } from '../../contexts/AuthContext';

interface Button {
    id: string;
    title: string;
    url: string;
    icon?: string; // Social media icon name or 'default'
}

const SOCIAL_ICONS = [
    { name: 'instagram', icon: Instagram, label: 'Instagram' },
    { name: 'facebook', icon: Facebook, label: 'Facebook' },
    { name: 'twitter', icon: Twitter, label: 'Twitter' },
    { name: 'youtube', icon: Youtube, label: 'YouTube' },
    { name: 'tiktok', icon: Music, label: 'TikTok' },
    { name: 'email', icon: Mail, label: 'Email' },
    { name: 'phone', icon: Phone, label: 'Phone' },
    { name: 'location', icon: MapPin, label: 'Location' },
    { name: 'website', icon: Globe, label: 'Website' },
    { name: 'default', icon: ExternalLink, label: 'Default' },
];

const TEMPLATE_PREVIEWS = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    name: `Template ${i + 1}`,
    preview: `/images/template-${i + 1}.png`, // Placeholder - you can add actual preview images
}));

const SuperProfileView: React.FC = () => {
    const { activeAccountID, activeAccount } = useDashboard();
    const { authenticatedFetch } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    
    const [slug, setSlug] = useState('');
    const [templateId, setTemplateId] = useState('1');
    const [buttons, setButtons] = useState<Button[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    const fetchingRef = useRef(false);
    const lastFetchedAccountIdRef = useRef<string | null>(null);

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
                `${import.meta.env.VITE_API_BASE_URL}/api/super-profile?account_id=${activeAccountID}`
            );
            if (res.ok) {
                const data = await res.json();
                setSlug(data.slug || '');
                setTemplateId(data.template_id || '1');
                setButtons(data.buttons || []);
                setIsActive(data.is_active !== false);
                setPublicUrl(data.public_url || '');
                lastFetchedAccountIdRef.current = activeAccountID;
            } else if (res.status === 404) {
                // Profile doesn't exist yet
                setSlug('');
                setTemplateId('1');
                setButtons([]);
                setIsActive(true);
                setPublicUrl('');
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
    }, [activeAccountID, authenticatedFetch]);

    useEffect(() => {
        // Reset last fetched account ID when account changes
        if (lastFetchedAccountIdRef.current !== activeAccountID) {
            lastFetchedAccountIdRef.current = null;
        }
        fetchProfile();
    }, [activeAccountID, fetchProfile]);

    const handleSave = async () => {
        if (!activeAccountID) return;

        if (!slug.trim()) {
            setError('Slug is required.');
            return;
        }

        if (buttons.length === 0) {
            setError('At least one button is required.');
            return;
        }

        // Validate buttons
        for (const btn of buttons) {
            if (!btn.title.trim()) {
                setError('All buttons must have a title.');
                return;
            }
            if (!btn.url.trim()) {
                setError('All buttons must have a URL.');
                return;
            }
        }

        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const url = `${import.meta.env.VITE_API_BASE_URL}/api/super-profile?account_id=${activeAccountID}`;
            const method = publicUrl ? 'PATCH' : 'POST';

            const res = await authenticatedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: slug.trim(),
                    template_id: templateId,
                    buttons: buttons,
                    is_active: isActive
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPublicUrl(data.public_url);
                setSuccess('Profile saved successfully!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save profile.');
            }
        } catch (e) {
            setError('Network error occurred.');
        } finally {
            setSaving(false);
        }
    };

    const addButton = () => {
        if (buttons.length >= 50) {
            setError('Maximum 50 buttons allowed.');
            return;
        }
        setButtons([...buttons, { id: Date.now().toString(), title: '', url: '', icon: 'default' }]);
    };

    const removeButton = (id: string) => {
        setButtons(buttons.filter(b => b.id !== id));
    };

    const updateButton = (id: string, field: keyof Button, value: string) => {
        setButtons(buttons.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const copyUrl = () => {
        if (publicUrl) {
            navigator.clipboard.writeText(publicUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!activeAccountID) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-orange-600 rounded-[28%] flex items-center justify-center text-white mb-6 shadow-2xl shadow-amber-500/20">
                    <Users className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3">Select Instagram Account</h2>
                <p className="text-gray-500 max-w-md mb-8 font-medium">Super Profile requires an active Instagram Business account.</p>
            </div>
        );
    }

    if (loading) {
        return <LoadingOverlay variant="fullscreen" message="Loading Super Profile" subMessage="Fetching your profile…" />;
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Super Profile</h1>
                    <p className="text-sm text-gray-500 mt-1">Create a high-converting link-in-bio page for your Instagram account.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {success && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Configuration */}
                <div className="space-y-6">
                    {/* Slug */}
                    <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-900 dark:text-white">Profile URL Slug *</label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-400">/profile/</span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="your-username"
                                />
                            </div>
                            <p className="text-xs text-gray-400">Only lowercase letters, numbers, and hyphens allowed.</p>
                        </div>
                    </div>

                    {/* Template Selection */}
                    <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6 space-y-4">
                        <label className="text-sm font-bold text-gray-900 dark:text-white">Select Template</label>
                        <div className="grid grid-cols-5 gap-3">
                            {TEMPLATE_PREVIEWS.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => setTemplateId(template.id)}
                                    className={`relative aspect-square rounded-xl border-2 transition-all ${
                                        templateId === template.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg">
                                        <span className="text-xs font-bold text-gray-400">{template.id}</span>
                                    </div>
                                    {templateId === template.id && (
                                        <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900 dark:text-white">Buttons ({buttons.length}/50)</label>
                            <button
                                onClick={addButton}
                                disabled={buttons.length >= 50}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                Add Button
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                            {buttons.map((button, index) => {
                                const IconComponent = SOCIAL_ICONS.find(si => si.name === button.icon)?.icon || ExternalLink;
                                return (
                                    <div key={button.id} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400">Button {index + 1}</span>
                                            <button
                                                onClick={() => removeButton(button.id)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 mb-1 block">Icon</label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {SOCIAL_ICONS.map((si) => {
                                                        const Icon = si.icon;
                                                        return (
                                                            <button
                                                                key={si.name}
                                                                type="button"
                                                                onClick={() => updateButton(button.id, 'icon', si.name)}
                                                                className={`p-2 rounded-lg border-2 transition-all ${
                                                                    button.icon === si.name
                                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                                }`}
                                                                title={si.label}
                                                            >
                                                                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 mb-1 block">Button Title *</label>
                                                <input
                                                    type="text"
                                                    value={button.title}
                                                    onChange={(e) => updateButton(button.id, 'title', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                    placeholder="e.g., Visit My Website"
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 mb-1 block">URL *</label>
                                                <input
                                                    type="url"
                                                    value={button.url}
                                                    onChange={(e) => updateButton(button.id, 'url', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                    placeholder="https://example.com"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="text-sm font-bold text-gray-900 dark:text-white">Profile Active</label>
                                <p className="text-xs text-gray-400 mt-1">Make your profile publicly accessible</p>
                            </div>
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`relative w-12 h-6 rounded-full border-2 transition-colors ${
                                    isActive ? 'bg-blue-500 border-blue-500' : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                }`}
                            >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                    isActive ? 'left-[22px]' : 'left-0.5'
                                }`} />
                            </button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || !slug.trim() || buttons.length === 0}
                        className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>

                {/* Right Column: Preview & Public URL */}
                <div className="space-y-6">
                    {/* Public URL */}
                    {publicUrl && (
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
                            <div className="flex items-center gap-2 mb-2">
                                <LinkIcon className="w-5 h-5" />
                                <span className="text-sm font-bold">Your Public URL</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                <code className="flex-1 text-sm font-mono truncate">{publicUrl}</code>
                                <button
                                    onClick={copyUrl}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Copy URL"
                                >
                                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-blue-100 mt-2">Add this URL to your Instagram bio</p>
                        </div>
                    )}

                    {/* Preview */}
                    <div className="bg-white dark:bg-gray-950 border border-border rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Preview</h3>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 min-h-[400px]">
                            {/* App Logo & Tagline */}
                            <div className="text-center py-4 border-b border-gray-200 dark:border-gray-700">
                                <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl mx-auto mb-2 flex items-center justify-center">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white">DM Panda</h2>
                                <p className="text-xs text-gray-400">Automate your Instagram DMs</p>
                            </div>

                            {/* Profile Info */}
                            {activeAccount && (
                                <div className="text-center py-4">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] mx-auto mb-2">
                                        <img
                                            src={activeAccount.profile_picture_url || '/images/logo.png'}
                                            alt={activeAccount.username}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">@{activeAccount.username}</h3>
                                </div>
                            )}

                            {/* Buttons Preview */}
                            <div className="space-y-2">
                                {buttons.length > 0 ? (
                                    buttons.map((button) => {
                                        const IconComponent = SOCIAL_ICONS.find(si => si.name === button.icon)?.icon || ExternalLink;
                                        return (
                                            <a
                                                key={button.id}
                                                href={button.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                                            >
                                                <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                                <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{button.title || 'Button'}</span>
                                                <ExternalLink className="w-4 h-4 text-gray-400" />
                                            </a>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-8 text-gray-400 text-sm">No buttons added yet</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SuperProfileView;
