# Job Queue System

An async job processing system built with Node.js, BullMQ, Redis, and PostgreSQL. Supports multiple job types with retry logic, concurrency control, and real-time status updates via WebSockets.

## Architecture

Client → Express REST API → BullMQ Queue (Redis) → Workers → PostgreSQL
                                                        ↓
                                              WebSocket → Client

## Tech Stack

- **Runtime** — Node.js, Express.js
- **Queue** — BullMQ backed by Redis
- **Database** — PostgreSQL (job records, history)
- **Cache/Queue Store** — Redis
- **Real-time** — Socket.io WebSockets
- **Infrastructure** — Docker, docker-compose
- **Load Testing** — k6

## Job Types

| Type | Payload | Processing Time |
|------|---------|-----------------|
| email | recipient, subject, body | ~1s |
| image-resize | imageUrl, dimensions | ~2s |
| report | reportType | ~3s |

## Features

- Three job types with independent processing logic
- Retry logic with exponential backoff — 3 attempts, delays of 1s, 2s, 4s
- Concurrency 5 — processes 5 jobs simultaneously
- Dead letter queue — permanently failed jobs tracked in PostgreSQL with error messages
- Manual retry endpoint — requeue failed jobs after fixing underlying issue
- Pagination on job listing with status and type filters
- Real-time job status updates via WebSockets

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/jobs | Create a new job |
| GET | /api/jobs | List all jobs with pagination |
| GET | /api/jobs/:id | Get job by ID |
| POST | /api/jobs/:id/retry | Retry a failed job |

## Performance

Load tested with k6 — 50 concurrent users over 50 seconds:

- 3,300 job submissions per minute
- p99 latency: 6.89ms
- 0% failure rate
- 2,773 requests with 100% success rate

## Local Setup

Prerequisites: Docker, Node.js

```bash
git clone https://github.com/TanuPayasi/Job-Queue-System.git
cd Job-Queue-System
npm install
docker-compose up -d
cp .env.example .env
node src/server.js
```

## Example Requests

Create an email job:

```json
POST /api/jobs
{
  "type": "email",
  "payload": {
    "recipient": "user@example.com",
    "subject": "Hello",
    "body": "Test email"
  }
}
```

Create a report job:

```json
POST /api/jobs
{
  "type": "report",
  "payload": {
    "reportType": "monthly-sales"
  }
}
```

## What I'd add with more time

- Redis Sentinel for high availability — automatic failover if Redis primary goes down
- Priority queues — urgent jobs jump ahead of normal jobs
- Job scheduling — run jobs at a specific time or on a cron schedule
- Prometheus metrics endpoint — monitor queue depth, processing rate, failure rate
- Bull Board UI — visual dashboard for monitoring queue state