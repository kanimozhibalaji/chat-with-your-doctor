import express from 'express';
import { createPrescription, getPrescription, verifyPrescription, dispensePrescription } from '../controllers/prescriptionController.js';
import authDoctor from '../middleware/authDoctor.js';
import authUser from '../middleware/authUser.js';

const prescriptionRouter = express.Router();

// Public verification & pharmacy anti-replay dispense lock routes
prescriptionRouter.get('/verify/:id', verifyPrescription);
prescriptionRouter.post('/dispense/:id', dispensePrescription);

// Doctor routes
prescriptionRouter.post('/create', authDoctor, createPrescription);
prescriptionRouter.get('/doctor/:appointmentId', authDoctor, getPrescription);

// Patient routes
prescriptionRouter.get('/patient/:appointmentId', authUser, getPrescription);

export default prescriptionRouter;
