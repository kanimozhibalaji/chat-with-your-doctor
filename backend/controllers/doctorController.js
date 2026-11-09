import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";
import medicalRecordModel from "../models/medicalRecordModel.js";
import biomarkerModel from "../models/biomarkerModel.js";
import vitalReadingModel from "../models/vitalReadingModel.js";
import prescriptionModel from "../models/prescriptionModel.js";
import chatModel from "../models/chatModel.js";
import { getVisionModel } from "../config/gemini.js";
import { emitToUser, emitToDoctor, emitToAdmin, emitGlobal, emitToRoom, notifyParty } from "../socket.js";
import { verifyGoogleCredential } from "../utils/googleAuth.js";

const REFERRAL_URGENCY_LABELS = {
    ROUTINE: 'Routine (within 2–4 weeks)',
    WITHIN_WEEK: 'Soon (within 7 days)',
    URGENT: 'Urgent (within 24–48 hours)',
    EMERGENCY: 'Emergency (go immediately)'
}

// API for doctor Login 
const loginDoctor = async (req, res) => {

    try {

        const { email, password } = req.body
        const normalizedEmail = (email || '').trim().toLowerCase()
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const user = await doctorModel.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        })

        if (!user) {
            return res.json({ success: false, message: "Invalid credentials" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1d' })
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }


    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get doctor appointments for doctor panel
const appointmentsDoctor = async (req, res) => {
    try {

        const { docId } = req.body
        const appointments = await appointmentModel.find({ docId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to cancel appointment for doctor panel
const appointmentCancel = async (req, res) => {
    try {

        const { docId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

            // Release slot in doctor's slots_booked
            const doctorData = await doctorModel.findById(docId)
            if (doctorData?.slots_booked?.[appointmentData.slotDate]) {
                const slots_booked = doctorData.slots_booked
                slots_booked[appointmentData.slotDate] = slots_booked[appointmentData.slotDate].filter(
                    (e) => e !== appointmentData.slotTime
                )
                await doctorModel.findByIdAndUpdate(docId, { slots_booked })
            }

            emitToUser(appointmentData.userId, 'appointment-updated', { action: 'cancelled', appointmentId })
            emitToDoctor(docId, 'appointment-updated', { action: 'cancelled', appointmentId })
            emitToAdmin('appointment-updated', { action: 'cancelled', appointmentId })
            emitGlobal('doctors-updated', { docId })

            const docName = appointmentData.docData?.name || 'Your doctor'
            notifyParty({
                recipientRole: 'user',
                recipientId: appointmentData.userId,
                type: 'appointment_cancelled',
                title: `Appointment Cancelled by ${docName.startsWith('Dr.') ? docName : 'Dr. ' + docName}`,
                body: `Your appointment on ${appointmentData.slotDate.replace(/_/g, '/')} at ${appointmentData.slotTime} was cancelled.`,
                appointmentId: String(appointmentId),
                link: '/my-appointments',
                senderName: docName,
                senderImage: appointmentData.docData?.image || ''
            })

            return res.json({ success: true, message: 'Appointment Cancelled' })
        }

        res.json({ success: false, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to mark appointment completed for doctor panel
const appointmentComplete = async (req, res) => {
    try {

        const { docId, appointmentId } = req.body

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (appointmentData && appointmentData.docId === docId) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true })

            emitToUser(appointmentData.userId, 'appointment-updated', { action: 'completed', appointmentId })
            emitToDoctor(docId, 'appointment-updated', { action: 'completed', appointmentId })
            emitToAdmin('appointment-updated', { action: 'completed', appointmentId })

            const docName = appointmentData.docData?.name || 'Your doctor'
            notifyParty({
                recipientRole: 'user',
                recipientId: appointmentData.userId,
                type: 'appointment_completed',
                title: `Consultation Completed`,
                body: `${docName.startsWith('Dr.') ? docName : 'Dr. ' + docName} marked your visit as completed. You can now view your prescription or leave a review.`,
                appointmentId: String(appointmentId),
                link: '/my-appointments',
                senderName: docName,
                senderImage: appointmentData.docData?.image || ''
            })

            return res.json({ success: true, message: 'Appointment Completed' })
        }

        res.json({ success: false, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to get all doctors list for Frontend
const doctorList = async (req, res) => {
    try {

        const doctors = await doctorModel.find({}).select(['-password', '-email'])
        res.json({ success: true, doctors })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to change doctor availablity for Admin and Doctor Panel
const changeAvailablity = async (req, res) => {
    try {

        const { docId } = req.body

        const docData = await doctorModel.findById(docId)
        await doctorModel.findByIdAndUpdate(docId, { available: !docData.available })
        emitGlobal('doctors-updated', { docId })
        res.json({ success: true, message: 'Availablity Changed' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get doctor profile for  Doctor Panel
const doctorProfile = async (req, res) => {
    try {

        const { docId } = req.body
        const profileData = await doctorModel.findById(docId).select('-password')

        res.json({ success: true, profileData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update doctor profile data from  Doctor Panel
const updateDoctorProfile = async (req, res) => {
    try {

        const { docId, fees, address, available } = req.body

        await doctorModel.findByIdAndUpdate(docId, { fees, address, available })
        emitGlobal('doctors-updated', { docId })

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get dashboard data for doctor panel
const doctorDashboard = async (req, res) => {
    try {

        const { docId } = req.body

        const appointments = await appointmentModel.find({ docId })

        let earnings = 0

        appointments.map((item) => {
            if (item.isCompleted || item.payment) {
                earnings += item.amount
            }
        })

        let patients = []

        appointments.map((item) => {
            if (!patients.includes(item.userId)) {
                patients.push(item.userId)
            }
        })



        const dashData = {
            earnings,
            appointments: appointments.length,
            patients: patients.length,
            latestAppointments: appointments.reverse()
        }

        res.json({ success: true, dashData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API for Doctor to fetch complete Patient Health Dossier (Lab Reports, AI Summaries, Biomarkers, Heart Rate Vitals, Allergies & Past Rx)
const getPatientDossier = async (req, res) => {
    try {
        const { userId } = req.params
        const docId = req.docId || req.body?.docId
        if (!userId) {
            return res.json({ success: false, message: 'Missing patient ID' })
        }

        // BOLA / IDOR Verification: Doctor must have a consultation relationship with the patient
        const hasRelationship = await appointmentModel.findOne({ docId, userId });
        if (!hasRelationship) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied: You do not have a clinical appointment relationship with this patient.'
            });
        }

        const [patient, records, biomarkers, vitals, prescriptions] = await Promise.all([
            userModel.findById(userId).select('-password').lean(),
            medicalRecordModel.find({ userId }).sort({ uploadDate: -1 }).lean(),
            biomarkerModel.find({ userId }).sort({ testDate: -1 }).lean(),
            vitalReadingModel.find({ userId }).sort({ timestamp: -1 }).limit(25).lean(),
            prescriptionModel.find({ userId }).sort({ createdAt: -1 }).limit(15).lean()
        ])

        if (!patient) {
            return res.json({ success: false, message: 'Patient not found' })
        }

        res.json({
            success: true,
            patient,
            records,
            biomarkers,
            vitals,
            prescriptions
        })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API for Doctor to trigger AI Analysis on a patient's uploaded lab report
const analyzePatientRecordDoctor = async (req, res) => {
    try {
        const { recordId } = req.body
        const record = await medicalRecordModel.findById(recordId)
        if (!record) {
            return res.json({ success: false, message: 'Medical record not found' })
        }

        const model = getVisionModel()
        const systemPrompt = `You are a medical report analysis AI for a telemedicine platform. Analyze the provided medical report and extract key information.

RESPOND IN THE FOLLOWING JSON FORMAT ONLY (no markdown, no code blocks, just raw JSON):
{
    "reportType": "type of report (e.g., Blood Test, X-Ray, Prescription, etc.)",
    "keyFindings": ["finding 1", "finding 2", "finding 3"],
    "vitalMetrics": {
        "metric_name": "value with unit"
    },
    "medications": ["medication 1", "medication 2"],
    "summary": "2-3 sentence clinical summary of the report",
    "flaggedValues": ["any abnormal or concerning values"],
    "recommendedFollowUp": "brief follow-up recommendation if applicable"
}`

        const imageResponse = await fetch(record.fileUrl)
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

        const result = await model.generateContent([
            { text: systemPrompt },
            { inlineData: { mimeType, data: base64Image } }
        ])

        const responseText = result.response.text()
        let aiSummary
        try {
            const cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()
            aiSummary = JSON.parse(cleanedResponse)
        } catch (e) {
            aiSummary = {
                reportType: 'Clinical Lab Report',
                summary: 'AI parsed the document image. Please inspect the visual report directly for detailed reference intervals.',
                keyFindings: ['Visual report available for review'],
                vitalMetrics: {},
                medications: [],
                flaggedValues: [],
                recommendedFollowUp: ''
            }
        }

        const updatedRecord = await medicalRecordModel.findByIdAndUpdate(
            recordId,
            {
                aiSummary: aiSummary.summary,
                aiExtractedData: aiSummary,
                isAnalyzed: true
            },
            { new: true }
        )

        res.json({
            success: true,
            summary: aiSummary,
            record: updatedRecord
        })
    } catch (error) {
        console.log('Doctor AI record analysis error:', error.message)
        res.json({ success: false, message: 'AI analysis temporarily unavailable. Please inspect the image directly.' })
    }
}

// API for Doctor to recommend (or withdraw) an in-person hospital visit after a teleconsult
const setInPersonReferral = async (req, res) => {
    try {
        const { docId, appointmentId, reason, urgency, facility, notes, clear } = req.body

        const appointment = await appointmentModel.findById(appointmentId)
        if (!appointment || appointment.docId !== docId) {
            return res.json({ success: false, message: 'Appointment not found or not authorized' })
        }
        if (appointment.cancelled) {
            return res.json({ success: false, message: 'Cannot refer a cancelled appointment' })
        }

        const docName = appointment.docData?.name || 'Your doctor'
        const displayDocName = docName.startsWith('Dr.') ? docName : `Dr. ${docName}`

        // Withdraw an existing recommendation (case resolved online after all)
        if (clear) {
            await appointmentModel.findByIdAndUpdate(appointmentId, { inPersonReferral: null })
            emitToUser(appointment.userId, 'appointment-updated', { action: 'referral-cleared', appointmentId })
            emitToDoctor(docId, 'appointment-updated', { action: 'referral-cleared', appointmentId })
            emitToAdmin('appointment-updated', { action: 'referral-cleared', appointmentId })
            return res.json({ success: true, message: 'In-person visit recommendation withdrawn' })
        }

        const cleanReason = String(reason || '').trim()
        if (!cleanReason) {
            return res.json({ success: false, message: 'Please select why an in-person visit is needed' })
        }
        const cleanUrgency = REFERRAL_URGENCY_LABELS[urgency] ? urgency : 'ROUTINE'

        const referral = {
            reason: cleanReason,
            urgency: cleanUrgency,
            urgencyLabel: REFERRAL_URGENCY_LABELS[cleanUrgency],
            facility: String(facility || '').trim(),
            notes: String(notes || '').trim(),
            recommendedAt: new Date(),
            doctorName: displayDocName
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { inPersonReferral: referral })

        emitToUser(appointment.userId, 'appointment-updated', { action: 'referral-set', appointmentId })
        emitToDoctor(docId, 'appointment-updated', { action: 'referral-set', appointmentId })
        emitToAdmin('appointment-updated', { action: 'referral-set', appointmentId })

        await notifyParty({
            recipientRole: 'user',
            recipientId: appointment.userId,
            type: 'in_person_referral',
            title: cleanUrgency === 'EMERGENCY'
                ? `🚨 ${displayDocName}: Go to a hospital immediately`
                : `🏥 ${displayDocName} recommends an in-person visit`,
            body: `${cleanReason} • ${referral.urgencyLabel}${referral.facility ? ` • ${referral.facility}` : ''}`,
            appointmentId: String(appointmentId),
            link: '/my-appointments',
            senderName: docName,
            senderImage: appointment.docData?.image || ''
        })

        // Log the recommendation in the consultation chat thread as well
        try {
            const chat = await chatModel.findOne({ appointmentId })
            if (chat) {
                chat.messages.push({
                    sender: 'doctor',
                    senderName: docName,
                    text: `🏥 In-Person Visit Recommended (${referral.urgencyLabel})\nReason: ${cleanReason}${referral.facility ? `\nWhere: ${referral.facility}` : ''}${referral.notes ? `\nNotes: ${referral.notes}` : ''}`,
                    readBy: ['doctor'],
                    timestamp: new Date()
                })
                chat.updatedAt = new Date()
                await chat.save()
                const savedMsg = chat.messages[chat.messages.length - 1]
                emitToRoom(String(appointmentId), 'chat-message', {
                    ...savedMsg.toObject(),
                    appointmentId: String(appointmentId)
                })
            }
        } catch (e) {
            console.log('Referral chat log error:', e.message)
        }

        res.json({ success: true, message: 'In-person visit recommendation sent to patient', referral })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API for doctor Login via Google
const googleAuthDoctor = async (req, res) => {
    try {
        const { credential, accessToken } = req.body;
        if (!credential && !accessToken) {
            return res.status(400).json({ success: false, message: 'Google credential or access token is required' });
        }

        const profile = await verifyGoogleCredential({ credential, accessToken });
        const { sub, email, picture } = profile;
        const normalizedEmail = (email || '').trim().toLowerCase();
        const escapedEmail = normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const doctor = await doctorModel.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: `No practitioner account found for ${email}. Please ensure your clinic email matches this Google account.`
            });
        }

        // Link Google ID & update picture if needed
        doctor.googleId = sub;
        doctor.isGoogleAuth = true;
        if (picture && (!doctor.image || doctor.image.includes('upload_area'))) {
            doctor.image = picture;
        }
        await doctor.save();

        const token = jwt.sign({ id: doctor._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({
            success: true,
            message: 'Practitioner authenticated with Google',
            token
        });

    } catch (error) {
        console.error('Doctor Google Auth error:', error.message);
        res.status(400).json({ success: false, message: error.message || 'Doctor Google login failed' });
    }
};

export {
    loginDoctor,
    googleAuthDoctor,
    appointmentsDoctor,
    appointmentCancel,
    doctorList,
    changeAvailablity,
    appointmentComplete,
    doctorDashboard,
    doctorProfile,
    updateDoctorProfile,
    getPatientDossier,
    analyzePatientRecordDoctor,
    setInPersonReferral
}