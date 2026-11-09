import express from 'express';
import { checkSafety, getDatabaseSummary } from '../controllers/ddiController.js';

const ddiRouter = express.Router();

ddiRouter.post('/check', checkSafety);
ddiRouter.get('/summary', getDatabaseSummary);

export default ddiRouter;
