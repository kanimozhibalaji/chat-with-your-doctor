import express from 'express';
import { submitReview, getDoctorReviews, checkReview, getReviewStats } from '../controllers/reviewController.js';
import authUser from '../middleware/authUser.js';
import authAdmin from '../middleware/authAdmin.js';

const reviewRouter = express.Router();

// Patient routes (auth required)
reviewRouter.post('/submit', authUser, submitReview);
reviewRouter.get('/check/:appointmentId', authUser, checkReview);

// Public routes (no auth needed — anyone can see reviews)
reviewRouter.get('/doctor/:docId', getDoctorReviews);

// Admin route
reviewRouter.get('/stats', authAdmin, getReviewStats);

export default reviewRouter;
