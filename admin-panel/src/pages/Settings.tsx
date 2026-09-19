import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, Instagram, Loader2, MessageSquare, RefreshCw, Save, Sparkles } from 'lucide-react';
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

                {/* Right: Live Instagram DM Preview */}
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-xs">
                        <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <Instagram className="h-4 w-4 text-primary" />
                                Live DM Preview
                            </div>
                            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-bold">
                                {policy.enabled ? 'Watermarked' : 'Plain'}
                            </span>
                        </div>

                        {/* Simulated Instagram Chat Window */}
                        <div className="mt-4 rounded-2xl border border-border/70 bg-background/70 p-4 space-y-3 font-sans">
                            {/* Inbound Customer Message */}
                            <div className="flex justify-start">
                                <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-muted/80 px-3.5 py-2 text-xs text-foreground">
                                    Hey! Can I get the discount code for the sale?
                                </div>
                            </div>

                            {/* Outbound Automated Reply */}
                            {policy.position === 'inline_when_possible' ? (
                                <div className="flex justify-end">
                                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-3.5 py-2.5 text-xs text-white shadow-sm leading-relaxed">
                                        <p>Here is your exclusive discount code: <strong>VIP20</strong>!</p>
                                        {policy.enabled && (
                                            <p className="mt-2 text-[10px] opacity-80 border-t border-white/20 pt-1 font-medium">
                                                {watermarkText}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Primary Reply */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] px-3.5 py-2 text-xs text-white shadow-sm">
                                            Here is your exclusive discount code: <strong>VIP20</strong>!
                                        </div>
                                    </div>

                                    {/* Secondary Watermark Bubble */}
                                    {policy.enabled && (
                                        <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-300">
                                            <div className="max-w-[75%] rounded-2xl bg-gradient-to-r from-[#405DE6]/80 to-[#833AB4]/80 px-3 py-1.5 text-[10px] text-white/90 shadow-2xs font-medium">
                                                {watermarkText}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <p className="mt-4 text-center text-[11px] text-muted-foreground">
                            Simulated Instagram Direct Message delivery behavior based on current policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
