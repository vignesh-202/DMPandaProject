const WebSocket = require('ws');

class StreamerClient {
    constructor({ worker, logger = console } = {}) {
        this.worker = worker;
        this.logger = logger;
        this.url = String(process.env.STREAMER_WS_URL || '').trim();
        this.sharedSecret = String(process.env.WORKER_SHARED_SECRET || '').trim();
        this.workerId = String(
            process.env.WORKER_INSTANCE_ID
            || worker?.workerInstanceId
            || `worker-${process.pid}`
        ).trim();
        this.capacity = Math.max(1, Number(process.env.WORKER_MAX_CONCURRENCY || 30) || 30);
        this.heartbeatIntervalMs = Math.max(1000, Number(process.env.WORKER_JOB_HEARTBEAT_INTERVAL_MS || 10000) || 10000);
        this.reconnectDelayMs = Math.max(1000, Number(process.env.WORKER_STREAM_RECONNECT_DELAY_MS || 2000) || 2000);
        this.ws = null;
        this.closed = false;
        this.reconnectTimer = null;
        this.activeJobs = new Map();
    }

    isEnabled() {
        return !!this.url;
    }

    start() {
        if (!this.url) {
            this.logger.log('Streamer WS URL not configured; worker stream client disabled.');
            return;
        }
        this.closed = false;
        this._connect();
    }

