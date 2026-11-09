import { evaluateSafetyWithAI, drugClassMap, allergyCrossReactivity } from '../data/ddiDatabase.js';
import userModel from '../models/userModel.js';
import appointmentModel from '../models/appointmentModel.js';
import { notifyParty } from '../socket.js';

/**
 * Controller for Clinical Decision Support: AI + Deterministic Drug-Drug & Allergy Conflict Detection
 */

// POST /api/ddi/check
export const checkSafety = async (req, res) => {
    try {
        const {
            medicines = [],
            userId,
            appointmentId,
            patientAllergies = [],
            currentMedications = [],
            notifyDoctorOnConflict = false
        } = req.body;

        let userAllergies = Array.isArray(patientAllergies) ? [...patientAllergies] : [];
        let userCurrentMeds = Array.isArray(currentMedications) ? [...currentMedications] : [];
        let userDoc = null;
        let apptDoc = null;

        if (appointmentId) {
            apptDoc = await appointmentModel.findById(appointmentId);
        }

        const effectiveUserId = userId || apptDoc?.userId;

        // If userId (or appointmentId) is provided, augment with stored user profile allergies/meds
        if (effectiveUserId) {
            userDoc = await userModel.findById(effectiveUserId).select('name image allergies currentMedications');
            if (userDoc) {
                if (Array.isArray(userDoc.allergies)) {
                    userAllergies = Array.from(new Set([...userAllergies, ...userDoc.allergies]));
                }
                if (Array.isArray(userDoc.currentMedications)) {
                    userCurrentMeds = [...userCurrentMeds, ...userDoc.currentMedications];
                }
            }
        }

        const report = await evaluateSafetyWithAI(medicines, userCurrentMeds, userAllergies);

        // Optional: notify the doctor if a check reveals a conflict on an appointment
        if (notifyDoctorOnConflict && appointmentId && report.overallRisk !== 'SAFE') {
            try {
                const appt = apptDoc || (await appointmentModel.findById(appointmentId));
                if (appt) {
                    const allergyText = report.allergyAlerts.map(a => `${a.drug} (Allergy: ${a.allergen})`).join(', ');
                    const ddiText = report.interactions.map(i => `${i.drugA} + ${i.drugB}`).join(', ');
                    const summaryText = [allergyText, ddiText].filter(Boolean).join(' • ');

                    await notifyParty({
                        recipientRole: 'doctor',
                        recipientId: appt.docId,
                        type: 'allergy_conflict',
                        title: `⚠️ Medicine / Allergy Alert: ${userDoc?.name || appt.userData?.name || 'Patient'}`,
                        body: `AI Safety Check flagged ${report.overallRisk} risk: ${summaryText}. Tap to review prescription.`,
                        appointmentId: String(appointmentId),
                        link: `/doctor-prescription/${appointmentId}`,
                        senderName: userDoc?.name || appt.userData?.name || 'Patient',
                        senderImage: userDoc?.image || appt.userData?.image || ''
                    });
                }
            } catch (notifyErr) {
                console.log('DDI notifyDoctor error:', notifyErr.message);
            }
        }

        return res.json({
            success: true,
            report,
            patientAllergies: userAllergies,
            patientCurrentMedications: userCurrentMeds
        });
    } catch (error) {
        console.error('DDI Check Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to run drug interaction analysis',
            error: error.message
        });
    }
};

// GET /api/ddi/database-summary
export const getDatabaseSummary = async (req, res) => {
    try {
        const drugCount = Object.keys(drugClassMap).length;
        const allergyCount = Object.keys(allergyCrossReactivity).length;

        return res.json({
            success: true,
            stats: {
                indexedDrugs: drugCount,
                allergyClasses: allergyCount,
                version: '2.0.0-ai-hybrid',
                engine: 'VitalSync Hybrid AI + Deterministic CDSS'
            },
            supportedClasses: Array.from(new Set(Object.values(drugClassMap))),
            sampleDrugs: Object.keys(drugClassMap).slice(0, 50)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
