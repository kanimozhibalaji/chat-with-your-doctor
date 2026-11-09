import crypto from 'crypto';
import appointmentModel from '../models/appointmentModel.js';
import { checkAppointmentWindow } from './calendarHelper.js';

/**
 * VitalSync Production Video Session Layer
 * ========================================
 * Server-authoritative signaling for 1:1 teleconsultations.
 *
 *  - Authorization: a socket may only join `video:<appointmentId>` if its handshake JWT
 *    belongs to that appointment's patient (userId) or doctor (docId).
 *  - Isolation: video signaling uses a dedicated `video:` room namespace, so chat sockets
 *    joined to the plain appointment room can never receive SDP / ICE payloads.
 *  - Single seat per role: a second tab/device for the same role replaces the first.
 *  - Reconnect-aware: transient socket drops keep the room alive for a grace period and
 *    peers are told whether a rejoin is a `resume` (existing RTCPeerConnection still alive).
 *  - Short-lived TURN credentials (coturn `use-auth-secret` / RFC 7635 style REST creds).
 *  - Call-quality audit log persisted to appointment.callLogs.
 */

const ROLES = ['user', 'doctor'];
const EMPTY_ROOM_GRACE_MS = 45 * 1000;
const MAX_SIGNAL_BYTES = 64 * 1024;
const TURN_CREDENTIAL_TTL_SEC = 6 * 60 * 60;

// appointmentId -> { participants: Map<role, {socketId, name, joinedAt}>, sessionStartedAt, peakParticipants, finalizeTimer, reconnects }
const videoRooms = new Map();

const roomKey = (appointmentId) => `video:${appointmentId}`;

const getRoom = (appointmentId) => {
    const id = String(appointmentId);
    if (!videoRooms.has(id)) {
        videoRooms.set(id, {
            participants: new Map(),
            sessionStartedAt: null,
            finalizeTimer: null,
            reconnects: 0,
            endedBy: null,
            endReason: null
        });
    }
    return videoRooms.get(id);
};

/**
 * Build ICE server list.
 *  TURN_URLS        = "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp"
 *  TURN_SECRET      = shared secret configured in coturn (`static-auth-secret`) -> ephemeral HMAC credentials
 *  or TURN_USERNAME / TURN_CREDENTIAL for static long-term credentials.
 */
export const buildIceServers = (identity = 'vitalsync') => {
    const iceServers = [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ];

    const turnUrls = String(process.env.TURN_URLS || process.env.TURN_URL || '')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

    if (turnUrls.length) {
        if (process.env.TURN_SECRET) {
            const expiry = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SEC;
            const username = `${expiry}:${identity}`;
            const credential = crypto
                .createHmac('sha1', process.env.TURN_SECRET)
                .update(username)
                .digest('base64');
            iceServers.push({ urls: turnUrls, username, credential });
        } else if (process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
            iceServers.push({
                urls: turnUrls,
                username: process.env.TURN_USERNAME,
                credential: process.env.TURN_CREDENTIAL
            });
        }
    }

    return iceServers;
};

const isTestOrDevOverrideAllowed = () =>
    String(process.env.PAYMENT_TEST_MODE || '').toLowerCase() === 'true' ||
    process.env.NODE_ENV !== 'production';

const finalizeSession = async (appointmentId, reason = 'completed', endedBy = null) => {
    const room = videoRooms.get(String(appointmentId));
    if (!room) return;
    if (room.finalizeTimer) clearTimeout(room.finalizeTimer);

    const startedAt = room.sessionStartedAt;
    videoRooms.delete(String(appointmentId));

    if (!startedAt) return; // Both parties never connected simultaneously: nothing to audit

    const endedAt = new Date();
    try {
        await appointmentModel.findByIdAndUpdate(appointmentId, {
            $push: {
                callLogs: {
                    startedAt,
                    endedAt,
                    durationSec: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
                    endedBy: endedBy || room.endedBy || null,
                    endReason: reason,
                    signalingReconnects: room.reconnects
                }
            }
        });
    } catch (err) {
        console.log('Video session log error:', err.message);
    }
};

const scheduleFinalizeIfEmpty = (appointmentId) => {
    const room = videoRooms.get(String(appointmentId));
    if (!room || room.participants.size > 0) return;
    if (room.finalizeTimer) clearTimeout(room.finalizeTimer);
    room.finalizeTimer = setTimeout(() => {
        const latest = videoRooms.get(String(appointmentId));
        if (latest && latest.participants.size === 0) {
            finalizeSession(appointmentId, latest.endReason || 'all-left');
        }
    }, EMPTY_ROOM_GRACE_MS);
};

const findSeat = (socket, appointmentId) => {
    const room = videoRooms.get(String(appointmentId));
    if (!room) return null;
    for (const [role, seat] of room.participants.entries()) {
        if (seat.socketId === socket.id) return { room, role, seat };
    }
    return null;
};