    stop() {
        this.closed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            try {
                this.ws.close();
            } catch (_) { }
            this.ws = null;
        }
        for (const job of this.activeJobs.values()) {
            if (job.heartbeatTimer) clearInterval(job.heartbeatTimer);
        }
        this.activeJobs.clear();
    }

    _connect() {
        if (this.closed || !this.url) return;
        const headers = {};
        if (this.sharedSecret) {
            headers['x-worker-secret'] = this.sharedSecret;
        }
        const ws = new WebSocket(this.url, { headers });
        this.ws = ws;

        ws.on('open', () => {
            this.logger.log(`Connected to streamer at ${this.url}`);
            this._send({
                type: 'worker.register',
                workerId: this.workerId,
                version: '1.0.0',
                capacity: this.capacity,
                activeJobs: this.activeJobs.size,
                metadata: {
                    role: 'slave',
                    pid: process.pid
                }
            });
        });

        ws.on('message', (data) => {
            this._handleMessage(data);
        });

        ws.on('close', () => {
            this.logger.warn('Streamer connection closed.');
            if (this.ws === ws) this.ws = null;
            this._scheduleReconnect();
        });

        ws.on('error', (error) => {
            this.logger.error('Streamer connection error:', error?.message || error);
        });
    }

    _scheduleReconnect() {
        if (this.closed || this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._connect();
        }, this.reconnectDelayMs);
    }

    _send(payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        try {
            this.ws.send(JSON.stringify(payload));
            return true;
        } catch (error) {
            this.logger.error('Failed to send streamer message:', error?.message || error);
            return false;
        }
    }

    _extractDerivedMeta(payload) {
        const entry = Array.isArray(payload?.entry) ? payload.entry[0] : null;
        if (!entry || typeof entry !== 'object') return null;

        const messaging = Array.isArray(entry.messaging) ? entry.messaging[0] : null;
        if (messaging && typeof messaging === 'object') {
            const recipientId = String(messaging?.recipient?.id || entry?.id || '').trim();
            const senderId = String(messaging?.sender?.id || '').trim();
            const eventType = messaging?.postback
                ? (messaging?.postback?.referral || messaging?.postback?.context ? 'share_referral' : 'postback')
                : 'message';
            const eventKey = String(
                messaging?.message?.mid
                || messaging?.postback?.mid
                || messaging?.postback?.title
                || ''
            ).trim();
            return {
                eventType,
                accountId: recipientId,
                recipientId,
                senderId,
                conversationKey: senderId && recipientId ? `${recipientId}:${senderId}` : '',
                eventKey
            };
        }

        const change = Array.isArray(entry.changes) ? entry.changes[0] : null;
        if (change && typeof change === 'object') {
            const field = String(change?.field || '').trim().toLowerCase();
            const value = change?.value || {};
            const recipientId = String(value?.recipient?.id || entry?.id || '').trim();
            const senderId = String(
                value?.from?.id
                || value?.sender?.id
                || value?.user?.id
                || value?.author?.id
                || value?.mentioned_by?.id
                || value?.user_id
                || value?.sender_id
                || ''
            ).trim();
            let eventType = '';
            if (field === 'comments' || field === 'live_comments') {
                eventType = 'comment';
            } else if (field === 'mentions' || field === 'mention' || field === 'story_mentions' || field.includes('mention')) {
                eventType = 'mention';
            }
            const entityId = String(value?.id || value?.comment_id || value?.media_id || value?.message || '').trim();
            return {
                eventType,
                accountId: recipientId,
                recipientId,
                senderId,
                conversationKey: senderId && recipientId ? `${recipientId}:${senderId}` : '',
                eventKey: eventType && recipientId && senderId && entityId
                    ? `${eventType}:${recipientId}:${senderId}:${entityId}`
                    : ''
            };
        }

        return null;
    }

    _validateAssignedJob(jobId, payload, meta) {
        const requiredFields = ['eventType', 'accountId', 'recipientId', 'senderId', 'conversationKey', 'eventKey'];
        if (!payload || typeof payload !== 'object' || !meta || typeof meta !== 'object') {
            const derived = this._extractDerivedMeta(payload);
            if (!derived) {
                return { valid: false, reason: 'invalid_job_payload', missing: requiredFields };
            }
            const missing = requiredFields.filter((field) => !String(derived[field] || '').trim());
            if (missing.length > 0) {
                return { valid: false, reason: 'invalid_job_payload', missing, derived };
            }
            return { valid: true, derived, effectiveMeta: derived };
        }
        const derived = this._extractDerivedMeta(payload);
        if (!derived) {
            return { valid: false, reason: 'invalid_job_payload', missing: requiredFields };
        }

        const readMetaField = (field) => {
            const aliases = {
                eventType: ['eventType', 'event_type'],
                accountId: ['accountId', 'account_id'],
                recipientId: ['recipientId', 'recipient_id'],
                senderId: ['senderId', 'sender_id'],
                conversationKey: ['conversationKey', 'conversation_key'],
                eventKey: ['eventKey', 'event_key']
            };
            const keys = aliases[field] || [field];
            for (const key of keys) {
                const value = String(meta?.[key] || '').trim();
                if (value) return value;
            }
            return '';
        };

        const effectiveMeta = {};
        const mismatched = [];
        const missing = [];
        for (const field of requiredFields) {
            const metaValue = readMetaField(field);
            const derivedValue = String(derived[field] || '').trim();
            if (metaValue && derivedValue && metaValue !== derivedValue) {
                mismatched.push(field);
            }
            const resolved = metaValue || derivedValue;
            if (!resolved) {
                missing.push(field);
            } else {
                effectiveMeta[field] = resolved;
            }
        }

        if (missing.length > 0) {
            return { valid: false, reason: 'invalid_job_payload', missing, derived };
        }
        if (mismatched.length > 0) {
            return { valid: false, reason: 'invalid_job_payload', mismatched, derived };
        }

        return { valid: true, derived, effectiveMeta };
    }

    async _handleMessage(data) {
        let message = null;
        try {
            message = JSON.parse(String(data || ''));
        } catch (_) {
            this.logger.warn('Ignoring invalid streamer message payload.');
            return;
        }
        if (!message || typeof message !== 'object') return;

        if (message.type === 'worker.registered') {
            this.logger.log(`Streamer registered worker ${this.workerId}.`);
            return;
        }

        if (message.type === 'job.assign') {
            await this._handleAssignedJob(message);
            return;
        }

        if (message.type === 'error') {
            this.logger.error('Streamer protocol error:', message.message || 'unknown');
        }
    }

    async _handleAssignedJob(message) {
        const jobId = String(message.jobId || '').trim();
        const payload = message.payload;
        const rawMeta = message.meta && typeof message.meta === 'object' ? message.meta : null;
        const meta = rawMeta || {};
        const validation = this._validateAssignedJob(jobId, payload, meta);
        if (!jobId || !validation.valid) {
            this.logger.warn(JSON.stringify({
                scope: 'worker_stream_validation',
                jobId,
                reason: validation.reason || 'invalid_job_payload',
                missing: validation.missing || [],
                mismatched: validation.mismatched || [],
                derived: validation.derived || null
            }));
            this._send({
                type: 'job.failed',
                workerId: this.workerId,
                jobId,
                retryable: true,
                error: 'invalid_job_payload'
            });
            return;
        }

        if (this.activeJobs.size >= this.capacity) {
            this._send({
                type: 'job.failed',
                workerId: this.workerId,
                jobId,
                retryable: true,
                error: 'worker_at_capacity'
            });
            return;
        }

        const heartbeatTimer = setInterval(() => {
            this._send({
                type: 'job.heartbeat',
                workerId: this.workerId,
                jobId
            });
        }, this.heartbeatIntervalMs);

        this.activeJobs.set(jobId, {
            heartbeatTimer,
            startedAt: Date.now()
        });

        this._send({
            type: 'job.accepted',
            workerId: this.workerId,
            jobId
        });

        try {
            const result = await this.worker.processWebhook(payload, validation.effectiveMeta || meta);
            const handled = result === true || result?.handled === true;
            this._send({
                type: 'job.completed',
                workerId: this.workerId,
                jobId,
                handled: handled === true,
                automationType: typeof result === 'object' ? result.automationType : undefined
            });
        } catch (error) {
            this.logger.error(`Assigned job ${jobId} failed:`, error?.message || error);
            this._send({
                type: 'job.failed',
                workerId: this.workerId,
                jobId,
                retryable: true,
                error: String(error?.message || error || 'worker_error').slice(0, 500)
            });
        } finally {
            const active = this.activeJobs.get(jobId);
            if (active?.heartbeatTimer) clearInterval(active.heartbeatTimer);
            this.activeJobs.delete(jobId);
        }
    }
}

module.exports = StreamerClient;
