const { required } = require("joi");
const mongoose = require("mongoose");
const jobLogsSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ["started", "completed", "failed", "retrying"],
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  excuationTime: {
    type: Date,
  },
  output: {
    type: mongoose.Schema.Types.Mixed,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  error: {
    type: String,
  },
});

const JobLogs = mongoose.model("JobLogs", jobLogsSchema);
module.exports = JobLogs;
