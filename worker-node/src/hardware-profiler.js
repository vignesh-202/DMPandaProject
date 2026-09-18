const EventEmitter = require('events');
const os = require('os');
const { performance } = require('perf_hooks');

class HardwareProfiler extends EventEmitter {
    constructor({
        sampleIntervalMs = 5000,
        lagThresholdCriticalMs = 80,
        lagThresholdWarningMs = 35,
        minCapacity = 2,
        maxCapacity = null,
        logger = console
    } = {}) {
        super();
        this.logger = logger;
        this.sampleIntervalMs = Math.max(2000, sampleIntervalMs);
        this.lagThresholdCriticalMs = lagThresholdCriticalMs;
        this.lagThresholdWarningMs = lagThresholdWarningMs;

        const cpus = os.cpus()?.length || 2;
        const totalRamMb = Math.round(os.totalmem() / (1024 * 1024));
        const freeRamMb = Math.round(os.freemem() / (1024 * 1024));

        // Memory budget calculation: ~35 MB per active concurrent task
        const ramAllowedSlots = Math.max(2, Math.floor(freeRamMb / 35));
        const cpuAllowedSlots = Math.max(2, cpus * 6);
        const autoBaseCapacity = Math.max(2, Math.min(cpuAllowedSlots, ramAllowedSlots));

        const explicitMax = Number(process.env.WORKER_MAX_CONCURRENCY);
        this.maxCapacity = (Number.isFinite(explicitMax) && explicitMax > 0)
            ? explicitMax
            : (maxCapacity || autoBaseCapacity);

        this.minCapacity = Math.max(1, Math.min(minCapacity, this.maxCapacity));
        this.currentCapacity = this.maxCapacity;

        this.eventLoopLagMs = 0;
        this.consecutiveCleanCycles = 0;
        this.lastLagCheck = performance.now();
        this.lagCheckTimer = null;
        this.sampleTimer = null;
        this.running = false;

        this.hardwareSpecs = {
            hostname: os.hostname(),
            platform: os.platform(),
            cpus,
            totalRamMb,
            baseCapacity: autoBaseCapacity,
            maxCapacity: this.maxCapacity,
            minCapacity: this.minCapacity
        };
    }

    start() {
        if (this.running) return;
        this.running = true;

        // Micro-timer to gauge Event Loop Lag (measures delay against a 500ms expected tick)
        let lastTick = performance.now();
        this.lagCheckTimer = setInterval(() => {
            const now = performance.now();
            const delta = now - lastTick;
            lastTick = now;
            // Expected tick is 500ms; any excess is event loop delay/lag
            const lag = Math.max(0, delta - 500);
            // Exponential smoothing for stable lag metrics
            this.eventLoopLagMs = Math.round((this.eventLoopLagMs * 0.6) + (lag * 0.4));
        }, 500);

        // Periodic Governor Loop for AIMD capacity adjustment
        this.sampleTimer = setInterval(() => {
            this._evaluateCapacity();
        }, this.sampleIntervalMs);
    }

    stop() {
        this.running = false;
        if (this.lagCheckTimer) {
            clearInterval(this.lagCheckTimer);
            this.lagCheckTimer = null;
        }
        if (this.sampleTimer) {
            clearInterval(this.sampleTimer);
            this.sampleTimer = null;
        }
    }

    _evaluateCapacity() {
        const mem = process.memoryUsage();
        const rssMb = Math.round(mem.rss / (1024 * 1024));
        const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
        const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
        const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
        const sysMemUsedPercent = totalMemMb > 0 ? Math.round(((totalMemMb - freeMemMb) / totalMemMb) * 100) : 0;

        let underPressure = false;
        let pressureReason = '';

        // Condition 1: Event loop is significantly lagging
        if (this.eventLoopLagMs >= this.lagThresholdCriticalMs) {
            underPressure = true;
            pressureReason = `high_event_loop_lag (${this.eventLoopLagMs}ms >= ${this.lagThresholdCriticalMs}ms)`;
        }
        // Condition 2: System is nearly out of RAM (< 10% free)
        else if (sysMemUsedPercent >= 90) {
            underPressure = true;
            pressureReason = `low_system_memory (${sysMemUsedPercent}% used, ${freeMemMb}MB free)`;
        }
        // Condition 3: Process RSS is dangerously high (> 1200MB on standard Node process)
        else if (rssMb > 1200) {
            underPressure = true;
            pressureReason = `high_process_rss (${rssMb}MB)`;
        }

        const oldCapacity = this.currentCapacity;

        if (underPressure) {
            this.consecutiveCleanCycles = 0;
            // Multiplicative Decrease: Drop slots by 25% immediately
            const target = Math.max(this.minCapacity, Math.floor(this.currentCapacity * 0.75));
            if (target < this.currentCapacity) {
                this.currentCapacity = target;
                this.logger.warn(`[HardwareProfiler] Backpressure detected: ${pressureReason}. Contracted slots: ${oldCapacity} -> ${this.currentCapacity}`);
                this.emit('capacity_change', {
                    capacity: this.currentCapacity,
                    reason: pressureReason,
                    metrics: this.getMetrics()
                });
            }
        } else if (this.eventLoopLagMs < this.lagThresholdWarningMs) {
            this.consecutiveCleanCycles += 1;
            // Additive Increase: After 3 consecutive healthy cycles (15s), increment slots by +1
            if (this.consecutiveCleanCycles >= 3 && this.currentCapacity < this.maxCapacity) {
                this.currentCapacity += 1;
                this.consecutiveCleanCycles = 0;
                this.logger.log(`[HardwareProfiler] Sustained optimal latency (${this.eventLoopLagMs}ms lag). Expanded slots: ${oldCapacity} -> ${this.currentCapacity}`);
                this.emit('capacity_change', {
                    capacity: this.currentCapacity,
                    reason: 'sustained_healthy_performance',
                    metrics: this.getMetrics()
                });
            }
        } else {
            // In warning band (between 35ms and 80ms) -> freeze scaling
            this.consecutiveCleanCycles = 0;
        }
    }

    getMetrics() {
        const mem = process.memoryUsage();
        return {
            eventLoopLagMs: this.eventLoopLagMs,
            processRssMb: Math.round(mem.rss / (1024 * 1024)),
            heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
            freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
            capacity: this.currentCapacity,
            maxCapacity: this.maxCapacity,
            minCapacity: this.minCapacity,
            status: this.eventLoopLagMs >= this.lagThresholdCriticalMs
                ? 'throttled'
                : this.eventLoopLagMs >= this.lagThresholdWarningMs
                    ? 'elevated'
                    : 'healthy'
        };
    }
}

module.exports = HardwareProfiler;
