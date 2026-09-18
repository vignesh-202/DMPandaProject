# High-Scale Webhook & Distributed Worker Architecture

## 1. Overview & Hardware Topology
DM Panda is engineered to handle **thousands of concurrent Instagram/Meta webhook requests** while maintaining real-time sub-second execution, zero duplicate responses, **100% accurate action & API usage calculation**, **complete resilience to ephemeral worker churn**, and **real-time cluster telemetry for the Admin Panel without flooding Server 1 with event-key records**.

### Physical Server Topology:
| Server | Role | Hardware Specs | Key Workloads | Optimization Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Server 1** | Database & Auth | 2 vCPU, 8 GB RAM, 100 GB SSD | Appwrite (Traefik, MariaDB, Appwrite Backend) | **98% Read Offload**: Shielded by in-memory caching. Batch log & usage writes. Zero ephemeral event-key writes. |
| **Server 2** | Web & Streamer | 4 vCPU, 4 GB RAM, 100 GB SSD | Hostinger Cloud Startup: WordPress, VVDeals, Frontend, Backend API, `streamer-node` | **Ultra-Lean Relay**: Max 100 MB RAM cap. No DB queries. Immediate noise dropping. Real-time metrics hub. |
| **Ephemeral Fleet (5–10 Workers)** | Execution Fleet | 1 GB to 4 GB RAM per VPS / Device | Disposable `worker-node` instances connected via WebSockets to Server 2 | **Tiny-LRU Caching (<5MB)**: In-memory atomic deduplication. Soft affinity with instant failover. Zero DB lock pollution. |

---

## 2. Core Architectural Pillars

### Pillar 1: Sub-Second Real-Time Execution Speed
To make automated replies feel instantaneous to Instagram followers (arriving within **300ms–600ms** of a comment or DM):
* **Zero Database Reads in Hot Path**:
  `worker-node` caches the Instagram access token, active automations, and keyword rules in a local Tiny-LRU cache (30s–60s TTL).
* **1ms Keyword & Template Matching**:
  When a comment arrives, keyword parsing and template rendering execute in memory in **<1ms**.
* **Direct Outbound Dispatch**:
  The only network round-trip is the outbound HTTPS call to the Instagram Graph API (`graph.instagram.com`).

### Pillar 2: Zero DB Event-Key Flooding & 4-Layer Deduplication with SSD WAL
* **The Danger of Flooding Appwrite with Event Keys**:
  If workers wrote a lock/deduplication document into Appwrite for every single webhook event, a burst of 10,000 comments would generate **20,000 write operations** (`createDocument` + `updateDocument`) on Server 1, bringing the 2 vCPU MariaDB to an instant halt.
* **The Zero-DB Deduplication Solution**:
  1. **Layer 1 (Meta HMAC-SHA256 Verification & Ingestion Gate)**: Incoming webhooks are validated against `META_APP_SECRET` using raw request payload comparison before any parsing. Invalid signatures are discarded at the edge.
  2. **Layer 2 (Streamer Memory + SSD Write-Ahead Log Deduplication)**: Meta message IDs (`mid`) and comment IDs are tracked in `streamer-node`'s in-memory index (`eventKeyIndex`) and backed by a local SSD Write-Ahead Log (`./data/eventkeys.wal`). On reboot, recent event keys hydrate in <10ms, permanently preventing duplicate DMs across process restarts.
  3. **Layer 3 (In-Flight Conversation Locking)**: `streamer-node` locks active `recipientId:senderId` threads, preventing parallel execution for the same user.
  4. **Layer 4 (Worker In-Memory Atomic Lock)**: Before calling Meta, `worker-node` verifies its local atomic Set `${accountId}:${eventType}:${eventKey}`.
  5. **Layer 5 (Persistent Cooldowns Only When Configured)**: Appwrite is **NEVER** flooded with transient event locks. Only legitimate 24h user cooldowns (`once_per_user_24h: true`) and final execution logs are written, and those are batched.

