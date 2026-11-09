import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import chatModel from './models/chatModel.js';
import appointmentModel from './models/appointmentModel.js';
import notificationModel from './models/notificationModel.js';
import { checkAppointmentWindow } from './utils/calendarHelper.js';
import { registerVideoHandlers, getVideoRoomSnapshot } from './utils/videoSession.js';

let io = null;

// Track active socket connections per userId and docId
const onlineUsers = new Map();   // userId -> Set<socketId>
const onlineDoctors = new Map(); // docId  -> Set<socketId>

const addSocketToMap = (map, key, socketId) => {
    if (!key) return;
    const strKey = String(key);
    if (!map.has(strKey)) {
        map.set(strKey, new Set());
    }
    map.get(strKey).add(socketId);
};

const removeSocketFromMap = (map, key, socketId) => {
    if (!key) return;
    const strKey = String(key);
    if (map.has(strKey)) {
        map.get(strKey).delete(socketId);
        if (map.get(strKey).size === 0) {
            map.delete(strKey);
        }
    }
};

export const getPresenceSnapshot = () => ({
    onlineUsers: Array.from(onlineUsers.keys()),
    onlineDoctors: Array.from(onlineDoctors.keys())
});

export const broadcastPresence = () => {
    if (!io) return;
    io.emit('presence-update', getPresenceSnapshot());
};

export const emitToUser = (userId, event, payload) => {
    if (!io || !userId) return;
    io.to(`user:${String(userId)}`).emit(event, payload);
};

export const emitToDoctor = (docId, event, payload) => {
    if (!io || !docId) return;
    io.to(`doctor:${String(docId)}`).emit(event, payload);
};

export const emitToAdmin = (event, payload) => {
    if (!io) return;
    io.to('admin:global').emit(event, payload);
};

export const emitToRoom = (roomId, event, payload) => {
    if (!io || !roomId) return;
    io.to(String(roomId)).emit(event, payload);
};

export const emitGlobal = (event, payload) => {
    if (!io) return;
    io.emit(event, payload);
};

/**
 * Persist a notification to MongoDB and immediately emit it over Socket.io
 */
