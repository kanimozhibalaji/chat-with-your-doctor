import mongoose from "mongoose";

const vitalReadingSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    appointmentId: { type: String, required: false, default: null, index: true },
    // Primary Clinical Vitals (Home Devices + Validated Spot-Checks)
    heartRate: { type: Number, default: null },         // BPM
    systolicBp: { type: Number, default: null },        // mmHg
    diastolicBp: { type: Number, default: null },       // mmHg
    spo2: { type: Number, default: null },              // %
    temperatureF: { type: Number, default: null },      // °F
    respiratoryRate: { type: Number, default: null },   // breaths/min
    bloodGlucose: { type: Number, default: null },      // mg/dL
    // Royal College of Physicians NEWS2 Clinical Early-Warning Triage
    news2Score: { type: Number, default: 0 },
    news2Risk: { type: String, default: 'LOW' },        // 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH'
    clinicalFlags: { type: [String], default: [] },
    // Measurement Provenance & Optical Adjunct Telemetry
    source: { type: String, default: 'manual' },        // 'manual' | 'rppg_spot_check' | 'hybrid'
    confidence: { type: Number, default: 1.0 },         // 0.0 - 1.0
    signalQuality: { type: String, default: 'CLINICAL_DEVICE' },
    method: { type: String, default: 'Clinical Home Vitals (BP / SpO2 / Temp / Pulse)' },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
});

const vitalReadingModel = mongoose.models.vitalReading || mongoose.model("vitalReading", vitalReadingSchema);
export default vitalReadingModel;
