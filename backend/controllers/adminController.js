import jwt from "jsonwebtoken";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import prescriptionModel from "../models/prescriptionModel.js";
import medicalRecordModel from "../models/medicalRecordModel.js";
import bcrypt from "bcryptjs";
import validator from "validator";
import { v2 as cloudinary } from "cloudinary";
import userModel from "../models/userModel.js";
import fs from "fs";
import { emitToUser, emitToDoctor, emitToAdmin, emitGlobal, notifyParty } from "../socket.js";
import { verifyGoogleCredential } from "../utils/googleAuth.js";

// API for admin login
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const configuredAdmin = (process.env.ADMIN_EMAIL || '').toLowerCase();

        if (configuredAdmin && (email || '').toLowerCase() === configuredAdmin && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(
                { role: 'admin', email: configuredAdmin },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
            res.json({ success: true, token });
        } else {
            res.json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get all appointments list
const appointmentsAdmin = async (req, res) => {
    try {
        const appointments = await appointmentModel.find({});
        res.json({ success: true, appointments });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for appointment cancellation by Admin
const appointmentCancel = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const appointmentData = await appointmentModel.findByIdAndUpdate(
            appointmentId,
            { cancelled: true },
            { new: true }
        );

        if (appointmentData) {
            // Also free up the doctor's booked slot
            const { docId, slotDate, slotTime } = appointmentData;
            const docData = await doctorModel.findById(docId);
            if (docData && docData.slots_booked && docData.slots_booked[slotDate]) {
                docData.slots_booked[slotDate] = docData.slots_booked[slotDate].filter(
                    (e) => e !== slotTime
                );
                await doctorModel.findByIdAndUpdate(docId, { slots_booked: docData.slots_booked });
            }

            emitToUser(appointmentData.userId, 'appointment-updated', { action: 'cancelled', appointmentId });
            emitToDoctor(appointmentData.docId, 'appointment-updated', { action: 'cancelled', appointmentId });
            emitToAdmin('appointment-updated', { action: 'cancelled', appointmentId });
            emitGlobal('doctors-updated', { docId: appointmentData.docId });

            notifyParty({
                recipientRole: 'user',
                recipientId: appointmentData.userId,
                type: 'appointment_cancelled',
                title: 'Appointment Cancelled by Clinic Admin',
                body: `Your appointment with ${appointmentData.docData?.name || 'Doctor'} on ${appointmentData.slotDate.replace(/_/g, '/')} at ${appointmentData.slotTime} was cancelled.`,
                appointmentId: String(appointmentId),
                link: '/my-appointments',
                senderName: 'VitalSync Clinic',
                senderImage: appointmentData.docData?.image || ''
            });

            notifyParty({
                recipientRole: 'doctor',
                recipientId: appointmentData.docId,
                type: 'appointment_cancelled',
                title: 'Appointment Cancelled by Admin',
                body: `Appointment with ${appointmentData.userData?.name || 'Patient'} on ${appointmentData.slotDate.replace(/_/g, '/')} at ${appointmentData.slotTime} was cancelled.`,
                appointmentId: String(appointmentId),
                link: '/doctor-appointments',
                senderName: 'Clinic Admin',
                senderImage: appointmentData.userData?.image || ''
            });
        }

        res.json({ success: true, message: 'Appointment Cancelled' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for marking appointment completed by Admin
const appointmentCompleteAdmin = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const appointmentData = await appointmentModel.findByIdAndUpdate(
            appointmentId,
            { isCompleted: true },
            { new: true }
        );

        if (appointmentData) {
            emitToUser(appointmentData.userId, 'appointment-updated', { action: 'completed', appointmentId });
            emitToDoctor(appointmentData.docId, 'appointment-updated', { action: 'completed', appointmentId });
            emitToAdmin('appointment-updated', { action: 'completed', appointmentId });

            notifyParty({
                recipientRole: 'user',
                recipientId: appointmentData.userId,
                type: 'appointment_completed',
                title: 'Consultation Marked Completed',
                body: `Your visit with ${appointmentData.docData?.name || 'Doctor'} has been marked completed.`,
                appointmentId: String(appointmentId),
                link: '/my-appointments',
                senderName: appointmentData.docData?.name || 'VitalSync Clinic',
                senderImage: appointmentData.docData?.image || ''
            });

            notifyParty({
                recipientRole: 'doctor',
                recipientId: appointmentData.docId,
                type: 'appointment_completed',
                title: 'Visit Completed by Admin',
                body: `Appointment with ${appointmentData.userData?.name || 'Patient'} was marked completed by Clinic Admin.`,
                appointmentId: String(appointmentId),
                link: '/doctor-appointments',
                senderName: 'Clinic Admin',
                senderImage: appointmentData.userData?.image || ''
            });
        }

        res.json({ success: true, message: 'Appointment Marked as Completed' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for adding Doctor
const addDoctor = async (req, res) => {
    try {
        const { name, email, password, speciality, degree, experience, about, fees, address } = req.body;
        const imageFile = req.file;

        if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address) {
            return res.json({ success: false, message: "Missing Details" });
        }

        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" });
        }

        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a password of at least 8 characters" });
        }

        const existingDoc = await doctorModel.findOne({ email });
        if (existingDoc) {
            return res.json({ success: false, message: "A doctor with this email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let imageUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80';
        if (imageFile) {
            try {
                const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
                imageUrl = imageUpload.secure_url;
            } finally {
                try { await fs.promises.unlink(imageFile.path); } catch (e) {}
            }
        }

        const formattedName = name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;

        const doctorData = {
            name: formattedName,
            email: email.trim().toLowerCase(),
            image: imageUrl,
            password: hashedPassword,
            speciality,
            degree,
            experience,
            about,
            fees: Number(fees),
            address: typeof address === 'string' ? JSON.parse(address) : address,
            available: true,
            date: Date.now()
        };

        const newDoctor = new doctorModel(doctorData);
        await newDoctor.save();
        emitGlobal('doctors-updated', { docId: newDoctor._id });
        res.json({ success: true, message: `${formattedName} added to clinic directory` });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for updating an existing Doctor's details (Admin)
const updateDoctorAdmin = async (req, res) => {
    try {
        const {
            docId,
            name,
            email,
            password,
            speciality,
            degree,
            experience,
            about,
            fees,
            address,
            available
        } = req.body;
        const imageFile = req.file;

        if (!docId) {
            return res.json({ success: false, message: "Doctor ID is required" });
        }

        const doctor = await doctorModel.findById(docId);
        if (!doctor) {
            return res.json({ success: false, message: "Doctor not found" });
        }

        const updateFields = {};
        if (name) {
            updateFields.name = name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`;
        }
        if (email && validator.isEmail(email)) {
            updateFields.email = email.trim().toLowerCase();
        }
        if (speciality) updateFields.speciality = speciality;
        if (degree) updateFields.degree = degree;
        if (experience) updateFields.experience = experience;
        if (about !== undefined) updateFields.about = about;
        if (fees !== undefined) updateFields.fees = Number(fees);
        if (available !== undefined) {
            updateFields.available = available === 'true' || available === true;
        }
        if (address) {
            updateFields.address = typeof address === 'string' ? JSON.parse(address) : address;
        }
        if (password && password.trim().length >= 8) {
            const salt = await bcrypt.genSalt(10);
            updateFields.password = await bcrypt.hash(password.trim(), salt);
        }
        if (imageFile) {
            try {
                const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" });
                updateFields.image = imageUpload.secure_url;
            } finally {
                try { await fs.promises.unlink(imageFile.path); } catch (e) {}
            }
        }

        const updatedDoc = await doctorModel.findByIdAndUpdate(docId, updateFields, { new: true }).select('-password');

        // Also sync updated docData snapshot into upcoming appointments for this doctor
        if (updatedDoc) {
            await appointmentModel.updateMany(
                { docId: String(docId), isCompleted: false, cancelled: false },
                {
                    $set: {
                        'docData.name': updatedDoc.name,
                        'docData.speciality': updatedDoc.speciality,
                        'docData.degree': updatedDoc.degree,
                        'docData.experience': updatedDoc.experience,
                        'docData.fees': updatedDoc.fees,
                        'docData.image': updatedDoc.image,
                        'docData.address': updatedDoc.address
                    }
                }
            );
        }

        emitGlobal('doctors-updated', { docId });
        emitToDoctor(docId, 'appointment-updated', { action: 'profile_updated' });

        res.json({
            success: true,
            message: `${updatedDoc.name}'s profile updated successfully`,
            doctor: updatedDoc
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for deleting a Doctor (Admin)
const deleteDoctorAdmin = async (req, res) => {
    try {
        const { docId } = req.body;
        if (!docId) {
            return res.json({ success: false, message: "Doctor ID is required" });
        }

        const doc = await doctorModel.findByIdAndDelete(docId);
        if (!doc) {
            return res.json({ success: false, message: "Doctor not found" });
        }

        emitGlobal('doctors-updated', { docId });
        res.json({ success: true, message: `${doc.name} removed from clinic directory` });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get all doctors list for admin panel
const allDoctors = async (req, res) => {
    try {
        const doctors = await doctorModel.find({}).select('-password');
        res.json({ success: true, doctors });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get all registered patients with appointment & clinical counts (Admin)
const allPatientsAdmin = async (req, res) => {
    try {
        const [users, appointments, prescriptions, records] = await Promise.all([
            userModel.find({}).select('-password').lean(),
            appointmentModel.find({}).lean(),
            prescriptionModel.find({}).select('userId appointmentId diagnosis safetyReport createdAt').lean(),
            medicalRecordModel.find({}).select('userId fileName isAnalyzed uploadDate').lean()
        ]);

        const patientsWithStats = users.map((u) => {
            const uid = String(u._id);
            const userAppts = appointments.filter((a) => String(a.userId) === uid);
            const completedAppts = userAppts.filter((a) => a.isCompleted);
            const totalSpent = userAppts
                .filter((a) => (a.isCompleted || a.payment) && !a.cancelled)
                .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
            const userPrescriptions = prescriptions.filter((p) => String(p.userId) === uid);
            const userRecords = records.filter((r) => String(r.userId) === uid);

            return {
                ...u,
                totalAppointments: userAppts.length,
                completedAppointments: completedAppts.length,
                totalSpent,
                prescriptionsCount: userPrescriptions.length,
                recordsCount: userRecords.length,
                recentAppointments: userAppts.slice(-5).reverse()
            };
        });

        res.json({ success: true, patients: patientsWithStats });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API to get dashboard data for admin panel
const adminDashboard = async (req, res) => {
    try {
        const [doctors, users, appointments, prescriptions] = await Promise.all([
            doctorModel.find({}).select('-password').lean(),
            userModel.find({}).select('-password').lean(),
            appointmentModel.find({}).lean(),
            prescriptionModel.find({}).select('docId userId diagnosis safetyReport createdAt').lean()
        ]);

        const availableDoctors = doctors.filter((d) => d.available).length;
        const completedAppointments = appointments.filter((a) => a.isCompleted).length;
        const cancelledAppointments = appointments.filter((a) => a.cancelled).length;
        const activeAppointments = appointments.filter((a) => !a.isCompleted && !a.cancelled).length;
        const paidAppointments = appointments.filter((a) => a.payment && !a.cancelled).length;

        const totalRevenue = appointments
            .filter((a) => (a.isCompleted || a.payment) && !a.cancelled)
            .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

        const safetyAlertsCaught = prescriptions.filter(
            (p) => p.safetyReport && p.safetyReport.overallRisk && p.safetyReport.overallRisk !== 'SAFE'
        ).length;

        // Telemedicine queue-skip analytics: Consultations resolved online vs referred to hospital
        const inPersonReferralsCount = appointments.filter((a) => Boolean(a.inPersonReferral)).length;
        const onlineResolvedCount = completedAppointments - appointments.filter((a) => a.isCompleted && Boolean(a.inPersonReferral)).length;
        const onlineResolutionRate = completedAppointments > 0 
            ? Math.round((Math.max(0, onlineResolvedCount) / completedAppointments) * 100) 
            : 100;

        // Top performing doctors by booking volume & revenue
        const docStatsMap = {};
        appointments.forEach((a) => {
            const did = String(a.docId);
            if (!docStatsMap[did]) {
                docStatsMap[did] = {
                    docId: did,
                    name: a.docData?.name || 'Doctor',
                    speciality: a.docData?.speciality || 'Specialist',
                    image: a.docData?.image || '',
                    bookings: 0,
                    completed: 0,
                    revenue: 0
                };
            }
            docStatsMap[did].bookings += 1;
            if (a.isCompleted) docStatsMap[did].completed += 1;
            if ((a.isCompleted || a.payment) && !a.cancelled) {
                docStatsMap[did].revenue += Number(a.amount) || 0;
            }
        });

        const topDoctors = Object.values(docStatsMap)
            .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
            .slice(0, 5);

        const dashData = {
            doctors: doctors.length,
            availableDoctors,
            appointments: appointments.length,
            completedAppointments,
            cancelledAppointments,
            activeAppointments,
            paidAppointments,
            totalRevenue,
            patients: users.length,
            prescriptionsCount: prescriptions.length,
            safetyAlertsCaught,
            inPersonReferralsCount,
            onlineResolvedCount,
            onlineResolutionRate,
            topDoctors,
            latestAppointments: [...appointments].reverse()
        };

        res.json({ success: true, dashData });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// API for admin login via Google OAuth
const googleAuthAdmin = async (req, res) => {
    try {
        const { credential, accessToken } = req.body;
        if (!credential && !accessToken) {
            return res.status(400).json({ success: false, message: 'Google credential or access token is required' });
        }

        const profile = await verifyGoogleCredential({ credential, accessToken });
        const { email } = profile;

        const configuredAdmin = (process.env.ADMIN_EMAIL || '').toLowerCase();

        if (!configuredAdmin || email.toLowerCase() !== configuredAdmin) {
            return res.status(403).json({
                success: false,
                message: `Google account (${email}) does not match the configured Clinic Administrator email.`
            });
        }

        const token = jwt.sign(
            { role: 'admin', email: configuredAdmin },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        res.json({
            success: true,
            message: 'Clinic Administrator authenticated with Google',
            token
        });

    } catch (error) {
        console.error('Admin Google Auth error:', error.message);
        res.status(400).json({ success: false, message: error.message || 'Admin Google login failed' });
    }
};

export {
    loginAdmin,
    googleAuthAdmin,
    appointmentsAdmin,
    appointmentCancel,
    appointmentCompleteAdmin,
    addDoctor,
    updateDoctorAdmin,
    deleteDoctorAdmin,
    allDoctors,
    allPatientsAdmin,
    adminDashboard
};
