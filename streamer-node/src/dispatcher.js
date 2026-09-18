class Dispatcher {
    constructor({ store, hub, logger = console } = {}) {
        this.store = store;
        this.hub = hub;
        this.logger = logger;
        this.roundRobinCursor = 0;
        this.dispatching = false;
        this.needsRerun = false;
        this.accountAffinity = new Map(); // accountId -> workerId
    }

    trigger() {
        if (this.dispatching) {
            this.needsRerun = true;
            return;
        }
        void this._dispatchLoop();
    }

    clearWorkerAffinity(workerId) {
        const safeWorkerId = String(workerId || '').trim();
        if (!safeWorkerId) return;
        for (const [accountId, assignedWorkerId] of this.accountAffinity.entries()) {
            if (assignedWorkerId === safeWorkerId) {
                this.accountAffinity.delete(accountId);
            }
        }
    }

    _pickWorkerForJob(job) {
        const available = this.hub.getAvailableWorkers();
        if (!available.length) return null;

        const accountId = String(job?.accountId || '').trim();
        if (accountId && this.accountAffinity.has(accountId)) {
            const preferredWorkerId = this.accountAffinity.get(accountId);
            // Check if preferred worker is healthy and has capacity
            const preferred = available.find((w) => w.workerId === preferredWorkerId && w.activeJobs.size < w.capacity);
            if (preferred) {
                return preferred;
            }
            // If preferred worker is disconnected, evict stale affinity
            const stillConnected = this.hub.workers.has(preferredWorkerId);
            if (!stillConnected) {
                this.accountAffinity.delete(accountId);
            }
        }

        // Pick least loaded worker to balance 5-10 workers dynamically
        available.sort((a, b) => {
            const loadA = a.activeJobs.size / Math.max(1, a.capacity);
            const loadB = b.activeJobs.size / Math.max(1, b.capacity);
            return loadA - loadB;
        });

        const selected = available[0] || null;
        if (accountId && selected) {
            this.accountAffinity.set(accountId, selected.workerId);
        }
        return selected;
    }

    async _dispatchLoop() {
        this.dispatching = true;
        try {
            while (true) {
                const job = this.store.getDispatchablePendingJob();
                if (!job) break;
                const worker = this._pickWorkerForJob(job);
                if (!worker) break;

                this.store.markAssigned(job.jobId, worker.workerId);
                const sent = this.hub.sendJob(worker.workerId, job);
                if (!sent) {
                    this.store.requeue(job.jobId, 'worker_send_failed');
                    continue;
                }
            }
        } finally {
            this.dispatching = false;
            if (this.needsRerun) {
                this.needsRerun = false;
                this.trigger();
            }
        }
    }
}

module.exports = Dispatcher;
