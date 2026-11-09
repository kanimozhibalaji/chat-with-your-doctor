import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    date: { type: Number, required: true },
    cancelled: { type: Boolean, default: false },
    payment: { type: Boolean, default: false },
    isCompleted: { type: Boolean, default: false },
    reasonForVisit: { type: String, default: '' },
    rescheduledAt: { type: Date, default: null },
    // How the consultation fee was settled: 'razorpay' | 'stripe' | 'test-bypass'
    paymentMethod: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    // Doctor-recommended in-person visit (set only when a teleconsult cannot fully resolve the case)
    // { reason, urgency: 'ROUTINE' | 'WITHIN_WEEK' | 'URGENT' | 'EMERGENCY', facility, notes, recommendedAt, doctorName }
    inPersonReferral: { type: Object, default: null },
    // Server-audited WebRTC consultation session telemetry logs
    // [{ startedAt, endedAt, durationSec, endedBy, endReason, signalingReconnects }]
    callLogs: { type: Array, default: [] }
})

// Atomic DB-level Partial Unique Mutex: prevents concurrent double-booking of the same active doctor slot,
// while allowing previously cancelled slots to be cleanly rebooked.
appointmentSchema.index(
    { docId: 1, slotDate: 1, slotTime: 1 },
    { unique: true, partialFilterExpression: { cancelled: false } }
)
appointmentSchema.index({ userId: 1, date: -1 })
appointmentSchema.index({ docId: 1, date: -1 })

const appointmentModel = mongoose.models.appointment || mongoose.model("appointment", appointmentSchema)
export default appointmentModel
