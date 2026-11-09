import chatModel from "../models/chatModel.js";
import appointmentModel from "../models/appointmentModel.js";
import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModel.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Get or create a chat for an appointment
const getOrCreateChat = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        if (!appointmentId) {
            return res.json({ success: false, message: "Appointment ID required" });
        }

        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return res.json({ success: false, message: "Appointment not found" });
        }

        let chat = await chatModel.findOne({ appointmentId });

        if (!chat) {
            chat = new chatModel({
                appointmentId,
                userId: appointment.userId,
                docId: appointment.docId,
                messages: [],
                isActive: true
            });
            await chat.save();
        }

        res.json({ success: true, chat, appointment });
    } catch (error) {
        console.log("Chat Error:", error);
        res.json({ success: false, message: "Failed to get/create chat" });
    }
};

// Save a message to a chat (REST fallback; Socket.io is primary)
const saveMessage = async (req, res) => {
    try {
        const {
            appointmentId,
            sender,
            senderName,
            text,
            attachmentUrl = '',
            attachmentType = '',
            attachmentName = '',
            replyTo = null
        } = req.body;

        if (!appointmentId || !sender || (!text && !attachmentUrl)) {
            return res.json({ success: false, message: "Missing required fields" });
        }

        let chat = await chatModel.findOne({ appointmentId });

        if (!chat) {
            const appointment = await appointmentModel.findById(appointmentId);
            if (!appointment) {
                return res.json({ success: false, message: "Appointment not found" });
            }
            chat = new chatModel({
                appointmentId,
                userId: appointment.userId,
                docId: appointment.docId,
                messages: [],
                isActive: true
            });
        }

        const message = {
            sender,
            senderName: senderName || (sender === 'doctor' ? 'Doctor' : 'Patient'),
            text: text || '',
            attachmentUrl,
            attachmentType,
            attachmentName,
            replyTo,
            reactions: [],
            readBy: [sender],
            timestamp: new Date()
        };

        chat.messages.push(message);
        chat.updatedAt = new Date();
        await chat.save();

        const savedMessage = chat.messages[chat.messages.length - 1];
        res.json({ success: true, message: savedMessage });
    } catch (error) {
        console.log("Save Message Error:", error);
        res.json({ success: false, message: "Failed to save message" });
    }
};

// Get all messages for a chat
const getChatMessages = async (req, res) => {
    try {
        const { appointmentId } = req.body;
        const requesterId = req.userId || req.body?.userId || req.docId || req.body?.docId;

        const appointment = await appointmentModel.findById(appointmentId).select('userId docId');
        if (!appointment) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        const isAuthorized = 
            (requesterId && (String(appointment.userId) === String(requesterId) || String(appointment.docId) === String(requesterId))) ||
            req.isAdmin;

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: "Unauthorized to access consultation chat" });
        }

        const chat = await chatModel.findOne({ appointmentId });

        if (!chat) {
            return res.json({ success: true, messages: [] });
        }

        res.json({ success: true, messages: chat.messages });
    } catch (error) {
        console.log("Get Messages Error:", error);
        res.json({ success: false, message: "Failed to get messages" });
    }
};

// Upload image/document attachment for chat
const uploadChatAttachment = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.json({ success: false, message: "No attachment file provided" });
        }

        let uploadResult;
        try {
            uploadResult = await cloudinary.uploader.upload(file.path, {
                resource_type: "auto",
                folder: "vitalsync_chat"
            });
        } finally {
            try { await fs.promises.unlink(file.path); } catch (e) {}
        }

        const isImage = file.mimetype?.startsWith("image/") || uploadResult.resource_type === "image";

        res.json({
            success: true,
            attachmentUrl: uploadResult.secure_url,
            attachmentType: isImage ? "image" : "document",
            attachmentName: file.originalname || "Attachment"
        });
    } catch (error) {
        console.log("Attachment Upload Error:", error);
        res.json({ success: false, message: "Failed to upload attachment" });
    }
};

// Get chat inbox for Patient — includes all booked appointments so patients can message any booked doctor immediately
const getChatInbox = async (req, res) => {
    try {
        const userId = req.body.userId;

        if (!userId) {
            return res.json({ success: false, message: "User ID required" });
        }

        const appointments = await appointmentModel.find({ userId }).sort({ date: -1 });
        const chats = await chatModel.find({ userId });
        const chatByAppointment = new Map();
        chats.forEach((c) => chatByAppointment.set(String(c.appointmentId), c));

        const threads = appointments.map((appointment) => {
            const aptId = String(appointment._id);
            const chat = chatByAppointment.get(aptId);
            const messages = chat?.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const unreadCount = messages.filter(
                (m) => m.sender !== 'user' && !(m.readBy || []).includes('user')
            ).length;

            return {
                chatId: chat?._id || aptId,
                appointmentId: aptId,
                doctorId: appointment.docId,
                doctorName: appointment.docData?.name || 'Doctor',
                doctorImage: appointment.docData?.image || '',
                doctorSpeciality: appointment.docData?.speciality || 'Specialist',
                doctorDegree: appointment.docData?.degree || 'MBBS',
                lastMessage: lastMessage
                    ? {
                        _id: lastMessage._id,
                        text: lastMessage.text || (lastMessage.attachmentUrl ? '📎 Sent an attachment' : ''),
                        sender: lastMessage.sender,
                        timestamp: lastMessage.timestamp,
                        readBy: lastMessage.readBy || []
                    }
                    : null,
                messageCount: messages.length,
                unreadCount,
                isActive: !appointment.cancelled,
                cancelled: Boolean(appointment.cancelled),
                isCompleted: Boolean(appointment.isCompleted),
                payment: Boolean(appointment.payment),
                slotDate: appointment.slotDate || '',
                slotTime: appointment.slotTime || '',
                appointmentDate: appointment.date || 0
            };
        });

        // Sort by latest message timestamp first, then by appointment booking date
        threads.sort((a, b) => {
            const aTime = a.lastMessage?.timestamp
                ? new Date(a.lastMessage.timestamp).getTime()
                : a.appointmentDate;
            const bTime = b.lastMessage?.timestamp
                ? new Date(b.lastMessage.timestamp).getTime()
                : b.appointmentDate;
            return bTime - aTime;
        });

        res.json({ success: true, threads });
    } catch (error) {
        console.log("Chat Inbox Error:", error);
        res.json({ success: false, message: "Failed to fetch inbox" });
    }
};

