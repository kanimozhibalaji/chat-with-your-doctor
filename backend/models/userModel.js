import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String, default: 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/smiling-man.jpg' },
    phone: { type: String, default: '000000000' },
    address: { type: Object, default: { line1: '', line2: '' } },
    gender: { type: String, default: 'Not Selected' },
    dob: { type: String, default: 'Not Selected' },
    password: { type: String, required: false },
    authProvider: { type: String, default: 'local' },
    googleId: { type: String, default: '' },
    isGoogleAuth: { type: Boolean, default: false },
    allergies: { type: [String], default: [] },
    currentMedications: { type: Array, default: [] },
})

const userModel = mongoose.models.user || mongoose.model("user", userSchema);
export default userModel;