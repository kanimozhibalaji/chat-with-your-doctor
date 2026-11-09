import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    instructions: { type: String, default: '' }
});

const prescriptionSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'appointment', required: true, unique: true },
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    diagnosis: { type: String, required: true },
    medicines: [medicineSchema],
    notes: { type: String, default: '' },
    followUpDate: { type: String, default: '' },
    safetyReport: {
        interactions: { type: Array, default: [] },
        allergyAlerts: { type: Array, default: [] },
        overallRisk: { type: String, default: 'SAFE' },
        totalInteractions: { type: Number, default: 0 },
        totalAllergyAlerts: { type: Number, default: 0 },
        aiSummary: { type: String, default: '' },
        aiAnalyzed: { type: Boolean, default: false },
        layer1LatencyMs: { type: Number, default: 0 },
        engine: { type: String, default: '' },
        timestamp: { type: String, default: '' },
        disclaimer: { type: String, default: '' }
    },
    clinicalOverride: {
        overridden: { type: Boolean, default: false },
        reason: { type: String, default: '' },
        overriddenAt: { type: Date, default: null }
    },
    digitalSignature: { type: String, default: '' },
    prescriptionHash: { type: String, default: '' },
    doctorPublicKey: { type: String, default: '' },
    qrCode: { type: String, default: '' },
    isVerified: { type: Boolean, default: true },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day statutory prescription validity window
    },
    dispenseStatus: {
        type: String,
        enum: ['ACTIVE', 'DISPENSED', 'EXPIRED'],
        default: 'ACTIVE'
    },
    dispenseCount: { type: Number, default: 0 },
    dispensedAt: { type: Date, default: null },
    dispensedByPharmacy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

const prescriptionModel = mongoose.models.prescription || mongoose.model("prescription", prescriptionSchema);
export default prescriptionModel;
