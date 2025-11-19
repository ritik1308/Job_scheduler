const cron =require('nodee-cron');
const {v4:uuidv4}=require('uuid');
const Job=require('../models/Job');
const JobLogs=require('../models/JobLogs');

class SchedulerService{
    constructor(){
        this.scheduledJobs = new Map();
        this.init();
    }
    async init(){
        await this.pendingJobs();
    }
     async loadPendingJobs() {
    try {
      const pendingJobs = await Job.find({
        status: { $in: ['pending', 'scheduled'] },
        isActive: true,
        $or: [
          { nextRunAt: { $gte: new Date() } },
          { scheduleType: 'recurring' }
        ]
      });

      for (const job of pendingJobs) {
        await this.scheduleJob(job);
      }

      console.log(`Loaded ${pendingJobs.length} pending jobs`);
    } catch (error) {
      console.error('Error loading pending jobs:', error);
    }
  }

  async scheduleJob(job) {
    try {
      // Cancel existing schedule if any
      this.cancelJob(job.jobId);

      if (job.scheduleType === 'one-time') {
        this.scheduleOneTimeJob(job);
      } else {
        this.scheduleRecurringJob(job);
      }

      await Job.findByIdAndUpdate(job._id, { status: 'scheduled' });
    } catch (error) {
      console.error(`Error scheduling job ${job.jobId}:`, error);
      await Job.findByIdAndUpdate(job._id, { 
        status: 'failed',
        lastError: error.message 
      });
    }
  }
}