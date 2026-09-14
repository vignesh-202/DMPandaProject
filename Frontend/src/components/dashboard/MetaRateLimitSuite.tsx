"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
    Clock3, 
    Activity, 
    ShieldCheck, 
    Zap, 
    CheckCircle2,
    MessageSquare,
    Video,
    Radio,
    FileText,
    Layers
} from 'lucide-react';
import Card from '../ui/card';
import { cn } from '../../lib/utils';

export interface MetaLimitItem {
    label?: string;
    api_name?: string;
    endpoint?: string;
    description?: string;
    used?: number;
    limit?: number;
    unit?: string;
    window_type?: string;
    window_label?: string;
    started_at?: string | null;
    resets_at?: string | null;
    remaining_seconds?: number;
    live_limit?: string;
    reels_limit?: string;
    standard_limit?: string;
    media_limit?: string;
    formula?: string;
    error_code?: string;
    sync_strategy?: string;
    category?: string;
}

export interface BusinessUseCaseUsage {
    account_id?: string;
    account_username?: string;
    token_type?: string;
    call_count_pct?: number;
    total_cputime_pct?: number;
    total_time_pct?: number;
    estimated_time_to_regain_access?: number;
}

export interface MetaRateLimitsPayload {
    hourly_window?: {
        started_at?: string | null;
        resets_at?: string | null;
        remaining_seconds?: number;
    };
    daily_window?: {
        started_at?: string | null;
        resets_at?: string | null;
        remaining_seconds?: number;
    };
    business_use_case_usage?: BusinessUseCaseUsage;
    limits?: {
        private_replies_posts_reels?: MetaLimitItem;
        private_replies_live?: MetaLimitItem;
        send_api_standard?: MetaLimitItem;
        send_api_media?: MetaLimitItem;
        conversations_api?: MetaLimitItem;
        platform_buc?: MetaLimitItem;
        private_replies?: MetaLimitItem;
        send_api?: MetaLimitItem;
        comment_to_dm?: MetaLimitItem;
        comment_replies?: MetaLimitItem;
        platform_api?: MetaLimitItem;
        dm_burst_concurrency?: MetaLimitItem;
    };
}

interface MetaRateLimitSuiteProps {
    metaRateLimits?: MetaRateLimitsPayload;
    hourlyUsed?: number;
    dailyUsed?: number;
    logs?: any[];
    className?: string;
}

const formatResetCountdown = (seconds: number): string => {
    if (seconds <= 0) return 'Rolling now';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
};

export interface GaugeShade {
    hex: string;
    rgb: string;
    level: 'QUIET' | 'ACTIVE' | 'BUSY' | 'PEAK';
}

// Gradually shades color from Green (0-25%) -> Yellow (25-50%) -> Orange (50-75%) -> Red (75-100%)
// exactly matching the circular gauge color interpolation
export const getGaugeShadedColor = (percent: number): GaugeShade => {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));

    // Color stops matching circular action gauge: Green -> Yellow -> Orange -> Red
    const stops = [
        { pos: 0, color: [34, 197, 94] },     // Green #22c55e - QUIET
        { pos: 25, color: [34, 197, 94] },    // Green #22c55e - QUIET end
        { pos: 50, color: [234, 179, 8] },    // Yellow #eab308 - ACTIVE
        { pos: 75, color: [249, 115, 22] },   // Orange #f97316 - BUSY
        { pos: 100, color: [239, 68, 68] }    // Red #ef4444 - PEAK
    ];

    let lower = stops[0];
    let upper = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
        if (p >= stops[i].pos && p <= stops[i + 1].pos) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }

    const range = upper.pos - lower.pos;
    const factor = range === 0 ? 0 : (p - lower.pos) / range;

    const r = Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * factor);
    const g = Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * factor);
    const b = Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * factor);

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    const rgb = `${r}, ${g}, ${b}`;

    let level: 'QUIET' | 'ACTIVE' | 'BUSY' | 'PEAK' = 'QUIET';
    if (p >= 75) level = 'PEAK';
    else if (p >= 50) level = 'BUSY';
    else if (p >= 25) level = 'ACTIVE';

    return { hex, rgb, level };
};

