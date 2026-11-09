import React, { useContext, useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'
import ChatWindow from '../components/ChatWindow'
import ReviewModal from '../components/ReviewModal'
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  FileText,
  CreditCard,
  Star,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Plus,
  ShieldCheck,
  AlertTriangle,
  X,
  Lock,
  Zap,
  Search,
  Sun,
  SunMedium,
  Moon
} from 'lucide-react'
import { checkAppointmentWindow } from '../utils/appointmentTime'

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const MyAppointments = () => {
    const { backendUrl, token, currencySymbol, isDoctorOnline, doctors, getDoctosData } = useContext(AppContext)
    const navigate = useNavigate()

    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState('all') // 'all' | 'upcoming' | 'completed' | 'cancelled'
    const [searchQuery, setSearchQuery] = useState('')
    const [paymentTarget, setPaymentTarget] = useState('')
    const [paymentConfig, setPaymentConfig] = useState({ testMode: false, razorpayEnabled: true, stripeEnabled: false })
    const [activeChat, setActiveChat] = useState(null)
    const [reviewTarget, setReviewTarget] = useState(null)

    // Reschedule Native <dialog> Modal State
    const rescheduleDialogRef = useRef(null)
    const [rescheduleTarget, setRescheduleTarget] = useState(null)
    const [rescheduleSlots, setRescheduleSlots] = useState([])
    const [rescheduleDayIdx, setRescheduleDayIdx] = useState(0)
    const [rescheduleTime, setRescheduleTime] = useState('')
    const [rescheduling, setRescheduling] = useState(false)

    const slotDateFormat = (slotDate) => {
        if (!slotDate) return ''
        const dateArray = slotDate.split('_')
        return `${dateArray[0]} ${MONTHS[Number(dateArray[1]) - 1] || dateArray[1]} ${dateArray[2]}`
    }

    const getPaymentConfig = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/payment-config`)
            if (data.success) {
                setPaymentConfig(data)
            }
        } catch (error) {
            console.error('Failed to get payment config:', error)
        }
    }

    const handleTestPaymentBypass = async (appointmentId) => {
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/user/payment-test-bypass`,
                { appointmentId },
                { headers: { token } }
            )
            if (data.success) {
                toast.success(data.message || 'Payment bypassed in test mode!')
                getUserAppointments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Bypass error:', error)
            toast.error(error.message)
        }
    }

    const getUserAppointments = async () => {
        setLoading(true)
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/appointments`, { headers: { token } })
            if (data.success) {
                setAppointments(data.appointments.reverse())
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        }
        setLoading(false)
    }

    const cancelAppointment = async (appointmentId) => {
        if (!window.confirm("Are you sure you want to cancel this consultation?")) return
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/user/cancel-appointment`,
                { appointmentId },
                { headers: { token } }
            )

            if (data.success) {
                toast.success(data.message)
                getUserAppointments()
                getDoctosData()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        }
    }

    // Build 7-day slots and open native <dialog>
    const openRescheduleModal = (apt) => {
        const liveDoc = doctors.find((d) => d._id === apt.docId) || apt.docData || {}
        const booked = liveDoc.slots_booked || {}

        const today = new Date()
        const generated = []

        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            const endTime = new Date(today)
            endTime.setDate(today.getDate() + i)
            endTime.setHours(21, 0, 0, 0)

            if (today.getDate() === currentDate.getDate()) {
                currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
                currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
            } else {
                currentDate.setHours(10)
                currentDate.setMinutes(0)
            }

            const timeSlots = []
            while (currentDate < endTime) {
                const formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const day = currentDate.getDate()
                const month = currentDate.getMonth() + 1
                const year = currentDate.getFullYear()
                const slotDateKey = `${day}_${month}_${year}`

                const isSlotAvailable =
                    !booked[slotDateKey] || !booked[slotDateKey].includes(formattedTime)

                if (isSlotAvailable) {
                    timeSlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime,
                        hours: currentDate.getHours(),
                        slotDateKey
                    })
                }
                currentDate.setMinutes(currentDate.getMinutes() + 30)
            }
            generated.push(timeSlots)
        }

        const firstNonEmptyIdx = generated.findIndex((d) => d.length > 0)
        setRescheduleSlots(generated)
        setRescheduleDayIdx(firstNonEmptyIdx !== -1 ? firstNonEmptyIdx : 0)
        setRescheduleTime('')
        setRescheduleTarget(apt)

        if (rescheduleDialogRef.current) {
            rescheduleDialogRef.current.showModal()
        }
    }

    const closeRescheduleModal = () => {
        if (rescheduleDialogRef.current) {
            rescheduleDialogRef.current.close()
        }
        setRescheduleTarget(null)
    }

    const handleConfirmReschedule = async () => {
        if (!rescheduleTarget || !rescheduleTime) {
            return toast.warning('Please select an available time slot')
        }
        const selectedDaySlots = rescheduleSlots[rescheduleDayIdx] || []
        const dateObj = selectedDaySlots[0]?.datetime
        if (!dateObj) {
            return toast.error('Selected date has no available slots')
        }

        const newSlotDate = `${dateObj.getDate()}_${dateObj.getMonth() + 1}_${dateObj.getFullYear()}`
        setRescheduling(true)
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/user/reschedule-appointment`,
                {
                    appointmentId: rescheduleTarget._id,
                    newSlotDate,
                    newSlotTime: rescheduleTime
                },
                { headers: { token } }
            )
            if (data.success) {
                toast.success(data.message)
                closeRescheduleModal()
                getUserAppointments()
                getDoctosData()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setRescheduling(false)
        }
    }

    const initPay = (order, keyId) => {
        const razorpayKey = keyId || import.meta.env.VITE_RAZORPAY_KEY_ID
        if (!razorpayKey || razorpayKey.includes('---')) {
            toast.error("Razorpay Key ID is not configured.")
            return
        }

        const options = {
            key: razorpayKey,
            amount: order.amount,
            currency: order.currency,
            name: 'VitalSync Healthcare',
            description: "Online Doctor Appointment",
            order_id: order.id,
            receipt: order.receipt,
            handler: async (response) => {
                try {
                    const { data } = await axios.post(`${backendUrl}/api/user/verifyRazorpay`, response, { headers: { token } })
                    if (data.success) {
                        toast.success("Payment verified! Appointment confirmed.")
                        setPaymentTarget('')
                        getUserAppointments()
                    } else {
                        toast.error(data.message || "Payment verification failed")
                    }
                } catch (error) {
                    console.error(error)
                    toast.error(error.message)
                }
            },
            modal: {
                ondismiss: () => {
                    toast.info("Payment window closed.")
                }
            }
        }
        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', function (response) {
            toast.error(response.error?.description || "Payment Failed")
        })
        rzp.open()
    }

    const appointmentRazorpay = async (appointmentId) => {
        try {
            const { data } = await axios.post(`${backendUrl}/api/user/payment-razorpay`, { appointmentId }, { headers: { token } })
            if (data.success) {
                initPay(data.order, data.key_id)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        }
    }

    const appointmentStripe = async (appointmentId) => {
        try {
            const { data } = await axios.post(`${backendUrl}/api/user/payment-stripe`, { appointmentId }, { headers: { token } })
            if (data.success) {
                window.location.replace(data.session_url)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        }
    }

    useEffect(() => {
        getPaymentConfig()
        if (token) getUserAppointments()

        const handleRealtimeUpdate = () => {
            if (token) getUserAppointments()
        }
        window.addEventListener('vitalsync:appointment-updated', handleRealtimeUpdate)
        window.addEventListener('prescripto:appointment-updated', handleRealtimeUpdate)
        window.addEventListener('vitalsync:prescription-updated', handleRealtimeUpdate)
        window.addEventListener('prescripto:prescription-updated', handleRealtimeUpdate)
        return () => {
            window.removeEventListener('vitalsync:appointment-updated', handleRealtimeUpdate)
            window.removeEventListener('prescripto:appointment-updated', handleRealtimeUpdate)
            window.removeEventListener('vitalsync:prescription-updated', handleRealtimeUpdate)
            window.removeEventListener('prescripto:prescription-updated', handleRealtimeUpdate)
        }
    }, [token])

    // Grouping reschedule slots for the active day
    const rescheduleGroupedSlots = useMemo(() => {
        const slots = rescheduleSlots[rescheduleDayIdx] || []
        const morning = []
        const afternoon = []
        const evening = []

        slots.forEach(slot => {
            const h = slot.hours
            if (h < 12) {
                morning.push(slot)
            } else if (h < 17) {
                afternoon.push(slot)
            } else {
                evening.push(slot)
            }
        })

        return { morning, afternoon, evening }
    }, [rescheduleSlots, rescheduleDayIdx])

    // Filter appointments
    const filteredAppointments = useMemo(() => {
        return appointments.filter(item => {
            if (filter === 'upcoming') {
                if (item.cancelled || item.isCompleted) return false
            } else if (filter === 'completed') {
                if (!item.isCompleted) return false
            } else if (filter === 'cancelled') {
                if (!item.cancelled) return false
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const docName = item.docData?.name?.toLowerCase() || ''
                const spec = item.docData?.speciality?.toLowerCase() || ''
                const reason = item.reasonForVisit?.toLowerCase() || ''
                return docName.includes(q) || spec.includes(q) || reason.includes(q)
            }

            return true
        })
    }, [appointments, filter, searchQuery])

    const countUpcoming = appointments.filter(a => !a.cancelled && !a.isCompleted).length
    const countCompleted = appointments.filter(a => a.isCompleted).length
    const countCancelled = appointments.filter(a => a.cancelled).length

    return (
        <div className='py-6 space-y-6 max-w-7xl mx-auto'>
            {/* Header Banner */}
            <div className='bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6'>
                <div className='space-y-1.5 max-w-xl'>
                    <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-xs font-semibold text-primary border border-sky-100'>
                        <Calendar className='w-3.5 h-3.5 text-primary' />
                        <span>Care Scheduling & Records</span>
                    </div>
                    <h1 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
                        My Consultations & Appointments
                    </h1>
                    <p className='text-xs sm:text-sm text-slate-500 leading-relaxed'>
                        Access scheduled video visits, digital prescriptions, doctor messages, and slot rescheduling.
                    </p>
                </div>

                <div className='flex flex-wrap items-center gap-2.5 shrink-0'>
                    <button
                        onClick={() => navigate('/chat')}
                        className='px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer'
                    >
                        <MessageSquare className='w-4 h-4 text-primary' />
                        <span>Doctor Messages</span>
                    </button>
                    <button
                        onClick={() => navigate('/doctors')}
                        className='px-4 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-sky-600 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer'
                    >
                        <Plus className='w-4 h-4' />
                        <span>Book New Visit</span>
                    </button>
                </div>
            </div>

            {/* Filter Tabs Bar with Search */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div className='flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none'>
                    {[
                        { id: 'all', label: 'All Consultations', count: appointments.length },
                        { id: 'upcoming', label: 'Upcoming', count: countUpcoming },
                        { id: 'completed', label: 'Completed', count: countCompleted },
                        { id: 'cancelled', label: 'Cancelled', count: countCancelled }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer whitespace-nowrap ${
                                filter === tab.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className='relative w-full sm:w-72'>
                    <Search className='w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
                    <input
                        type='text'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder='Search doctor or specialty...'
                        className='w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-primary shadow-2xs'
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                        >
                            <X className='w-3.5 h-3.5' />
                        </button>
                    )}
                </div>
            </div>

            {/* Appointment Cards List */}
            {loading ? (
                <div className='bg-white rounded-3xl border border-slate-200/90 p-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3'>
                    <div className='w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                    <span>Loading your consultation records...</span>
                </div>
            ) : filteredAppointments.length === 0 ? (
                <div className='text-center py-16 bg-white rounded-3xl border border-slate-200/90 p-8 space-y-4 shadow-xs'>
                    <div className='w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400'>
                        <Calendar className='w-6 h-6' />
                    </div>
                    <div>
                        <h3 className='font-bold text-slate-900 text-base'>No Consultations Found</h3>
                        <p className='text-xs text-slate-500 max-w-sm mx-auto mt-1'>
                            {searchQuery
                                ? "No appointments match your search keywords. Try clearing the search bar."
                                : filter === 'upcoming'
                                ? "You have no upcoming consultations scheduled right now."
                                : "No consultations recorded under this category."}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/doctors')}
                        className='px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-sky-600 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs'
                    >
                        <Plus className='w-4 h-4' />
                        <span>Find a Doctor</span>
                    </button>
                </div>
            ) : (
                <div className='space-y-4'>
                    {filteredAppointments.map((item) => {
                        const windowStatus = checkAppointmentWindow(item.slotDate, item.slotTime, paymentConfig.testMode)
                        const isOnline = isDoctorOnline && isDoctorOnline(item.docId)

                        return (
                            <div
                                key={item._id}
                                className='bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row gap-6 items-start justify-between'
                            >
                                {/* Left Section: Doctor Avatar & Status */}
                                <div className='flex items-start gap-4 w-full lg:w-auto shrink-0'>
                                    <div className='relative w-24 h-28 sm:w-28 sm:h-32 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0'>
                                        <img
                                            className='w-full h-full object-cover object-top'
                                            src={item.docData?.image}
                                            alt={item.docData?.name}
                                        />
                                    </div>

                                    {/* Doctor Details */}
                                    <div className='space-y-1.5 flex-1 min-w-0'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <h3 className='text-base font-extrabold text-slate-900 truncate'>{item.docData?.name}</h3>
                                            <span className='text-[11px] bg-sky-50 text-primary px-2.5 py-0.5 rounded-md font-semibold border border-sky-100'>
                                                {item.docData?.speciality}
                                            </span>
                                            {isOnline && (
                                                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200'>
                                                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                                                    Online
                                                </span>
                                            )}
                                        </div>

                                        <p className='text-xs text-slate-500'>
                                            {item.docData?.degree || 'MBBS'} &bull; {item.docData?.experience || 'Specialist'}
                                        </p>

                                        {/* Status Badge */}
                                        <div className='pt-1'>
                                            {item.cancelled ? (
                                                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 rounded-full border border-rose-200'>
                                                    <XCircle className='w-3 h-3' /> Cancelled
                                                </span>
                                            ) : item.isCompleted ? (
                                                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200'>
                                                    <CheckCircle2 className='w-3 h-3' /> Completed
                                                </span>
                                            ) : item.payment ? (
                                                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700 rounded-full border border-sky-200'>
                                                    <ShieldCheck className='w-3 h-3 text-sky-600' /> Confirmed & Paid
                                                </span>
                                            ) : (
                                                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full border border-amber-200'>
                                                    <AlertCircle className='w-3 h-3 text-amber-600' /> Payment Pending
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Section: Schedule & Clinical Notes */}
                                <div className='flex-1 space-y-3 w-full text-xs'>
                                    {/* Appointment Time Block */}
                                    <div className='bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-2'>
                                        <div className='flex flex-wrap items-center justify-between gap-2'>
                                            <div className='flex items-center gap-2 text-slate-900 font-bold text-sm'>
                                                <Calendar className='w-4 h-4 text-primary shrink-0' />
                                                <span>{slotDateFormat(item.slotDate)}</span>
                                                <span className='text-slate-400'>&bull;</span>
                                                <Clock className='w-4 h-4 text-sky-600 shrink-0' />
                                                <span className='font-mono'>{item.slotTime}</span>
                                            </div>
                                            {item.rescheduledAt && (
                                                <span className='px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold'>
                                                    Rescheduled
                                                </span>
                                            )}
                                        </div>

                                        <div className='flex items-center gap-2 text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-3 py-1.5 text-[11px] font-semibold'>
                                            <Video className='w-3.5 h-3.5 text-emerald-600 shrink-0' />
                                            <span>Encrypted Teleconsultation &bull; Direct Physician Link</span>
                                        </div>

                                        {item.reasonForVisit && (
                                            <div className='text-slate-600 pt-1'>
                                                <span className='font-semibold text-slate-800'>Reason:</span> {item.reasonForVisit}
                                            </div>
                                        )}

                                        <div className='text-slate-500 pt-0.5 text-[11px] flex items-center justify-between'>
                                            <span>Consultation Fee: <strong className='text-slate-900 font-mono'>{currencySymbol}{item.amount}</strong></span>
                                            {item.docData?.address?.line1 && (
                                                <span className='text-slate-400 truncate max-w-[200px]'>
                                                    Clinic: {item.docData.address.line1}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* In-Person Referral Urgency Notice */}
                                    {item.inPersonReferral && item.inPersonReferral.urgency && (
                                        <div className={`rounded-2xl p-4 border text-xs space-y-2 ${
                                            item.inPersonReferral.urgency === 'EMERGENCY'
                                                ? 'bg-rose-50 border-rose-300 text-rose-950'
                                                : item.inPersonReferral.urgency === 'URGENT'
                                                ? 'bg-amber-50 border-amber-300 text-amber-950'
                                                : 'bg-purple-50 border-purple-200 text-purple-950'
                                        }`}>
                                            <div className='flex items-center justify-between gap-2'>
                                                <div className='flex items-center gap-1.5 font-bold'>
                                                    <AlertTriangle className='w-4 h-4 text-rose-600 shrink-0' />
                                                    <span>In-Person Clinical Evaluation Recommended</span>
                                                </div>
                                                <span className='px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border bg-rose-600 text-white border-rose-600'>
                                                    {item.inPersonReferral.urgency}
                                                </span>
                                            </div>
                                            <p className='text-slate-700'>
                                                <strong>Doctor's Note:</strong> {item.inPersonReferral.reason}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Right Section: High-Priority Actions */}
                                <div className='w-full lg:w-60 space-y-2 shrink-0'>
                                    {/* Video Call Action for Active Consultation */}
                                    {!item.cancelled && !item.isCompleted && (
                                        <>
                                            {item.payment ? (
                                                windowStatus.status === 'OPEN' ? (
                                                    <button
                                                        onClick={() => navigate(`/video-call/${item._id}`)}
                                                        className='w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer animate-pulse'
                                                    >
                                                        <Video className='w-4 h-4' />
                                                        <span>Join Video Consultation</span>
                                                    </button>
                                                ) : windowStatus.status === 'TOO_EARLY' ? (
                                                    <button
                                                        onClick={() => navigate(`/video-call/${item._id}`)}
                                                        className='w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer'
                                                        title={`Opens 10m prior to slot (${item.slotTime})`}
                                                    >
                                                        <Clock className='w-4 h-4' />
                                                        <span>Waiting Room ({windowStatus.formattedRemaining})</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => openRescheduleModal(item)}
                                                        className='w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer'
                                                    >
                                                        <Clock className='w-4 h-4 text-amber-400' />
                                                        <span>Slot Expired &bull; Reschedule</span>
                                                    </button>
                                                )
                                            ) : (
                                                <button
                                                    onClick={() => setPaymentTarget(item._id)}
                                                    className='w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer'
                                                >
                                                    <Lock className='w-3.5 h-3.5 text-amber-600' />
                                                    <span>Pay to Unlock Consultation</span>
                                                </button>
                                            )}

                                            {/* Doctor Messaging Quick Chat */}
                                            <button
                                                onClick={() => setActiveChat({
                                                    appointmentId: item._id,
                                                    doctorName: item.docData?.name,
                                                    doctorImage: item.docData?.image
                                                })}
                                                className='w-full py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs'
                                            >
                                                <MessageSquare className='w-3.5 h-3.5 text-sky-600' />
                                                <span>Quick Message</span>
                                            </button>
                                        </>
                                    )}

                                    {/* Prescription Button (Visible for all stages) */}
                                    <button
                                        onClick={() => navigate(`/prescription/${item._id}`)}
                                        className='w-full py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/80 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer'
                                    >
                                        <FileText className='w-3.5 h-3.5 text-sky-600' />
                                        <span>View Prescription</span>
                                    </button>

                                    {/* Inline Payment Options when Unpaid */}
                                    {!item.cancelled && !item.payment && !item.isCompleted && (
                                        paymentTarget === item._id ? (
                                            <div className='p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-in fade-in'>
                                                <p className='text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center'>Select Payment Method</p>
                                                <button
                                                    onClick={() => appointmentRazorpay(item._id)}
                                                    className='w-full py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer shadow-2xs'
                                                >
                                                    <img className='max-w-16 max-h-4 object-contain' src={assets.razorpay_logo} alt="Razorpay" />
                                                </button>
                                                {paymentConfig.stripeEnabled && (
                                                    <button
                                                        onClick={() => appointmentStripe(item._id)}
                                                        className='w-full py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer shadow-2xs'
                                                    >
                                                        <img className='max-w-14 max-h-4 object-contain' src={assets.stripe_logo} alt="Stripe" />
                                                    </button>
                                                )}
                                                {paymentConfig.testMode && (
                                                    <button
                                                        onClick={() => handleTestPaymentBypass(item._id)}
                                                        className='w-full py-2 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer'
                                                    >
                                                        <Zap className='w-3.5 h-3.5 text-amber-600' />
                                                        <span>Skip Payment (Test Mode)</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setPaymentTarget('')}
                                                    className='w-full text-xs text-slate-400 hover:text-slate-600 text-center block pt-0.5 cursor-pointer'
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setPaymentTarget(item._id)}
                                                className='w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer'
                                            >
                                                <CreditCard className='w-3.5 h-3.5' />
                                                <span>Pay Online ({currencySymbol}{item.amount})</span>
                                            </button>
                                        )
                                    )}

                                    {/* Rating for Completed Consultation */}
                                    {item.isCompleted && (
                                        <button
                                            onClick={() => setReviewTarget({
                                                appointmentId: item._id,
                                                doctorName: item.docData?.name
                                            })}
                                            className='w-full py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl font-semibold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer'
                                        >
                                            <Star className='w-3.5 h-3.5 text-amber-500 fill-amber-400' />
                                            <span>Rate & Review Doctor</span>
                                        </button>
                                    )}

                                    {/* Reschedule & Cancel Row for Upcoming Visits */}
                                    {!item.cancelled && !item.isCompleted && (
                                        <div className='flex items-center justify-between gap-2 pt-2 border-t border-slate-100'>
                                            <button
                                                onClick={() => openRescheduleModal(item)}
                                                className='flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-primary font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer'
                                            >
                                                <Calendar className='w-3.5 h-3.5' />
                                                <span>Reschedule</span>
                                            </button>
                                            <button
                                                onClick={() => cancelAppointment(item._id)}
                                                className='py-1.5 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors cursor-pointer'
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Native HTML <dialog> for Rescheduling Appointments */}
            <dialog
                ref={rescheduleDialogRef}
                aria-labelledby="reschedule-modal-title"
                className="rounded-3xl p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs max-w-xl w-full shadow-2xl border border-slate-200/90 text-slate-900 m-auto"
                onClick={(e) => {
                    if (e.target === rescheduleDialogRef.current && !rescheduling) closeRescheduleModal()
                }}
            >
                {rescheduleTarget && (
                    <div className='p-6 sm:p-7 space-y-5'>
                        {/* Modal Header */}
                        <div className='flex items-start justify-between gap-4 pb-4 border-b border-slate-100'>
                            <div className='flex items-center gap-3'>
                                <img
                                    src={rescheduleTarget.docData?.image}
                                    alt={rescheduleTarget.docData?.name}
                                    className='w-12 h-12 rounded-2xl object-cover bg-slate-100 border border-slate-200'
                                />
                                <div>
                                    <h3 id="reschedule-modal-title" className='text-base font-extrabold text-slate-900'>
                                        Reschedule Consultation Slot
                                    </h3>
                                    <p className='text-xs text-slate-500'>
                                        {rescheduleTarget.docData?.name} &bull; Current:{' '}
                                        <strong className='text-slate-700 font-mono'>
                                            {slotDateFormat(rescheduleTarget.slotDate)} at {rescheduleTarget.slotTime}
                                        </strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeRescheduleModal}
                                className='p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer'
                                aria-label="Close"
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* Step 1: Select New Date */}
                        <div className='space-y-2'>
                            <p className='text-xs font-bold text-slate-800 flex items-center gap-1.5'>
                                <Calendar className='w-3.5 h-3.5 text-primary' />
                                <span>1. Select New Date</span>
                            </p>
                            <div className='flex gap-2 overflow-x-auto pb-1 scrollbar-none'>
                                {rescheduleSlots.map((daySlots, idx) => {
                                    const dateObj = daySlots[0]?.datetime
                                    if (!dateObj) return null
                                    const selected = rescheduleDayIdx === idx
                                    const hasSlots = daySlots.length > 0

                                    return (
                                        <button
                                            key={idx}
                                            type='button'
                                            onClick={() => {
                                                setRescheduleDayIdx(idx)
                                                setRescheduleTime('')
                                            }}
                                            className={`flex flex-col items-center justify-center min-w-[72px] py-2.5 px-3 rounded-2xl border text-xs transition-all cursor-pointer ${
                                                selected
                                                    ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                                                    : hasSlots
                                                    ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                    : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-50'
                                            }`}
                                        >
                                            <span className={`text-[10px] uppercase font-bold ${selected ? 'text-slate-300' : 'text-slate-400'}`}>
                                                {DAYS_OF_WEEK[dateObj.getDay()]}
                                            </span>
                                            <span className='text-base font-extrabold mt-0.5 font-mono tabular-nums'>{dateObj.getDate()}</span>
                                            <span className={`text-[10px] ${selected ? 'text-slate-300' : 'text-slate-400'}`}>
                                                {MONTHS[dateObj.getMonth()]}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Step 2: Select Grouped Time Slot */}
                        <div className='space-y-3 pt-2 border-t border-slate-100'>
                            <div className='flex items-center justify-between'>
                                <p className='text-xs font-bold text-slate-800 flex items-center gap-1.5'>
                                    <Clock className='w-3.5 h-3.5 text-primary' />
                                    <span>2. Select Time ({rescheduleSlots[rescheduleDayIdx]?.length || 0} slots open)</span>
                                </p>
                            </div>

                            {rescheduleSlots[rescheduleDayIdx]?.length === 0 ? (
                                <p className='text-xs text-slate-500 italic py-3'>No slots open on this date. Select another day above.</p>
                            ) : (
                                <div className='space-y-3 max-h-48 overflow-y-auto pr-1'>
                                    {/* Morning */}
                                    {rescheduleGroupedSlots.morning.length > 0 && (
                                        <div className='space-y-1.5'>
                                            <span className='text-[11px] font-bold text-slate-500 flex items-center gap-1'>
                                                <Sun className='w-3 h-3 text-amber-500' /> Morning
                                            </span>
                                            <div className='flex flex-wrap gap-2'>
                                                {rescheduleGroupedSlots.morning.map((slot, idx) => (
                                                    <button
                                                        key={idx}
                                                        type='button'
                                                        onClick={() => setRescheduleTime(slot.time)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tabular-nums border transition-all cursor-pointer ${
                                                            rescheduleTime === slot.time
                                                                ? 'bg-primary text-white border-primary shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-primary'
                                                        }`}
                                                    >
                                                        {slot.time}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Afternoon */}
                                    {rescheduleGroupedSlots.afternoon.length > 0 && (
                                        <div className='space-y-1.5'>
                                            <span className='text-[11px] font-bold text-slate-500 flex items-center gap-1'>
                                                <SunMedium className='w-3 h-3 text-orange-500' /> Afternoon
                                            </span>
                                            <div className='flex flex-wrap gap-2'>
                                                {rescheduleGroupedSlots.afternoon.map((slot, idx) => (
                                                    <button
                                                        key={idx}
                                                        type='button'
                                                        onClick={() => setRescheduleTime(slot.time)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tabular-nums border transition-all cursor-pointer ${
                                                            rescheduleTime === slot.time
                                                                ? 'bg-primary text-white border-primary shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-primary'
                                                        }`}
                                                    >
                                                        {slot.time}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evening */}
                                    {rescheduleGroupedSlots.evening.length > 0 && (
                                        <div className='space-y-1.5'>
                                            <span className='text-[11px] font-bold text-slate-500 flex items-center gap-1'>
                                                <Moon className='w-3 h-3 text-indigo-500' /> Evening
                                            </span>
                                            <div className='flex flex-wrap gap-2'>
                                                {rescheduleGroupedSlots.evening.map((slot, idx) => (
                                                    <button
                                                        key={idx}
                                                        type='button'
                                                        onClick={() => setRescheduleTime(slot.time)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono tabular-nums border transition-all cursor-pointer ${
                                                            rescheduleTime === slot.time
                                                                ? 'bg-primary text-white border-primary shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-primary'
                                                        }`}
                                                    >
                                                        {slot.time}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className='pt-3 border-t border-slate-100 flex items-center justify-between gap-3'>
                            <p className='text-[11px] text-slate-400'>
                                Payment status and consultation history will remain intact.
                            </p>
                            <div className='flex items-center gap-2 shrink-0'>
                                <button
                                    type='button'
                                    onClick={closeRescheduleModal}
                                    className='px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer'
                                >
                                    Cancel
                                </button>
                                <button
                                    type='button'
                                    disabled={!rescheduleTime || rescheduling}
                                    onClick={handleConfirmReschedule}
                                    className='px-5 py-2 rounded-xl bg-primary hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer'
                                >
                                    {rescheduling ? 'Updating...' : 'Confirm New Slot'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </dialog>

            {/* Quick Chat Modal */}
            {activeChat && (
                <ChatWindow
                    appointmentId={activeChat.appointmentId}
                    doctorName={activeChat.doctorName}
                    doctorImage={activeChat.doctorImage}
                    onClose={() => setActiveChat(null)}
                />
            )}

            {/* Review Modal */}
            {reviewTarget && (
                <ReviewModal
                    appointmentId={reviewTarget.appointmentId}
                    doctorName={reviewTarget.doctorName}
                    onClose={() => setReviewTarget(null)}
                    onSubmitted={() => getUserAppointments()}
                />
            )}
        </div>
    )
}

export default MyAppointments