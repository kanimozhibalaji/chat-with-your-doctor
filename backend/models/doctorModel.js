import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, required: true },
    speciality: { type: String, required: true },
    degree: { type: String, required: true },
    experience: { type: String, required: true },
    about: { type: String, required: true },
    available: { type: Boolean, default: true },
    fees: { type: Number, required: true },
    slots_booked: { type: Object, default: {} },
    address: { type: Object, required: true },
    date: { type: Number, required: true },
    publicKey: { type: String, default: '' },
    // Encrypted at rest via AES-256-GCM & excluded from default projections
    privateKey: { type: String, default: '', select: false },
    googleId: { type: String, default: '' },
    isGoogleAuth: { type: Boolean, default: false },
}, { minimize: false })

doctorSchema.index({ speciality: 1, available: 1 });

const doctorModel = mongoose.models.doctor || mongoose.model("doctor", doctorSchema);
export default doctorModel;
