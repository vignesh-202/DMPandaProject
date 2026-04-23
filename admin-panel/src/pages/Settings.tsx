import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';

type WatermarkPolicy = {
    enabled: boolean;
    default_text: string;
    enforcement_mode: 'inline_when_possible' | 'fallback_secondary_message';
    allow_user_override: boolean;
    updated_at?: string | null;
};

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policy, setPolicy] = useState<WatermarkPolicy>({
        enabled: true,
        default_text: 'Automation made by DMPanda',
        enforcement_mode: 'fallback_secondary_message',
        allow_user_override: true
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
        return <AdminLoadingState title="Loading settings" description="Fetching platform-wide watermark and override policy settings." />;
    }

    const enforcementOptions: Array<{ value: WatermarkPolicy['enforcement_mode']; label: string; description: string }> = [
        {
            value: 'fallback_secondary_message',
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
                <p className="mt-2 text-gray-500 dark:text-neutral-400">Manage platform-wide watermark behavior with per-user override support.</p>
            </div>

            <div className="glass-card rounded-[32px] p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                        <p className="text-sm font-semibold text-muted-foreground">Override access</p>
                        <h2 className="mt-2 text-xl font-extrabold text-foreground">Per-user exceptions</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Decide whether admins can override watermark behavior on individual users.</p>
                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button type="button" className={booleanCardClass(policy.allow_user_override)} onClick={() => setPolicy((prev) => ({ ...prev, allow_user_override: true }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Allowed</p>
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">Admins can disable watermarking or customize text per user when needed.</p>
                                </div>
                            </button>
                            <button type="button" className={booleanCardClass(!policy.allow_user_override)} onClick={() => setPolicy((prev) => ({ ...prev, allow_user_override: false }))}>
                                <span className="segmented-dot" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Locked</p>
                                    <p className="mt-1 text-xs font-medium text-muted-foreground">Keep the global rule authoritative with no per-user override.</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-4">
                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <label className="text-sm font-semibold text-muted-foreground">Default watermark text</label>
                        <textarea
                            rows={5}
                            value={policy.default_text}
                            onChange={(e) => setPolicy((prev) => ({ ...prev, default_text: e.target.value }))}
                            className="input-base mt-3 min-h-[8rem]"
                        />
                    </div>
                    <div className="rounded-[28px] border border-border/70 bg-background/55 p-5">
                        <label className="text-sm font-semibold text-muted-foreground">Enforcement mode</label>
                        <div className="mt-3 space-y-3">
                            {enforcementOptions.map((option) => {
                                const active = policy.enforcement_mode === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setPolicy((prev) => ({ ...prev, enforcement_mode: option.value }))}
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
