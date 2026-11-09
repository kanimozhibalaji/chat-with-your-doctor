import prescriptionModel from '../models/prescriptionModel.js';
import appointmentModel from '../models/appointmentModel.js';
import doctorModel from '../models/doctorModel.js';
import userModel from '../models/userModel.js';
import chatModel from '../models/chatModel.js';
import { sendPrescriptionEmail } from '../utils/emailService.js';
import { checkDrugInteractions, evaluateSafetyWithAI } from '../data/ddiDatabase.js';
import {
    generateDoctorKeyPair,
    encryptPrivateKey,
    decryptPrivateKey,
    canonicalizePrescription,
    computeHash,
    signPrescription,
    verifySignature,
    generateQRCode
} from '../utils/cryptoSign.js';
import { emitToUser, emitToDoctor, emitToRoom, notifyParty } from '../socket.js';

// Create or Update a prescription (Doctor only)
const createPrescription = async (req, res) => {
    try {
        const {
            appointmentId,
            diagnosis,
            medicines,
            notes,
            followUpDate,
            clinicalOverrideConfirmed,
            clinicalOverrideReason
        } = req.body;
        const docId = req.body.docId; // from authDoctor

        // Verify appointment
        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.json({ success: false, message: "Appointment not found" });
        }

        if (appointment.docId !== docId) {
            return res.json({ success: false, message: "Not authorized to prescribe for this appointment" });
        }

        // Check if prescription already exists (if so, we will update and re-sign it!)
        const existing = await prescriptionModel.findOne({ appointmentId });
        const isUpdate = Boolean(existing);

        // Fetch user data for clinical allergies and current medications
        const user = await userModel.findById(appointment.userId);
        const userAllergies = user?.allergies || [];
        const userCurrentMeds = user?.currentMedications || [];

        // 1. Run Hybrid AI + Deterministic Drug-Drug Interaction and Allergy Safety Engine
        const safetyReport = await evaluateSafetyWithAI(medicines || [], userCurrentMeds, userAllergies);

        // Enforce ISMP Clinical Decision Support Hard-Stop on SEVERE risk unless physician documents override reason
        const trimmedOverrideReason = String(clinicalOverrideReason || '').trim();
        if (safetyReport.overallRisk === 'SEVERE' && (!clinicalOverrideConfirmed || trimmedOverrideReason.length < 5)) {
            return res.json({
                success: false,
                requiresClinicalOverride: true,
                safetyReport,
                message: "CRITICAL SAFETY HARD-STOP: Severe allergy or drug interaction detected. Modify the prescription or submit a documented clinical override justification."
            });
        }

        const clinicalOverrideMeta = safetyReport.overallRisk === 'SEVERE'
            ? {
                overridden: true,
                reason: trimmedOverrideReason,
                overriddenAt: new Date()
            }
            : {
                overridden: false,
                reason: '',
                overriddenAt: null
            };

        // 2. Fetch or provision Doctor's RSA-2048 Cryptographic Key Pair (AES-256-GCM encrypted at rest)
        let doctor = await doctorModel.findById(docId).select('+privateKey');
        let privateKeyPem = '';
        if (!doctor.publicKey || !doctor.privateKey) {
            const keyPair = generateDoctorKeyPair();
            const encryptedPriv = encryptPrivateKey(keyPair.privateKey);
            await doctorModel.findByIdAndUpdate(docId, {
                publicKey: keyPair.publicKey,
                privateKey: encryptedPriv
            });
            doctor.publicKey = keyPair.publicKey;
            privateKeyPem = keyPair.privateKey;
        } else {
            privateKeyPem = decryptPrivateKey(doctor.privateKey);
            // Transparently upgrade any legacy plaintext PEM in DB to AES-256-GCM envelope
            if (String(doctor.privateKey).startsWith('-----BEGIN')) {
                await doctorModel.findByIdAndUpdate(docId, {
                    privateKey: encryptPrivateKey(privateKeyPem)
                });
            }
        }

        // 3. Canonicalize prescription payload & compute SHA-256 hash
        const canonicalString = canonicalizePrescription({
            appointmentId,
            userId: appointment.userId,
            docId,
            diagnosis,
            medicines
        });
        const prescriptionHash = computeHash(canonicalString);

        // 4. Doctor Cryptographically signs the payload with decrypted in-memory RSA-2048 private key
        const digitalSignature = signPrescription(canonicalString, privateKeyPem);

        const expiryWindow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        let savedPrescription = null;

        if (existing) {
            existing.diagnosis = diagnosis;
            existing.medicines = medicines;
            existing.notes = notes;
            existing.followUpDate = followUpDate;
            existing.safetyReport = safetyReport;
            existing.clinicalOverride = clinicalOverrideMeta;
            existing.prescriptionHash = prescriptionHash;
            existing.digitalSignature = digitalSignature;
            existing.doctorPublicKey = doctor.publicKey;
            existing.isVerified = true;
            existing.expiresAt = expiryWindow;
            existing.dispenseStatus = 'ACTIVE';
            savedPrescription = await existing.save();
        } else {
            const prescriptionData = {
                appointmentId,
                userId: appointment.userId,
                docId,
                diagnosis,
                medicines,
                notes,
                followUpDate,
                safetyReport,
                clinicalOverride: clinicalOverrideMeta,
                prescriptionHash,
                digitalSignature,
                doctorPublicKey: doctor.publicKey,
                isVerified: true,
                expiresAt: expiryWindow,
                dispenseStatus: 'ACTIVE'
            };
            const newPrescription = new prescriptionModel(prescriptionData);
            savedPrescription = await newPrescription.save();
        }

        // 5. Generate QR Code linking to public verification portal
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const verificationUrl = `${clientUrl}/verify-prescription/${savedPrescription._id}`;
        const qrCodeDataUrl = await generateQRCode(verificationUrl, {
            prescriptionId: savedPrescription._id,
            hash: prescriptionHash,
            doctorName: doctor.name
        });

        savedPrescription.qrCode = qrCodeDataUrl;
        await savedPrescription.save();

        const docDisplayName = doctor.name?.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;

        // 6. Emit real-time socket events so patient's PrescriptionView & Appointments update instantaneously
        emitToUser(appointment.userId, 'prescription-updated', {
            appointmentId: String(appointmentId),
            prescriptionId: String(savedPrescription._id),
            isUpdate,
            diagnosis,
            safetyReport
        });
        emitToDoctor(docId, 'prescription-updated', {
            appointmentId: String(appointmentId),
            prescriptionId: String(savedPrescription._id),
            isUpdate,
            diagnosis,
            safetyReport
        });
        emitToRoom(appointmentId, 'prescription-updated', {
            appointmentId: String(appointmentId),
            prescriptionId: String(savedPrescription._id),
            isUpdate,
            diagnosis,
            safetyReport
        });

        // 7. Send real-time notification to Patient
        await notifyParty({
            recipientRole: 'user',
            recipientId: appointment.userId,
            type: isUpdate ? 'prescription_updated' : 'prescription_created',
            title: isUpdate
                ? `${docDisplayName} updated your prescription`
                : `${docDisplayName} issued your prescription`,
            body: `Diagnosis: ${diagnosis} (${(medicines || []).length} medicine${(medicines || []).length === 1 ? '' : 's'}). Tap to view or download.`,
            appointmentId: String(appointmentId),
            link: `/prescription/${appointmentId}`,
            senderName: docDisplayName,
            senderImage: doctor.image || ''
        });

        // If prescription was issued with a clinical conflict override, also log a clinical alert for the doctor
        if (safetyReport && safetyReport.overallRisk !== 'SAFE') {
            const conflictDetails = [
                ...(safetyReport.allergyAlerts || []).map(a => `${a.drug} (Allergy: ${a.allergen})`),
                ...(safetyReport.interactions || []).map(i => `${i.drugA} ↔ ${i.drugB}`)
            ].join(', ');
            await notifyParty({
                recipientRole: 'doctor',
                recipientId: docId,
                type: 'allergy_conflict',
                title: `⚠️ Clinical Safety Alert (${safetyReport.overallRisk}): ${user?.name || appointment.userData?.name || 'Patient'}`,
                body: `Prescription includes ${conflictDetails}. Review or adjust if not intentional.`,
                appointmentId: String(appointmentId),
                link: `/doctor-prescription/${appointmentId}`,
                senderName: user?.name || appointment.userData?.name || 'Clinical CDSS',
                senderImage: user?.image || appointment.userData?.image || ''
            });
        }

        // 8. Also append a rich prescription event message into the appointment chat thread
        try {
            let chat = await chatModel.findOne({ appointmentId });
            if (!chat) {
                chat = new chatModel({
                    appointmentId,
                    userId: appointment.userId,
                    docId,
                    messages: [],
                    isActive: true
                });
            }
            const rxMsg = {
                sender: 'doctor',
                senderName: doctor.name || 'Doctor',
                text: `📋 ${isUpdate ? 'Updated' : 'Issued'} Digital Prescription for "${diagnosis}" (${(medicines || []).length} medicine${(medicines || []).length === 1 ? '' : 's'}).`,
                attachmentUrl: `/prescription/${appointmentId}`,
                attachmentType: 'prescription',
                attachmentName: `Digital Prescription • ${diagnosis}`,
                readBy: ['doctor'],
                timestamp: new Date()
            };
            chat.messages.push(rxMsg);
            chat.updatedAt = new Date();
            await chat.save();

            const savedRxMsg = chat.messages[chat.messages.length - 1];
            emitToRoom(appointmentId, 'chat-message', {
                ...savedRxMsg.toObject(),
                appointmentId: String(appointmentId)
            });
            emitToUser(appointment.userId, 'chat-thread-updated', {
                appointmentId: String(appointmentId),
                lastMessage: savedRxMsg
            });
            emitToDoctor(docId, 'chat-thread-updated', {
                appointmentId: String(appointmentId),
                lastMessage: savedRxMsg
            });
        } catch (chatErr) {
            console.log('Prescription chat log error:', chatErr.message);
        }

        res.json({
            success: true,
            isUpdate,
            message: isUpdate
                ? "Prescription updated and re-signed successfully"
                : "Prescription saved and cryptographically signed successfully",
            prescription: savedPrescription,
            user: {
                allergies: userAllergies,
                currentMedications: userCurrentMeds
            }
        });

        // Send email notification (non-blocking)
        sendPrescriptionEmail(
            appointment.userData.email,
            appointment.userData.name,
            appointment.docData.name
        ).catch(err => console.log('Prescription email error:', err.message));

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Get prescription for an appointment (Patient or Doctor)
// Dynamically re-evaluates safetyReport against the patient's latest allergies and regular medications!
const getPrescription = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const requesterUserId = req.userId || req.body?.userId;
        const requesterDocId = req.docId || req.body?.docId;

        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        // BOLA / IDOR Verification: Requester must be the assigned patient, doctor, or clinic admin
        const isPatient = requesterUserId && String(appointment.userId) === String(requesterUserId);
        const isDoctor = requesterDocId && String(appointment.docId) === String(requesterDocId);
        if (!isPatient && !isDoctor && !req.isAdmin) {
            return res.status(403).json({ success: false, message: "Unauthorized to access this prescription" });
        }

        const prescription = await prescriptionModel.findOne({ appointmentId })
            .populate('appointmentId');

        if (!prescription) {
            // Even if no prescription exists yet, return the patient's latest allergies & currentMedications for the Doctor's form
            const user = await userModel.findById(appointment.userId).select('name email phone allergies currentMedications image dob gender');
            return res.json({
                success: false,
                message: "Prescription not found",
                user
            });
        }

        // Fetch doctor and latest patient details (including live allergies & regular medications)
        const doctor = await doctorModel.findById(prescription.docId).select('name speciality degree experience image');
        const user = await userModel.findById(prescription.userId).select('name email phone allergies currentMedications image dob gender');

        const liveAllergies = user?.allergies || [];
        const liveCurrentMeds = user?.currentMedications || [];

        // Re-check prescription medicines against the patient's live allergies and regular medications
        const freshCheck = checkDrugInteractions(
            prescription.medicines || [],
            liveCurrentMeds,
            liveAllergies
        );

        const storedReport = prescription.safetyReport || {};
        const needsRefresh =
            storedReport.overallRisk !== freshCheck.overallRisk ||
            (storedReport.allergyAlerts?.length || 0) !== freshCheck.totalAllergyAlerts ||
            (storedReport.interactions?.length || 0) !== freshCheck.totalInteractions ||
            !storedReport.aiSummary;

        if (needsRefresh) {
            const wasPreviouslySafe = !storedReport.overallRisk || storedReport.overallRisk === 'SAFE';
            const updatedSafetyReport = await evaluateSafetyWithAI(
                prescription.medicines || [],
                liveCurrentMeds,
                liveAllergies
            );
            prescription.safetyReport = updatedSafetyReport;
            await prescriptionModel.findByIdAndUpdate(prescription._id, {
                safetyReport: updatedSafetyReport
            });

            // If this live re-evaluation uncovered a conflict that was previously marked SAFE, alert the doctor!
            if (wasPreviouslySafe && updatedSafetyReport.overallRisk !== 'SAFE') {
                const conflictSummary = [
                    ...(updatedSafetyReport.allergyAlerts || []).map(a => `${a.drug} (Allergy: ${a.allergen})`),
                    ...(updatedSafetyReport.interactions || []).map(i => `${i.drugA} ↔ ${i.drugB}`)
                ].join(', ');

                await notifyParty({
                    recipientRole: 'doctor',
                    recipientId: prescription.docId,
                    type: 'allergy_conflict',
                    title: `⚠️ Allergy / Medicine Conflict: ${user?.name || 'Patient'}`,
                    body: `Prescription for "${prescription.diagnosis}" has a ${updatedSafetyReport.overallRisk} conflict (${conflictSummary}) against patient's allergies/medications. Tap to review.`,
                    appointmentId: String(appointmentId),
                    link: `/doctor-prescription/${appointmentId}`,
                    senderName: user?.name || 'Patient Safety Monitor',
                    senderImage: user?.image || ''
                });
            }
        }

        res.json({
            success: true,
            prescription,
            doctor,
            user
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false, message: error.message });
    }
};