export const notifyParty = async ({
    recipientRole,
    recipientId,
    type,
    title,
    body,
    appointmentId = '',
    link = '',
    senderName = '',
    senderImage = ''
}) => {
    try {
        if (!recipientRole || !recipientId) return null;

        const notif = await notificationModel.create({
            recipientRole,
            recipientId: String(recipientId),
            type,
            title,
            body,
            appointmentId: appointmentId ? String(appointmentId) : '',
            link,
            senderName,
            senderImage,
            isRead: false,
            createdAt: new Date()
        });

        if (recipientRole === 'user') {
            emitToUser(recipientId, 'notification', notif);
        } else if (recipientRole === 'doctor') {
            emitToDoctor(recipientId, 'notification', notif);
        } else if (recipientRole === 'admin') {
            emitToAdmin('notification', notif);
        }

        return notif;
    } catch (error) {
        console.log('Notification error:', error.message);
        return null;
    }
};

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        },
        // Prevent Chromium/Safari 60s background-tab timer throttling from dropping active calls
        pingInterval: 25000,
        pingTimeout: 65000
    });

    io.on('connection', (socket) => {
        const registerAuth = (authPayload = {}) => {
            try {
                // Patient token
                if (authPayload.token) {
                    const decoded = jwt.verify(authPayload.token, process.env.JWT_SECRET);
                    if (decoded?.id) {
                        socket.data.userId = String(decoded.id);
                        socket.join(`user:${socket.data.userId}`);
                        addSocketToMap(onlineUsers, socket.data.userId, socket.id);
                    }
                }
                // Doctor token
                if (authPayload.dToken) {
                    const decodedDoc = jwt.verify(authPayload.dToken, process.env.JWT_SECRET);
                    if (decodedDoc?.id) {
                        socket.data.docId = String(decodedDoc.id);
                        socket.join(`doctor:${socket.data.docId}`);
                        addSocketToMap(onlineDoctors, socket.data.docId, socket.id);
                    }
                }
                // Admin token
                if (authPayload.aToken) {
                    try {
                        const decodedAdmin = jwt.verify(authPayload.aToken, process.env.JWT_SECRET);
                        const isRoleAdmin = typeof decodedAdmin === 'object' && decodedAdmin?.role === 'admin';
                        const isLegacyAdmin = decodedAdmin === (process.env.ADMIN_EMAIL + process.env.ADMIN_PASSWORD);
                        if (isRoleAdmin || isLegacyAdmin) {
                            socket.data.isAdmin = true;
                            socket.join('admin:global');
                        }
                    } catch (e) {
                        // Invalid admin token - ignore
                    }
                }
                broadcastPresence();
            } catch (err) {
                // Ignore invalid/expired token on handshake
            }
        };

        // Automatically register if handshake.auth was provided
        if (socket.handshake?.auth) {
            registerAuth(socket.handshake.auth);
        }

        // Also allow explicit registration after connect
        socket.on('register-session', (authPayload) => {
            registerAuth(authPayload);
            socket.emit('presence-update', getPresenceSnapshot());
        });

        socket.on('get-presence', () => {
            socket.emit('presence-update', getPresenceSnapshot());
        });

        // Join an appointment room (supports both string roomId and { appointmentId } object)
        const handleJoinRoom = async (payload) => {
            const roomId = typeof payload === 'object' ? payload?.appointmentId || payload?.roomId : payload;
            if (!roomId) return;
            const strRoom = String(roomId);

            // If it is an appointment room (24-hex MongoDB ID), verify authorization
            if (/^[0-9a-fA-F]{24}$/.test(strRoom)) {
                if (!socket.data?.isAdmin) {
                    try {
                        const appointment = await appointmentModel.findById(strRoom).select('userId docId').lean();
                        if (appointment) {
                            const isPatient = socket.data?.userId && String(appointment.userId) === socket.data.userId;
                            const isDoctor = socket.data?.docId && String(appointment.docId) === socket.data.docId;
                            if (!isPatient && !isDoctor) {
                                socket.emit('error', { message: 'Unauthorized room access' });
                                return;
                            }
                        }
                    } catch (e) {
                        return;
                    }
                }
            }

            socket.join(strRoom);
            socket.to(strRoom).emit('user-joined', socket.id);
        };

        socket.on('join-room', handleJoinRoom);
        socket.on('join-chat', handleJoinRoom);

        socket.on('leave-room', (roomId) => {
            if (roomId) socket.leave(String(roomId));
        });

        // Typing indicators
        socket.on('typing', ({ roomId, sender, senderName, isTyping }) => {
            if (!roomId) return;
            socket.to(String(roomId)).emit('typing', {
                roomId: String(roomId),
                sender,
                senderName,
                isTyping: Boolean(isTyping)
            });
        });

        // Handle chat messages (supports both 'chat-message' and 'send-message')
        const handleIncomingChatMessage = async (payload) => {
            try {
                const roomId = String(payload?.roomId || payload?.appointmentId || '');
                const rawMsg = payload?.message || payload;
                if (!roomId || !rawMsg) return;

                const sender = rawMsg.sender || 'user';
                const senderName = rawMsg.senderName || (sender === 'doctor' ? 'Doctor' : 'Patient');
                const text = (rawMsg.text || '').trim();
                const attachmentUrl = rawMsg.attachmentUrl || '';
                const attachmentType = rawMsg.attachmentType || '';
                const attachmentName = rawMsg.attachmentName || '';
                const replyTo = rawMsg.replyTo || null;

                if (!text && !attachmentUrl) return;

                let chat = await chatModel.findOne({ appointmentId: roomId });
                let appointment = null;

                if (!chat) {
                    appointment = await appointmentModel.findById(roomId);
                    if (!appointment) return;
                    chat = new chatModel({
                        appointmentId: roomId,
                        userId: appointment.userId,
                        docId: appointment.docId,
                        messages: [],
                        isActive: true
                    });
                }

                const newMsgObj = {
                    sender,
                    senderName,
                    text,
                    attachmentUrl,
                    attachmentType,
                    attachmentName,
                    replyTo,
                    reactions: [],
                    readBy: [sender],
                    timestamp: rawMsg.timestamp ? new Date(rawMsg.timestamp) : new Date()
                };

                chat.messages.push(newMsgObj);
                chat.updatedAt = new Date();
                await chat.save();

                const savedMessage = chat.messages[chat.messages.length - 1];
                const outgoingMessage = {
                    ...savedMessage.toObject(),
                    clientTempId: rawMsg.clientTempId || null,
                    appointmentId: roomId
                };

                // Broadcast to everyone in the room (including sender so sender gets DB _id)
                io.to(roomId).emit('chat-message', outgoingMessage);
                io.to(roomId).emit('receive-message', outgoingMessage);

                // Also emit thread update to both user and doctor personal rooms so their inboxes update live
                emitToUser(chat.userId, 'chat-thread-updated', {
                    appointmentId: roomId,
                    lastMessage: outgoingMessage
                });
                emitToDoctor(chat.docId, 'chat-thread-updated', {
                    appointmentId: roomId,
                    lastMessage: outgoingMessage
                });

                // Send real-time notification to the recipient
                if (!appointment) {
                    appointment = await appointmentModel.findById(roomId);
                }

                if (sender === 'user') {
                    await notifyParty({
                        recipientRole: 'doctor',
                        recipientId: chat.docId,
                        type: 'message',
                        title: `New message from ${appointment?.userData?.name || senderName}`,
                        body: text || 'Sent an attachment',
                        appointmentId: roomId,
                        link: `/doctor-chat/${roomId}`,
                        senderName: appointment?.userData?.name || senderName,
                        senderImage: appointment?.userData?.image || ''
                    });
                } else if (sender === 'doctor') {
                    const docName = appointment?.docData?.name || senderName;
                    await notifyParty({
                        recipientRole: 'user',
                        recipientId: chat.userId,
                        type: 'message',
                        title: `New message from ${docName.startsWith('Dr.') ? docName : 'Dr. ' + docName}`,
                        body: text || 'Sent an attachment',
                        appointmentId: roomId,
                        link: `/chat/${roomId}`,
                        senderName: docName,
                        senderImage: appointment?.docData?.image || ''
                    });
                }
            } catch (err) {
                console.log('Socket message error:', err.message);
            }
        };

        socket.on('chat-message', handleIncomingChatMessage);
        socket.on('send-message', handleIncomingChatMessage);

        // Mark messages as read
        socket.on('mark-messages-read', async ({ roomId, readerRole }) => {
            try {
                if (!roomId || !readerRole) return;
                const chat = await chatModel.findOne({ appointmentId: roomId });
                if (!chat) return;

                let updated = false;
                chat.messages.forEach((msg) => {
                    if (!msg.readBy.includes(readerRole)) {
                        msg.readBy.push(readerRole);
                        updated = true;
                    }
                });

                if (updated) {
                    await chat.save();
                    io.to(String(roomId)).emit('messages-read', {
                        roomId: String(roomId),
                        readerRole
                    });
                    emitToUser(chat.userId, 'messages-read', {
                        roomId: String(roomId),
                        readerRole
                    });
                    emitToDoctor(chat.docId, 'messages-read', {
                        roomId: String(roomId),
                        readerRole
                    });
                }
            } catch (err) {
                console.log('Mark read error:', err.message);
            }
        });

        // Message Emoji Reaction toggle
        socket.on('message-reaction', async ({ roomId, messageId, sender, emoji }) => {
            try {
                if (!roomId || !messageId || !sender || !emoji) return;
                const chat = await chatModel.findOne({ appointmentId: roomId });
                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                const existingIndex = msg.reactions.findIndex(
                    (r) => r.sender === sender && r.emoji === emoji
                );

                if (existingIndex > -1) {
                    msg.reactions.splice(existingIndex, 1);
                } else {
                    // Replace previous reaction by same sender or add
                    const prevBySender = msg.reactions.findIndex((r) => r.sender === sender);
                    if (prevBySender > -1) {
                        msg.reactions[prevBySender].emoji = emoji;
                    } else {
                        msg.reactions.push({ sender, emoji });
                    }
                }

                await chat.save();
                io.to(String(roomId)).emit('message-reaction-updated', {
                    roomId: String(roomId),
                    messageId: String(messageId),
                    reactions: msg.reactions
                });
            } catch (err) {
                console.log('Reaction error:', err.message);
            }
        });

        // Video Call Initiation (alerts the other side anywhere on the site!)
        socket.on('call-initiate', async ({ roomId, callerRole, override }) => {
            try {
                if (!roomId) return;
                const appointment = await appointmentModel.findById(roomId);
                if (!appointment) return;

                // Telemedicine payment rule: consultations must be prepaid online before the call can ring
                if (!appointment.payment) {
                    socket.emit('call-blocked', {
                        appointmentId: String(roomId),
                        reason: 'payment_pending',
                        message: 'Consultation fee is not paid yet. The patient must complete online payment before the video call can start.'
                    });
                    return;
                }

                // Telemedicine scheduled window rule:
                //  - Doctors may ring slightly early/late (OPD queue flexibility).
                //  - Patients may ring during the scheduled window, OR if doctor is already seated in room, OR via dev/test override.
                const isTestMode = String(process.env.PAYMENT_TEST_MODE || '').toLowerCase() === 'true';
                const isDevOverrideAllowed = isTestMode || process.env.NODE_ENV !== 'production';
                const windowStatus = checkAppointmentWindow(appointment.slotDate, appointment.slotTime, isTestMode);
                const snap = getVideoRoomSnapshot(roomId);
                const doctorSeated = snap.participants?.includes('doctor');
                const canBypassWindow =
                    callerRole === 'doctor' ||
                    doctorSeated ||
                    (Boolean(override) && isDevOverrideAllowed);

                if (windowStatus.status !== 'OPEN' && !canBypassWindow) {
                    socket.emit('call-blocked', {
                        appointmentId: String(roomId),
                        reason: windowStatus.status === 'TOO_EARLY' ? 'window_not_open' : 'window_expired',
                        message: windowStatus.message,
                        openTime: windowStatus.openTime,
                        closeTime: windowStatus.closeTime
                    });
                    return;
                }

                if (callerRole === 'doctor') {
                    const docName = appointment.docData?.name || 'Your Doctor';
                    const callPayload = {
                        appointmentId: String(roomId),
                        callerRole: 'doctor',
                        callerName: docName.startsWith('Dr.') ? docName : `Dr. ${docName}`,
                        callerImage: appointment.docData?.image || '',
                        speciality: appointment.docData?.speciality || 'Consultation'
                    };
                    emitToUser(appointment.userId, 'call-incoming', callPayload);
                    await notifyParty({
                        recipientRole: 'user',
                        recipientId: appointment.userId,
                        type: 'call_incoming',
                        title: `${callPayload.callerName} is calling you`,
                        body: 'Tap to join your live video consultation now.',
                        appointmentId: String(roomId),
                        link: `/video-call/${roomId}`,
                        senderName: callPayload.callerName,
                        senderImage: callPayload.callerImage
                    });
                } else {
                    const patientName = appointment.userData?.name || 'Patient';
                    const callPayload = {
                        appointmentId: String(roomId),
                        callerRole: 'user',
                        callerName: patientName,
                        callerImage: appointment.userData?.image || '',
                        speciality: `Slot: ${appointment.slotDate?.replace(/_/g, '/')} at ${appointment.slotTime}`
                    };
                    emitToDoctor(appointment.docId, 'call-incoming', callPayload);
                    await notifyParty({
                        recipientRole: 'doctor',
                        recipientId: appointment.docId,
                        type: 'call_incoming',
                        title: `${patientName} joined the video room`,
                        body: 'Patient is waiting in the video consultation room.',
                        appointmentId: String(roomId),
                        link: `/doctor-video-call/${roomId}`,
                        senderName: patientName,
                        senderImage: callPayload.callerImage
                    });
                }
            } catch (err) {
                console.log('Call initiate error:', err.message);
            }
        });

        socket.on('call-declined', async ({ roomId, declinedBy }) => {
            if (!roomId) return;
            io.to(String(roomId)).emit('call-declined', { roomId: String(roomId), declinedBy });
            try {
                const appointment = await appointmentModel.findById(roomId);
                if (appointment) {
                    emitToUser(appointment.userId, 'call-declined', { roomId: String(roomId), declinedBy });
                    emitToDoctor(appointment.docId, 'call-declined', { roomId: String(roomId), declinedBy });
                }
            } catch (e) {}
        });

        // WebRTC signaling
        socket.on('offer', ({ roomId, offer }) => {
            socket.to(String(roomId)).emit('offer', { offer, from: socket.id });
        });

        socket.on('answer', ({ roomId, answer }) => {
            socket.to(String(roomId)).emit('answer', { answer, from: socket.id });
        });

        socket.on('ice-candidate', ({ roomId, candidate }) => {
            socket.to(String(roomId)).emit('ice-candidate', { candidate, from: socket.id });
        });

        socket.on('call-ended', async (roomId) => {
            if (!roomId) return;
            socket.to(String(roomId)).emit('call-ended');
            try {
                const appointment = await appointmentModel.findById(roomId);
                if (appointment) {
                    emitToUser(appointment.userId, 'call-ended', { appointmentId: String(roomId) });
                    emitToDoctor(appointment.docId, 'call-ended', { appointmentId: String(roomId) });
                }
            } catch (e) {}
        });

        // Real-time rPPG contactless vitals streaming
        socket.on('vitals-update', ({ roomId, vitals }) => {
            if (!roomId) return;
            socket.to(String(roomId)).emit('vitals-update', vitals);
            socket.to(`video:${String(roomId)}`).emit('vitals-update', vitals);
        });

        // Production JWT-verified WebRTC video room session handlers (`video:*` namespace)
        registerVideoHandlers(io, socket);

        socket.on('disconnect', () => {
            if (socket.data?.userId) {
                removeSocketFromMap(onlineUsers, socket.data.userId, socket.id);
            }
            if (socket.data?.docId) {
                removeSocketFromMap(onlineDoctors, socket.data.docId, socket.id);
            }
            broadcastPresence();
        });
    });

    return io;
};

export { io };