// Shaded level meter that turns green to yellow to red gradually according to level
// When empty (0% or unfilled), has clean border line with a substantial starting color indicator so it's clearly visible that a level exists
const renderGaugeLevelMeter = (percent: number) => {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const shade = getGaugeShadedColor(safePercent);

    // Starting minimal indicator width when 0%, increased width by >50% (14px) so the level clearly exists at its starting point
    const hasProgress = safePercent > 0;
    const widthStyle = hasProgress ? `${Math.max(5, safePercent)}%` : '14px';
    const activeColor = hasProgress ? shade.hex : '#22c55e';
    const shadowColor = hasProgress ? `rgba(${shade.rgb}, 0.55)` : 'rgba(34, 197, 94, 0.5)';

    return (
        <div className="w-full">
            {/* Clean Bordered Track - 50% thicker (h-2 / 8px), NO background color fill, just a clean border line */}
            <div className="relative h-2 w-full rounded-full border border-border/75 dark:border-border/60 bg-transparent overflow-hidden p-[1px]">
                {/* Level indicator: Substantial starting color indicator, expanding & shading dynamically */}
                <div 
                    className="h-full rounded-full transition-all duration-500 ease-out shrink-0"
                    style={{
                        width: widthStyle,
                        minWidth: '12px',
                        backgroundColor: activeColor,
                        boxShadow: `0 0 6px ${shadowColor}`
                    }}
                />
            </div>
        </div>
    );
};

