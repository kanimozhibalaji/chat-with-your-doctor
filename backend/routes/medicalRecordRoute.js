import express from 'express';
import { uploadRecord, getUserRecords, deleteRecord, analyzeRecord, syncRecordToHealth } from '../controllers/medicalRecordController.js';
import authUser from '../middleware/authUser.js';
import upload from '../middleware/multer.js';

const medicalRecordRouter = express.Router();

// Upload a medical record (image or PDF)
medicalRecordRouter.post("/upload", authUser, upload.single('report'), uploadRecord);

// Get all records for the logged-in user
medicalRecordRouter.post("/list", authUser, getUserRecords);

// Delete a record
medicalRecordRouter.post("/delete", authUser, deleteRecord);

// AI-analyze a record
medicalRecordRouter.post("/analyze", authUser, analyzeRecord);

// Sync AI extracted metrics to Health Biomarkers
medicalRecordRouter.post("/sync-to-health", authUser, syncRecordToHealth);

export default medicalRecordRouter;
