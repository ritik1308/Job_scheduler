# Chronos — Job Scheduler

Chronos is a lightweight job scheduler built with Node.js, Express and MongoDB. It allows you to create, schedule, run, retry, and log jobs of different types (HTTP, script, function, email). This README explains how to set up and run the project locally and documents the main API endpoints and configuration.

**Features**

- Schedule one-time and recurring jobs (cron expressions)
- Execute jobs by type: `http`, `script`, `function`, `email`
- Job retry with exponential backoff
- Job logs and status tracking
- Simple authentication (JWT)
- Pluggable notification/email logic via `nodemailer`

**Tech stack**

- Node.js (tested on Node.js 18+; logs show Node 22 in your environment)
- Express
- MongoDB and Mongoose
- node-cron
- nodemailer
- bcryptjs, jsonwebtoken

**Project layout (important files)**

- `app.js` — Express app and server bootstrap
- `package.json` — project dependencies & scripts
- `services/SchedulerService.js` — scheduling logic (cron & timeouts)
- `controllers/jobsController.js` — jobs API handlers
- `controllers/authController.js` — auth handlers
- `routes/jobs.js`, `routes/auth.js` — route definitions
- `models/Job.js`, `models/JobLogs.js`, `models/User.js` — Mongoose models
- `middleware/auth.js` — JWT auth middleware
- `Utils/nodemailer.js` — helper for sending emails (optional)

**Prerequisites**

- Node.js >= 18 (your environment shows Node 22.9.0)
- MongoDB running locally or accessible via a connection string

**Quick start (Windows PowerShell)**

1. Install dependencies

```powershell
npm install
```

2. Create environment variables

Create a `.env` file in the project root or set env vars in your environment. Minimum recommended variables:

```
MONGODB_URI=mongodb://localhost:27017/chronos
PORT=3000
JWT_SECRET=your_jwt_secret_here
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

3. Start the app

```powershell
npm start
# or
node app.js
```

By default the app listens on `http://localhost:3000`.

**Available API endpoints (summary)**

Authentication

- `POST /api/auth/register` — Register a user (body: `username`, `email`, `password`, `confirmPassword`).
- `POST /api/auth/login` — Login (body: `email`, `password`) — returns JWT.

Jobs (authenticated; set `Authorization: Bearer <token>` header)

- `POST /api/jobs` — Create a job. Example body:

```json
{
  "title": "Fetch API",
  "description": "Call external endpoint",
  "type": "http",
  "payload": {
    "url": "https://example.com/api",
    "method": "GET"
  },
  "schedule": "*/5 * * * *", // cron expression or ISO date for one-time
  "scheduleType": "recurring" // or "one-time"
}
```

- `GET /api/jobs` — List jobs created by the authenticated user (supports `page`, `limit`, `status`, `type` query params).
- `GET /api/jobs/:jobId` — Get a single job.
- `PUT /api/jobs/:jobId` — Update job (not allowed if status is `running`).
- `POST /api/jobs/:jobId/cancel` — Cancel a scheduled job.
- `POST /api/jobs/:jobId/execute-now` — Execute a job immediately.
- `GET /api/jobs/:jobId/logs` — Get job logs (paginated).

**Scheduler internals**

- `services/SchedulerService.js` keeps a `Map` of scheduled jobs (cron tasks and timeouts).
- One-time jobs use `setTimeout`, recurring jobs use `node-cron`.
- Jobs are retried with exponential backoff up to `maxRetries`.
- `Job` and `JobLogs` Mongoose models power persistence and querying.

**Notes & troubleshooting**

- If you hit errors about `uuid` being an ES module (ERR_REQUIRE_ESM), the repository uses `crypto.randomUUID()` in several places already. If you add `uuid` packages, prefer ESM import or use `crypto.randomUUID()` for compatibility with CommonJS.

- If `path-to-regexp` errors show up (Missing parameter name at index 1: `*`), ensure you do not register routes with the literal `'*'` string in `app.use` — a no-path `app.use((req,res)=>{})` or `app.all('*', ...)` is better for 404 handling. The current code uses a no-path 404 handler.

- If Mongoose model functions like `Job.find` are `not a function`, ensure the model file exports a mongoose model using `module.exports = mongoose.model('Job', jobSchema)` — this project includes the exported models.

**Development tips**

- Use `nodemon` for automatic restarts during development (install globally or as dev dependency):

```powershell
npm install -g nodemon
nodemon app.js
```

.......POSTMAN API.....
Authentication APIs

1. Register User
   POST http://localhost:3000/api/auth/register

json
{
"username": "john_doe",
"email": "john@example.com",
"password": "password123"
}
Response:

json
{
"success": true,
"message": "User registered successfully",
"data": {
"user": {
"id": "64f1a2b3c4d5e6f7a8b9c0d1",
"username": "john_doe",
"email": "john@example.com",
"role": "user"
},
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
} 2. Login User
POST http://localhost:3000/api/auth/login

json
{
"email": "john@example.com",
"password": "password123"
}
Response:

json
{
"success": true,
"message": "Login successful",
"data": {
"user": {
"id": "64f1a2b3c4d5e6f7a8b9c0d1",
"username": "john_doe",
"email": "john@example.com",
"role": "user"
},
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
}

......................JOb MANAGEMET...........

Job Management APIs
Note: All job APIs require Authorization header:

text
Authorization: Bearer <your-jwt-token> 3. Create One-Time Job (Run at specific time)
POST http://localhost:3000/api/jobs

json
{
"title": "One-time Data Export",b
"description": "Export user data to CSV",
"type": "http",
"scheduleType": "one-time",
"schedule": "2024-12-25T10:30:00.000Z",
"maxRetries": 3,
"payload": {
"url": "https://api.example.com/export",
"method": "POST",
"headers": {
"Authorization": "Bearer api-key-123"
},
"body": {
"format": "csv",
"includeMetadata": true
}
}
} 4. Create Recurring Job (Daily)
POST http://localhost:3000/api/jobs

json
{
"title": "Daily Backup",
"description": "Daily database backup",
"type": "script",
"scheduleType": "recurring",
"schedule": "0 2 \* \* \*",
"maxRetries": 3,
"payload": {
"scriptPath": "/scripts/backup.js",
"args": ["--full", "--compress"]
}
} 5. Create Recurring Job (Every 2 Days)
POST http://localhost:3000/api/jobs

json
{
"title": "Bi-daily Report",
"description": "Generate report every 2 days",
"type": "email",
"scheduleType": "recurring",
"schedule": "0 9 _/2 _ \*",
"maxRetries": 2,
"payload": {
"to": "admin@company.com",
"subject": "Bi-daily System Report",
"body": "Here is your bi-daily system report."
}
} 6. Create Function Job
POST http://localhost:3000/api/jobs

json
{
"title": "Calculate Metrics",
"description": "Calculate daily business metrics",
"type": "function",
"scheduleType": "recurring",
"schedule": "0 6 \* \* \*",
"maxRetries": 2,
"payload": {
"functionCode": "async (params) => { return { total: params.a + params.b, timestamp: new Date() }; }",
"parameters": {
"a": 10,
"b": 20
}
}
} 7. Create Immediate One-Time Job
POST http://localhost:3000/api/jobs

json
{
"title": "Immediate Test Job",
"description": "Run immediately for testing",
"type": "http",
"scheduleType": "one-time",
"schedule": "2024-01-01T00:00:00.000Z",
"maxRetries": 1,
"payload": {
"url": "https://webhook.site/test",
"method": "GET"
}
}