export const MetaRateLimitSuite: React.FC<MetaRateLimitSuiteProps> = ({
    metaRateLimits,
    hourlyUsed = 0,
    dailyUsed = 0,
    logs = [],
    className
}) => {
    const [secondsTicker, setSecondsTicker] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSecondsTicker((s) => s + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const limits = metaRateLimits?.limits;

    // 1. Conversations API (2 calls/sec)
    const conversationsApi = useMemo(() => {
        const item = limits?.conversations_api;
        return {
            title: 'Conversations API',
            badge: '2/s',
            scope: 'Thread & Message Reads',
            used: item?.used ?? 0,
            limit: item?.limit ?? 2,
            unit: 'calls/s'
        };
    }, [limits?.conversations_api]);

    // 2. Private Replies API - Limit 1: Posts & Reels comments (750 calls/hr)
    const privateRepliesPostsReels = useMemo(() => {
        const item = limits?.private_replies_posts_reels || limits?.private_replies || limits?.comment_to_dm;
        const baseUsed = typeof item?.used === 'number' ? item.used : 0;
        const baseLimit = item?.limit ?? 750;
        const rawRem = item?.remaining_seconds ?? 0;
        const rem = baseUsed > 0 ? Math.max(0, rawRem - secondsTicker) : 0;
        return {
            title: 'Private Replies (Feed)',
            badge: '750/hr',
            scope: 'Post & Reel Comments',
            used: baseUsed,
            limit: baseLimit,
            remainingSeconds: rem,
            unit: 'calls/hr'
        };
    }, [limits?.private_replies_posts_reels, limits?.private_replies, limits?.comment_to_dm, secondsTicker]);

    // 3. Private Replies API - Limit 2: Live comments (100 calls/sec)
    const privateRepliesLive = useMemo(() => {
        const item = limits?.private_replies_live;
        const baseUsed = typeof item?.used === 'number' ? item.used : 0;
        const baseLimit = item?.limit ?? 100;
        return {
            title: 'Private Replies (Live)',
            badge: '100/s',
            scope: 'Live Stream Comments',
            used: baseUsed,
            limit: baseLimit,
            unit: 'calls/s'
        };
    }, [limits?.private_replies_live]);

    // 4. Send API - Limit 1: Text, links, reactions, stickers (100 calls/sec)
    const sendApiStandard = useMemo(() => {
        const item = limits?.send_api_standard || limits?.send_api || limits?.dm_burst_concurrency;
        const baseThroughput = typeof item?.used === 'number' ? item.used : (hourlyUsed > 0 ? 1 : 0);
        const baseLimit = item?.limit ?? 100;
        return {
            title: 'Send API (Standard)',
            badge: '100/s',
            scope: 'Text, Links & Reactions',
            used: baseThroughput,
            limit: baseLimit,
            unit: 'msgs/s'
        };
    }, [limits?.send_api_standard, limits?.send_api, limits?.dm_burst_concurrency, hourlyUsed]);

    // 5. Send API - Limit 2: Audio or video content (10 calls/sec)
    const sendApiMedia = useMemo(() => {
        const item = limits?.send_api_media;
        const baseThroughput = typeof item?.used === 'number' ? item.used : 0;
        const baseLimit = item?.limit ?? 10;
        return {
            title: 'Send API (Media)',
            badge: '10/s',
            scope: 'Audio & Video Content',
            used: baseThroughput,
            limit: baseLimit,
            unit: 'msgs/s'
        };
    }, [limits?.send_api_media]);

    // 6. Platform BUC Limits (4,800 x Impressions / 24 hours)
    const platformBuc = useMemo(() => {
        const item = limits?.platform_buc || limits?.comment_replies;
        const baseUsed = typeof item?.used === 'number' ? item.used : (dailyUsed > 0 ? dailyUsed : 0);
        const baseLimit = item?.limit ?? 4800;
        const rawRem = item?.remaining_seconds ?? metaRateLimits?.daily_window?.remaining_seconds ?? 0;
        const rem = baseUsed > 0 ? Math.max(0, rawRem - secondsTicker) : 0;
        return {
            title: 'Platform BUC',
            badge: '4.8k/24h',
            scope: 'General Graph API',
            used: baseUsed,
            limit: baseLimit,
            remainingSeconds: rem,
            unit: 'calls/24h'
        };
    }, [limits?.platform_buc, limits?.comment_replies, dailyUsed, metaRateLimits?.daily_window, secondsTicker]);

    // Percentages for gauge levels
    const convPercent = Math.min(100, Math.round((conversationsApi.used / conversationsApi.limit) * 100));
    const prPostsReelsPercent = Math.min(100, Math.round((privateRepliesPostsReels.used / privateRepliesPostsReels.limit) * 100));
    const prLivePercent = Math.min(100, Math.round((privateRepliesLive.used / privateRepliesLive.limit) * 100));
    const sendStandardPercent = Math.min(100, Math.round((sendApiStandard.used / sendApiStandard.limit) * 100));
    const sendMediaPercent = Math.min(100, Math.round((sendApiMedia.used / sendApiMedia.limit) * 100));
    const bucPercent = Math.min(100, Math.round((platformBuc.used / platformBuc.limit) * 100));

    // Overall account safety status with dynamic gradual shading
    const maxPercent = Math.max(convPercent, prPostsReelsPercent, prLivePercent, sendStandardPercent, sendMediaPercent, bucPercent);
    const overallShade = useMemo(() => getGaugeShadedColor(maxPercent), [maxPercent]);

    // Trailing 12-hour hourly burn sparkline
    const hourlyBurnData = useMemo(() => {
        const now = Date.now();
        const buckets: Array<{ hour: string; shortHour: string; count: number; percent: number }> = [];

        for (let i = 11; i >= 0; i--) {
            const bucketStart = now - (i + 1) * 3600000;
            const bucketEnd = now - i * 3600000;
            const hourDate = new Date(bucketEnd);
            const hourLabel = hourDate.toLocaleTimeString([], { hour: 'numeric', hour12: true });
            const shortHour = hourLabel.replace(':00', '').replace(/\s+/g, '').toLowerCase();
            
            const count = (logs || []).filter((l) => {
                const time = new Date(l.sent_at || l.created_at).getTime();
                return time >= bucketStart && time < bucketEnd;
            }).length;

            const pct = Math.min(100, Math.round((count / 750) * 100));

            buckets.push({
                hour: hourLabel,
                shortHour,
                count: count,
                percent: pct
            });
        }
        return buckets;
    }, [logs]);

    // Total calls aggregated across the 12h window
    const total12hCalls = useMemo(() => {
        return hourlyBurnData.reduce((acc, curr) => acc + curr.count, 0);
    }, [hourlyBurnData]);

    // Group into categories with items placed one below the other
    const apiCategories = [
        {
            name: 'Private Replies API',
            categoryTag: 'Comment-to-DM',
            items: [
                {
                    title: 'Posts & Reels Comments',
                    badge: '750/hr',
                    scope: 'Comment-to-DM triggers on feed posts & reels',
                    used: privateRepliesPostsReels.used,
                    limit: privateRepliesPostsReels.limit,
                    unit: 'calls/hr',
                    percent: prPostsReelsPercent,
                    status: privateRepliesPostsReels.used === 0 ? 'Full capacity' : `Reset: ${formatResetCountdown(privateRepliesPostsReels.remainingSeconds)}`,
                    meta: `${Math.max(0, privateRepliesPostsReels.limit - privateRepliesPostsReels.used)} left`
                },
                {
                    title: 'Live Stream Comments',
                    badge: '100/s',
                    scope: 'Private replies to comments in live streams',
                    used: privateRepliesLive.used,
                    limit: privateRepliesLive.limit,
                    unit: 'calls/s',
                    percent: prLivePercent,
                    status: 'Live Pacing',
                    meta: 'Peak: 100/s'
                }
            ]
        },
        {
            name: 'Send API',
            categoryTag: 'Outbound Messaging',
            items: [
                {
                    title: 'Text, Links & Reactions',
                    badge: '100/s',
                    scope: 'Messages with text, links, reactions & stickers',
                    used: sendApiStandard.used,
                    limit: sendApiStandard.limit,
                    unit: 'msgs/s',
                    percent: sendStandardPercent,
                    status: 'Standard DMs',
                    meta: 'Peak: 100/s'
                },
                {
                    title: 'Audio & Video Content',
                    badge: '10/s',
                    scope: 'Rich messages with voice audio or video clips',
                    used: sendApiMedia.used,
                    limit: sendApiMedia.limit,
                    unit: 'msgs/s',
                    percent: sendMediaPercent,
                    status: 'Voice & Media',
                    meta: 'Peak: 10/s'
                }
            ]
        },
        {
            name: 'Conversations & Platform API',
            categoryTag: 'Graph Ingestion',
            items: [
                {
                    title: 'Conversations API',
                    badge: '2/s',
                    scope: 'Thread reads and message list sync',
                    used: conversationsApi.used,
                    limit: conversationsApi.limit,
                    unit: 'calls/s',
                    percent: convPercent,
                    status: 'Webhook Ingest',
                    meta: 'Peak: 2/s'
                },
                {
                    title: 'Platform BUC',
                    badge: '4.8k/24h',
                    scope: 'General Graph API Business Use Case calls',
                    used: platformBuc.used,
                    limit: platformBuc.limit,
                    unit: 'calls/24h',
                    percent: bucPercent,
                    status: platformBuc.remainingSeconds > 0 ? `Reset: ${formatResetCountdown(platformBuc.remainingSeconds)}` : '24h Window',
                    meta: `${Math.max(0, platformBuc.limit - platformBuc.used)} left`
                }
            ]
        }
    ];

    return (
        <section className={cn("space-y-1.5", className)}>
            <Card className="rounded-xl border border-border/80 bg-card p-0 shadow-xs overflow-hidden">
                
                {/* Ultra-compact Responsive Header Bar with Dynamic Shaded Health Pill */}
                <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1.5 border-b border-border/60 bg-muted/20">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span 
                            className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300"
                            style={{
                                backgroundColor: overallShade.hex,
                                boxShadow: `0 0 5px rgba(${overallShade.rgb}, 0.7)`
                            }}
                        />
                        <h3 className="text-xs font-semibold text-foreground tracking-tight truncate">
                            Meta Instagram API Rate Limits
                        </h3>
                        <span className="text-muted-foreground/30 hidden md:inline">•</span>
                        <span className="font-mono text-[10px] text-muted-foreground hidden md:inline truncate">
                            Per-Account Infrastructure Quotas
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <div 
                            className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10px] font-medium border font-mono transition-all duration-300"
                            style={{
                                color: overallShade.hex,
                                backgroundColor: `rgba(${overallShade.rgb}, 0.12)`,
                                borderColor: `rgba(${overallShade.rgb}, 0.35)`
                            }}
                        >
                            <span 
                                className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300"
                                style={{
                                    backgroundColor: overallShade.hex,
                                    boxShadow: `0 0 4px ${overallShade.hex}`
                                }}
                            />
                            <span>{overallShade.level === 'QUIET' ? 'Nominal' : overallShade.level}</span>
                        </div>

                        <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            Token Siloed
                        </span>

                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                            <Activity className="w-3 h-3 text-emerald-500" />
                            <span className="hidden sm:inline">12h Live Monitor</span>
                        </span>
                    </div>
                </div>

                {/* 3 Category Columns: Responsive Grid (1 column on mobile, 3 columns on tablet landscape & desktop) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5 p-2 sm:p-2.5">
                    {apiCategories.map((cat, catIdx) => (
                        <div 
                            key={catIdx} 
                            className="p-2 rounded-lg border border-border/60 bg-muted/10 flex flex-col justify-between space-y-2"
                        >
                            {/* Category Header */}
                            <div className="flex items-center justify-between gap-1 pb-1 border-b border-border/40">
                                <span className="font-semibold text-[11.5px] text-foreground tracking-tight">
                                    {cat.name}
                                </span>
                                <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground font-medium shrink-0">
                                    {cat.categoryTag}
                                </span>
                            </div>

                            {/* Limits of this category placed ONE BELOW THE OTHER with Shaded Gauge Dynamics */}
                            <div className="space-y-1.5">
                                {cat.items.map((item, itemIdx) => {
                                    const pct = item.percent;
                                    const shade = getGaugeShadedColor(pct);
                                    return (
                                        <div 
                                            key={itemIdx}
                                            className="p-2 rounded-md border border-border/40 bg-background/70 hover:bg-background transition-all space-y-1"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[11px] font-medium text-foreground truncate" title={item.title}>
                                                    {item.title}
                                                </span>
                                                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-semibold shrink-0">
                                                    {item.badge}
                                                </span>
                                            </div>

                                            <div className="flex items-baseline justify-between">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                                                        {item.used}
                                                    </span>
                                                    <span className="font-mono text-[9.5px] text-muted-foreground">
                                                        / {item.limit.toLocaleString()} {item.unit}
                                                    </span>
                                                </div>
                                                {pct > 0 ? (
                                                    <span 
                                                        className="font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded transition-all duration-300"
                                                        style={{
                                                            color: shade.hex,
                                                            backgroundColor: `rgba(${shade.rgb}, 0.12)`,
                                                            border: `1px solid rgba(${shade.rgb}, 0.25)`
                                                        }}
                                                    >
                                                        {pct}%
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-[9.5px] font-medium px-1.5 py-0.2 rounded border border-border/60 bg-transparent text-muted-foreground">
                                                        0%
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-0.5">
                                                {renderGaugeLevelMeter(pct)}
                                                <div className="flex items-center justify-between font-mono text-[8.5px] text-muted-foreground pt-0.5">
                                                    {pct > 0 ? (
                                                        <span 
                                                            className="font-semibold transition-colors duration-300"
                                                            style={{ color: shade.hex }}
                                                        >
                                                            {shade.level} • {item.status}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            {item.status}
                                                        </span>
                                                    )}
                                                    <span className="shrink-0">{item.meta}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Trailing 12-Hour Hourly Dispatch Burn Graph - Open & Clearly Visible by Default */}
                <div className="px-2.5 sm:px-3.5 py-2.5 border-t border-border/70 bg-muted/15 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-foreground font-semibold text-xs tracking-tight">
                                Trailing 12-Hour Dispatch Distribution
                            </span>
                            <span className="text-muted-foreground hidden sm:inline text-[9.5px]">
                                (Hourly aggregate vs 750/hr ceiling)
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-muted-foreground text-[9.5px]">
                            <span className="px-1.5 py-0.5 rounded bg-background border border-border/60 font-semibold text-foreground">
                                {total12hCalls.toLocaleString()} calls total
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-background border border-border/60 text-muted-foreground hidden xs:inline">
                                Ceiling: 750 calls/hr
                            </span>
                        </div>
                    </div>

                    {/* High-Contrast Responsive Graph Area */}
                    <div className="relative pt-3 pb-1">
                        {/* Reference Guidelines */}
                        <div className="absolute inset-x-0 top-3 bottom-5 flex flex-col justify-between pointer-events-none z-0">
                            {/* 100% Ceiling (750/hr) */}
                            <div className="border-b border-dashed border-red-500/30 flex items-center justify-end pr-1">
                                <span className="font-mono text-[8px] text-red-500/70 bg-card/90 px-1 rounded">750/hr</span>
                            </div>
                            {/* 50% Guideline (375/hr) */}
                            <div className="border-b border-dashed border-border/50 flex items-center justify-end pr-1">
                                <span className="font-mono text-[8px] text-muted-foreground/60 bg-card/90 px-1 rounded">375/hr</span>
                            </div>
                            {/* Baseline (0/hr) */}
                            <div className="border-b border-border/70" />
                        </div>

                        {/* 12 Hour Columns: Responsive grid with high-visibility pillar tracks */}
                        <div className="grid grid-cols-12 gap-1 sm:gap-1.5 md:gap-2 items-end h-16 sm:h-20 md:h-24 relative z-10">
                            {hourlyBurnData.map((b, idx) => {
                                const hasVolume = b.count > 0;
                                const barHeight = hasVolume ? Math.min(100, Math.max(15, Math.round((b.count / 750) * 100))) : 0;
                                const shade = getGaugeShadedColor(b.percent);

                                return (
                                    <div 
                                        key={idx} 
                                        className="flex flex-col items-center h-full justify-end group/bar relative cursor-pointer"
                                    >
                                        {/* Bar Pillar Slot with clear visibility */}
                                        <div className="w-full bg-muted/60 dark:bg-muted/40 hover:bg-muted/90 dark:hover:bg-muted/70 border border-border/70 rounded-t-xs h-full flex items-end p-[1.5px] transition-colors">
                                            {hasVolume ? (
                                                <div 
                                                    className="w-full rounded-t-xs transition-all duration-500 ease-out"
                                                    style={{ 
                                                        height: `${barHeight}%`,
                                                        backgroundColor: shade.hex,
                                                        boxShadow: `0 0 6px rgba(${shade.rgb}, 0.65)`
                                                    }}
                                                />
                                            ) : (
                                                /* Distinct visible emerald baseline pip so every hour slot is clearly anchored */
                                                <div className="w-full h-1 bg-emerald-500/50 dark:bg-emerald-500/60 rounded-xs" />
                                            )}
                                        </div>

                                        {/* Clear High-Contrast Hour Label */}
                                        <span className={cn(
                                            "font-mono text-[8.5px] sm:text-[9.5px] md:text-[10px] truncate w-full text-center mt-1.5 transition-colors",
                                            hasVolume 
                                                ? "text-foreground font-bold" 
                                                : "text-foreground/80 dark:text-foreground/90 font-medium group-hover/bar:text-foreground"
                                        )}>
                                            {b.shortHour}
                                        </span>

                                        {/* Tooltip on Hover / Focus */}
                                        <div className="absolute -top-7 hidden group-hover/bar:flex flex-col items-center px-1.5 py-0.5 rounded bg-popover text-popover-foreground border border-border shadow-md font-mono text-[9px] z-30 pointer-events-none whitespace-nowrap">
                                            <span className="font-bold">{b.hour}</span>
                                            <span>{b.count} calls ({b.percent}%)</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </Card>
        </section>
    );
};

export default MetaRateLimitSuite;
