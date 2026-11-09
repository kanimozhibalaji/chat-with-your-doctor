import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipientRole: {
        type: String,
        required: true,
        enum: ['user', 'doctor', 'admin']
    },
    recipientId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'message',
            'appointment_booked',
            'appointment_cancelled',
            'appointment_completed',
            'payment_received',
            'prescription_created',
            'prescription_updated',
            'call_incoming',
            'vitals_recorded',
            'allergy_conflict',
            'allergy_updated'
        ]
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    appointmentId: { type: String, default: '' },
    link: { type: String, default: '' },
    senderName: { type: String, default: '' },
    senderImage: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });

const notificationModel = mongoose.models.notification || mongoose.model("notification", notificationSchema);
export default notificationModel;
