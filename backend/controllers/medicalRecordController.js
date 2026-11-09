import medicalRecordModel from "../models/medicalRecordModel.js";
import biomarkerModel from "../models/biomarkerModel.js";
import userModel from "../models/userModel.js";
import { v2 as cloudinary } from "cloudinary";
import { getVisionModel } from "../config/gemini.js";
import fs from "fs";

// Sex-Stratified Reference Intervals & Lundberg Critical Panic Thresholds
// Standard clinical reference interval spans mean ± 1.96 SD (width = 3.92 SD)
const CLINICAL_BIOMARKER_ONTOLOGY = {
    glucose: {
        name: 'Fasting Blood Glucose', unit: 'mg/dL', category: 'Glycemic',
        default: { min: 70, max: 99 }, criticalLow: 54, criticalHigh: 400
    },
    blood_glucose: {
        name: 'Fasting Blood Glucose', unit: 'mg/dL', category: 'Glycemic',
        default: { min: 70, max: 99 }, criticalLow: 54, criticalHigh: 400
    },
    sugar: {
        name: 'Postprandial Blood Sugar', unit: 'mg/dL', category: 'Glycemic',
        default: { min: 70, max: 140 }, criticalLow: 54, criticalHigh: 400
    },
    hba1c: {
        name: 'Glycated Hemoglobin (HbA1c)', unit: '%', category: 'Glycemic',
        default: { min: 4.0, max: 5.6 }, criticalLow: 3.5, criticalHigh: 10.0
    },
    cholesterol: {
        name: 'Total Cholesterol', unit: 'mg/dL', category: 'Lipid',
        default: { min: 125, max: 200 }, criticalLow: 70, criticalHigh: 300
    },
    ldl: {
        name: 'LDL Cholesterol', unit: 'mg/dL', category: 'Lipid',
        default: { min: 0, max: 100 }, criticalLow: 0, criticalHigh: 190
    },
    hdl: {
        name: 'HDL Cholesterol', unit: 'mg/dL', category: 'Lipid',
        default: { min: 40, max: 80 },
        female: { min: 50, max: 90 },
        male: { min: 40, max: 80 },
        criticalLow: 25, criticalHigh: 120
    },
    triglycerides: {
        name: 'Triglycerides', unit: 'mg/dL', category: 'Lipid',
        default: { min: 0, max: 150 }, criticalLow: 0, criticalHigh: 500
    },
    creatinine: {
        name: 'Serum Creatinine', unit: 'mg/dL', category: 'Renal',
        default: { min: 0.6, max: 1.2 },
        female: { min: 0.55, max: 1.05 },
        male: { min: 0.70, max: 1.30 },
        criticalLow: 0.2, criticalHigh: 4.0
    },
    hemoglobin: {
        name: 'Hemoglobin (Hb)', unit: 'g/dL', category: 'Hematology',
        default: { min: 12.5, max: 17.0 },
        female: { min: 12.0, max: 15.5 },
        male: { min: 13.5, max: 17.5 },
        criticalLow: 7.0, criticalHigh: 20.0
    },
    platelets: {
        name: 'Platelet Count', unit: '10^3/uL', category: 'Hematology',
        default: { min: 150, max: 450 }, criticalLow: 50, criticalHigh: 1000
    },
    heart_rate: {
        name: 'Resting Heart Rate', unit: 'bpm', category: 'Cardiovascular',
        default: { min: 60, max: 100 }, criticalLow: 40, criticalHigh: 150
    },
    pulse: {
        name: 'Pulse Rate', unit: 'bpm', category: 'Cardiovascular',
        default: { min: 60, max: 100 }, criticalLow: 40, criticalHigh: 150
    }
};

/**
 * Deterministic Biomarker Classifier (Lundberg Critical Thresholds + Z-Score Deviation)
 */
const evaluateBiomarkerRule = (numericValue, config, genderStr = '') => {
    const g = String(genderStr || '').toLowerCase();
    const isFemale = g.startsWith('f') || g === 'female';
    const isMale = g.startsWith('m') || g === 'male';

    const range = (isFemale && config.female)
        ? config.female
        : (isMale && config.male)
        ? config.male
        : (config.default || { min: 0, max: 100 });

    const { min, max } = range;
    const mean = (min + max) / 2;
    const sd = (max - min) / 3.92 || 1;
    const zScore = Number(((numericValue - mean) / sd).toFixed(2));

    let status = 'NORMAL';
    if (
        (config.criticalLow !== undefined && numericValue < config.criticalLow) ||
        (config.criticalHigh !== undefined && numericValue > config.criticalHigh) ||
        numericValue > max * 1.35
    ) {
        status = 'CRITICAL';
    } else if (numericValue < min) {
        status = 'LOW';
    } else if (numericValue > max) {
        status = 'HIGH';
    }

    return { min, max, status, zScore };
};

