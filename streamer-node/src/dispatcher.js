class Dispatcher {
    constructor({ store, hub, logger = console } = {}) {
        this.store = store;
        this.hub = hub;
        this.logger = logger;
        this.roundRobinCursor = 0;
        this.dispatching = false;
        this.needsRerun = false;
    }

    trigger() {
        if (this.dispatching) {
            this.needsRerun = true;
            return;
        }
        void this._dispatchLoop();
    }

    _pickWorker() {
        const available = this.hub.getAvailableWorkers();
        if (!available.length) return null;
        if (this.roundRobinCursor >= available.length) this.roundRobinCursor = 0;
        const worker = available[this.roundRobinCursor];
        this.roundRobinCursor = (this.roundRobinCursor + 1) % available.length;
        return worker;
    }

    async _dispatchLoop() {
        this.dispatching = true;
        try {
            while (true) {
                const job = this.store.getDispatchablePendingJob();
                if (!job) break;
                const worker = this._pickWorker();
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
