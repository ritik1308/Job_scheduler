// src/routes/jobs.js
const express = require("express");
const jobsController = require("../controllers/jobsController");
const { auth } = require("../middleware/auth");
const router = express.Router();

router.use(auth);

router.post("/", jobsController.createJob);
router.get("/", jobsController.getJobs);
router.get("/:jobId", jobsController.getJob);
router.put("/:jobId", jobsController.updateJob);
router.delete("/:jobId", jobsController.cancelJob);
router.get("/:jobId/logs", jobsController.getJobLogs);
router.post("/:jobId/execute", jobsController.executeJobNow);

module.exports = router;
