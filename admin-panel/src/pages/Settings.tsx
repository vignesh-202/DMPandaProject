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
        'segmented-option min-h-[100px] flex-col items-start gap-2 rounded-xl p-4 text-left',
        active ? 'is-active' : ''
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Global Settings</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Manage the shared watermark policy with safe fallback behavior.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/50 p-5">
                        <p className="text-xs font-semibold text-muted-foreground">Watermark policy</p>
                        <h2 className="mt-1 text-lg font-bold text-foreground">Global watermark enforcement</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Choose whether watermarking stays enabled across all automated replies.</p>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button type="button" className={booleanCardClass(policy.enabled)} onClick={() => setPolicy((prev) => ({ ...prev, enabled: true }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Enabled</p>
                                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Apply the shared watermark policy to outgoing automation replies.</p>
                                </div>
                            </button>
                            <button type="button" className={booleanCardClass(!policy.enabled)} onClick={() => setPolicy((prev) => ({ ...prev, enabled: false }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Disabled</p>
                                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Turn off platform-level watermark enforcement.</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/50 p-5">
                        <p className="text-xs font-semibold text-muted-foreground">Watermark type</p>
                        <h2 className="mt-1 text-lg font-bold text-foreground">Rendering format</h2>
                        <p className="mt-1 text-xs text-muted-foreground">The backend currently supports text watermarking.</p>
                        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3.5">
                            <p className="text-xs font-semibold text-foreground">Text watermark</p>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Replies use the shared text watermark with per-user fallback logic.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background/50 p-5">
                        <label className="text-xs font-semibold text-muted-foreground">Opacity</label>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={policy.opacity}
                            onChange={(e) => setPolicy((prev) => ({ ...prev, opacity: Number(e.target.value) }))}
                            className="mt-4 w-full accent-primary"
                        />
                        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                            <span>Subtle</span>
                            <span>{Math.round(policy.opacity * 100)}%</span>
                            <span>Strong</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="rounded-xl border border-border bg-background/50 p-5">
                        <label className="text-xs font-semibold text-muted-foreground">Placement strategy</label>
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
                                            <p className="text-xs font-semibold text-foreground">{option.label}</p>
                                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{option.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/50 p-5">
                        <p className="text-xs font-semibold text-muted-foreground">Resolution order</p>
                        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <p>1. Admin-configured system policy</p>
                            <p>2. Plan-based behavior</p>
                            <p>3. Environment default fallback</p>
                        </div>
                        <p className="mt-4 text-xs text-muted-foreground">
                            Updated: {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : 'Not saved yet'}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="btn-primary inline-flex w-full items-center justify-center gap-2 h-10 px-5 rounded-xl text-xs font-medium sm:w-auto disabled:opacity-60"
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
