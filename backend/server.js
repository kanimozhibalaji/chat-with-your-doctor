import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import express from "express"
import cors from 'cors'
import 'dotenv/config'
import { createServer } from 'http'
import connectDB from "./config/mongodb.js"
import connectCloudinary from "./config/cloudinary.js"
import userRouter from "./routes/userRoute.js"
import doctorRouter from "./routes/doctorRoute.js"
import adminRouter from "./routes/adminRoute.js"
import aiRouter from "./routes/aiRoute.js"
import medicalRecordRouter from "./routes/medicalRecordRoute.js"
import chatbotRouter from "./routes/chatbotRoute.js"
import chatRouter from "./routes/chatRoute.js"
import prescriptionRouter from "./routes/prescriptionRoute.js"
import reviewRouter from "./routes/reviewRoute.js"
import ddiRouter from "./routes/ddiRoute.js"
import healthTrendRouter from "./routes/healthTrendRoute.js"
import vitalsRouter from "./routes/vitalsRoute.js"
import { initSocket, io } from "./socket.js"
import { getTransporter } from "./utils/emailService.js"

// app config
const app = express()
const port = process.env.PORT || 4000
const httpServer = createServer(app)

// Initialize Socket.io
initSocket(httpServer)

connectDB()
connectCloudinary()
getTransporter().catch(err => console.error("Email service init error:", err.message))

// middlewares
app.use(express.json())

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS violation: Origin not allowed'));
    }
  },
  credentials: true
}))

// api endpoints
app.use("/api/user", userRouter)
app.use("/api/admin", adminRouter)
app.use("/api/doctor", doctorRouter)
app.use("/api/ai", aiRouter)
app.use("/api/records", medicalRecordRouter)
app.use("/api/chatbot", chatbotRouter)
app.use("/api/chat", chatRouter)
app.use("/api/prescription", prescriptionRouter)
app.use("/api/review", reviewRouter)
app.use("/api/ddi", ddiRouter)
app.use("/api/health", healthTrendRouter)
app.use("/api/vitals", vitalsRouter)

app.get("/", (req, res) => {
  res.send("API Working")
});

export { io }

httpServer.listen(port, () => console.log(`Server started on PORT:${port}`))
