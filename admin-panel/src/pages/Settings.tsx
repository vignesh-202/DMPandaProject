import React, { useEffect, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, Heart, Image as ImageIcon, Instagram, Loader2, Mic, Phone, Save, Video } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';

type WatermarkPolicy = {
    enabled: boolean;
    type: 'text';
    position: 'inline_when_possible' | 'secondary_message';
    default_text: string;
    updated_at?: string | null;
};

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [policy, setPolicy] = useState<WatermarkPolicy>({
        enabled: true,
        type: 'text',
        position: 'secondary_message',
        default_text: 'Automation made by DMPanda'
    });

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/api/admin/settings/watermark');
                if (response.data?.policy) {
                    setPolicy({
                        enabled: response.data.policy.enabled !== false,
                        type: 'text',
                        position: response.data.policy.position === 'inline_when_possible' ? 'inline_when_possible' : 'secondary_message',
                        default_text: response.data.policy.default_text || 'Automation made by DMPanda',
                        updated_at: response.data.policy.updated_at
                    });
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(null), 3500);
        return () => window.clearTimeout(timer);
    }, [notice]);

    const save = async () => {
        try {
            setSaving(true);
            const response = await httpClient.put('/api/admin/settings/watermark', {
                enabled: policy.enabled,
                position: policy.position,
                default_text: policy.default_text.trim() || 'Automation made by DMPanda'
            });
            if (response.data?.policy) {
                setPolicy((prev) => ({
                    ...prev,
                    enabled: response.data.policy.enabled !== false,
                    position: response.data.policy.position,
                    default_text: response.data.policy.default_text || prev.default_text,
                    updated_at: response.data.policy.updated_at
                }));
                setNotice('Watermark settings saved successfully.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <AdminLoadingState title="Loading settings" description="Fetching platform-wide watermark policy settings." />;
    }

    const positionOptions: Array<{ value: WatermarkPolicy['position']; label: string; description: string }> = [
        {
            value: 'secondary_message',
            label: 'Secondary Message (Follow-up)',
            description: 'Send watermark as a separate follow-up message after the primary response.'
        },
        {
            value: 'inline_when_possible',
            label: 'Inline (Appended to Message)',
            description: 'Insert the watermark directly into the main reply body when character limits permit.'
        }
    ];

    const watermarkText = policy.default_text.trim() || 'Automation made by DMPanda';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-semibold text-primary">System Configuration</p>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Global Settings</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage platform-wide watermark branding, enforcement, and messaging behavior.</p>
                </div>
                {notice && (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {notice}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
                {/* Left: Configuration Form */}
                <div className="rounded-[28px] border border-border bg-card p-6 shadow-xs space-y-6">
                    {/* Watermark Toggle */}
                    <div className="rounded-2xl border border-border/80 bg-background/50 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-foreground">Global Watermark Enforcement</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    When enabled, users without a custom no-watermark plan receive the watermark on automated replies.
                                </p>
                            </div>
                            <span className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                                policy.enabled
                                    ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'border border-border bg-muted text-muted-foreground'
                            )}>
                                {policy.enabled ? 'Enforced' : 'Disabled'}
                            </span>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setPolicy((prev) => ({ ...prev, enabled: true }))}
                                className={cn(
                                    'segmented-option flex-col items-start gap-1.5 rounded-xl p-4 text-left',
                                    policy.enabled ? 'is-active' : ''
                                )}
                            >
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-xs font-bold text-foreground">Enabled</p>
                                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Apply watermark according to user plan features.</p>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPolicy((prev) => ({ ...prev, enabled: false }))}
                                className={cn(
                                    'segmented-option flex-col items-start gap-1.5 rounded-xl p-4 text-left',
                                    !policy.enabled ? 'is-active' : ''
                                )}
                            >
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-xs font-bold text-foreground">Disabled</p>
                                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Disable watermarking across all outgoing automation.</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Watermark Text Input */}
                    <div className="rounded-2xl border border-border/80 bg-background/50 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <label className="text-xs font-bold text-foreground">Watermark Text</label>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    The signature or branding text attached to automated Instagram messages.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPolicy((prev) => ({ ...prev, default_text: 'Automation made by DMPanda' }))}
                                className="text-[11px] font-semibold text-primary hover:underline"
                            >
                                Reset to default
                            </button>
                        </div>
                        <div className="mt-3 relative">
                            <input
                                type="text"
                                maxLength={200}
                                value={policy.default_text}
                                onChange={(e) => setPolicy((prev) => ({ ...prev, default_text: e.target.value }))}
                                placeholder="Automation made by DMPanda"
                                className="input-base pr-16"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium text-muted-foreground">
                                {policy.default_text.length}/200
                            </span>
                        </div>
                    </div>

                    {/* Placement Strategy */}
                    <div className="rounded-2xl border border-border/80 bg-background/50 p-5">
                        <label className="text-xs font-bold text-foreground">Placement Strategy</label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Determine whether the watermark is appended directly to the reply or sent as a secondary follow-up bubble.
                        </p>
                        <div className="mt-3 space-y-2.5">
                            {positionOptions.map((option) => {
                                const active = policy.position === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setPolicy((prev) => ({ ...prev, position: option.value }))}
                                        className={cn('segmented-option w-full justify-start rounded-xl px-4 py-3 text-left', active ? 'is-active' : '')}
                                    >
                                        <span className="segmented-dot" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">{option.label}</p>
                                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{option.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-muted-foreground">
                            Last updated: {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : 'System default'}
                        </p>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="btn-primary inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl text-xs font-semibold disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Settings
                        </button>
                    </div>
                </div>

                {/* Right: Live Instagram DM Preview Matching Frontend Automation Preview */}
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-xs">
                        <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <Instagram className="h-4 w-4 text-primary" />
                                Live DM Automation Preview
                            </div>
                            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold">
                                {policy.enabled ? 'Watermarked' : 'Plain'}
                            </span>
                        </div>

                        {/* Phone Mockup Frame (Matching Frontend SharedMobilePreview) */}
                        <div className="mt-5 relative mx-auto w-full max-w-[320px] sm:max-w-[340px] rounded-[48px] border-[10px] border-slate-900 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-800/60 transition-all">
                            {/* Screen Canvas */}
                            <div className="overflow-hidden rounded-[38px] bg-white dark:bg-black flex flex-col h-[520px] select-none">
                                {/* Dynamic Island / Notch */}
                                <div className="pt-2 pb-1 bg-white dark:bg-black flex items-center justify-center shrink-0">
                                    <div className="h-4 w-24 rounded-full bg-black dark:bg-zinc-800 flex items-center justify-end pr-2.5">
                                        <div className="h-2 w-2 rounded-full bg-zinc-950 border border-zinc-800" />
                                    </div>
                                </div>

                                {/* Instagram Chat Header */}
                                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-zinc-900 flex items-center justify-between bg-white dark:bg-black shrink-0">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <ChevronLeft className="w-5 h-5 shrink-0 text-slate-900 dark:text-white" />
                                        <div className="w-8 h-8 min-w-[32px] rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px] shrink-0">
                                            <div className="w-full h-full rounded-full bg-white dark:bg-black p-[1px] flex items-center justify-center overflow-hidden">
                                                <img
                                                    src="/images/loading_panda.webp"
                                                    alt="DM Panda"
                                                    className="w-full h-full rounded-full object-cover"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src = '/images/loading_panda.gif';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">@dmpanda_demo</div>
                                            <div className="text-[10px] text-muted-foreground leading-none">Active now • Instagram</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-900 dark:text-white shrink-0">
                                        <Phone className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                                        <Video className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                                    </div>
                                </div>

                                {/* Chat Area with Scroll */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white dark:bg-black text-[13px]">
                                    <div className="text-center">
                                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                            Today 2:45 PM
                                        </span>
                                    </div>

                                    {/* User (Customer) Message on Right */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] px-3.5 py-2.5 bg-[#3797f0] text-white rounded-[18px] rounded-br-[4px] text-xs font-normal shadow-xs leading-relaxed">
                                            Hey! Can you send me the discount link for the sale?
                                        </div>
                                    </div>

                                    {/* Bot (Automation) Reply on Left */}
                                    <div className="flex justify-start items-end gap-2">
                                        <div className="w-6 h-6 rounded-full bg-muted shrink-0 overflow-hidden mb-0.5 border border-border/50">
                                            <img
                                                src="/images/loading_panda.webp"
                                                alt="DM Panda"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.currentTarget as HTMLImageElement).src = '/images/loading_panda.gif';
                                                }}
                                            />
                                        </div>
                                        <div className="max-w-[85%] space-y-1.5">
                                            {/* Main message bubble */}
                                            <div className="rounded-[18px] rounded-bl-[4px] bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-white px-3.5 py-2.5 text-xs leading-relaxed shadow-xs">
                                                <p>
                                                    Hey there! 👋 Here is your exclusive 20% off coupon: <strong className="font-bold text-foreground">VIP20</strong>. Tap below to claim your access:
                                                </p>
                                                <p className="mt-1 text-primary dark:text-[#3897f0] font-semibold underline">
                                                    https://dmpanda.com/sale
                                                </p>

                                                {/* Below Message Watermark Position */}
                                                {policy.enabled && policy.position === 'inline_when_possible' && (
                                                    <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 animate-in fade-in">
                                                        <span className="text-primary font-bold">⚡</span>
                                                        <span>{watermarkText}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Separate Message Watermark Position */}
                                            {policy.enabled && policy.position === 'secondary_message' && (
                                                <div className="flex items-center gap-1.5 w-fit rounded-[16px] rounded-bl-[4px] bg-[#EFEFEF] dark:bg-[#262626] text-muted-foreground px-3 py-1.5 text-[10px] font-medium shadow-2xs animate-in fade-in slide-in-from-bottom-1">
                                                    <span className="text-primary font-bold">⚡</span>
                                                    <span>{watermarkText}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Chat Input Bar */}
                                <div className="p-3 border-t border-slate-100 dark:border-zinc-900 bg-white dark:bg-black flex items-center gap-2 shrink-0">
                                    <div className="w-7 h-7 rounded-full bg-[#0095F6] flex items-center justify-center text-white shrink-0 shadow-xs">
                                        <Camera className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 flex items-center justify-between rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 text-xs text-muted-foreground">
                                        <span>Message...</span>
                                        <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                                            <Mic className="w-3.5 h-3.5" />
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            <Heart className="w-3.5 h-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="mt-4 text-center text-[11px] text-muted-foreground">
                            Live simulated Instagram Direct Message delivery matching frontend automation preview.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
