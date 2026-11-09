import reviewModel from '../models/reviewModel.js';
import appointmentModel from '../models/appointmentModel.js';
import doctorModel from '../models/doctorModel.js';

// Submit a review (Patient only, for completed appointments)
const submitReview = async (req, res) => {
    try {
        const { appointmentId, rating, comment } = req.body;
        const userId = req.body.userId; // from authUser

        if (!appointmentId || !rating) {
            return res.json({ success: false, message: "Appointment ID and rating are required" });
        }

        if (rating < 1 || rating > 5) {
            return res.json({ success: false, message: "Rating must be between 1 and 5" });
        }

        // Verify appointment belongs to user and is completed
        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.json({ success: false, message: "Appointment not found" });
        }

        if (appointment.userId !== userId) {
            return res.json({ success: false, message: "Not authorized" });
        }

        if (!appointment.isCompleted) {
            return res.json({ success: false, message: "You can only review completed appointments" });
        }

        // Check if already reviewed
        const existing = await reviewModel.findOne({ appointmentId });
        if (existing) {
            return res.json({ success: false, message: "You have already reviewed this appointment" });
        }

        const review = new reviewModel({
            userId,
            docId: appointment.docId,
            appointmentId,
            rating: Number(rating),
            comment: comment || '',
            userName: appointment.userData.name
        });

        await review.save();

        res.json({ success: true, message: "Review submitted successfully", review });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Get all reviews for a specific doctor (public)
const getDoctorReviews = async (req, res) => {
    try {
        const { docId } = req.params;

        const reviews = await reviewModel.find({ docId }).sort({ createdAt: -1 });

        // Calculate average rating
        let avgRating = 0;
        if (reviews.length > 0) {
            avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            avgRating = Math.round(avgRating * 10) / 10; // Round to 1 decimal
        }

        res.json({
            success: true,
            reviews,
            avgRating,
            totalReviews: reviews.length
        });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Check if user has already reviewed an appointment
const checkReview = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const existing = await reviewModel.findOne({ appointmentId });
        res.json({ success: true, hasReviewed: !!existing, review: existing });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Get platform-wide review stats (for admin dashboard)
const getReviewStats = async (req, res) => {
    try {
        const allReviews = await reviewModel.find({});
        const totalReviews = allReviews.length;
        let avgRating = 0;
        const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        if (totalReviews > 0) {
            allReviews.forEach(r => {
                avgRating += r.rating;
                ratingDist[r.rating] = (ratingDist[r.rating] || 0) + 1;
            });
            avgRating = Math.round((avgRating / totalReviews) * 10) / 10;
        }

        res.json({ success: true, totalReviews, avgRating, ratingDistribution: ratingDist });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export { submitReview, getDoctorReviews, checkReview, getReviewStats };
