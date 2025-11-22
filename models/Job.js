const mongoose = require("mongoose");
const jobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["https", "script", "function", "email"],
        message: `{VALUE} is not supported we support http, script, function and email`,
      },
    },
    schedule: {
      type: String,
      required: true, //we get expression of cron job
      trim: true,
    },
    scheduleType: {
      type: String,
      required: true,
      enum: {
        values: ["one-time", "recurring"],
        message: `{VALUE} is not supported we support one-time and recurring`,
      },
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "scheduled",
          "running",
          "completed",
          "failed",
          "canceled",
        ],
        message: `{VALUE} is not supported we support pending, scheduled, running, completed, failed and canceled`,
      },
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    currentRetries: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    lastRunAt: {
      type: Date,
    },
    nextRunAt: {
      type: Date,
    },
    lastError: {
      type: String,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;
