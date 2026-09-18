const { WebSocketServer } = require('ws');
const EventEmitter = require('events');

class WorkerHub extends EventEmitter {
    constructor({ server, path = '/workers', sharedSecret = '', logger = console, callbacks = {} } = {}) {
        super();
        this.logger = logger;
        this.sharedSecret = String(sharedSecret || '').trim();
        this.callbacks = callbacks;
        this.workers = new Map();
        this.socketToWorkerId = new WeakMap();
        this.wss = new WebSocketServer({ server, path });
        this.wss.on('connection', (ws, req) => {
            if (this.sharedSecret) {
                const provided = String(req?.headers?.['x-worker-secret'] || '').trim();
                if (provided !== this.sharedSecret) {
                    ws.close(1008, 'unauthorized');
                    return;
                }
            }
            ws.on('message', (data) => this._handleMessage(ws, data));
            ws.on('close', () => this._handleClose(ws));
            ws.on('error', (error) => {
                this.logger.error('Worker socket error:', error?.message || error);
            });
        });
    }

    _handleMessage(ws, data) {
        let message = null;
        try {
            message = JSON.parse(String(data || ''));
        } catch (_) {
            this._send(ws, { type: 'error', message: 'invalid_json' });
            return;
        }
        if (!message || typeof message !== 'object') return;

        if (message.type === 'worker.register') {
            this._registerWorker(ws, message);
            return;
        }

        const workerId = this.socketToWorkerId.get(ws);
        if (!workerId) {
            this._send(ws, { type: 'error', message: 'worker_not_registered' });
            return;
        }

        const worker = this.workers.get(workerId);
        if (!worker) return;
        worker.lastSeenAt = Date.now();

        if (message.type === 'worker.capacity_update') {
            const newCapacity = Math.max(1, Number(message.capacity || 1) || 1);
            const oldCapacity = worker.capacity;
            worker.capacity = newCapacity;
            if (message.metrics && typeof message.metrics === 'object') {
                worker.metadata = {
                    ...worker.metadata,
                    metrics: message.metrics,
                    lastThrottledReason: message.reason || ''
                };
            }
            this.callbacks.onCapacityUpdated?.({
                workerId,
                oldCapacity,
                newCapacity,
                reason: message.reason || '',
                metrics: message.metrics || {}
            });
            this.emit('cluster_change', {
                event: 'worker.capacity_update',
                workerId,
                capacity: newCapacity,
                metrics: message.metrics || {},
                stats: this.getStats()
            });
            return;
        }

        if (message.type === 'job.accepted') {
            this.callbacks.onAccepted?.({ workerId, jobId: message.jobId });
            return;
        }
        if (message.type === 'job.heartbeat') {
            this.callbacks.onHeartbeat?.({ workerId, jobId: message.jobId });
            return;
        }
        if (message.type === 'job.completed') {
            worker.activeJobs.delete(String(message.jobId || '').trim());
            this.callbacks.onCompleted?.({
                workerId,
                jobId: message.jobId,
                handled: message.handled === true,
                retryable: message.retryable !== false,
                automationType: String(message.automationType || '').trim()
            });
            return;
        }
        if (message.type === 'job.failed') {
            worker.activeJobs.delete(String(message.jobId || '').trim());
            this.callbacks.onFailed?.({
                workerId,
                jobId: message.jobId,
                retryable: message.retryable !== false,
                error: message.error
            });
        }
    }

    _registerWorker(ws, message) {
        const workerId = String(message.workerId || '').trim();
        if (!workerId) {
            this._send(ws, { type: 'error', message: 'missing_worker_id' });
            return;
        }

        const existing = this.workers.get(workerId);
        if (existing?.ws && existing.ws !== ws) {
            try {
                existing.ws.close(1012, 'replaced');
            } catch (_) { }
        }

        this.workers.set(workerId, {
            ws,
            workerId,
            version: String(message.version || '').trim(),
            capacity: Math.max(1, Number(message.capacity || 1) || 1),
            activeJobs: new Set(),
            metadata: message.metadata && typeof message.metadata === 'object' ? message.metadata : {},
            lastSeenAt: Date.now()
        });
        this.socketToWorkerId.set(ws, workerId);
        this._send(ws, { type: 'worker.registered', workerId });
        this.callbacks.onRegistered?.({ workerId });
        this.emit('cluster_change', {
            event: 'worker.registered',
            workerId,
            stats: this.getStats()
        });
    }

    _handleClose(ws) {
        const workerId = this.socketToWorkerId.get(ws);
        if (!workerId) return;
        const worker = this.workers.get(workerId);
        this.workers.delete(workerId);
        this.socketToWorkerId.delete(ws);
        if (worker) {
            this.callbacks.onDisconnected?.({
                workerId,
                activeJobIds: Array.from(worker.activeJobs)
            });
            this.emit('cluster_change', {
                event: 'worker.disconnected',
                workerId,
                stats: this.getStats()
            });
        }
    }

    _send(ws, payload) {
        try {
            ws.send(JSON.stringify(payload));
            return true;
        } catch (error) {
            this.logger.error('Failed to send worker-hub message:', error?.message || error);
            return false;
        }
    }

    sendJob(workerId, job) {
        const worker = this.workers.get(String(workerId || '').trim());
        if (!worker || worker.ws.readyState !== 1) return false;
        worker.activeJobs.add(job.jobId);
        const sent = this._send(worker.ws, {
            type: 'job.assign',
            jobId: job.jobId,
            attempt: job.attempts,
            conversationKey: job.conversationKey,
            payload: job.payload,
            meta: job.meta && typeof job.meta === 'object' ? job.meta : {}
        });
        if (!sent) {
            worker.activeJobs.delete(job.jobId);
            return false;
        }
        return true;
    }

    releaseJob(workerId, jobId) {
        const worker = this.workers.get(String(workerId || '').trim());
        if (!worker) return;
        worker.activeJobs.delete(String(jobId || '').trim());
    }

    getAvailableWorkers() {
        return Array.from(this.workers.values()).filter((worker) => {
            return worker.ws.readyState === 1 && worker.activeJobs.size < worker.capacity;
        });
    }

    getStats() {
        return {
            connectedWorkers: this.workers.size,
            workers: Array.from(this.workers.values()).map((worker) => ({
                workerId: worker.workerId,
                capacity: worker.capacity,
                activeJobs: worker.activeJobs.size,
                lastSeenAt: worker.lastSeenAt,
                metadata: worker.metadata || {}
            }))
        };
    }
}

module.exports = WorkerHub;
