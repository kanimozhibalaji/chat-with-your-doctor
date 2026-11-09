import express from 'express';
import { loginUser, registerUser, googleAuthUser, getAuthConfig, getProfile, updateProfile, bookAppointment, listAppointment, getAppointment, cancelAppointment, rescheduleAppointment, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe, getPaymentConfig, testPaymentBypass, downloadAppointmentCalendar } from '../controllers/userController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
const userRouter = express.Router();

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)
userRouter.post("/google-auth", googleAuthUser)
userRouter.get("/auth-config", getAuthConfig)

userRouter.get("/get-profile", authUser, getProfile)
userRouter.post("/update-profile", authUser, upload.single('image'), updateProfile)
userRouter.post("/book-appointment", authUser, bookAppointment)
userRouter.get("/appointments", authUser, listAppointment)
userRouter.get("/appointment/:appointmentId", authUser, getAppointment)
userRouter.get("/appointment-calendar/:appointmentId", authUser, downloadAppointmentCalendar)
userRouter.post("/cancel-appointment", authUser, cancelAppointment)
userRouter.post("/reschedule-appointment", authUser, rescheduleAppointment)
userRouter.get("/payment-config", getPaymentConfig)
userRouter.post("/payment-razorpay", authUser, paymentRazorpay)
userRouter.post("/verifyRazorpay", authUser, verifyRazorpay)
userRouter.post("/payment-stripe", authUser, paymentStripe)
userRouter.post("/verifyStripe", authUser, verifyStripe)
userRouter.post("/payment-test-bypass", authUser, testPaymentBypass)

export default userRouter;