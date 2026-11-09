import express from 'express';
import {
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
} from '../controllers/chatController.js';
import authUser from '../middleware/authUser.js';
import authDoctor from '../middleware/authDoctor.js';
import upload from '../middleware/multer.js';

const chatRouter = express.Router();

// Patient endpoints (require user auth)
chatRouter.post("/get-or-create", authUser, getOrCreateChat);
chatRouter.post("/send-message", authUser, saveMessage);
chatRouter.post("/save-message", authUser, saveMessage);
chatRouter.post("/messages", authUser, getChatMessages);
chatRouter.get("/inbox", authUser, getChatInbox);
chatRouter.post("/upload-attachment", authUser, upload.single('attachment'), uploadChatAttachment);
chatRouter.get("/notifications", authUser, getUserNotifications);
chatRouter.post("/notifications/mark-read", authUser, markUserNotificationsRead);

// Doctor endpoints (require doctor auth)
chatRouter.post("/doctor/get-or-create", authDoctor, getOrCreateChat);
chatRouter.post("/doctor/send-message", authDoctor, saveMessage);
chatRouter.post("/doctor/save-message", authDoctor, saveMessage);
chatRouter.post("/doctor/messages", authDoctor, getChatMessages);
chatRouter.get("/doctor/inbox", authDoctor, getDoctorChatInbox);
chatRouter.post("/doctor/upload-attachment", authDoctor, upload.single('attachment'), uploadChatAttachment);
chatRouter.get("/doctor/notifications", authDoctor, getDoctorNotifications);
chatRouter.post("/doctor/notifications/mark-read", authDoctor, markDoctorNotificationsRead);

export default chatRouter;