### Pillar 3: Ephemeral Elastic Worker Fleet ($0 \le N \le \infty$) ("Cattle, Not Pets")
* **Soft Account Affinity with Instant Dead-Worker Eviction**:
  * `streamer-node` routes jobs for `accountId` to the warm worker as a cache hint.
  * When a worker disconnects or crashes:
    1. It is immediately evicted from the active pool.
    2. All affinity pointers to the dead worker are wiped.
    3. In-flight uncompleted jobs are re-queued to `pending` and re-dispatched to another healthy worker.
    4. The new worker cold-starts its cache in 1 DB read, maintaining 99.9% uptime.
* **1-Minute Elastic Onboarding from Any Device**:
  * Workers require zero master Appwrite API keys. They connect purely via secure WebSocket to `streamer-node`:
    ```env
    STREAMER_WS_URL=wss://webhook.dmpanda.com/workers
    WORKER_SHARED_SECRET=your_secret
    ```
  * Auto-tunes concurrency based on device CPU cores (`cpus * 5`).
  * Telemetry reports device hostname, platform, CPU count, and memory to the Admin Panel.
* **Graceful Worker Shutdown (`SIGINT`/`SIGTERM`)**:
  Workers finish in-flight jobs (<500ms), flush pending log/metric buffers, and disconnect cleanly.

### Pillar 4: Accurate Action Calculation & Dashboard Analytics
* **Elimination of Lost-Update Race Conditions via Account Affinity**:
  All concurrent jobs for `Account A` route to the *same* worker instance, acting as the single atomic coordinator. The worker accumulates action usage deltas locally and flushes in batches, eliminating concurrent overwrites.
* **Pre-Execution Overdraft Prevention**:
  The worker checks in-memory `allocated_credits - (actions_used + pending_in_flight) >= 1`. If an account has 3 credits left and 50 comments hit in 1 second, exactly 3 execute and 47 are gated as `hourly_action_limit_reached`.
* **Backend Dashboard Read Caching**:
  In `Backend/routes/dashboard.js`, user overview metrics are cached in memory for 5 seconds to prevent multiple rapid dashboard refreshes from hammering Server 1's MariaDB with 5,000-document log scans.

### Pillar 5: Real-Time Admin Panel Telemetry (Zero Load on Server 1)
* **Real-Time Swarm & Ingestion Metrics Endpoint (`/api/admin/cluster/status`)**:
  Instead of the Admin Panel running heavy database queries on Server 1 to check system health, the Backend queries `streamer-node/metrics` directly over the local network (Server 2 RAM).
* **Metrics Provided to Admin Panel**:
  - **Live Worker Fleet**: List of connected workers, worker IDs, device hostnames, OS platforms, memory usage, active jobs vs max capacity, and last heartbeat timestamps.
  - **Live Queue Health**: Pending jobs, assigned jobs, processing jobs, and conversations in flight.
  - **Throughput & Noise Telemetry**: Webhooks received/min, noise dropped/min, and average execution time.
  - **Meta 750/hr Radar**: Platform safety gauge tracking action velocity vs Instagram's 750 actions/hr account hard ceiling.
* **Zero Database Impact**: The Admin Panel polls live cluster metrics from RAM in **<2ms** without querying MariaDB.

---

## 3. Worker Contract & Error Handling

### Non-Retryable Rejection Contract
When an event does not trigger an automation (e.g. no matching keyword, self-authored message, active cooldown), `worker-node` returns:
```json
{
  "handled": false,
  "retryable": false,
  "automationType": "no_keyword_match"
}
```
`streamer-node` immediately closes the job without re-queueing, permanently eliminating the 5x retry storm.

---

## 4. Scaling & Swarm Management Guide
* **Starting Workers Anywhere in 60 Seconds**: Workers can run on any VPS, local machine, or cloud instance:
  ```bash
  git clone https://github.com/vignesh-202/DMPandaProject.git
  cd DMPandaProject/worker-node
  npm install
  cp .env.example .env
  # Set STREAMER_WS_URL and WORKER_SHARED_SECRET
  npm start
  ```
  The streamer dynamically absorbs the new worker into the pool with **zero configuration changes, zero database credentials, and zero downtime**.
