import express from 'express';
import jwt from 'jsonwebtoken';
import { saveVitalReading, getAppointmentVitals, getUserVitalsHistory } from '../controllers/vitalsController.js';
import authUser from '../middleware/authUser.js';

const vitalsRouter = express.Router();

const authParticipant = async (req, res, next) => {
    const token = req.headers?.token || req.headers?.dtoken || req.headers?.atoken;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication required to view clinical vitals' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof decoded === 'object') {
            if (decoded.role === 'admin') req.isAdmin = true;
            else if (decoded.role === 'doctor') req.docId = decoded.id;
            else req.userId = decoded.id;
        } else if (decoded === process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD) {
            req.isAdmin = true;
        }
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session token' });
    }
};

vitalsRouter.post('/save', authUser, saveVitalReading);
vitalsRouter.get('/history', authUser, getUserVitalsHistory);
vitalsRouter.get('/:appointmentId', authParticipant, getAppointmentVitals);

export default vitalsRouter;

