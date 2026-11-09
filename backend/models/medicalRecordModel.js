import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true }, // 'image' or 'pdf'
    aiSummary: { type: String, default: '' },
    aiExtractedData: { type: Object, default: {} },
    isAnalyzed: { type: Boolean, default: false },
    uploadDate: { type: Date, default: Date.now }
});

const medicalRecordModel = mongoose.models.medicalRecord || mongoose.model("medicalRecord", medicalRecordSchema);
export default medicalRecordModel;
