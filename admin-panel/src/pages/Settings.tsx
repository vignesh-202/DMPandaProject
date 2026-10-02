import React, { useEffect, useState } from 'react';
import {
    Camera,
    CheckCircle2,
    ChevronLeft,
    Heart,
    Image as ImageIcon,
    Instagram,
    Loader2,
    MessageSquare,
    Mic,
    Phone,
    PowerOff,
    Save,
    Sparkles,
    Video,
    Zap
} from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';

export type WatermarkMode = 'dynamic' | 'secondary' | 'off';

interface WatermarkPolicy {
    enabled: boolean;
    type: 'text';
    position: 'dynamic' | 'secondary' | 'secondary_message' | 'off';
    default_text: string;
    opacity?: number;
    updated_at?: string | null;
}

export const SettingsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [selectedMode, setSelectedMode] = useState<WatermarkMode>('dynamic');
    const [watermarkText, setWatermarkText] = useState('Automation made by DMPanda');
    const [initialMode, setInitialMode] = useState<WatermarkMode>('dynamic');
    const [initialText, setInitialText] = useState('Automation made by DMPanda');
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const isDirty = selectedMode !== initialMode || watermarkText.trim() !== initialText.trim();

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const response = await httpClient.get('/api/admin/settings/watermark');
                if (response.data?.policy) {
                    const pol: WatermarkPolicy = response.data.policy;
                    const pos = pol.position;
                    let loadedMode: WatermarkMode = 'dynamic';
                    if (pol.enabled === false || pos === 'off') {
                        loadedMode = 'off';
                    } else if (pos === 'secondary' || pos === 'secondary_message') {
                        loadedMode = 'secondary';
                    } else {
                        loadedMode = 'dynamic';
                    }
                    const loadedText = pol.default_text ? pol.default_text : 'Automation made by DMPanda';
                    setSelectedMode(loadedMode);
                    setInitialMode(loadedMode);
                    setWatermarkText(loadedText);
                    setInitialText(loadedText);
                    setUpdatedAt(pol.updated_at || null);
                }
            } catch (err) {
                console.error('Failed to load watermark settings:', err);
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
        if (!isDirty || saving) return;
        try {
            setSaving(true);
            const isOff = selectedMode === 'off';
            const position = selectedMode === 'secondary' ? 'secondary' : (isOff ? 'off' : 'dynamic');
            const enabled = !isOff;
            const textToSave = watermarkText.trim() || 'Automation made by DMPanda';

            const response = await httpClient.put('/api/admin/settings/watermark', {
                enabled,
                position,
                default_text: textToSave
            });

            if (response.data?.policy) {
                const pol = response.data.policy;
                const pos = pol.position;
                let savedMode: WatermarkMode = 'dynamic';
                if (pol.enabled === false || pos === 'off') {
                    savedMode = 'off';
                } else if (pos === 'secondary' || pos === 'secondary_message') {
                    savedMode = 'secondary';
                } else {
                    savedMode = 'dynamic';
                }
                const savedText = pol.default_text || textToSave;
                setSelectedMode(savedMode);
                setInitialMode(savedMode);
                setWatermarkText(savedText);
                setInitialText(savedText);
                setUpdatedAt(pol.updated_at || new Date().toISOString());
                setNotice('Watermark settings saved successfully.');
            }
        } catch (err) {
            console.error('Failed to save watermark settings:', err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <AdminLoadingState title="Loading settings" description="Fetching platform-wide watermark policy settings." />;
    }

    const options: Array<{
        id: WatermarkMode;
        title: string;
        badge?: string;
        badgeType?: 'primary' | 'neutral' | 'muted';
        icon: React.ComponentType<{ className?: string }>;
        description: string;
        behaviorNote: string;
        colorClasses: {
            border: string;
            bg: string;
            text: string;
            iconBg: string;
            radio: string;
        };
    }> = [
        {
            id: 'dynamic',
            title: 'Dynamic',
            badge: 'Recommended • Default',
            badgeType: 'primary',
            icon: Sparkles,
            description: 'Intelligently determines delivery on the first reply. Embeds watermark inline when text is concise (no extra action limit consumed), or sends a follow-up bubble if text is long or contains media/carousels.',
            behaviorNote: 'Leaves 2 lines before inline watermark • First reply only • Suppressed on follow-ups.',
            colorClasses: {
                border: 'border-emerald-500/40 dark:border-emerald-500/50',
                bg: 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08]',
                text: 'text-emerald-700 dark:text-emerald-300',
                iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
                radio: 'border-emerald-500 bg-emerald-500'
            }
        },
        {
            id: 'secondary',
            title: 'Secondary',
            badge: 'Follow-up Bubble',
            badgeType: 'neutral',
            icon: MessageSquare,
            description: 'Always sends the watermark as a clean, individual follow-up message bubble immediately following the primary reply message (consumes action limit as an individual message).',
            behaviorNote: 'Sends 1 follow-up bubble on first reply • Primary message remains 100% clean.',
            colorClasses: {
                border: 'border-sky-500/40 dark:border-sky-500/50',
                bg: 'bg-sky-500/[0.04] dark:bg-sky-500/[0.08]',
                text: 'text-sky-700 dark:text-sky-300',
                iconBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20',
                radio: 'border-sky-500 bg-sky-500'
            }
        },
        {
            id: 'off',
            title: 'Off',
            badge: 'Disabled',
            badgeType: 'muted',
            icon: PowerOff,
            description: 'Completely disables watermark delivery across all automated replies and interactions platform-wide.',
            behaviorNote: 'No branding messages or signatures sent.',
            colorClasses: {
                border: 'border-zinc-400/40 dark:border-zinc-600/50',
                bg: 'bg-zinc-500/[0.04] dark:bg-zinc-500/[0.08]',
                text: 'text-zinc-700 dark:text-zinc-300',
                iconBg: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-500/20',
                radio: 'border-zinc-500 bg-zinc-500'
            }
        }
    ];

    const currentText = watermarkText.trim() || 'Automation made by DMPanda';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Zap className="h-3.5 w-3.5" />
                        <span>System Configuration</span>
                    </div>
                    <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Global Settings</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Configure platform-wide watermark branding, delivery behavior, and enforcement rules.
                    </p>
                </div>
                {notice && (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {notice}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
                {/* Left: Configuration Form */}
                <div className="rounded-[28px] border border-border bg-card p-6 shadow-xs space-y-6">
                    <div>
                        <h2 className="text-base font-bold text-foreground">Watermark Delivery Mode</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Choose how automated responses brand outgoing Instagram Direct Messages. The worker node strictly enforces watermarks on first replies and suppresses them during interactive follow-ups.
                        </p>
                    </div>

                    {/* 3 Unified Options */}
                    <div className="space-y-3.5">
                        {options.map((option) => {
                            const isSelected = selectedMode === option.id;
                            const Icon = option.icon;

                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setSelectedMode(option.id)}
                                    className={cn(
                                        'w-full text-left rounded-2xl p-4 sm:p-5 transition-all duration-200 border relative group',
                                        isSelected
                                            ? cn(option.colorClasses.border, option.colorClasses.bg, 'shadow-xs ring-1 ring-inset', option.colorClasses.border)
                                            : 'border-border/80 bg-background/50 hover:bg-muted/40 hover:border-border'
                                    )}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Left: Icon Box */}
                                        <div className={cn(
                                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105',
                                            isSelected ? option.colorClasses.iconBg : 'bg-muted text-muted-foreground'
                                        )}>
                                            <Icon className="w-5 h-5" />
                                        </div>

                                        {/* Center: Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-foreground">
                                                    {option.title}
                                                </span>
                                                {option.badge && (
                                                    <span className={cn(
                                                        'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide border',
                                                        option.badgeType === 'primary' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
                                                        option.badgeType === 'neutral' && 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
                                                        option.badgeType === 'muted' && 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25'
                                                    )}>
                                                        {option.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                                {option.description}
                                            </p>
                                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80">
                                                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                                                <span>{option.behaviorNote}</span>
                                            </div>
                                        </div>

                                        {/* Right: Radio indicator */}
                                        <div className="pt-0.5 shrink-0">
                                            <div className={cn(
                                                'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                                                isSelected ? 'border-primary' : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
                                            )}>
                                                {isSelected && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Watermark Text Input (Active when mode is dynamic or secondary) */}
                    <div className={cn(
                        'rounded-2xl border p-5 transition-all duration-300',
                        selectedMode === 'off'
                            ? 'border-border/40 bg-muted/20 opacity-60'
                            : 'border-border/80 bg-background/50'
                    )}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-foreground">Branding Watermark Text</label>
                                    {selectedMode === 'off' && (
                                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                            Inactive while Off
                                        </span>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    The signature appended inline or delivered in the secondary bubble.
                                </p>
                            </div>
                            {selectedMode !== 'off' && (
                                <button
                                    type="button"
                                    onClick={() => setWatermarkText('Automation made by DMPanda')}
                                    className="text-[11px] font-semibold text-primary hover:underline"
                                >
                                    Reset to default
                                </button>
                            )}
                        </div>
                        <div className="mt-3 relative">
                            <input
                                type="text"
                                maxLength={200}
                                disabled={selectedMode === 'off'}
                                value={watermarkText}
                                onChange={(e) => setWatermarkText(e.target.value)}
                                placeholder="Automation made by DMPanda"
                                className="input-base pr-16 disabled:cursor-not-allowed"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-medium text-muted-foreground">
                                {watermarkText.length}/200
                            </span>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <p className="text-xs text-muted-foreground">
                            Last saved: {updatedAt ? new Date(updatedAt).toLocaleString() : 'System default'}
                        </p>
                        <div className="flex items-center gap-3">
                            {!isDirty && (
                                <span className="text-[11px] font-medium text-muted-foreground/70 hidden sm:inline-block">
                                    No changes to save
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={save}
                                disabled={!isDirty || saving}
                                className={cn(
                                    "inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl text-xs font-semibold shadow-xs transition-all duration-200",
                                    isDirty
                                        ? "btn-primary hover:shadow-md cursor-pointer"
                                        : "border border-border/60 bg-muted/60 text-muted-foreground/60 cursor-not-allowed opacity-60 shadow-none pointer-events-none"
                                )}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Watermark Policy
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Live Instagram DM Preview */}
                <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-xs">
                        <div className="flex items-center justify-between pb-4 border-b border-border/60">
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <Instagram className="h-4 w-4 text-primary" />
                                <span>Live Simulated Preview</span>
                            </div>
                            <span className={cn(
                                'rounded-full px-2.5 py-0.5 text-[10px] font-bold border',
                                selectedMode === 'dynamic' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                selectedMode === 'secondary' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
                                selectedMode === 'off' && 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20'
                            )}>
                                {selectedMode === 'dynamic' && 'Dynamic Active'}
                                {selectedMode === 'secondary' && 'Secondary Bubble'}
                                {selectedMode === 'off' && 'Watermark Off'}
                            </span>
                        </div>

                        {/* Phone Mockup Frame */}
                        <div className="mt-5 relative mx-auto w-full max-w-[320px] sm:max-w-[340px] rounded-[48px] border-[10px] border-slate-900 bg-slate-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-800/60 transition-all">
                            {/* Screen Canvas */}
                            <div className="overflow-hidden rounded-[38px] bg-white dark:bg-black flex flex-col h-[520px] select-none">
                                {/* Notch */}
                                <div className="pt-2 pb-1 bg-white dark:bg-black flex items-center justify-center shrink-0">
                                    <div className="h-4 w-24 rounded-full bg-black dark:bg-zinc-800 flex items-center justify-end pr-2.5">
                                        <div className="h-2 w-2 rounded-full bg-zinc-950 border border-zinc-800" />
                                    </div>
                                </div>

                                {/* Header */}
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

                                {/* Chat Area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-white dark:bg-black text-[13px]">
                                    <div className="text-center">
                                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                            Today 2:45 PM
                                        </span>
                                    </div>

                                    {/* Inbound Customer Message */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] px-3.5 py-2.5 bg-[#3797f0] text-white rounded-[18px] rounded-br-[4px] text-xs font-normal shadow-xs leading-relaxed">
                                            Hey! Can you send me the discount link for the sale?
                                        </div>
                                    </div>

                                    {/* Outbound Automation Reply */}
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
                                        <div className="max-w-[85%] space-y-2">
                                            {/* Primary message bubble */}
                                            <div className="rounded-[18px] rounded-bl-[4px] bg-[#EFEFEF] dark:bg-[#262626] text-[#262626] dark:text-white px-3.5 py-2.5 text-xs leading-relaxed shadow-xs">
                                                <p>
                                                    Hey there! 👋 Here is your exclusive 20% off coupon: <strong className="font-bold text-foreground">VIP20</strong>. Tap below to claim your access:
                                                </p>
                                                <p className="mt-1 text-primary dark:text-[#3897f0] font-semibold underline">
                                                    https://dmpanda.com/sale
                                                </p>

                                                {/* Dynamic Inline Watermark (leaving 2 lines before watermark) */}
                                                {selectedMode === 'dynamic' && (
                                                    <div className="mt-5 pt-2 border-t border-dashed border-black/10 dark:border-white/10 text-[10px] text-muted-foreground font-medium flex items-center justify-between gap-1.5 animate-in fade-in">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <span className="text-emerald-500 font-bold">⚡</span>
                                                            <span className="truncate">{currentText}</span>
                                                        </div>
                                                        <span className="shrink-0 text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                                            Inline (+2 lines)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Secondary Follow-up Message Bubble */}
                                            {selectedMode === 'secondary' && (
                                                <div className="flex items-center gap-1.5 w-fit rounded-[16px] rounded-bl-[4px] bg-[#EFEFEF] dark:bg-[#262626] text-muted-foreground px-3 py-1.5 text-[10px] font-medium shadow-2xs animate-in fade-in slide-in-from-bottom-1">
                                                    <span className="text-sky-500 font-bold">⚡</span>
                                                    <span>{currentText}</span>
                                                    <span className="text-[8.5px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded ml-1">
                                                        Follow-up
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Input Bar */}
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
                            Simulated Instagram Direct Message delivery based on active watermark policy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