// Get chat inbox for Doctor — includes all patient appointments with unread counts & clinical context
const getDoctorChatInbox = async (req, res) => {
    try {
        const docId = req.body.docId;

        if (!docId) {
            return res.json({ success: false, message: "Doctor ID required" });
        }

        const appointments = await appointmentModel.find({ docId }).sort({ date: -1 });
        const chats = await chatModel.find({ docId });
        const chatByAppointment = new Map();
        chats.forEach((c) => chatByAppointment.set(String(c.appointmentId), c));

        // Fetch latest user allergy/medication metadata for clinical safety banner in chat
        const userIds = [...new Set(appointments.map((a) => a.userId))];
        const users = await userModel.find({ _id: { $in: userIds } }).select('name image phone dob gender allergies currentMedications');
        const userById = new Map();
        users.forEach((u) => userById.set(String(u._id), u));

        const threads = appointments.map((appointment) => {
            const aptId = String(appointment._id);
            const chat = chatByAppointment.get(aptId);
            const messages = chat?.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            const unreadCount = messages.filter(
                (m) => m.sender !== 'doctor' && !(m.readBy || []).includes('doctor')
            ).length;
            const liveUser = userById.get(String(appointment.userId));

            return {
                chatId: chat?._id || aptId,
                appointmentId: aptId,
                patientId: appointment.userId,
                patientName: liveUser?.name || appointment.userData?.name || 'Patient',
                patientImage: liveUser?.image || appointment.userData?.image || '',
                patientPhone: liveUser?.phone || appointment.userData?.phone || '',
                patientGender: liveUser?.gender || appointment.userData?.gender || '',
                patientDob: liveUser?.dob || appointment.userData?.dob || '',
                patientAllergies: liveUser?.allergies || appointment.userData?.allergies || [],
                patientMedications: liveUser?.currentMedications || appointment.userData?.currentMedications || [],
                lastMessage: lastMessage
                    ? {
                        _id: lastMessage._id,
                        text: lastMessage.text || (lastMessage.attachmentUrl ? '📎 Sent an attachment' : ''),
                        sender: lastMessage.sender,
                        timestamp: lastMessage.timestamp,
                        readBy: lastMessage.readBy || []
                    }
                    : null,
                messageCount: messages.length,
                unreadCount,
                isActive: !appointment.cancelled,
                cancelled: Boolean(appointment.cancelled),
                isCompleted: Boolean(appointment.isCompleted),
                payment: Boolean(appointment.payment),
                slotDate: appointment.slotDate || '',
                slotTime: appointment.slotTime || '',
                amount: appointment.amount || 0,
                appointmentDate: appointment.date || 0
            };
        });

        threads.sort((a, b) => {
            const aTime = a.lastMessage?.timestamp
                ? new Date(a.lastMessage.timestamp).getTime()
                : a.appointmentDate;
            const bTime = b.lastMessage?.timestamp
                ? new Date(b.lastMessage.timestamp).getTime()
                : b.appointmentDate;
            return bTime - aTime;
        });

        res.json({ success: true, threads });
    } catch (error) {
        console.log("Doctor Chat Inbox Error:", error);
        res.json({ success: false, message: "Failed to fetch doctor inbox" });
    }
};

// Notifications for Patient
const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.body;
        const notifications = await notificationModel
            .find({ recipientRole: 'user', recipientId: String(userId) })
            .sort({ createdAt: -1 })
            .limit(40);

        res.json({ success: true, notifications });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const markUserNotificationsRead = async (req, res) => {
    try {
        const { userId, notificationId } = req.body;
        if (notificationId) {
            await notificationModel.findOneAndUpdate(
                { _id: notificationId, recipientRole: 'user', recipientId: String(userId) },
                { isRead: true }
            );
        } else {
            await notificationModel.updateMany(
                { recipientRole: 'user', recipientId: String(userId), isRead: false },
                { isRead: true }
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Notifications for Doctor
const getDoctorNotifications = async (req, res) => {
    try {
        const { docId } = req.body;
        const notifications = await notificationModel
            .find({ recipientRole: 'doctor', recipientId: String(docId) })
            .sort({ createdAt: -1 })
            .limit(40);

        res.json({ success: true, notifications });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

const markDoctorNotificationsRead = async (req, res) => {
    try {
        const { docId, notificationId } = req.body;
        if (notificationId) {
            await notificationModel.findOneAndUpdate(
                { _id: notificationId, recipientRole: 'doctor', recipientId: String(docId) },
                { isRead: true }
            );
        } else {
            await notificationModel.updateMany(
                { recipientRole: 'doctor', recipientId: String(docId), isRead: false },
                { isRead: true }
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

export {
    getOrCreateChat,
    saveMessage,
    getChatMessages,
    uploadChatAttachment,
    getChatInbox,
    getDoctorChatInbox,
    getUserNotifications,
    markUserNotificationsRead,
    getDoctorNotifications,
    markDoctorNotificationsRead
};
