import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
    sender: { type: String, required: true }, // 'user' | 'doctor'
    emoji: { type: String, required: true }
}, { _id: false });

const replyPreviewSchema = new mongoose.Schema({
    messageId: { type: String, default: '' },
    senderName: { type: String, default: '' },
    text: { type: String, default: '' }
}, { _id: false });

const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true, enum: ['user', 'doctor', 'system'] },
    senderName: { type: String, required: true },
    text: { type: String, default: '' },
    attachmentUrl: { type: String, default: '' },
    attachmentType: { type: String, default: '' }, // 'image' | 'document' | 'prescription'
    attachmentName: { type: String, default: '' },
    replyTo: { type: replyPreviewSchema, default: null },
    reactions: { type: [reactionSchema], default: [] },
    readBy: { type: [String], default: [] }, // contains 'user' and/or 'doctor'
    timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'appointment', required: true },
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    messages: [messageSchema],
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now }
});

chatSchema.index({ appointmentId: 1 });
chatSchema.index({ userId: 1 });
chatSchema.index({ docId: 1 });

const chatModel = mongoose.models.chat || mongoose.model("chat", chatSchema);
export default chatModel;