/**
 * Attach video handlers to a connected socket.
 * `socket.data.userId` / `socket.data.docId` are populated by the JWT handshake in socket.js.
 */
export const registerVideoHandlers = (io, socket) => {
    socket.on('video:join', async (payload = {}, ack = () => {}) => {
        const reply = typeof ack === 'function' ? ack : () => {};
        try {
            const appointmentId = String(payload.appointmentId || '');
            if (!/^[0-9a-fA-F]{24}$/.test(appointmentId)) {
                return reply({ ok: false, code: 'BAD_REQUEST', message: 'Invalid consultation room.' });
            }

            const appointment = await appointmentModel.findById(appointmentId).lean();
            if (!appointment) {
                return reply({ ok: false, code: 'NOT_FOUND', message: 'Consultation not found.' });
            }

            // Role resolution strictly from verified JWT identity (never from client-supplied role)
            let role = null;
            if (socket.data?.docId && String(appointment.docId) === socket.data.docId) role = 'doctor';
            else if (socket.data?.userId && String(appointment.userId) === socket.data.userId) role = 'user';

            if (!role) {
                return reply({ ok: false, code: 'FORBIDDEN', message: 'You are not a participant of this consultation.' });
            }
            if (appointment.cancelled) {
                return reply({ ok: false, code: 'CANCELLED', message: 'This appointment has been cancelled.' });
            }
            if (!appointment.payment) {
                return reply({
                    ok: false,
                    code: 'PAYMENT_PENDING',
                    message: role === 'user'
                        ? 'Please complete the consultation fee payment to unlock the room.'
                        : 'The patient has not completed payment yet.'
                });
            }

            const room = getRoom(appointmentId);
            room.userId = String(appointment.userId);
            room.docId = String(appointment.docId);

            // Clinical window check:
            //  - Doctors may open their own patient's paid consultation room slightly early/late (OPD queue flexibility).
            //  - Patients may join during the scheduled window, OR immediately if the doctor is already seated in the room,
            //    OR via explicit dev/test override in non-production / test environments.
            const testMode = String(process.env.PAYMENT_TEST_MODE || '').toLowerCase() === 'true';
            const windowStatus = checkAppointmentWindow(appointment.slotDate, appointment.slotTime, testMode);
            const doctorAlreadySeated = room.participants.has('doctor');
            const bypassAllowed =
                role === 'doctor' ||
                doctorAlreadySeated ||
                (Boolean(payload.override) && isTestOrDevOverrideAllowed());

            if (windowStatus.status !== 'OPEN' && !bypassAllowed) {
                return reply({ ok: false, code: windowStatus.status, message: windowStatus.message });
            }

            if (room.finalizeTimer) {
                clearTimeout(room.finalizeTimer);
                room.finalizeTimer = null;
            }

            // Single seat per role: evict a previous tab/device of the same participant
            const existing = room.participants.get(role);
            if (existing && existing.socketId !== socket.id) {
                const oldSocket = io.sockets.sockets.get(existing.socketId);
                if (oldSocket) {
                    oldSocket.emit('video:replaced', { appointmentId });
                    oldSocket.leave(roomKey(appointmentId));
                } else {
                    room.reconnects += 1;
                }
            }

            const name = role === 'doctor'
                ? (appointment.docData?.name || 'Doctor')
                : (appointment.userData?.name || 'Patient');
            const image = role === 'doctor' ? appointment.docData?.image : appointment.userData?.image;

            const initialMediaState = {
                audio: payload.mediaState?.audio !== false,
                video: payload.mediaState?.video !== false,
                screen: Boolean(payload.mediaState?.screen),
                dataSaver: Boolean(payload.mediaState?.dataSaver),
                handRaised: false
            };

            room.participants.set(role, {
                socketId: socket.id,
                name,
                image: image || '',
                joinedAt: new Date(),
                mediaState: initialMediaState
            });
            socket.join(roomKey(appointmentId));
            socket.data.videoRooms = new Set([...(socket.data.videoRooms || []), appointmentId]);

            const otherRole = ROLES.find((r) => r !== role);
            const other = room.participants.get(otherRole);

            if (other) {
                if (!room.sessionStartedAt) room.sessionStartedAt = new Date();
                // Notify existing peer first so it is ready before the joiner's offer arrives
                socket.to(roomKey(appointmentId)).emit('video:peer-joined', {
                    role,
                    name,
                    image: image || '',
                    resume: Boolean(payload.resume),
                    mediaState: initialMediaState
                });
            }

            return reply({
                ok: true,
                role,
                // Perfect-negotiation politeness: patient yields on offer collisions, doctor wins
                polite: role === 'user',
                peer: other
                    ? { role: otherRole, name: other.name, image: other.image, mediaState: other.mediaState || null }
                    : null,
                iceServers: buildIceServers(`${role}-${appointmentId}`),
                serverTime: Date.now()
            });
        } catch (err) {
            console.log('video:join error:', err.message);
            return reply({ ok: false, code: 'SERVER_ERROR', message: 'Unable to join the consultation room.' });
        }
    });

    // SDP / ICE relay (only from seated participants, size-capped)
    socket.on('video:signal', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        if (!findSeat(socket, appointmentId)) return;
        const message = { description: payload.description || null, candidate: payload.candidate || null };
        if (JSON.stringify(message).length > MAX_SIGNAL_BYTES) return;
        socket.to(roomKey(appointmentId)).emit('video:signal', message);
    });

    // Mic / camera / screen-share / data-saver state broadcast
    socket.on('video:media-state', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat) return;
        const nextState = {
            audio: Boolean(payload.audio),
            video: Boolean(payload.video),
            screen: Boolean(payload.screen),
            dataSaver: Boolean(payload.dataSaver),
            handRaised: Boolean(payload.handRaised)
        };
        seat.seat.mediaState = nextState;
        socket.to(roomKey(appointmentId)).emit('video:media-state', nextState);
    });

    // Live Speech-to-Text clinical captions relay
    socket.on('video:caption', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat) return;
        const text = String(payload.text || '').trim().slice(0, 600);
        if (!text) return;
        socket.to(roomKey(appointmentId)).emit('video:caption', {
            text,
            isFinal: Boolean(payload.isFinal),
            speakerRole: seat.role,
            speakerName: seat.seat.name,
            timestamp: Date.now()
        });
    });

    // Quick floating reactions / clinical cues
    socket.on('video:reaction', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat) return;
        const emoji = String(payload.emoji || '').trim().slice(0, 16);
        const label = String(payload.label || '').trim().slice(0, 48);
        if (!emoji && !label) return;
        socket.to(roomKey(appointmentId)).emit('video:reaction', {
            id: crypto.randomUUID(),
            emoji,
            label,
            by: seat.role,
            name: seat.seat.name,
            timestamp: Date.now()
        });
    });

    // Real-time contactless rPPG vitals stream inside video room
    socket.on('video:vitals', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat || !payload.vitals) return;
        socket.to(roomKey(appointmentId)).emit('vitals-update', payload.vitals);
        socket.to(appointmentId).emit('vitals-update', payload.vitals);
    });

    // Instant in-call notification when doctor signs & issues an e-Prescription
    socket.on('video:rx-issued', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat || seat.role !== 'doctor') return;
        socket.to(roomKey(appointmentId)).emit('video:rx-issued', {
            appointmentId,
            diagnosis: String(payload.diagnosis || '').slice(0, 200),
            doctorName: seat.seat.name,
            issuedAt: Date.now()
        });
    });

    // Two-party recording consent protocol (request -> accept/decline -> stop)
    socket.on('video:recording', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat) return;
        const action = ['request', 'accept', 'decline', 'stop'].includes(payload.action) ? payload.action : null;
        if (!action) return;
        socket.to(roomKey(appointmentId)).emit('video:recording', { action, by: seat.role, name: seat.seat.name });
    });

    socket.on('video:leave', (payload = {}) => {
        const appointmentId = String(payload.appointmentId || '');
        const seat = findSeat(socket, appointmentId);
        if (!seat) return;

        seat.room.participants.delete(seat.role);
        socket.leave(roomKey(appointmentId));

        const endForAll = Boolean(payload.endForAll);
        if (endForAll) {
            socket.to(roomKey(appointmentId)).emit('video:ended', { by: seat.role, name: seat.seat.name });
            // Also dismiss global incoming-call banners on personal rooms
            if (seat.room.userId) io.to(`user:${seat.room.userId}`).emit('call-ended', { appointmentId });
            if (seat.room.docId) io.to(`doctor:${seat.room.docId}`).emit('call-ended', { appointmentId });
            seat.room.endedBy = seat.role;
            finalizeSession(appointmentId, 'ended-for-all', seat.role);
            return;
        }

        socket.to(roomKey(appointmentId)).emit('video:peer-left', { role: seat.role, reason: 'left' });
        seat.room.endedBy = seat.role;
        seat.room.endReason = 'left';
        scheduleFinalizeIfEmpty(appointmentId);
    });

    socket.on('disconnect', () => {
        const rooms = socket.data?.videoRooms;
        if (!rooms) return;
        for (const appointmentId of rooms) {
            const seat = findSeat(socket, appointmentId);
            if (!seat) continue;
            seat.room.participants.delete(seat.role);
            socket.to(roomKey(appointmentId)).emit('video:peer-left', { role: seat.role, reason: 'disconnected' });
            seat.room.endReason = 'disconnected';
            scheduleFinalizeIfEmpty(appointmentId);
        }
    });
};

export const getVideoRoomSnapshot = (appointmentId) => {
    const room = videoRooms.get(String(appointmentId));
    if (!room) return { active: false, participants: [] };
    return {
        active: true,
        sessionStartedAt: room.sessionStartedAt,
        participants: Array.from(room.participants.keys())
    };
};
