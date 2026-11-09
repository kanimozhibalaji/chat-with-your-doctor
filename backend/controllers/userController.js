import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import validator from "validator";
import crypto from 'crypto';
import fs from 'fs';
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import prescriptionModel from "../models/prescriptionModel.js";
import chatModel from "../models/chatModel.js";
import { v2 as cloudinary } from 'cloudinary'
import stripe from "stripe";
import razorpay from 'razorpay';
import { sendAppointmentConfirmation, sendCancellationEmail } from '../utils/emailService.js';
import { generateICS } from '../utils/calendarHelper.js';
import { evaluateSafetyWithAI } from '../data/ddiDatabase.js';
import { emitToUser, emitToDoctor, emitToAdmin, emitToRoom, emitGlobal, notifyParty } from '../socket.js';
import { verifyGoogleCredential } from '../utils/googleAuth.js';

// Gateway Initialize
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' })

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' })
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to authenticate user with Google OAuth (GIS ID token / One-Tap / Access token)
const googleAuthUser = async (req, res) => {
    try {
        const { credential, accessToken } = req.body;

        if (!credential && !accessToken) {
            return res.status(400).json({ success: false, message: 'Google credential or access token is required' });
        }

        const profile = await verifyGoogleCredential({ credential, accessToken });
        const { sub, email, name, picture } = profile;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Google account does not have a verified email address' });
        }

        // Check if user already exists with this email
        let user = await userModel.findOne({ email });
        let isNewUser = false;

        const defaultAvatar = 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/smiling-man.jpg';

        if (user) {
            // Update / Link Google credentials and avatar if default
            const updates = {
                googleId: sub,
                isGoogleAuth: true,
                authProvider: user.authProvider === 'local' ? 'google' : user.authProvider
            };

            if (picture && (!user.image || user.image === defaultAvatar)) {
                updates.image = picture;
            }

            user = await userModel.findByIdAndUpdate(user._id, updates, { new: true }).select('-password');
        } else {
            // New user registration via Google OAuth
            isNewUser = true;
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            const newUser = new userModel({
                name: name || 'VitalSync Patient',
                email,
                password: hashedPassword,
                image: picture || defaultAvatar,
                phone: '000000000',
                address: { line1: '', line2: '' },
                gender: 'Not Selected',
                dob: 'Not Selected',
                allergies: [],
                currentMedications: [],
                authProvider: 'google',
                googleId: sub,
                isGoogleAuth: true
            });

            const savedUser = await newUser.save();
            user = await userModel.findById(savedUser._id).select('-password');
        }

        // Issue VitalSync JWT Token
        const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: isNewUser ? 'Account registered successfully with Google' : 'Signed in successfully with Google',
            token,
            userData: user,
            isNewUser
        });

    } catch (error) {
        console.error('Google Auth Error:', error.message);
        res.status(400).json({ success: false, message: error.message || 'Google authentication failed' });
    }
};

