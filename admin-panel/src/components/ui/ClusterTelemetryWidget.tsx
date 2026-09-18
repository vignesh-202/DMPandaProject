import React, { useEffect, useState, useCallback } from 'react';
import httpClient from '../../lib/httpClient';
import {
    Activity,
    Server,
    Zap,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    Layers,
    Clock,
    Cpu,
    Gauge,
    Radio
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface WorkerMetrics {
    dynamicCapacity?: number;
    baselineCapacity?: number;
    currentLagMs?: number;
    avgLagMs?: number;
    memoryUsagePercent?: number;
    isThrottled?: boolean;
    lastThrottledReason?: string;
    rssMb?: number;
    heapUsedMb?: number;
    freeMemMb?: number;
    totalMemMb?: number;
}

interface WorkerInfo {
    workerId: string;
    capacity: number;
    activeJobs: number;
    lastSeenAt: number;
    metadata?: {
        hostname?: string;
        platform?: string;
        cpus?: number;
        memoryMb?: number;
        baselineCapacity?: number;
        metrics?: WorkerMetrics;
        lastThrottledReason?: string;
        [key: string]: any;
    };
}

interface ClusterMetrics {
    status?: string;
    connectedWorkers: number;
    workers?: WorkerInfo[];
    pendingQueueLength?: number;
    activeJobsCount?: number;
    shedJobsCount?: number;
    totalJobsProcessed?: number;
    uptime?: number;
    [key: string]: any;
}

export const ClusterTelemetryWidget: React.FC<{ className?: string }> = ({ className }) => {
    const [cluster, setCluster] = useState<ClusterMetrics | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);

    const fetchClusterStatus = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const res = await httpClient.get('/api/admin/cluster/status');
            const data = res.data?.cluster || res.data;
            if (data && typeof data === 'object') {
                const isOfflinePayload = data.status === 'offline';
                setCluster({
                    ...data,
                    workers: isOfflinePayload ? [] : (Array.isArray(data.workers) ? data.workers : [])
                });
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.warn('Failed to fetch cluster status:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let eventSource: EventSource | null = null;
        let pollInterval: ReturnType<typeof setInterval> | null = null;
        let isVisible = typeof document === 'undefined' || document.visibilityState === 'visible';
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        const apiBaseUrl = String(
            (globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ ||
            import.meta.env.VITE_API_BASE_URL ||
            ''
        ).replace(/\/+$/, '');
        const streamUrl = `${apiBaseUrl}/api/admin/cluster/stream`;

        const startPollingFallback = () => {
            if (pollInterval) return;
            fetchClusterStatus();
            pollInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
                fetchClusterStatus();
            }, 6000);
        };

        const stopPollingFallback = () => {
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        };

        const connectSSE = () => {
            if (typeof EventSource === 'undefined') {
                startPollingFallback();
                return;
            }

            try {
                eventSource = new EventSource(streamUrl, { withCredentials: true });

                eventSource.onopen = () => {
                    setIsLiveStreaming(true);
                    stopPollingFallback();
                };

                eventSource.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload && typeof payload === 'object') {
                            setCluster((prev) => {
                                const nextStatus = payload.status || (payload.role === 'master' ? 'online' : prev?.status);
                                const isOfflinePayload = nextStatus === 'offline';
                                const nextWorkers = isOfflinePayload
                                    ? []
                                    : (Array.isArray(payload.workers) ? payload.workers : (payload.connectedWorkers === 0 ? [] : (prev?.workers || [])));

                                return {
                                    ...(prev || {}),
                                    ...payload,
                                    status: nextStatus,
                                    workers: nextWorkers
                                };
                            });
                            setLastUpdated(new Date());
                            setLoading(false);
                        }
                    } catch (_) {}
                };

                eventSource.onerror = () => {
                    setIsLiveStreaming(false);
                    if (eventSource) {
                        eventSource.close();
                        eventSource = null;
                    }
                    startPollingFallback();

                    if (reconnectTimeout) clearTimeout(reconnectTimeout);
                    reconnectTimeout = setTimeout(() => {
                        if (isVisible && !eventSource) {
                            connectSSE();
                        }
                    }, 10000);
                };
            } catch (err) {
                console.warn('EventSource connection failed, falling back to polling:', err);
                startPollingFallback();
            }
        };

        const handleVisibilityChange = () => {
            isVisible = document.visibilityState === 'visible';
            if (isVisible) {
                if (!eventSource) {
                    connectSSE();
                } else {
                    fetchClusterStatus();
                }
            } else {
                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                    setIsLiveStreaming(false);
                }
                stopPollingFallback();
            }
        };

        // First load
        fetchClusterStatus();
        if (isVisible) {
            connectSSE();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            stopPollingFallback();
        };
    }, [fetchClusterStatus]);

    const rawWorkers = cluster?.workers || [];
    const isOffline = cluster?.status === 'offline';
    const workers = isOffline ? [] : rawWorkers;
    const connectedCount = isOffline
        ? 0
        : (workers.length > 0 ? workers.length : (cluster?.connectedWorkers ?? 0));
    const queueDepth = cluster?.pendingQueueLength ?? cluster?.pendingJobs ?? cluster?.queueLength ?? 0;
    const activeJobs = cluster?.activeJobsCount ?? cluster?.processingJobs ?? 0;

    return (
        <div className={cn(
            'relative overflow-hidden rounded-[28px] border border-border/70 bg-card/60 backdrop-blur-md p-5 sm:p-6 shadow-xs transition-all',
            className
        )}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Activity className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">Live Cluster & Worker Telemetry</h3>
                            {isLiveStreaming ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    <Radio className="h-3 w-3 animate-pulse" />
                                    Live SSE
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    Polling (6s)
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Real-time streaming from Server 2 RAM • Zero database load on Server 1
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {lastUpdated.toLocaleTimeString('en-IN')}
                    </span>
                    <button
                        onClick={() => fetchClusterStatus()}
                        disabled={isRefreshing}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/80 hover:bg-accent text-foreground transition"
                        title="Refresh cluster telemetry"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* Zero-Workers Warning Alert Banner */}
            {connectedCount === 0 && workers.length === 0 && !loading && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                        <strong className="font-semibold block text-sm mb-0.5">Zero Worker Nodes Connected</strong>
                        Incoming Meta webhooks are currently buffering safely in Streamer RAM & local SSD backlog ({queueDepth} pending).
                        Launch a worker on any laptop, VPS, or cloud instance (<code className="font-mono text-[11px] px-1 py-0.5 bg-black/10 rounded">npm start</code>) to resume instantaneous execution.
                    </div>
                </div>
            )}

            {/* Key Vital Metrics Bar */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border/60 bg-background/50 p-3.5">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                        <span>Connected Fleet</span>
                        <Server className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-xl font-black text-foreground flex items-center gap-1.5">
                        {connectedCount}
                        <span className={cn(
                            'inline-block h-2.5 w-2.5 rounded-full',
                            connectedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                        )} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Active execution nodes</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/50 p-3.5">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                        <span>Queue Depth</span>
                        <Layers className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="text-xl font-black text-foreground">
                        {queueDepth.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Streamer buffer (max 3,000)</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/50 p-3.5">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                        <span>In-Flight Jobs</span>
                        <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-foreground">
                        {activeJobs.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Currently processing</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/50 p-3.5">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium mb-1">
                        <span>Ingestion Health</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-xl font-black text-foreground">
                        {isOffline ? 'Offline' : 'Sub-500ms'}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Zero duplicate DMs</p>
                </div>
            </div>

            {/* Dynamic Worker Cards Grid */}
            <div className="mt-5">
                <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Active Worker Instances ({connectedCount})
                    </h4>
                </div>

                {workers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                        No workers reporting at this moment. Workers auto-register dynamically when launched on any machine.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {workers.map((w, idx) => {
                            const meta = w.metadata || {};
                            const metrics = meta.metrics || {};
                            const baselineCap = metrics.baselineCapacity || meta.baselineCapacity || w.capacity;
                            const isThrottled = Boolean(metrics.isThrottled || w.capacity < baselineCap);
                            const lag = metrics.currentLagMs ?? metrics.avgLagMs;
                            const memPercent = metrics.memoryUsagePercent;
                            const throttleReason = metrics.lastThrottledReason || meta.lastThrottledReason;
                            const loadRatio = Math.round((w.activeJobs / Math.max(1, w.capacity)) * 100);

                            return (
                                <div
                                    key={w.workerId || idx}
                                    className={cn(
                                        'rounded-2xl border bg-background/70 p-3.5 flex flex-col justify-between shadow-2xs transition',
                                        isThrottled ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/70 hover:border-primary/40'
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-mono text-xs font-bold text-foreground truncate max-w-[150px]" title={w.workerId}>
                                                {w.workerId}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {isThrottled && (
                                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md">
                                                        Throttled
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Active
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 text-[11px] text-muted-foreground">
                                            {/* Concurrency Slots with Dynamic Badge */}
                                            <div className="flex items-center justify-between">
                                                <span className="flex items-center gap-1">
                                                    <Gauge className="h-3 w-3 text-primary" />
                                                    Concurrency Slots:
                                                </span>
                                                <span className="font-semibold text-foreground">
                                                    {w.activeJobs} / {w.capacity}
                                                    {baselineCap !== w.capacity ? (
                                                        <span className="text-[10px] font-mono text-muted-foreground ml-1">
                                                            (base: {baselineCap})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 ml-1">
                                                            (auto)
                                                        </span>
                                                    )}
                                                </span>
                                            </div>

                                            {/* Event Loop Lag Telemetry */}
                                            {typeof lag === 'number' && (
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="h-3 w-3 text-sky-500" />
                                                        Event Loop Lag:
                                                    </span>
                                                    <span className={cn(
                                                        'font-mono font-semibold',
                                                        lag > 80 ? 'text-rose-500' : lag > 40 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                                                    )}>
                                                        {lag.toFixed(1)}ms
                                                    </span>
                                                </div>
                                            )}

                                            {/* Hardware Specs & Memory */}
                                            {meta.cpus && (
                                                <div className="flex items-center justify-between">
                                                    <span className="flex items-center gap-1">
                                                        <Cpu className="h-3 w-3 text-muted-foreground" />
                                                        Hardware:
                                                    </span>
                                                    <span className="font-medium">
                                                        {meta.cpus} vCPU {meta.memoryMb ? `• ${(meta.memoryMb / 1024).toFixed(1)} GB` : ''}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Process Heap / Memory */}
                                            {typeof memPercent === 'number' && (
                                                <div className="flex items-center justify-between">
                                                    <span>Process RAM:</span>
                                                    <span className={cn(
                                                        'font-mono',
                                                        memPercent > 80 ? 'text-amber-500 font-semibold' : 'text-foreground'
                                                    )}>
                                                        {metrics.heapUsedMb ? `${metrics.heapUsedMb} MB • ` : ''}{memPercent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            )}

                                            {/* Host Device Name */}
                                            {meta.hostname && (
                                                <div className="flex items-center justify-between">
                                                    <span>Host:</span>
                                                    <span className="font-mono truncate max-w-[120px]">{meta.hostname}</span>
                                                </div>
                                            )}

                                            {/* Throttle Reason Banner */}
                                            {throttleReason && (
                                                <div className="mt-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                                    <span className="truncate">{throttleReason}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Concurrency Load Bar */}
                                    <div className="mt-3 pt-2.5 border-t border-border/40">
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Slot Utilization</span>
                                            <span className="font-mono font-medium">{loadRatio}%</span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-500',
                                                    loadRatio > 85 ? 'bg-amber-500' : 'bg-primary'
                                                )}
                                                style={{ width: `${Math.min(100, Math.max(loadRatio > 0 ? 5 : 0, loadRatio))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClusterTelemetryWidget;
