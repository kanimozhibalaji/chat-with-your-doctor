import express from 'express';
import {
    getPatientTrends,
    addBiomarkerReading,
    seedSampleTrends,
    deleteBiomarkerReading
} from '../controllers/healthTrendController.js';
import authUser from '../middleware/authUser.js';
import authDoctor from '../middleware/authDoctor.js';

const healthTrendRouter = express.Router();

// Patient routes
healthTrendRouter.get('/trends', authUser, getPatientTrends);
healthTrendRouter.post('/add-reading', authUser, addBiomarkerReading);
healthTrendRouter.post('/seed-sample-trends', authUser, seedSampleTrends);
healthTrendRouter.delete('/reading/:id', authUser, deleteBiomarkerReading);

// Doctor viewing patient trends
healthTrendRouter.get('/patient-trends/:userId', authDoctor, (req, res, next) => {
    req.body.userId = req.params.userId;
    next();
}, getPatientTrends);

export default healthTrendRouter;
