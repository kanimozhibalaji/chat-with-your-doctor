import express from 'express';
import { analyzeSymptoms, summarizeReport } from '../controllers/aiController.js';
import authUser from '../middleware/authUser.js';

const aiRouter = express.Router();

// Symptom analysis - requires user authentication
aiRouter.post("/analyze-symptoms", authUser, analyzeSymptoms);

// Report summarization - requires user authentication
aiRouter.post("/summarize-report", authUser, summarizeReport);

export default aiRouter;
