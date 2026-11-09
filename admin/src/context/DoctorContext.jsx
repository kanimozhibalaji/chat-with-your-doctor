import { createContext, useState, useEffect, useRef, useCallback } from "react";
import axios from 'axios';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

export const DoctorContext = createContext();

const playDoctorAlertSound = (type = 'default') => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'call') {
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.14);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else {
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.09);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        }
    } catch (e) {}
};

const DoctorContextProvider = (props) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [dToken, setDToken] = useState(localStorage.getItem('dToken') ? localStorage.getItem('dToken') : '');
    const [appointments, setAppointments] = useState([]);
    const [dashData, setDashData] = useState(false);
    const [profileData, setProfileData] = useState(false);

    // Real-time Socket & Notifications state
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [incomingCall, setIncomingCall] = useState(null);
    const socketRef = useRef(null);

    const getAppointments = useCallback(async () => {
        if (!dToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/appointments', { headers: { dToken } });
            if (data.success) {
                setAppointments(data.appointments.reverse());
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl, dToken]);

    const getProfileData = useCallback(async () => {
        if (!dToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/profile', { headers: { dToken } });
            setProfileData(data.profileData);
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl, dToken]);

    const getDashData = useCallback(async () => {
        if (!dToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/dashboard', { headers: { dToken } });
            if (data.success) {
                setDashData(data.dashData);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl, dToken]);

    const fetchDoctorNotifications = useCallback(async () => {
        if (!dToken) {
            setNotifications([]);
            return;
        }
        try {
            const { data } = await axios.get(`${backendUrl}/api/chat/doctor/notifications`, {
                headers: { dToken }
            });
            if (data.success) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.log('Doctor notifications error:', error.message);
        }
    }, [backendUrl, dToken]);

    const fetchUnreadChatCount = useCallback(async () => {
        if (!dToken) {
            setUnreadChatCount(0);
            return;
        }
        try {
            const { data } = await axios.get(`${backendUrl}/api/chat/doctor/inbox`, {
                headers: { dToken }
            });
            if (data.success && Array.isArray(data.threads)) {
                const total = data.threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
                setUnreadChatCount(total);
            }
        } catch (error) {
            console.log('Doctor unread count error:', error.message);
        }
    }, [backendUrl, dToken]);

    const markDoctorNotificationRead = async (notificationId = null) => {
        if (!dToken) return;
        try {
            await axios.post(
                `${backendUrl}/api/chat/doctor/notifications/mark-read`,
                { notificationId },
                { headers: { dToken } }
            );
            setNotifications((prev) =>
                prev.map((n) =>
                    !notificationId || n._id === notificationId ? { ...n, isRead: true } : n
                )
            );
        } catch (error) {
            console.log(error);
        }
    };

    const cancelAppointment = async (appointmentId) => {
        try {
            const { data } = await axios.post(
                backendUrl + '/api/doctor/cancel-appointment',
                { appointmentId },
                { headers: { dToken } }
            );
            if (data.success) {
                toast.success(data.message);
                getAppointments();
                getDashData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
            console.log(error);
        }
    };

    const completeAppointment = async (appointmentId) => {
        try {
            const { data } = await axios.post(
                backendUrl + '/api/doctor/complete-appointment',
                { appointmentId },
                { headers: { dToken } }
            );
            if (data.success) {
                toast.success(data.message);
                getAppointments();
                getDashData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
            console.log(error);
        }
    };

    const declineIncomingCall = () => {
        if (incomingCall && socketRef.current) {
            socketRef.current.emit('call-declined', {
                roomId: incomingCall.appointmentId,
                declinedBy: 'doctor'
            });
        }
        setIncomingCall(null);
    };

    const isPatientOnline = useCallback(
        (userId) => onlineUsers.includes(String(userId)),
        [onlineUsers]
    );

    useEffect(() => {
        if (dToken) {
            getProfileData();
            fetchDoctorNotifications();
            fetchUnreadChatCount();
        } else {
            setNotifications([]);
            setUnreadChatCount(0);
        }
    }, [dToken, getProfileData, fetchDoctorNotifications, fetchUnreadChatCount]);

    // Persistent Doctor Socket.io Connection
    useEffect(() => {
        if (!backendUrl || !dToken) return;

        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            auth: { dToken }
        });
        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('register-session', { dToken });
            newSocket.emit('get-presence');
        });

        newSocket.on('presence-update', ({ onlineUsers: users = [] }) => {
            setOnlineUsers(users.map(String));
        });

        newSocket.on('appointment-updated', (payload) => {
            getAppointments();
            getDashData();
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:doctor-appointment-updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:doctor-appointment-updated', { detail: payload }));
        });

        newSocket.on('chat-thread-updated', (payload) => {
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:doctor-chat-updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:doctor-chat-updated', { detail: payload }));
        });

        newSocket.on('messages-read', (payload) => {
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:doctor-messages-read', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:doctor-messages-read', { detail: payload }));
        });

        newSocket.on('notification', (notif) => {
            setNotifications((prev) => [notif, ...prev.filter((n) => n._id !== notif._id)]);
            playDoctorAlertSound(
                notif.type === 'call_incoming' || notif.type === 'allergy_conflict' ? 'call' : 'default'
            );

            const currentPath = window.location.pathname;
            if (notif.type === 'message' && notif.appointmentId && currentPath === `/doctor-chat/${notif.appointmentId}`) {
                return;
            }

            const toastFn = notif.type === 'allergy_conflict' ? toast.error : notif.type === 'allergy_updated' ? toast.warning : toast.info;
            toastFn(
                <div>
                    <p className="font-bold text-xs text-slate-900">{notif.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-3">{notif.body}</p>
                </div>,
                {
                    autoClose: notif.type === 'allergy_conflict' ? 9000 : 5000,
                    onClick: () => {
                        if (notif.link) {
                            window.dispatchEvent(
                                new CustomEvent('vitalsync:doctor-navigate', {
                                    detail: { path: notif.link, notifId: notif._id }
                                })
                            );
                            window.dispatchEvent(
                                new CustomEvent('prescripto:doctor-navigate', {
                                    detail: { path: notif.link, notifId: notif._id }
                                })
                            );
                        }
                    }
                }
            );
        });

        newSocket.on('call-incoming', (callPayload) => {
            playDoctorAlertSound('call');
            const currentPath = window.location.pathname;
            if (currentPath !== `/doctor-video-call/${callPayload.appointmentId}`) {
                setIncomingCall(callPayload);
            }
        });

        newSocket.on('call-ended', (payload) => {
            setIncomingCall((prev) =>
                prev && (!payload?.appointmentId || prev.appointmentId === payload.appointmentId) ? null : prev
            );
        });

        return () => {
            newSocket.disconnect();
        };
    }, [backendUrl, dToken, getAppointments, getDashData, fetchUnreadChatCount]);

    const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

    const value = {
        dToken,
        setDToken,
        backendUrl,
        appointments,
        getAppointments,
        cancelAppointment,
        completeAppointment,
        dashData,
        getDashData,
        profileData,
        setProfileData,
        getProfileData,
        socket,
        onlineUsers,
        isPatientOnline,
        notifications,
        unreadNotifCount,
        fetchDoctorNotifications,
        markDoctorNotificationRead,
        unreadChatCount,
        fetchUnreadChatCount,
        incomingCall,
        setIncomingCall,
        declineIncomingCall
    };

    return (
        <DoctorContext.Provider value={value}>
            {props.children}
        </DoctorContext.Provider>
    );
};

export default DoctorContextProvider;
