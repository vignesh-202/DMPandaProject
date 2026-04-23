const http = require('http');
const express = require('express');
const morgan = require('morgan');
require('dotenv').config();

const { registerWebhookRoutes } = require('./src/webhook-server');
const { splitWebhookPayload } = require('./src/meta-parser');
const JobStore = require('./src/job-store');
const WorkerHub = require('./src/worker-hub');
const Dispatcher = require('./src/dispatcher');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3010;

const store = new JobStore({
    maxAttempts: Math.max(1, Number(process.env.STREAMER_MAX_JOB_ATTEMPTS || 5) || 5)
});
const welcomeWindowMs = Math.max(
    60_000,
    Number(process.env.WELCOME_MESSAGE_WINDOW_MS || 24 * 60 * 60 * 1000) || (24 * 60 * 60 * 1000)
);
const recentWelcomeReplies = new Map();

function pruneRecentWelcomeReplies(now = Date.now()) {
    for (const [conversationKey, expiresAt] of recentWelcomeReplies.entries()) {
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
            recentWelcomeReplies.delete(conversationKey);
        }
    }
}

function hasRecentWelcomeReply(conversationKey, now = Date.now()) {
    pruneRecentWelcomeReplies(now);
    const expiresAt = recentWelcomeReplies.get(String(conversationKey || '').trim());
    return Number.isFinite(expiresAt) && expiresAt > now;
}

function rememberWelcomeReply(conversationKey, now = Date.now()) {
    const safeConversationKey = String(conversationKey || '').trim();
    if (!safeConversationKey) return;
    pruneRecentWelcomeReplies(now);
    recentWelcomeReplies.set(safeConversationKey, now + welcomeWindowMs);
}

let dispatcher = null;
const hub = new WorkerHub({
    server,
    path: '/workers',
    sharedSecret: process.env.WORKER_SHARED_SECRET || '',
    callbacks: {
        onRegistered: () => dispatcher?.trigger(),
        onAccepted: ({ jobId }) => {
            store.markAccepted(jobId);
        },
        onHeartbeat: ({ jobId }) => {
            store.markHeartbeat(jobId);
        },
        onCompleted: ({ jobId, handled, automationType }) => {
            const job = store.getJob(jobId);
            if (job?.assignedWorkerId) {
                hub.releaseJob(job.assignedWorkerId, jobId);
            }
            if (handled === false) {
                const result = store.requeue(jobId, 'worker_reported_unhandled');
                if (result.dropped) {
                    console.warn(`Dropped job ${jobId} after worker reported handled=false.`);
                }
                dispatcher?.trigger();
                return;
            }
            if (String(automationType || '').trim().toLowerCase() === 'welcome_message' && job?.conversationKey) {
                rememberWelcomeReply(job.conversationKey);
            }
            store.markCompleted(jobId);
            dispatcher?.trigger();
        },
        onFailed: ({ workerId, jobId, error }) => {
            if (workerId) {
                hub.releaseJob(workerId, jobId);
            }
            const result = store.requeue(jobId, error || 'job_failed');
            if (result.dropped) {
                console.warn(`Dropped job ${jobId} after max attempts.`);
            }
            dispatcher?.trigger();
        },
        onDisconnected: ({ workerId }) => {
            const results = store.releaseWorkerJobs(workerId, 'worker_disconnected');
            for (const result of results) {
                if (result.workerId) {
                    hub.releaseJob(result.workerId, result.job?.jobId);
                }
                if (result.dropped) {
                    console.warn(`Dropped job ${result.job?.jobId || 'unknown'} after worker disconnect retries.`);
                }
            }
            dispatcher?.trigger();
        }
    }
});

dispatcher = new Dispatcher({ store, hub });

app.use(morgan(':date[iso] :method :url :status :response-time ms - :res[content-length]'));

registerWebhookRoutes(app, {
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    onWebhook: async (payload) => {
        pruneRecentWelcomeReplies();
        const jobs = splitWebhookPayload(payload).map((job) => ({
            ...job,
            meta: {
                welcomeSentRecently: hasRecentWelcomeReply(job.conversationKey)
            }
        }));
        const accepted = store.enqueueMany(jobs);
        dispatcher.trigger();
        return { accepted: accepted.length };
    },
    getStats: () => ({
        role: 'master',
        ...store.getStats(),
        ...hub.getStats(),
        recentWelcomeWindows: recentWelcomeReplies.size
    })
});

const assignTimeoutMs = Math.max(1000, Number(process.env.STREAMER_ASSIGN_TIMEOUT_MS || 3000) || 3000);
const heartbeatTimeoutMs = Math.max(5000, Number(process.env.STREAMER_JOB_HEARTBEAT_TIMEOUT_MS || 30000) || 30000);
const sweepIntervalMs = Math.max(500, Number(process.env.STREAMER_TIMEOUT_SWEEP_MS || 2000) || 2000);

setInterval(() => {
    const timedOut = store.sweepTimeouts({
        assignTimeoutMs,
        heartbeatTimeoutMs
    });
    for (const result of timedOut) {
        if (result.workerId) {
            hub.releaseJob(result.workerId, result.job?.jobId);
        }
        if (result.dropped) {
            console.warn(`Dropped job ${result.job?.jobId || 'unknown'} after ${result.reason}.`);
        }
    }
    if (timedOut.length) {
        dispatcher.trigger();
    }
}, sweepIntervalMs);

server.listen(port, () => {
    console.log(`Streamer node listening at http://localhost:${port}`);
});
