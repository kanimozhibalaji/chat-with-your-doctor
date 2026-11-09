import axios from "axios";
import { createContext, useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { io } from "socket.io-client";

export const AdminContext = createContext();

const AdminContextProvider = (props) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [aToken, setAToken] = useState(localStorage.getItem('aToken') ? localStorage.getItem('aToken') : '');

    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [patients, setPatients] = useState([]);
    const [dashData, setDashData] = useState(false);

    const getAllDoctors = useCallback(async () => {
        if (!aToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/all-doctors', { headers: { aToken } });
            if (data.success) {
                setDoctors(data.doctors);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
        }
    }, [backendUrl, aToken]);

    const getAllPatients = useCallback(async () => {
        if (!aToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/patients', { headers: { aToken } });
            if (data.success) {
                setPatients(data.patients || []);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
        }
    }, [backendUrl, aToken]);

    const changeAvailability = async (docId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/change-availability', { docId }, { headers: { aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
                getDashData();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    };

    const updateDoctor = async (formData) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/update-doctor', formData, { headers: { aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
                getDashData();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
            return false;
        }
    };

    const deleteDoctor = async (docId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/delete-doctor', { docId }, { headers: { aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllDoctors();
                getDashData();
                return true;
            } else {
                toast.error(data.message);
                return false;
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
            return false;
        }
    };

    const getAllAppointments = useCallback(async () => {
        if (!aToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/appointments', { headers: { aToken } });
            if (data.success) {
                setAppointments(data.appointments.reverse());
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
            console.log(error);
        }
    }, [backendUrl, aToken]);

    const getDashData = useCallback(async () => {
        if (!aToken) return;
        try {
            const { data } = await axios.get(backendUrl + '/api/admin/dashboard', { headers: { aToken } });
            if (data.success) {
                setDashData(data.dashData);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message);
        }
    }, [backendUrl, aToken]);

    const cancelAppointment = async (appointmentId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/cancel-appointment', { appointmentId }, { headers: { aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllAppointments();
                getDashData();
                getAllPatients();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
            console.log(error);
        }
    };

    const completeAppointmentAdmin = async (appointmentId) => {
        try {
            const { data } = await axios.post(backendUrl + '/api/admin/complete-appointment', { appointmentId }, { headers: { aToken } });
            if (data.success) {
                toast.success(data.message);
                getAllAppointments();
                getDashData();
                getAllPatients();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.message);
            console.log(error);
        }
    };

    // Real-time Socket connection for Admin
    useEffect(() => {
        if (!backendUrl || !aToken) return;

        const socket = io(backendUrl, {
            transports: ['websocket', 'polling'],
            auth: { aToken }
        });

        socket.on('connect', () => {
            socket.emit('register-session', { aToken });
        });

        socket.on('appointment-updated', () => {
            getAllAppointments();
            getDashData();
            getAllPatients();
        });

        socket.on('doctors-updated', () => {
            getAllDoctors();
            getDashData();
        });

        return () => {
            socket.disconnect();
        };
    }, [backendUrl, aToken, getAllAppointments, getDashData, getAllDoctors, getAllPatients]);

    const value = {
        aToken,
        setAToken,
        doctors,
        getAllDoctors,
        changeAvailability,
        updateDoctor,
        deleteDoctor,
        patients,
        getAllPatients,
        appointments,
        getAllAppointments,
        getDashData,
        cancelAppointment,
        completeAppointmentAdmin,
        dashData
    };

    return (
        <AdminContext.Provider value={value}>
            {props.children}
        </AdminContext.Provider>
    );
};

export default AdminContextProvider;
