const cron = require("node-cron");
const { v4: uuidv4 } = require("uuid");
const Job = require("../models/Job");
const JobLogs = require("../models/JobLogs");

class SchedulerService {
  constructor() {
    this.scheduledJobs = new Map();
    this.init();
  }
  async init() {
    await this.pendingJobs();
  }
  async loadPendingJobs() {
    try {
      const pendingJobs = await Job.find({
        status: { $in: ["pending", "scheduled"] },
        isActive: true,
        $or: [
          { nextRunAt: { $gte: new Date() } },
          { scheduleType: "recurring" },
        ],
      });

      for (const job of pendingJobs) {
        await this.scheduleJob(job);
      }

      console.log(`Loaded ${pendingJobs.length} pending jobs`);
    } catch (error) {
      console.error("Error loading pending jobs:", error);
    }
  }

  async scheduleJob(job) {
    try {
      // Cancel existing schedule if any
      this.cancelJob(job.jobId);

      if (job.scheduleType === "one-time") {
        this.scheduleOneTimeJob(job);
      } else {
        this.scheduleRecurringJob(job);
      }

      await Job.findByIdAndUpdate(job._id, { status: "scheduled" });
    } catch (error) {
      console.error(`Error scheduling job ${job.jobId}:`, error);
      await Job.findByIdAndUpdate(job._id, {
        status: "failed",
        lastError: error.message,
      });
    }
  }
  async scheduleOneTimeJob(job) {
    try {
      const runTime = new Date(job.schedule);
      const currentTime = new Date();
      let delay = runTime.getTime() - currentTime.getTime();
      if (delay < 0) {
        this.execute(job);
      }

      const timeOutId = setTimeout(() => {
        this.execuation(job);
      }, delay);

      this.scheduledJobs.set(job.jobId, { type: "timeout", id: timeOutId });
    } catch (err) {}
  }
  async scheduleRecurringJob(job) {
    try {
      if (!cron.validate(job.schedule)) {
        throw new Error(`Invalid cron expression ${job.schedule}`);
      }
      const task = cron.schedule(job.schedule, () => {
        this.execuation(job);
      });
      this.scheduledJobs.set(job.jobId, { type: "cron", id: task });
    } catch (err) {}
  }
  cancelJob(jobId) {
    const scheduledJob = this.scheduledJobs.get(jobId);

    if (scheduledJob.type === "timeout") {
      clearTimeout(scheduledJob.id);
    } else {
      scheduledJob.id.stop();
    }
    this.scheduledJobs.delete(jobId);
  }
  async executeJob(job) {
    const jobLog = new JobLogs({
      jobId: job.jobId,
      job: job._id,
      status: "started",
      startedAt: new Date(),
    });

    try {
      await jobLog.save();
      await Job.findByIdAndUpdate(job._id, {
        status: "running",
        lastRunAt: new Date(),
      });

      // Execute job based on type
      const result = await this.executeJobByType(job);

      jobLog.status = "completed";
      jobLog.completedAt = new Date();
      jobLog.executionTime = jobLog.completedAt - jobLog.startedAt;
      jobLog.output = result;

      await jobLog.save();
      await Job.findByIdAndUpdate(job._id, {
        status: job.scheduleType === "one-time" ? "completed" : "scheduled",
        currentRetries: 0,
        lastError: null,
      });

      console.log(`Job ${job.jobId} completed successfully`);
    } catch (error) {
      await this.handleJobFailure(job, jobLog, error);
    }
  }
  async executeJobByType(job) {
    switch (job.type) {
      case "http":
        return await this.executeHttpJob(job);
      case "function":
        return await this.executeFunctionJob(job);
      case "script":
        return await this.executeScriptJob(job);
      case "email":
        return await this.executeEmailJob(job);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }
  async executeHttpJob(job) {
    const { url, method = "GET", headers = {}, body } = job.payload;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async executeFunctionJob(job) {
    // For security reasons, in production you might want to use a sandbox
    const { functionCode, parameters = {} } = job.payload;

    // This is a simplified example - be very careful with eval in production!
    const func = eval(`(${functionCode})`);
    return await func(parameters);
  }

  async executeScriptJob(job) {
    const { scriptPath, args = [] } = job.payload;
    const { spawn } = require("child_process");

    return new Promise((resolve, reject) => {
      const child = spawn("node", [scriptPath, ...args]);
      let output = "";
      let error = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        error += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Script exited with code ${code}: ${error}`));
        }
      });
    });
  }

  async executeEmailJob(job) {
    const { to, subject, body } = job.payload;
    // Implement email sending logic here for future ..
    console.log(`Sending email to: ${to}, Subject: ${subject}`);
    return { sent: true, to, subject };
  }

  async handleJobFailure(job, jobLog, error) {
    jobLog.status = "failed";
    jobLog.completedAt = new Date();
    jobLog.executionTime = jobLog.completedAt - jobLog.startedAt;
    jobLog.error = error.message;

    await jobLog.save();

    const updatedJob = await Job.findById(job._id);
    const currentRetries = updatedJob.currentRetries + 1;

    if (currentRetries < updatedJob.maxRetries) {
      // Retry the job
      updatedJob.currentRetries = currentRetries;
      updatedJob.status = "pending";
      updatedJob.lastError = error.message;
      await updatedJob.save();

      // Schedule retry with exponential backoff
      const retryDelay = Math.min(1000 * Math.pow(2, currentRetries), 30000);
      setTimeout(() => {
        this.executeJob(updatedJob);
      }, retryDelay);

      console.log(
        `Scheduled retry ${currentRetries} for job ${job.jobId} in ${retryDelay}ms`
      );
    } else {
      // Max retries exceeded
      updatedJob.status = "failed";
      updatedJob.lastError = `Max retries exceeded: ${error.message}`;
      await updatedJob.save();

      console.log(`Job ${job.jobId} failed after ${currentRetries} retries`);

      //  Here i can implement notification logic for future
      await this.notifyJobFailure(updatedJob, error);
    }
  }

  async notifyJobFailure(job, error) {
    // Implement notification logic (email, webhook, etc.) in the future
    console.log(`Notification: Job ${job.jobId} failed: ${error.message}`);
  }
}
console.log("hello");
module.exports = new SchedulerService();
