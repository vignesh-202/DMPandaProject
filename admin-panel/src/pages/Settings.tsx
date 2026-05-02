import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';

type WatermarkPolicy = {
    enabled: boolean;
    type: 'text';
    position: 'inline_when_possible' | 'secondary_message';
    opacity: number;
    updated_at?: string | null;
};

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policy, setPolicy] = useState<WatermarkPolicy>({
        enabled: true,
        type: 'text',
        position: 'secondary_message',
        opacity: 1
    });

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/api/admin/settings/watermark');
                if (response.data?.policy) {
                    setPolicy(response.data.policy);
                }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const save = async () => {
        try {
            setSaving(true);
            const response = await httpClient.put('/api/admin/settings/watermark', policy);
            if (response.data?.policy) {
                setPolicy(response.data.policy);
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
            label: 'Secondary Message',
            description: 'Append the watermark as a follow-up message when inline insertion is not appropriate.'
        },
        {
            value: 'inline_when_possible',
            label: 'Inline When Possible',
            description: 'Insert the watermark directly in the main reply whenever the format supports it.'
        }
    ];

    const booleanCardClass = (active: boolean) => cn(
        'segmented-option min-h-[112px] flex-col items-start gap-2 rounded-[24px] p-4 text-left',
        active ? 'is-active' : ''
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Global Settings</h1>
                <p className="mt-2 text-gray-500 dark:text-neutral-400">Manage the shared watermark policy with safe fallback behavior.</p>
            </div>

            <div className="glass-card rounded-[32px] p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <p className="text-sm font-semibold text-muted-foreground">Watermark policy</p>
                        <h2 className="mt-2 text-xl font-extrabold text-foreground">Global watermark enforcement</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Choose whether watermarking stays enabled across all automated replies.</p>
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button type="button" className={booleanCardClass(policy.enabled)} onClick={() => setPolicy((prev) => ({ ...prev, enabled: true }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Enabled</p>
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">Apply the shared watermark policy to outgoing automation replies.</p>
                                </div>
                            </button>
                            <button type="button" className={booleanCardClass(!policy.enabled)} onClick={() => setPolicy((prev) => ({ ...prev, enabled: false }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Disabled</p>
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">Turn off platform-level watermark enforcement.</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <p className="text-sm font-semibold text-muted-foreground">Watermark type</p>
                        <h2 className="mt-2 text-xl font-extrabold text-foreground">Rendering format</h2>
                        <p className="mt-2 text-sm text-muted-foreground">The backend currently supports text watermarking.</p>
                        <div className="mt-5 rounded-[22px] border border-border/70 bg-card/70 px-4 py-4">
                            <p className="text-sm font-semibold text-foreground">Text watermark</p>
                            <p className="mt-1 text-xs font-medium text-muted-foreground">Replies use the shared text watermark with per-user fallback logic.</p>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <label className="text-sm font-semibold text-muted-foreground">Opacity</label>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={policy.opacity}
                            onChange={(e) => setPolicy((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                            className="mt-4 w-full"
                        />
                        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                            <span>Subtle</span>
                            <span>{Math.round(policy.opacity * 100)}%</span>
                            <span>Strong</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <label className="text-sm font-semibold text-muted-foreground">Placement strategy</label>
                        <div className="mt-3 space-y-3">
                            {positionOptions.map((option) => {
                                const active = policy.position === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setPolicy((prev) => ({ ...prev, position: option.value }))}
                                        className={cn('segmented-option w-full justify-start rounded-[22px] px-4 py-4 text-left', active ? 'is-active' : '')}
                                    >
                                        <span className="segmented-dot" />
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{option.label}</p>
                                            <p className="mt-1 text-xs font-medium text-muted-foreground">{option.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <p className="text-sm font-semibold text-muted-foreground">Resolution order</p>
                        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                            <p>1. Admin-configured system policy</p>
                            <p>2. Plan-based behavior</p>
                            <p>3. Environment default fallback</p>
                        </div>
                        <p className="mt-4 text-sm text-gray-500 dark:text-neutral-400">
                            updated: {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : 'not saved yet'}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="btn-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-xs sm:w-auto disabled:opacity-60"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Policy
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
