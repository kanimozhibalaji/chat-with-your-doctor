import express from 'express';
import {
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
} from '../controllers/adminController.js';
import { changeAvailablity } from '../controllers/doctorController.js';
import authAdmin from '../middleware/authAdmin.js';
import upload from '../middleware/multer.js';

const adminRouter = express.Router();

adminRouter.post("/login", loginAdmin);
adminRouter.post("/google-auth", googleAuthAdmin);
adminRouter.post("/add-doctor", authAdmin, upload.single('image'), addDoctor);
adminRouter.post("/update-doctor", authAdmin, upload.single('image'), updateDoctorAdmin);
adminRouter.post("/delete-doctor", authAdmin, deleteDoctorAdmin);
adminRouter.get("/appointments", authAdmin, appointmentsAdmin);
adminRouter.post("/cancel-appointment", authAdmin, appointmentCancel);
adminRouter.post("/complete-appointment", authAdmin, appointmentCompleteAdmin);
adminRouter.get("/all-doctors", authAdmin, allDoctors);
adminRouter.get("/patients", authAdmin, allPatientsAdmin);
adminRouter.post("/change-availability", authAdmin, changeAvailablity);
adminRouter.get("/dashboard", authAdmin, adminDashboard);

export default adminRouter;
