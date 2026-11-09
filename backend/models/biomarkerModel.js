import mongoose from "mongoose";

const biomarkerSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'medicalRecord' },
    name: { type: String, required: true },           // e.g., "Fasting Blood Glucose"
    key: { type: String, required: true, index: true }, // normalized: "glucose", "hba1c", "cholesterol", "creatinine", "hemoglobin", "blood_pressure_sys"
    value: { type: Number, required: true },
    unit: { type: String, required: true },           // "mg/dL", "%", "g/dL", "mg/dL"
    referenceMin: { type: Number, default: 0 },
    referenceMax: { type: Number, default: 100 },
    status: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
    category: { type: String, default: 'Metabolic' }, // 'Glycemic', 'Lipid', 'Renal', 'Hematology'
    testDate: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
}, { timestamps: true });

const biomarkerModel = mongoose.models.biomarker || mongoose.model("biomarker", biomarkerSchema);
export default biomarkerModel;