// API to get public auth configuration (Google Client ID, etc.)
const getAuthConfig = async (req, res) => {
    try {
        res.json({
            success: true,
            googleClientId: process.env.GOOGLE_CLIENT_ID || '',
            isGoogleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID)
        });
    } catch (error) {
        console.error('Auth config error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        const updateData = { name, phone, address: typeof address === 'string' ? JSON.parse(address) : address, dob, gender }
        
        if (req.body.allergies) {
            updateData.allergies = typeof req.body.allergies === 'string' ? JSON.parse(req.body.allergies) : req.body.allergies
        }
        if (req.body.currentMedications) {
            updateData.currentMedications = typeof req.body.currentMedications === 'string' ? JSON.parse(req.body.currentMedications) : req.body.currentMedications
        }

        await userModel.findByIdAndUpdate(userId, updateData)

        if (imageFile) {
            try {
                // upload image to cloudinary
                const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
                const imageURL = imageUpload.secure_url

                await userModel.findByIdAndUpdate(userId, { image: imageURL })
            } finally {
                try { await fs.promises.unlink(imageFile.path); } catch (e) {}
            }
        }

        // Fetch updated user profile and sync into appointments + re-evaluate prescriptions & notify doctors
        const updatedUser = await userModel.findById(userId).select('-password')
        if (updatedUser) {
            await appointmentModel.updateMany({ userId }, { $set: { userData: updatedUser } })

            // Re-evaluate all prescriptions for this patient against their updated allergies & regular medications
            const userPrescriptions = await prescriptionModel.find({ userId })
            const notifiedDocAppointments = new Set()

            for (const rx of userPrescriptions) {
                const newSafetyReport = await evaluateSafetyWithAI(
                    rx.medicines || [],
                    updatedUser.currentMedications || [],
                    updatedUser.allergies || []
                )
                rx.safetyReport = newSafetyReport
                await rx.save()

                emitToUser(userId, 'prescription-updated', {
                    appointmentId: String(rx.appointmentId),
                    prescriptionId: String(rx._id),
                    safetyReport: newSafetyReport
                })
                emitToDoctor(rx.docId, 'prescription-updated', {
                    appointmentId: String(rx.appointmentId),
                    prescriptionId: String(rx._id),
                    safetyReport: newSafetyReport
                })
                emitToRoom(String(rx.appointmentId), 'prescription-updated', {
                    appointmentId: String(rx.appointmentId),
                    prescriptionId: String(rx._id),
                    safetyReport: newSafetyReport
                })

                // If an allergy or drug-drug conflict is detected on this prescription, alert the doctor & patient!
                if (newSafetyReport.overallRisk !== 'SAFE') {
                    notifiedDocAppointments.add(String(rx.appointmentId))
                    const allergyText = (newSafetyReport.allergyAlerts || [])
                        .map(a => `${a.drug} (Allergy: ${a.allergen})`)
                        .join(', ')
                    const ddiText = (newSafetyReport.interactions || [])
                        .map(i => `${i.drugA} ↔ ${i.drugB}`)
                        .join(', ')
                    const conflictSummary = [allergyText, ddiText].filter(Boolean).join(' • ')

                    await notifyParty({
                        recipientRole: 'doctor',
                        recipientId: rx.docId,
                        type: 'allergy_conflict',
                        title: `🚨 Allergy / Medicine Conflict: ${updatedUser.name}`,
                        body: `Patient updated their allergies/medications. Active prescription has ${newSafetyReport.overallRisk} conflict: ${conflictSummary}. Tap to review & update prescription.`,
                        appointmentId: String(rx.appointmentId),
                        link: `/doctor-prescription/${rx.appointmentId}`,
                        senderName: updatedUser.name,
                        senderImage: updatedUser.image || ''
                    })

                    await notifyParty({
                        recipientRole: 'user',
                        recipientId: userId,
                        type: 'allergy_conflict',
                        title: `⚠️ Medicine Allergy / Interaction Alert`,
                        body: `Your prescription has a ${newSafetyReport.overallRisk} conflict with your updated allergies/medications (${conflictSummary}). Your doctor has been notified automatically.`,
                        appointmentId: String(rx.appointmentId),
                        link: `/prescription/${rx.appointmentId}`,
                        senderName: 'AI Medicine Safety Guard',
                        senderImage: ''
                    })

                    // Also log a clinical safety alert in the appointment chat thread
                    try {
                        let chat = await chatModel.findOne({ appointmentId: rx.appointmentId })
                        if (chat) {
                            const alertMsg = {
                                sender: 'user',
                                senderName: updatedUser.name,
                                text: `⚠️ Clinical Alert: I updated my allergies/medications (Allergies: ${(updatedUser.allergies || []).join(', ') || 'None'}). AI Safety Check flagged a ${newSafetyReport.overallRisk} conflict on my prescription: ${conflictSummary}. Please review.`,
                                attachmentUrl: `/prescription/${rx.appointmentId}`,
                                attachmentType: 'prescription',
                                attachmentName: `Safety Conflict (${newSafetyReport.overallRisk})`,
                                readBy: ['user'],
                                timestamp: new Date()
                            }
                            chat.messages.push(alertMsg)
                            chat.updatedAt = new Date()
                            await chat.save()

                            const savedMsg = chat.messages[chat.messages.length - 1]
                            emitToRoom(String(rx.appointmentId), 'chat-message', {
                                ...savedMsg.toObject(),
                                appointmentId: String(rx.appointmentId)
                            })
                            emitToDoctor(rx.docId, 'chat-thread-updated', {
                                appointmentId: String(rx.appointmentId),
                                lastMessage: savedMsg
                            })
                        }
                    } catch (e) {
                        console.log('Allergy chat alert error:', e.message)
                    }
                }
            }

            // Also notify doctors of active upcoming appointments when patient updates allergies or regular meds
            if (req.body.allergies || req.body.currentMedications) {
                const activeAppointments = await appointmentModel.find({
                    userId,
                    cancelled: false,
                    isCompleted: false
                })
                const allergiesList = (updatedUser.allergies || []).join(', ')
                const medsList = (updatedUser.currentMedications || [])
                    .map(m => (typeof m === 'string' ? m : `${m.name || ''} ${m.dosage || ''}`.trim()))
                    .filter(Boolean)
                    .join(', ')

                for (const apt of activeAppointments) {
                    emitToDoctor(apt.docId, 'appointment-updated', {
                        action: 'patient-profile-updated',
                        appointmentId: apt._id
                    })
                    if (!notifiedDocAppointments.has(String(apt._id)) && (allergiesList || medsList)) {
                        await notifyParty({
                            recipientRole: 'doctor',
                            recipientId: apt.docId,
                            type: 'patient_allergies_updated',
                            title: `📋 ${updatedUser.name} Updated Allergies / Meds`,
                            body: `Allergies: ${allergiesList || 'None'} • Regular Meds: ${medsList || 'None'}.`,
                            appointmentId: String(apt._id),
                            link: `/doctor-prescription/${apt._id}`,
                            senderName: updatedUser.name,
                            senderImage: updatedUser.image || ''
                        })
                    }
                }
            }
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const { userId, docId, slotDate, slotTime, reasonForVisit } = req.body
        const cleanReason = typeof reasonForVisit === 'string' ? reasonForVisit.trim() : ''
        const docCheck = await doctorModel.findById(docId).select("-password -privateKey")

        if (!docCheck || !docCheck.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        // Atomic Slot Reservation Mutex: atomically verify slotTime is NOT already booked and push it in a single MongoDB operation
        const slotField = `slots_booked.${slotDate}`
        const reservedDoc = await doctorModel.findOneAndUpdate(
            {
                _id: docId,
                available: true,
                [slotField]: { $nin: [slotTime] }
            },
            {
                $push: { [slotField]: slotTime }
            },
            { new: true }
        ).select("-password -privateKey -slots_booked")

        if (!reservedDoc) {
            return res.json({ success: false, message: 'Slot Not Available' })
        }

        const docData = reservedDoc.toObject()
        const userData = await userModel.findById(userId).select("-password")

        const isTestBypass = Boolean(req.body.testBypass && isPaymentTestMode())

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            reasonForVisit: cleanReason,
            date: Date.now(),
            payment: isTestBypass,
            paymentMethod: isTestBypass ? 'test-bypass' : '',
            paidAt: isTestBypass ? new Date() : null
        }

        let newAppointment
        try {
            newAppointment = new appointmentModel(appointmentData)
            await newAppointment.save()
        } catch (saveErr) {
            // Rollback atomic slot lock if unique index rejects concurrent insert
            await doctorModel.findByIdAndUpdate(docId, { $pull: { [slotField]: slotTime } })
            if (saveErr?.code === 11000) {
                return res.json({ success: false, message: 'Slot Not Available (Concurrent Booking Prevented)' })
            }
            throw saveErr
        }

        // Pre-create chat room so both patient and doctor see the thread immediately
        const initialMessages = cleanReason
            ? [{
                sender: 'user',
                senderName: userData.name,
                text: `📋 Reason for Visit / Symptoms: ${cleanReason}`,
                readBy: ['user'],
                timestamp: new Date()
            }]
            : []

        await chatModel.findOneAndUpdate(
            { appointmentId: newAppointment._id },
            {
                $setOnInsert: {
                    appointmentId: newAppointment._id,
                    userId,
                    docId,
                    messages: initialMessages,
                    isActive: true
                }
            },
            { upsert: true, new: true }
        )

        // Emit real-time socket updates
        emitToUser(userId, 'appointment-updated', { action: 'booked', appointmentId: newAppointment._id })
        emitToDoctor(docId, 'appointment-updated', { action: 'booked', appointmentId: newAppointment._id })
        emitToAdmin('appointment-updated', { action: 'booked', appointmentId: newAppointment._id })
        emitGlobal('doctors-updated', { docId })

        if (isTestBypass) {
            emitToUser(userId, 'appointment-updated', { action: 'paid', appointmentId: newAppointment._id })
            emitToDoctor(docId, 'appointment-updated', { action: 'paid', appointmentId: newAppointment._id })
            emitToAdmin('appointment-updated', { action: 'paid', appointmentId: newAppointment._id })
        }

        // Notify Doctor in real time
        notifyParty({
            recipientRole: 'doctor',
            recipientId: docId,
            type: 'appointment_booked',
            title: `New Appointment: ${userData.name}`,
            body: `Booked for ${slotDate.replace(/_/g, '/')} at ${slotTime}${cleanReason ? ` • Reason: ${cleanReason}` : ''}${isTestBypass ? ' • Paid (Test Mode)' : ''}.`,
            appointmentId: String(newAppointment._id),
            link: '/doctor-appointments',
            senderName: userData.name,
            senderImage: userData.image || ''
        })

        res.json({
            success: true,
            message: isTestBypass ? 'Appointment Booked & Confirmed (Test Mode)' : 'Appointment Booked',
            appointmentId: newAppointment._id,
            payment: isTestBypass
        })

        // Send confirmation email with interactive calendar attachment (.ics) (non-blocking)
        sendAppointmentConfirmation({
            patientEmail: userData.email,
            patientName: userData.name,
            doctorName: docData.name,
            doctorSpeciality: docData.speciality,
            slotDate,
            slotTime,
            appointmentId: newAppointment._id,
            amount: docData.fees
        }).catch(err => console.error('Booking email error:', err.message))

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const { userId, appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        // verify appointment user 
        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)

        let slots_booked = doctorData.slots_booked

        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        // Emit real-time socket updates
        emitToUser(userId, 'appointment-updated', { action: 'cancelled', appointmentId })
        emitToDoctor(docId, 'appointment-updated', { action: 'cancelled', appointmentId })
        emitToAdmin('appointment-updated', { action: 'cancelled', appointmentId })
        emitGlobal('doctors-updated', { docId })

        // Notify Doctor in real time
        notifyParty({
            recipientRole: 'doctor',
            recipientId: docId,
            type: 'appointment_cancelled',
            title: `Appointment Cancelled`,
            body: `${appointmentData.userData?.name || 'Patient'} cancelled their visit for ${slotDate.replace(/_/g, '/')} at ${slotTime}.`,
            appointmentId: String(appointmentId),
            link: '/doctor-appointments',
            senderName: appointmentData.userData?.name || 'Patient',
            senderImage: appointmentData.userData?.image || ''
        })

        res.json({ success: true, message: 'Appointment Cancelled' })

        // Send cancellation email (non-blocking)
        sendCancellationEmail(
            appointmentData.userData.email,
            appointmentData.userData.name,
            appointmentData.docData.name,
            appointmentData.slotDate.replace(/_/g, '/'),
            appointmentData.slotTime
        ).catch(err => console.log('Email error:', err.message))

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to reschedule an upcoming appointment without losing payment or chat history
const rescheduleAppointment = async (req, res) => {
    try {
        const { userId, appointmentId, newSlotDate, newSlotTime } = req.body

        if (!appointmentId || !newSlotDate || !newSlotTime) {
            return res.json({ success: false, message: 'Please select a new date and time slot' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        if (appointmentData.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.cancelled || appointmentData.isCompleted) {
            return res.json({ success: false, message: 'Cannot reschedule a completed or cancelled appointment' })
        }

        if (appointmentData.slotDate === newSlotDate && appointmentData.slotTime === newSlotTime) {
            return res.json({ success: false, message: 'Please choose a different date or time slot' })
        }

        const { docId, slotDate: oldSlotDate, slotTime: oldSlotTime } = appointmentData
        const newSlotField = `slots_booked.${newSlotDate}`
        const oldSlotField = `slots_booked.${oldSlotDate}`

        // Atomic mutex reservation on the target slot to prevent concurrent reschedule collisions
        const lockedDoc = await doctorModel.findOneAndUpdate(
            {
                _id: docId,
                available: true,
                [newSlotField]: { $nin: [newSlotTime] }
            },
            {
                $push: { [newSlotField]: newSlotTime }
            },
            { new: true }
        )

        if (!lockedDoc) {
            const existsDoc = await doctorModel.findById(docId).select('available')
            if (!existsDoc || !existsDoc.available) {
                return res.json({ success: false, message: 'Doctor is currently not available for rescheduling' })
            }
            return res.json({ success: false, message: 'Selected time slot is already booked' })
        }

        try {
            await appointmentModel.findByIdAndUpdate(appointmentId, {
                slotDate: newSlotDate,
                slotTime: newSlotTime,
                rescheduledAt: new Date()
            })
        } catch (updateErr) {
            // Rollback newly reserved slot if partial unique index rejects collision
            await doctorModel.findByIdAndUpdate(docId, {
                $pull: { [newSlotField]: newSlotTime }
            })
            if (updateErr.code === 11000) {
                return res.json({ success: false, message: 'Selected time slot was just reserved by another patient.' })
            }
            throw updateErr
        }

        // Release old slot atomically after successful transition
        await doctorModel.findByIdAndUpdate(docId, {
            $pull: { [oldSlotField]: oldSlotTime }
        })

        // Emit real-time socket updates
        emitToUser(userId, 'appointment-updated', { action: 'rescheduled', appointmentId })
        emitToDoctor(docId, 'appointment-updated', { action: 'rescheduled', appointmentId })
        emitToAdmin('appointment-updated', { action: 'rescheduled', appointmentId })
        emitGlobal('doctors-updated', { docId })

        const patientName = appointmentData.userData?.name || 'Patient'
        notifyParty({
            recipientRole: 'doctor',
            recipientId: docId,
            type: 'appointment_rescheduled',
            title: `📅 Appointment Rescheduled: ${patientName}`,
            body: `Moved from ${oldSlotDate.replace(/_/g, '/')} (${oldSlotTime}) → ${newSlotDate.replace(/_/g, '/')} at ${newSlotTime}.`,
            appointmentId: String(appointmentId),
            link: '/doctor-appointments',
            senderName: patientName,
            senderImage: appointmentData.userData?.image || ''
        })

        res.json({
            success: true,
            message: `Appointment rescheduled to ${newSlotDate.replace(/_/g, '/')} at ${newSlotTime}`
        })

        // Send updated confirmation email with rescheduled calendar attachment (non-blocking)
        sendAppointmentConfirmation({
            patientEmail: appointmentData.userData?.email,
            patientName: appointmentData.userData?.name,
            doctorName: appointmentData.docData?.name,
            doctorSpeciality: appointmentData.docData?.speciality,
            slotDate: newSlotDate,
            slotTime: newSlotTime,
            appointmentId,
            amount: appointmentData.amount
        }).catch(err => console.log('Reschedule email error:', err.message))
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const { userId } = req.body
        const appointments = await appointmentModel.find({ userId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get a single appointment by ID
const getAppointment = async (req, res) => {
    try {
        const { userId } = req.body
        const { appointmentId } = req.params

        const appointment = await appointmentModel.findById(appointmentId)

        if (!appointment) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        // Verify this appointment belongs to the requesting user
        if (appointment.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized' })
        }

        res.json({ success: true, appointment })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        let isAuthentic = false
        if (razorpay_order_id && razorpay_payment_id && razorpay_signature && process.env.RAZORPAY_KEY_SECRET) {
            const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`)
            isAuthentic = hmac.digest('hex') === razorpay_signature
        }

        if (orderInfo.status === 'paid' || isAuthentic) {
            await markAppointmentPaid(orderInfo.receipt, 'razorpay')
            res.json({ success: true, message: "Payment Successful" })
        }
        else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using Stripe
const paymentStripe = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const { origin } = req.headers

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        const currency = process.env.CURRENCY.toLocaleLowerCase()

        const line_items = [{
            price_data: {
                currency,
                product_data: {
                    name: "Appointment Fees"
                },
                unit_amount: appointmentData.amount * 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&appointmentId=${appointmentData._id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/verify?success=false&appointmentId=${appointmentData._id}`,
            line_items: line_items,
            mode: 'payment',
            client_reference_id: appointmentData._id.toString(),
            metadata: {
                appointmentId: appointmentData._id.toString(),
                userId: appointmentData.userId.toString()
            }
        })

        res.json({ success: true, session_url: session.url });

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const verifyStripe = async (req, res) => {
    try {
        const { appointmentId, success, sessionId } = req.body
        const requesterUserId = req.userId || req.body.userId

        const appointmentData = await appointmentModel.findById(appointmentId)
        if (!appointmentData || String(appointmentData.userId) !== String(requesterUserId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.payment) {
            return res.json({ success: true, message: 'Appointment is already paid' })
        }

        // 1. Live Stripe Checkout Session Verification
        if (sessionId && process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('---')) {
            const session = await stripeInstance.checkout.sessions.retrieve(sessionId)
            const matchesAppointment = session.client_reference_id === appointmentId || session.metadata?.appointmentId === appointmentId
            if (session.payment_status === 'paid' && matchesAppointment) {
                await markAppointmentPaid(appointmentId, 'stripe')
                return res.json({ success: true, message: 'Payment Successful' })
            } else {
                return res.status(400).json({ success: false, message: 'Payment verification failed with provider' })
            }
        }

        // 2. Controlled developer/test mode bypass (strictly gated)
        if (isPaymentTestMode() && success === "true") {
            await markAppointmentPaid(appointmentId, 'test-bypass')
            return res.json({ success: true, message: 'Test Mode: Payment Marked Successful' })
        }

        res.status(400).json({ success: false, message: 'Payment verification failed or session missing' })

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }

}

// Shared helper: mark an appointment as paid, emit real-time updates & notify the doctor
const markAppointmentPaid = async (appointmentId, method) => {
    const updatedApt = await appointmentModel.findByIdAndUpdate(
        appointmentId,
        { payment: true, paymentMethod: method, paidAt: new Date() },
        { new: true }
    )
    if (!updatedApt) return null

    emitToUser(updatedApt.userId, 'appointment-updated', { action: 'paid', appointmentId: updatedApt._id })
    emitToDoctor(updatedApt.docId, 'appointment-updated', { action: 'paid', appointmentId: updatedApt._id })
    emitToAdmin('appointment-updated', { action: 'paid', appointmentId: updatedApt._id })
    notifyParty({
        recipientRole: 'doctor',
        recipientId: updatedApt.docId,
        type: 'payment_received',
        title: method === 'test-bypass' ? 'Payment Marked Paid (Test Mode)' : 'Payment Received Online',
        body: `${updatedApt.userData?.name || 'Patient'} ${method === 'test-bypass' ? 'skipped payment in test mode' : `paid ₹${updatedApt.amount}`} — the video consultation is now unlocked.`,
        appointmentId: String(updatedApt._id),
        link: '/doctor-appointments',
        senderName: updatedApt.userData?.name || 'Patient',
        senderImage: updatedApt.userData?.image || ''
    })

    // Send confirmation email with iCalendar invite and Google Calendar link (if not already sent via upfront test-bypass)
    if (method !== 'test-bypass') {
        sendAppointmentConfirmation({
            patientEmail: updatedApt.userData?.email,
            patientName: updatedApt.userData?.name,
            doctorName: updatedApt.docData?.name,
            doctorSpeciality: updatedApt.docData?.speciality,
            slotDate: updatedApt.slotDate,
            slotTime: updatedApt.slotTime,
            appointmentId: updatedApt._id,
            amount: updatedApt.amount
        }).catch(err => console.error('Payment confirmation email error:', err.message))
    }

    return updatedApt
}

const isPaymentTestMode = () => String(process.env.PAYMENT_TEST_MODE || '').toLowerCase() === 'true'

// API to expose which payment options are available (public, no secrets)
const getPaymentConfig = async (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY || ''
    const razorpayKey = process.env.RAZORPAY_KEY_ID || ''
    res.json({
        success: true,
        testMode: isPaymentTestMode(),
        razorpayEnabled: Boolean(razorpayKey) && !razorpayKey.includes('---'),
        stripeEnabled: Boolean(stripeKey) && !stripeKey.includes('---')
    })
}

// API to mark an appointment as paid WITHOUT a gateway — only works when PAYMENT_TEST_MODE=true
const testPaymentBypass = async (req, res) => {
    try {
        if (!isPaymentTestMode()) {
            return res.json({ success: false, message: 'Payment test mode is disabled on this server' })
        }

        const { userId, appointmentId } = req.body
        const appointment = await appointmentModel.findById(appointmentId)

        if (!appointment) {
            return res.json({ success: false, message: 'Appointment not found' })
        }
        if (appointment.userId !== userId) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }
        if (appointment.cancelled) {
            return res.json({ success: false, message: 'Appointment is cancelled' })
        }
        if (appointment.payment) {
            return res.json({ success: true, message: 'Appointment is already paid' })
        }

        await markAppointmentPaid(appointmentId, 'test-bypass')
        res.json({ success: true, message: 'Test Mode: payment skipped — video consultation unlocked' })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to download .ics calendar file for an appointment
const downloadAppointmentCalendar = async (req, res) => {
    try {
        const { appointmentId } = req.params
        if (!appointmentId || appointmentId.length !== 24) {
            return res.status(404).send('Appointment not found')
        }
        const appointment = await appointmentModel.findById(appointmentId)
        if (!appointment) {
            return res.status(404).send('Appointment not found')
        }

        const requesterId = req.userId || req.body?.userId
        if (requesterId && String(appointment.userId) !== String(requesterId) && String(appointment.docId) !== String(requesterId)) {
            return res.status(403).send('Unauthorized')
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
        const icsContent = generateICS({
            appointmentId: String(appointment._id),
            doctorName: appointment.docData?.name || 'Doctor',
            doctorSpeciality: appointment.docData?.speciality || 'Specialist',
            patientName: appointment.userData?.name || 'Patient',
            patientEmail: appointment.userData?.email || 'patient@example.com',
            slotDate: appointment.slotDate,
            slotTime: appointment.slotTime,
            amount: appointment.amount || 0,
            videoUrl: `${frontendUrl}/video-call/${appointment._id}`
        })

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="vitalsync_appointment_${appointment._id}.ics"`)
        return res.send(icsContent)
    } catch (error) {
        console.error('Calendar download error:', error)
        return res.status(500).send(error.message)
    }
}

export {
    loginUser,
    registerUser,
    googleAuthUser,
    getAuthConfig,
    getProfile,
    updateProfile,
    bookAppointment,
    listAppointment,
    getAppointment,
    cancelAppointment,
    rescheduleAppointment,
    paymentRazorpay,
    verifyRazorpay,
    paymentStripe,
    verifyStripe,
    getPaymentConfig,
    testPaymentBypass,
    downloadAppointmentCalendar
}