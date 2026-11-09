import { createContext, useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import axios from 'axios';
import { io } from 'socket.io-client';

export const AppContext = createContext();

// Subtle WebAudio notification chime (zero external audio files needed)
const playNotificationSound = (type = 'default') => {
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
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.14); // A5
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else {
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.09); // E5
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.start(now);
            osc.stop(now + 0.28);
        }
    } catch (e) {
        // Ignore if browser blocks autoplay before user interaction
    }
};

const AppContextProvider = (props) => {
    const currencySymbol = '₹';
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [doctors, setDoctors] = useState([]);
    const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : '');
    const [userData, setUserData] = useState(false);

    // Real-time Socket & Presence state
    const [socket, setSocket] = useState(null);
    const [onlineDoctors, setOnlineDoctors] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [incomingCall, setIncomingCall] = useState(null);
    const socketRef = useRef(null);

    const getDoctosData = useCallback(async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/list');
            if (data.success) {
                setDoctors(data.doctors);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl]);

    const loadUserProfileData = useCallback(async () => {
        if (!token) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/user/get-profile', { headers: { token } });
            if (data.success) {
                setUserData(data.userData);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl, token]);

    const fetchNotifications = useCallback(async () => {
        if (!token) {
            setNotifications([]);
            return;
        }
        try {
            const { data } = await axios.get(`${backendUrl}/api/chat/notifications`, {
                headers: { token }
            });
            if (data.success) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.log('Fetch notifications error:', error.message);
        }
    }, [backendUrl, token]);

    const fetchUnreadChatCount = useCallback(async () => {
        if (!token) {
            setUnreadChatCount(0);
            return;
        }
        try {
            const { data } = await axios.get(`${backendUrl}/api/chat/inbox`, {
                headers: { token }
            });
            if (data.success && Array.isArray(data.threads)) {
                const totalUnread = data.threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
                setUnreadChatCount(totalUnread);
            }
        } catch (error) {
            console.log('Unread count error:', error.message);
        }
    }, [backendUrl, token]);

    const markNotificationRead = async (notificationId = null) => {
        if (!token) return;
        try {
            await axios.post(
                `${backendUrl}/api/chat/notifications/mark-read`,
                { notificationId },
                { headers: { token } }
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

    const declineIncomingCall = () => {
        if (incomingCall && socketRef.current) {
            socketRef.current.emit('call-declined', {
                roomId: incomingCall.appointmentId,
                declinedBy: 'user'
            });
        }
        setIncomingCall(null);
    };

    const isDoctorOnline = useCallback(
        (docId) => onlineDoctors.includes(String(docId)),
        [onlineDoctors]
    );

    // Initial load
    useEffect(() => {
        getDoctosData();
    }, [getDoctosData]);

    useEffect(() => {
        if (token) {
            loadUserProfileData();
            fetchNotifications();
            fetchUnreadChatCount();
        } else {
            setUserData(false);
            setNotifications([]);
            setUnreadChatCount(0);
        }
    }, [token, loadUserProfileData, fetchNotifications, fetchUnreadChatCount]);

    // Persistent Global Socket.io Connection
    useEffect(() => {
        if (!backendUrl) return;

        const newSocket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            auth: token ? { token } : {}
        });
        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            if (token) {
                newSocket.emit('register-session', { token });
            }
            newSocket.emit('get-presence');
        });

        newSocket.on('presence-update', ({ onlineDoctors: docs = [] }) => {
            setOnlineDoctors(docs.map(String));
        });

        newSocket.on('doctors-updated', () => {
            getDoctosData();
            window.dispatchEvent(new CustomEvent('vitalsync:doctors-updated'));
            window.dispatchEvent(new CustomEvent('prescripto:doctors-updated'));
        });

        newSocket.on('appointment-updated', (payload) => {
            getDoctosData();
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:appointment-updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:appointment-updated', { detail: payload }));
        });

        newSocket.on('prescription-updated', (payload) => {
            window.dispatchEvent(new CustomEvent('vitalsync:prescription-updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:prescription-updated', { detail: payload }));
        });

        newSocket.on('chat-thread-updated', (payload) => {
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:chat-thread-updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:chat-thread-updated', { detail: payload }));
        });

        newSocket.on('messages-read', (payload) => {
            fetchUnreadChatCount();
            window.dispatchEvent(new CustomEvent('vitalsync:messages-read', { detail: payload }));
            window.dispatchEvent(new CustomEvent('prescripto:messages-read', { detail: payload }));
        });

        newSocket.on('notification', (notif) => {
            setNotifications((prev) => [notif, ...prev.filter((n) => n._id !== notif._id)]);
            playNotificationSound(notif.type === 'call_incoming' ? 'call' : 'default');

            // Avoid duplicate toast if user is already inside that exact chat page
            const currentPath = window.location.pathname;
            if (notif.type === 'message' && notif.appointmentId && currentPath === `/chat/${notif.appointmentId}`) {
                return;
            }

            toast.info(
                <div>
                    <p className="font-bold text-xs text-slate-900">{notif.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.body}</p>
                </div>,
                {
                    onClick: () => {
                        if (notif.link) {
                            window.dispatchEvent(
                                new CustomEvent('vitalsync:navigate', { detail: { path: notif.link, notifId: notif._id } })
                            );
                            window.dispatchEvent(
                                new CustomEvent('prescripto:navigate', { detail: { path: notif.link, notifId: notif._id } })
                            );
                        }
                    }
                }
            );
        });

        newSocket.on('call-incoming', (callPayload) => {
            playNotificationSound('call');
            const currentPath = window.location.pathname;
            if (currentPath !== `/video-call/${callPayload.appointmentId}`) {
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
    }, [backendUrl, token, getDoctosData, fetchUnreadChatCount]);

    const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

    const value = {
        doctors,
        getDoctosData,
        currencySymbol,
        backendUrl,
        token,
        setToken,
        userData,
        setUserData,
        loadUserProfileData,
        socket,
        onlineDoctors,
        isDoctorOnline,
        notifications,
        unreadNotifCount,
        fetchNotifications,
        markNotificationRead,
        unreadChatCount,
        fetchUnreadChatCount,
        incomingCall,
        setIncomingCall,
        declineIncomingCall
    };

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContextProvider;
