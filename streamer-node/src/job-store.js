const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class JobStore {
    constructor({ maxAttempts = 5, eventKeyTtlMs = 10 * 60 * 1000, maxQueueSize = 3000, walPath } = {}) {
        this.maxAttempts = Math.max(1, Number(maxAttempts) || 5);
        this.eventKeyTtlMs = Math.max(1000, Number(eventKeyTtlMs) || (10 * 60 * 1000));
        this.maxQueueSize = Math.max(1, Number(process.env.STREAMER_MAX_QUEUE_SIZE || maxQueueSize) || 3000);
        this.walPath = walPath || path.join(__dirname, '../data/eventkeys.wal');
        this.jobs = new Map();
        this.pendingQueue = [];
        this.conversationInFlight = new Map();
        this.eventKeyIndex = new Map();
        this.recentEventKeys = new Map();
        this.shedJobsCount = 0;

        this._initWal();
    }

    _initWal() {
        try {
            const dir = path.dirname(this.walPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fs.existsSync(this.walPath)) {
                const now = Date.now();
                const content = fs.readFileSync(this.walPath, 'utf8');
                const lines = content.split('\n');
                let validLines = [];
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const [tsStr, key] = trimmed.split('\t');
                    const ts = Number(tsStr);
                    if (ts && key && (now - ts) < this.eventKeyTtlMs) {
                        this.recentEventKeys.set(key, ts + this.eventKeyTtlMs);
                        validLines.push(trimmed);
                    }
                }
                // Compact WAL to only valid recent lines
                fs.writeFileSync(this.walPath, validLines.join('\n') + (validLines.length ? '\n' : ''));
            }
        } catch (err) {
            // Non-fatal, fallback to memory
        }
    }

    _appendWal(eventKey) {
        if (!eventKey) return;
        try {
            const line = `${Date.now()}\t${eventKey}\n`;
            fs.appendFile(this.walPath, line, () => {});
        } catch (_) {}
    }

    enqueueMany(jobInputs = []) {
        const created = [];
        this._cleanupRecentEventKeys();
        for (const input of jobInputs) {
            const eventKey = String(input?.eventKey || '').trim();
            if (eventKey && (this.eventKeyIndex.has(eventKey) || this.recentEventKeys.has(eventKey))) {
                continue;
            }

            if (eventKey) {
                this._appendWal(eventKey);
            }

            // Server 2 RAM Guard: If pending queue hits max threshold, shed oldest unassigned job
            if (this.pendingQueue.length >= this.maxQueueSize) {
                while (this.pendingQueue.length >= this.maxQueueSize) {
                    const dropJobId = this.pendingQueue.shift();
                    const dropJob = this.jobs.get(dropJobId);
                    if (dropJob && dropJob.state === 'pending') {
                        this.jobs.delete(dropJobId);
                        if (dropJob.eventKey) {
                            this._deleteIndexedEventKey(dropJob.eventKey, dropJobId);
                        }
                        this.shedJobsCount += 1;
                    }
                }
            }

            const jobId = crypto.randomUUID();
            const job = {
                jobId,
                payload: input.payload,
                eventType: String(input.eventType || 'message'),
                accountId: String(input.accountId || '').trim(),
                senderId: String(input.senderId || '').trim(),
                recipientId: String(input.recipientId || '').trim(),
                conversationKey: String(input.conversationKey || 'unknown:unknown').trim(),
                eventKey,
                meta: input.meta && typeof input.meta === 'object' ? { ...input.meta } : {},
                attempts: 0,
                state: 'pending',
                assignedWorkerId: null,
                createdAt: Date.now(),
                assignedAt: null,
                heartbeatAt: null,
                acceptedAt: null,
                lastError: ''
            };
            this.jobs.set(jobId, job);
            if (eventKey) {
                this.eventKeyIndex.set(eventKey, jobId);
            }
            this.pendingQueue.push(jobId);
            created.push(job);
        }
        return created;
    }

    getStats() {
        let assigned = 0;
        let processing = 0;
        let pending = 0;
        for (const job of this.jobs.values()) {
            if (job.state === 'assigned') assigned += 1;
            else if (job.state === 'processing') processing += 1;
            else if (job.state === 'pending') pending += 1;
        }
        return {
            totalJobs: this.jobs.size,
            pendingJobs: pending,
            assignedJobs: assigned,
            processingJobs: processing,
            conversationsInFlight: this.conversationInFlight.size,
            recentEventKeys: this.recentEventKeys.size,
            shedJobsCount: this.shedJobsCount,
            maxQueueSize: this.maxQueueSize
        };
    }


    getJob(jobId) {
        return this.jobs.get(String(jobId || '').trim()) || null;
    }

    getDispatchablePendingJob() {
        for (const jobId of this.pendingQueue) {
            const job = this.jobs.get(jobId);
            if (!job || job.state !== 'pending') continue;
            if (this.conversationInFlight.has(job.conversationKey)) continue;
            return job;
        }
        return null;
    }

    markAssigned(jobId, workerId) {
        const job = this.getJob(jobId);
        if (!job) return null;
        job.attempts += 1;
        job.state = 'assigned';
        job.assignedWorkerId = String(workerId || '').trim() || null;
        job.assignedAt = Date.now();
        job.acceptedAt = null;
        job.heartbeatAt = job.assignedAt;
        this.conversationInFlight.set(job.conversationKey, job.jobId);
        return job;
    }

    markAccepted(jobId) {
        const job = this.getJob(jobId);
        if (!job) return null;
        job.state = 'processing';
        job.acceptedAt = Date.now();
        job.heartbeatAt = job.acceptedAt;
        return job;
    }

    markHeartbeat(jobId) {
        const job = this.getJob(jobId);
        if (!job) return null;
        job.heartbeatAt = Date.now();
        return job;
    }

    markCompleted(jobId) {
        const job = this.getJob(jobId);
        if (!job) return null;
        this.conversationInFlight.delete(job.conversationKey);
        this._rememberCompletedEventKey(job.eventKey);
        this._deleteIndexedEventKey(job.eventKey, job.jobId);
        this.jobs.delete(job.jobId);
        this._compactQueue();
        return job;
    }

    requeue(jobId, reason = 'retry') {
        const job = this.getJob(jobId);
        if (!job) return { job: null, dropped: false };
        const previousWorkerId = job.assignedWorkerId;

        this.conversationInFlight.delete(job.conversationKey);
        job.assignedWorkerId = null;
        job.assignedAt = null;
        job.acceptedAt = null;
        job.heartbeatAt = null;
        job.lastError = String(reason || '').trim();

        if (job.attempts >= this.maxAttempts) {
            this._rememberCompletedEventKey(job.eventKey);
            this._deleteIndexedEventKey(job.eventKey, job.jobId);
            this.jobs.delete(job.jobId);
            this._compactQueue();
            return { job, dropped: true, workerId: previousWorkerId };
        }

        job.state = 'pending';
        this.pendingQueue.push(job.jobId);
        this._compactQueue();
        return { job, dropped: false, workerId: previousWorkerId };
    }

    releaseWorkerJobs(workerId, reason = 'worker_disconnect') {
        const safeWorkerId = String(workerId || '').trim();
        const affected = [];
        for (const job of this.jobs.values()) {
            if (job.assignedWorkerId !== safeWorkerId) continue;
            affected.push({
                ...this.requeue(job.jobId, reason),
                workerId: safeWorkerId
            });
        }
        return affected;
    }

    sweepTimeouts({ assignTimeoutMs, heartbeatTimeoutMs, now = Date.now() }) {
        const results = [];
        for (const job of this.jobs.values()) {
            if (job.state === 'assigned' && job.assignedAt && (now - job.assignedAt) > assignTimeoutMs) {
                results.push({
                    reason: 'accept_timeout',
                    ...this.requeue(job.jobId, 'accept_timeout')
                });
                continue;
            }
            if (job.state === 'processing' && job.heartbeatAt && (now - job.heartbeatAt) > heartbeatTimeoutMs) {
                results.push({
                    reason: 'heartbeat_timeout',
                    ...this.requeue(job.jobId, 'heartbeat_timeout')
                });
            }
        }
        return results;
    }

    _compactQueue() {
        const next = [];
        const seen = new Set();
        for (const jobId of this.pendingQueue) {
            if (seen.has(jobId)) continue;
            const job = this.jobs.get(jobId);
            if (!job || job.state !== 'pending') continue;
            seen.add(jobId);
            next.push(jobId);
        }
        this.pendingQueue = next;
    }

    _cleanupRecentEventKeys(now = Date.now()) {
        for (const [eventKey, expiresAt] of this.recentEventKeys.entries()) {
            if (!Number.isFinite(expiresAt) || expiresAt <= now) {
                this.recentEventKeys.delete(eventKey);
            }
        }
    }

    _rememberCompletedEventKey(eventKey) {
        const safeEventKey = String(eventKey || '').trim();
        if (!safeEventKey) return;
        this._cleanupRecentEventKeys();
        this.recentEventKeys.set(safeEventKey, Date.now() + this.eventKeyTtlMs);
    }

    _deleteIndexedEventKey(eventKey, jobId) {
        const safeEventKey = String(eventKey || '').trim();
        if (!safeEventKey) return;
        if (this.eventKeyIndex.get(safeEventKey) === String(jobId || '').trim()) {
            this.eventKeyIndex.delete(safeEventKey);
        }
    }
}

module.exports = JobStore;