// Public endpoint to verify prescription authenticity (Pharmacists / Regulators / Patients)
const verifyPrescription = async (req, res) => {
    try {
        const { id } = req.params;

        // Find by mongo ID or prescription hash
        let prescription = null;
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            prescription = await prescriptionModel.findById(id);
        }
        if (!prescription) {
            prescription = await prescriptionModel.findOne({ prescriptionHash: id });
        }

        if (!prescription) {
            return res.status(404).json({
                success: false,
                isAuthentic: false,
                message: "Prescription not found in registry"
            });
        }

        const doctor = await doctorModel.findById(prescription.docId).select('name speciality degree experience email image');
        const user = await userModel.findById(prescription.userId).select('name email allergies currentMedications');

        // Recompute canonical payload
        const recomputedCanonical = canonicalizePrescription({
            appointmentId: prescription.appointmentId,
            userId: prescription.userId,
            docId: prescription.docId,
            diagnosis: prescription.diagnosis,
            medicines: prescription.medicines
        });

        const recomputedHash = computeHash(recomputedCanonical);
        const hashMatches = recomputedHash === prescription.prescriptionHash;

        // Verify RSA signature against Doctor's public key
        const signatureValid = prescription.doctorPublicKey && prescription.digitalSignature
            ? verifySignature(recomputedCanonical, prescription.digitalSignature, prescription.doctorPublicKey)
            : false;

        const isAuthentic = hashMatches && signatureValid;

        // Ensure safety report reflects latest allergies
        const freshSafety = checkDrugInteractions(
            prescription.medicines || [],
            user?.currentMedications || [],
            user?.allergies || []
        );

        const expiresAt = prescription.expiresAt || new Date(new Date(prescription.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
        const isExpired = new Date() > new Date(expiresAt);
        const effectiveDispenseStatus = isExpired && prescription.dispenseStatus !== 'DISPENSED'
            ? 'EXPIRED'
            : (prescription.dispenseStatus || 'ACTIVE');

        const dispenseProof = crypto.createHmac('sha256', process.env.JWT_SECRET)
            .update(`dispense:${prescription._id}:${prescription.prescriptionHash}`)
            .digest('hex');

        return res.json({
            success: true,
            isAuthentic,
            verificationDetails: {
                hashMatches,
                signatureValid,
                storedHash: prescription.prescriptionHash,
                recomputedHash,
                algorithm: "RSA-SHA256 (2048-bit) + AES-256-GCM Key Envelope",
                verifiedAt: new Date().toISOString(),
                dispenseProof
            },
            prescription: {
                _id: prescription._id,
                diagnosis: prescription.diagnosis,
                medicines: prescription.medicines,
                notes: prescription.notes,
                followUpDate: prescription.followUpDate,
                createdAt: prescription.createdAt,
                expiresAt,
                isExpired,
                dispenseStatus: effectiveDispenseStatus,
                dispenseCount: prescription.dispenseCount || 0,
                dispensedAt: prescription.dispensedAt || null,
                dispensedByPharmacy: prescription.dispensedByPharmacy || '',
                clinicalOverride: prescription.clinicalOverride || { overridden: false, reason: '' },
                safetyReport: freshSafety.overallRisk !== 'SAFE' ? freshSafety : (prescription.safetyReport || freshSafety),
                qrCode: prescription.qrCode
            },
            doctor: doctor || { name: "Doctor" },
            patient: user || { name: "Patient" }
        });

    } catch (error) {
        console.error('Verify error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Pharmacy Anti-Replay Dispense Lock (prevents repeated dispensing of photocopied QR codes)
const dispensePrescription = async (req, res) => {
    try {
        const { id } = req.params;
        const pharmacyName = String(req.body?.pharmacyName || 'Verified Retail Pharmacy').trim();

        const target = id.match(/^[0-9a-fA-F]{24}$/)
            ? await prescriptionModel.findById(id)
            : await prescriptionModel.findOne({ prescriptionHash: id });

        if (!target) {
            return res.status(404).json({ success: false, message: "Prescription not found in registry" });
        }

        const { dispenseProof } = req.body;
        const expectedProof = crypto.createHmac('sha256', process.env.JWT_SECRET)
            .update(`dispense:${target._id}:${target.prescriptionHash}`)
            .digest('hex');
        const hasValidProof = dispenseProof && dispenseProof === expectedProof;
        const hasAuthSession = Boolean(req.headers?.atoken || req.headers?.dtoken || req.headers?.token);

        if (!hasValidProof && !hasAuthSession) {
            return res.status(403).json({
                success: false,
                message: "Security Block: Dispensing requires prior cryptographic verification of this prescription or authenticated clinical credentials."
            });
        }

        const expiresAt = target.expiresAt || new Date(new Date(target.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000);
        if (new Date() > new Date(expiresAt)) {
            return res.json({
                success: false,
                alreadyExpired: true,
                message: "STATUTORY EXPIRY BLOCK: This prescription has exceeded its 30-day validity window and cannot be dispensed."
            });
        }

        // Verify cryptographic integrity before allowing dispense lock
        const canonical = canonicalizePrescription({
            appointmentId: target.appointmentId,
            userId: target.userId,
            docId: target.docId,
            diagnosis: target.diagnosis,
            medicines: target.medicines
        });
        const sigValid = target.doctorPublicKey && target.digitalSignature
            ? verifySignature(canonical, target.digitalSignature, target.doctorPublicKey)
            : false;

        if (!sigValid || computeHash(canonical) !== target.prescriptionHash) {
            return res.json({
                success: false,
                message: "CRYPTOGRAPHIC TAMPER BLOCK: Digital signature invalid. Do not dispense."
            });
        }

        // Atomic single-use dispense transition (prevents race condition across two pharmacy terminals)
        const locked = await prescriptionModel.findOneAndUpdate(
            {
                _id: target._id,
                dispenseStatus: { $nin: ['DISPENSED', 'EXPIRED'] }
            },
            {
                $set: {
                    dispenseStatus: 'DISPENSED',
                    dispensedAt: new Date(),
                    dispensedByPharmacy: pharmacyName
                },
                $inc: { dispenseCount: 1 }
            },
            { new: true }
        );

        if (!locked) {
            return res.json({
                success: false,
                replayBlocked: true,
                message: `ANTI-REPLAY LOCK: Prescription was already dispensed on ${target.dispensedAt ? new Date(target.dispensedAt).toLocaleString() : 'an earlier scan'} (${target.dispensedByPharmacy || 'Verified Pharmacy'}). Duplicate fulfillment blocked.`
            });
        }

        return res.json({
            success: true,
            message: "Prescription fulfilled & locked against QR replay.",
            dispenseStatus: locked.dispenseStatus,
            dispenseCount: locked.dispenseCount,
            dispensedAt: locked.dispensedAt,
            dispensedByPharmacy: locked.dispensedByPharmacy
        });
    } catch (error) {
        console.error('Dispense error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export { createPrescription, getPrescription, verifyPrescription, dispensePrescription };