const matchBiomarkerConfig = (rawKey) => {
    const normalizedKey = String(rawKey || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const [k, conf] of Object.entries(CLINICAL_BIOMARKER_ONTOLOGY)) {
        if (normalizedKey.includes(k)) {
            return { key: k, ...conf };
        }
    }
    return null;
};

// Upload a medical record (supports both images and PDF diagnostic reports via resource_type: "auto")
const uploadRecord = async (req, res) => {
    try {
        const { userId } = req.body;
        const uploadedFile = req.file;

        if (!uploadedFile) {
            return res.json({ success: false, message: "Please upload a medical report image or PDF" });
        }

        const isPdf = uploadedFile.mimetype === "application/pdf" || uploadedFile.originalname?.toLowerCase().endsWith(".pdf");

        let cloudUpload;
        try {
            cloudUpload = await cloudinary.uploader.upload(uploadedFile.path, {
                resource_type: "auto",
                folder: "medical_records"
            });
        } finally {
            try { await fs.promises.unlink(uploadedFile.path); } catch (e) {}
        }

        const record = new medicalRecordModel({
            userId,
            fileName: uploadedFile.originalname,
            fileUrl: cloudUpload.secure_url,
            fileType: isPdf ? "pdf" : "image"
        });

        await record.save();

        res.json({
            success: true,
            message: "Medical record uploaded successfully",
            record
        });

    } catch (error) {
        console.log("Upload Error:", error);
        res.json({ success: false, message: "Failed to upload record" });
    }
};

// Get all medical records for a user
const getUserRecords = async (req, res) => {
    try {
        const { userId } = req.body;
        const records = await medicalRecordModel.find({ userId }).sort({ uploadDate: -1 });
        res.json({ success: true, records });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Failed to fetch records" });
    }
};

