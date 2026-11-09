import express from 'express';
import { loginDoctor, googleAuthDoctor, appointmentsDoctor, appointmentCancel, doctorList, changeAvailablity, appointmentComplete, doctorDashboard, doctorProfile, updateDoctorProfile, getPatientDossier, analyzePatientRecordDoctor, setInPersonReferral } from '../controllers/doctorController.js';
import authDoctor from '../middleware/authDoctor.js';
const doctorRouter = express.Router();

doctorRouter.post("/login", loginDoctor)
doctorRouter.post("/google-auth", googleAuthDoctor)
doctorRouter.post("/cancel-appointment", authDoctor, appointmentCancel)
doctorRouter.get("/appointments", authDoctor, appointmentsDoctor)
doctorRouter.get("/list", doctorList)
doctorRouter.post("/change-availability", authDoctor, changeAvailablity)
doctorRouter.post("/complete-appointment", authDoctor, appointmentComplete)
doctorRouter.get("/dashboard", authDoctor, doctorDashboard)
doctorRouter.get("/profile", authDoctor, doctorProfile)
doctorRouter.post("/update-profile", authDoctor, updateDoctorProfile)
doctorRouter.get("/patient-dossier/:userId", authDoctor, getPatientDossier)
doctorRouter.post("/analyze-patient-record", authDoctor, analyzePatientRecordDoctor)
doctorRouter.post("/in-person-referral", authDoctor, setInPersonReferral)

export default doctorRouter;