// src/controllers/jobsController.js
const { v4: uuidv4 } = require("uuid");
const Job = require("../models/Job");
const JobLog = require("../models/JobLog");
const SchedulerService = require("../services/SchedulerService");

const jobsController = {
  async createJob(req, res) {
    try {
      const {
        title,
        description,
        type,
        payload,
        schedule,
        scheduleType,
        maxRetries = 3,
      } = req.body;

      const job = new Job({
        jobId: uuidv4(),
        title,
        description,
        type,
        payload,
        schedule,
        scheduleType,
        maxRetries,
        createdBy: req.user._id,
      });

      await job.save();

      // Schedule the job
      await SchedulerService.scheduleJob(job);

      res.status(201).json({
        success: true,
        message: "Job created successfully",
        data: { job },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error creating job",
        error: error.message,
      });
    }
  },

  async getJobs(req, res) {
    try {
      const { page = 1, limit = 10, status, type } = req.query;
      const filter = { createdBy: req.user._id };

      if (status) filter.status = status;
      if (type) filter.type = type;

      const jobs = await Job.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Job.countDocuments(filter);

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching jobs",
        error: error.message,
      });
    }
  },

  async getJob(req, res) {
    try {
      const job = await Job.findOne({
        jobId: req.params.jobId,
        createdBy: req.user._id,
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      res.json({
        success: true,
        data: { job },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching job",
        error: error.message,
      });
    }
  },

  async updateJob(req, res) {
    try {
      const job = await Job.findOne({
        jobId: req.params.jobId,
        createdBy: req.user._id,
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      if (job.status === "running") {
        return res.status(400).json({
          success: false,
          message: "Cannot update a running job",
        });
      }

      const updates = req.body;
      Object.keys(updates).forEach((key) => {
        job[key] = updates[key];
      });

      await job.save();

      // Reschedule the job if schedule changed
      if (updates.schedule || updates.scheduleType) {
        await SchedulerService.scheduleJob(job);
      }

      res.json({
        success: true,
        message: "Job updated successfully",
        data: { job },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error updating job",
        error: error.message,
      });
    }
  },

  async cancelJob(req, res) {
    try {
      const job = await Job.findOne({
        jobId: req.params.jobId,
        createdBy: req.user._id,
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      if (["completed", "failed", "cancelled"].includes(job.status)) {
        return res.status(400).json({
          success: false,
          message: `Job is already ${job.status}`,
        });
      }

      SchedulerService.cancelJob(job.jobId);
      job.status = "cancelled";
      await job.save();

      res.json({
        success: true,
        message: "Job cancelled successfully",
        data: { job },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error cancelling job",
        error: error.message,
      });
    }
  },

  async getJobLogs(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const job = await Job.findOne({
        jobId: req.params.jobId,
        createdBy: req.user._id,
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      const logs = await JobLog.find({ jobId: job.jobId })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await JobLog.countDocuments({ jobId: job.jobId });

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching job logs",
        error: error.message,
      });
    }
  },

  async executeJobNow(req, res) {
    try {
      const job = await Job.findOne({
        jobId: req.params.jobId,
        createdBy: req.user._id,
      });

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      // Execute job immediately
      SchedulerService.executeJob(job);

      res.json({
        success: true,
        message: "Job execution triggered",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error executing job",
        error: error.message,
      });
    }
  },
};

module.exports = jobsController;