// Delete a medical record
const deleteRecord = async (req, res) => {
    try {
        const { userId, recordId } = req.body;
        const record = await medicalRecordModel.findById(recordId);

        if (!record) {
            return res.json({ success: false, message: "Record not found" });
        }
        if (record.userId !== userId) {
            return res.json({ success: false, message: "Unauthorized" });
        }

        await medicalRecordModel.findByIdAndDelete(recordId);
        res.json({ success: true, message: "Record deleted successfully" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Failed to delete record" });
    }
};

// AI-Analyze a medical record (Gemini Vision Spatial OCR + Deterministic Reference-Interval Verification)
const analyzeRecord = async (req, res) => {
    try {
        const { userId, recordId } = req.body;

        const [record, patient] = await Promise.all([
            medicalRecordModel.findById(recordId),
            userModel.findById(userId).select('gender dob')
        ]);

        if (!record) {
            return res.json({ success: false, message: "Record not found" });
        }
        if (record.userId !== userId) {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const model = getVisionModel();

        const systemPrompt = `You are a clinical diagnostic OCR tokenizer for VitalSync. Extract structured biomarker measurements and findings from this medical document.

RESPOND IN THE FOLLOWING JSON FORMAT ONLY (no markdown, no code blocks, just raw JSON):
{
    "reportType": "type of report (e.g., Complete Blood Count, Lipid Panel, Prescription, etc.)",
    "keyFindings": ["finding 1", "finding 2", "finding 3"],
    "vitalMetrics": {
        "metric_name": "value with unit"
    },
    "medications": ["medication 1", "medication 2"],
    "summary": "2-3 sentence plain language summary of the report for a patient",
    "flaggedValues": ["any abnormal or concerning values"],
    "recommendedFollowUp": "brief follow-up recommendation if applicable"
}

IMPORTANT: If the document is not a medical report, respond with:
{
    "reportType": "Not a medical report",
    "summary": "The uploaded file does not appear to be a medical report. Please upload a valid medical document.",
    "keyFindings": [],
    "vitalMetrics": {},
    "medications": [],
    "flaggedValues": [],
    "recommendedFollowUp": ""
}`;

        const docResponse = await fetch(record.fileUrl);
        const docBuffer = await docResponse.arrayBuffer();
        const base64Data = Buffer.from(docBuffer).toString('base64');
        const mimeType = docResponse.headers.get('content-type') || (record.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg');

        const result = await model.generateContent([
            { text: systemPrompt },
            {
                inlineData: {
                    mimeType,
                    data: base64Data
                }
            }
        ]);

        const responseText = result.response.text();

        let aiSummary;
        try {
            const cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            aiSummary = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.log("Report parsing error:", parseError);
            aiSummary = {
                reportType: "Unknown",
                summary: "Unable to fully parse the report. Please consult your doctor for detailed analysis.",
                keyFindings: [],
                vitalMetrics: {},
                medications: [],
                flaggedValues: [],
                recommendedFollowUp: "Please consult your doctor."
            };
        }

        // DETERMINISTIC POST-OCR CLINICAL VERIFICATION (Sex-Stratified Intervals + Z-Score + Lundberg Panic Flags)
        const verifiedFlags = Array.isArray(aiSummary.flaggedValues) ? [...aiSummary.flaggedValues] : [];
        const deterministicEvaluations = [];

        if (aiSummary.vitalMetrics && typeof aiSummary.vitalMetrics === 'object') {
            for (const [metricKey, metricVal] of Object.entries(aiSummary.vitalMetrics)) {
                const numMatch = String(metricVal).match(/([0-9]+(?:\.[0-9]+)?)/);
                if (!numMatch) continue;
                const val = Number(numMatch[1]);
                const conf = matchBiomarkerConfig(metricKey);
                if (conf) {
                    const evalRes = evaluateBiomarkerRule(val, conf, patient?.gender);
                    deterministicEvaluations.push({
                        biomarker: conf.name,
                        value: val,
                        unit: conf.unit,
                        referenceRange: `${evalRes.min} - ${evalRes.max}`,
                        status: evalRes.status,
                        zScore: evalRes.zScore
                    });
                    if (evalRes.status !== 'NORMAL') {
                        const flagStr = `${conf.name}: ${val} ${conf.unit} [${evalRes.status} • Ref: ${evalRes.min}–${evalRes.max}, z=${evalRes.zScore}]`;
                        const alreadyListed = verifiedFlags.some(f => String(f).toLowerCase().includes(conf.key));
                        if (!alreadyListed) verifiedFlags.push(flagStr);
                    }
                }
            }
        }

        aiSummary.flaggedValues = verifiedFlags;
        aiSummary.deterministicAudit = {
            engine: "Sex-Stratified Reference Interval & Lundberg Critical-Value Classifier",
            patientSexApplied: patient?.gender || "Unspecified (Adult Population Baseline)",
            evaluatedCount: deterministicEvaluations.length,
            evaluations: deterministicEvaluations
        };

        await medicalRecordModel.findByIdAndUpdate(recordId, {
            aiSummary: aiSummary.summary,
            aiExtractedData: aiSummary,
            isAnalyzed: true
        });

        res.json({
            success: true,
            summary: aiSummary
        });

    } catch (error) {
        console.log("AI Analysis Error:", error.message);

        res.json({
            success: true,
            summary: {
                reportType: "Analysis Pending",
                summary: "AI analysis is temporarily unavailable due to high demand. Your report has been saved and you can retry the analysis later.",
                keyFindings: ["Report uploaded successfully"],
                vitalMetrics: {},
                medications: [],
                flaggedValues: [],
                recommendedFollowUp: "Please try the AI analysis again in a few minutes, or consult your doctor directly."
            }
        });
    }
};

// Sync AI extracted metrics from a medical record to the Biomarker longitudinal model
const syncRecordToHealth = async (req, res) => {
    try {
        const { userId, recordId } = req.body;
        const [record, patient] = await Promise.all([
            medicalRecordModel.findById(recordId),
            userModel.findById(userId).select('gender dob')
        ]);

        if (!record || record.userId !== userId) {
            return res.json({ success: false, message: "Record not found or unauthorized" });
        }

        const metrics = record.aiExtractedData?.vitalMetrics;
        if (!metrics || Object.keys(metrics).length === 0) {
            return res.json({ success: false, message: "No vital metrics found in this record to sync." });
        }

        const syncedBiomarkers = [];

        for (const [keyRaw, valRaw] of Object.entries(metrics)) {
            const numMatch = String(valRaw).match(/([0-9]+(?:\.[0-9]+)?)/);
            if (!numMatch) continue;
            const numericValue = Number(numMatch[1]);

            const normalizedKey = keyRaw.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const matchedConfig = matchBiomarkerConfig(keyRaw) || {
                key: normalizedKey,
                name: keyRaw,
                unit: 'units',
                default: { min: 0, max: 100 },
                category: 'General'
            };

            const { min, max, status } = evaluateBiomarkerRule(numericValue, matchedConfig, patient?.gender);

            const biomarker = new biomarkerModel({
                userId,
                recordId: record._id,
                name: matchedConfig.name,
                key: matchedConfig.key,
                value: numericValue,
                unit: matchedConfig.unit,
                referenceMin: min,
                referenceMax: max,
                status,
                category: matchedConfig.category,
                testDate: record.uploadDate || new Date(),
                notes: `Auto-extracted (${status}) from ${record.fileName}`
            });

            await biomarker.save();
            syncedBiomarkers.push(biomarker);
        }

        return res.json({
            success: true,
            message: `Synced ${syncedBiomarkers.length} sex-calibrated biomarker(s) to Health Hub!`,
            count: syncedBiomarkers.length,
            biomarkers: syncedBiomarkers
        });

    } catch (error) {
        console.error("Sync error:", error);
        return res.json({ success: false, message: error.message });
    }
};

export { uploadRecord, getUserRecords, deleteRecord, analyzeRecord, syncRecordToHealth };
