import React, { useContext, useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import ReviewSection from '../components/ReviewSection'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  Clock,
  Calendar,
  ShieldCheck,
  Info,
  ArrowRight,
  Video,
  ClipboardList,
  Sparkles,
  Lock,
  Zap,
  Check,
  CalendarCheck,
  Sun,
  SunMedium,
  Moon,
  MapPin,
  BadgeCheck
} from 'lucide-react'

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const QUICK_REASONS = [
  'General Checkup',
  'Follow-up Consultation',
  'Lab Report Review',
  'Fever / Cold / Cough',
  'Prescription Renewal',
  'Chronic Condition Review'
]

const Appointment = () => {
    const { docId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { doctors, currencySymbol, backendUrl, token, getDoctosData } = useContext(AppContext)

    const [docInfo, setDocInfo] = useState(null)
    const [docSlots, setDocSlots] = useState([])
    const [slotIndex, setSlotIndex] = useState(0)
    const [slotTime, setSlotTime] = useState('')
    const [reasonForVisit, setReasonForVisit] = useState(location.state?.prefilledSymptoms || '')
    const [booking, setBooking] = useState(false)
    const [paymentConfig, setPaymentConfig] = useState({ testMode: false, razorpayEnabled: true, stripeEnabled: false })
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('razorpay')

    const fetchDocInfo = () => {
        const foundDoc = doctors.find((doc) => doc._id === docId)
        setDocInfo(foundDoc)
    }

    const getAvailableSlots = () => {
        if (!docInfo) return
        setDocSlots([])

        let today = new Date()
        let slotsByDay = []

        for (let i = 0; i < 7; i++) {
            let currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            let endTime = new Date(today)
            endTime.setDate(today.getDate() + i)
            endTime.setHours(21, 0, 0, 0)

            if (today.getDate() === currentDate.getDate()) {
                currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
                currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
            } else {
                currentDate.setHours(10)
                currentDate.setMinutes(0)
            }

            let timeSlots = []

            while (currentDate < endTime) {
                let formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                let day = currentDate.getDate()
                let month = currentDate.getMonth() + 1
                let year = currentDate.getFullYear()

                const slotDate = `${day}_${month}_${year}`
                const isSlotAvailable = !(docInfo.slots_booked && docInfo.slots_booked[slotDate]?.includes(formattedTime))

                if (isSlotAvailable) {
                    timeSlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime,
                        hours: currentDate.getHours()
                    })
                }

                currentDate.setMinutes(currentDate.getMinutes() + 30)
            }

            slotsByDay.push(timeSlots)
        }

        setDocSlots(slotsByDay)
    }

    const fetchPaymentConfig = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/payment-config`)
            if (data.success) {
                setPaymentConfig(data)
                if (data.testMode) {
                    setSelectedPaymentMethod('test')
                } else if (data.razorpayEnabled) {
                    setSelectedPaymentMethod('razorpay')
                } else if (data.stripeEnabled) {
                    setSelectedPaymentMethod('stripe')
                }
            }
        } catch (error) {
            console.error('Failed to get payment config:', error)
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
            description: `Teleconsultation with ${docInfo?.name || 'Doctor'}`,
            order_id: order.id,
            receipt: order.receipt,
            handler: async (response) => {
                try {
                    const { data } = await axios.post(`${backendUrl}/api/user/verifyRazorpay`, response, { headers: { token } })
                    if (data.success) {
                        toast.success("Payment verified! Your consultation is confirmed.")
                        getDoctosData()
                        navigate('/my-appointments')
                    } else {
                        toast.error(data.message || "Payment verification failed")
                        navigate('/my-appointments')
                    }
                } catch (error) {
                    console.error(error)
                    toast.error(error.message)
                    navigate('/my-appointments')
                }
            },
            modal: {
                ondismiss: () => {
                    toast.info("Payment window closed. Appointment pending in My Appointments.")
                    navigate('/my-appointments')
                }
            }
        }
        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', function (response) {
            toast.error(response.error?.description || "Payment Failed")
            navigate('/my-appointments')
        })
        rzp.open()
    }

    const handleBookAndPay = async () => {
        if (!token) {
            toast.warning('Please sign in to schedule an appointment')
            return navigate('/login')
        }

        if (!slotTime) {
            return toast.warning('Please select an available consultation time slot')
        }

        const date = docSlots[slotIndex]?.[0]?.datetime
        if (!date) return toast.error('Selected date has no available slots')

        let day = date.getDate()
        let month = date.getMonth() + 1
        let year = date.getFullYear()
        const slotDate = `${day}_${month}_${year}`

        const isTest = selectedPaymentMethod === 'test'

        setBooking(true)
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/user/book-appointment`,
                {
                    docId,
                    slotDate,
                    slotTime,
                    reasonForVisit: reasonForVisit.trim(),
                    testBypass: isTest
                },
                { headers: { token } }
            )

            if (!data.success) {
                setBooking(false)
                return toast.error(data.message)
            }

            const appointmentId = data.appointmentId

            if (isTest) {
                toast.success('Consultation confirmed! (Test Mode Bypass)')
                getDoctosData()
                setBooking(false)
                return navigate('/my-appointments')
            }

            if (selectedPaymentMethod === 'razorpay') {
                const payRes = await axios.post(
                    `${backendUrl}/api/user/payment-razorpay`,
                    { appointmentId },
                    { headers: { token } }
                )
                if (payRes.data.success) {
                    initPay(payRes.data.order, payRes.data.key_id)
                } else {
                    toast.error(payRes.data.message || 'Failed to initialize payment')
                    navigate('/my-appointments')
                }
                setBooking(false)
                return
            }

            if (selectedPaymentMethod === 'stripe') {
                const payRes = await axios.post(
                    `${backendUrl}/api/user/payment-stripe`,
                    { appointmentId },
                    { headers: { token } }
                )
                if (payRes.data.success) {
                    window.location.replace(payRes.data.session_url)
                } else {
                    toast.error(payRes.data.message || 'Failed to initialize Stripe')
                    navigate('/my-appointments')
                }
                setBooking(false)
                return
            }

            toast.success('Consultation booked successfully!')
            getDoctosData()
            navigate('/my-appointments')
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        } finally {
            setBooking(false)
        }
    }

    useEffect(() => {
        fetchPaymentConfig()
    }, [backendUrl])

    useEffect(() => {
        if (doctors.length > 0) {
            fetchDocInfo()
        }
    }, [doctors, docId])

    useEffect(() => {
        if (docInfo) {
            getAvailableSlots()
        }
    }, [docInfo])

    // Group selected day's slots by time of day
    const groupedSlots = useMemo(() => {
        const slots = docSlots[slotIndex] || []
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
    }, [docSlots, slotIndex])

    const selectedDateObj = docSlots[slotIndex]?.[0]?.datetime

    if (!docInfo) {
        return (
            <div className='py-24 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3'>
                <div className='w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                <span>Loading specialist consultation profile...</span>
            </div>
        )
    }

    return (
        <div className='py-6 space-y-8 max-w-7xl mx-auto'>
            {/* Top Back Navigation & Breadcrumb */}
            <div className='flex items-center gap-2 text-xs text-slate-500'>
                <button
                    onClick={() => navigate('/doctors')}
                    className='text-slate-600 hover:text-primary transition-colors cursor-pointer'
                >
                    Specialists Directory
                </button>
                <span>&bull;</span>
                <span className='text-slate-400'>{docInfo.speciality}</span>
                <span>&bull;</span>
                <span className='font-semibold text-slate-800'>{docInfo.name}</span>
            </div>

            {/* Main Booking Two-Column Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'>
                
                {/* LEFT COLUMN: Doctor Bio & Slot Picker (approx 65%) */}
                <div className='lg:col-span-8 space-y-6'>
                    {/* Doctor Header Profile Card */}
                    <div className='bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row gap-6 items-start'>
                        {/* Portrait */}
                        <div className='w-full sm:w-52 shrink-0'>
                            <div className='relative rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-[3/4]'>
                                <img
                                    className='w-full h-full object-cover object-top'
                                    src={docInfo.image}
                                    alt={docInfo.name}
                                />
                                <div className='absolute bottom-3 left-3'>
                                    <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/95 text-emerald-800 text-[11px] font-semibold border border-emerald-200/90 backdrop-blur-md shadow-2xs'>
                                        <BadgeCheck className='w-3.5 h-3.5 text-emerald-600' />
                                        <span>Verified Doctor</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Credentials & Bio */}
                        <div className='flex-1 space-y-4'>
                            <div>
                                <div className='flex flex-wrap items-center gap-2 mb-2'>
                                    <span className='px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-primary border border-sky-100'>
                                        {docInfo.speciality}
                                    </span>
                                    <span className='px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200'>
                                        {docInfo.experience} Experience
                                    </span>
                                    <span className='px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200'>
                                        Telehealth Ready
                                    </span>
                                </div>

                                <h1 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
                                    {docInfo.name}
                                </h1>
                                <p className='text-xs font-medium text-slate-500 mt-1 flex items-center gap-2'>
                                    <span>Qualifications: <strong className='text-slate-800 font-semibold'>{docInfo.degree || 'MBBS, MD'}</strong></span>
                                </p>
                                <p className='text-xs text-slate-400 mt-0.5 flex items-center gap-1.5'>
                                    <MapPin className='w-3.5 h-3.5 text-slate-400 shrink-0' />
                                    <span>{docInfo.address?.line1 || 'Online Telehealth & Video Consultation'}</span>
                                </p>
                            </div>

                            {/* About Section */}
                            <div className='pt-3 border-t border-slate-100 space-y-1.5'>
                                <h3 className='text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5'>
                                    <Info className='w-3.5 h-3.5 text-primary' />
                                    <span>Clinical Background & Specialties</span>
                                </h3>
                                <p className='text-xs sm:text-sm text-slate-600 leading-relaxed'>
                                    {docInfo.about}
                                </p>
                            </div>

                            {/* Telemedicine Feature Guarantee */}
                            <div className='pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium'>
                                <span className='flex items-center gap-1.5'>
                                    <Video className='w-4 h-4 text-emerald-600' />
                                    <span>Encrypted Video Call</span>
                                </span>
                                <span className='flex items-center gap-1.5'>
                                    <ShieldCheck className='w-4 h-4 text-primary' />
                                    <span>Digital Rx Prescription</span>
                                </span>
                                <span className='flex items-center gap-1.5'>
                                    <CalendarCheck className='w-4 h-4 text-indigo-600' />
                                    <span>Google Calendar Invite</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive 7-Day Date & Time Slot Selector */}
                    <div className='bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6'>
                        <div className='space-y-1'>
                            <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-xs font-semibold text-primary border border-sky-100'>
                                <Calendar className='w-3.5 h-3.5 text-primary' />
                                <span>Appointment Schedule</span>
                            </div>
                            <h2 className='text-xl font-bold text-slate-900 tracking-tight pt-1'>
                                Select Consultation Date & Time
                            </h2>
                            <p className='text-xs sm:text-sm text-slate-500'>
                                Choose a convenient day and 30-minute consultation window.
                            </p>
                        </div>

                        {/* 7-Day Calendar Carousel */}
                        <div>
                            <div className='flex items-center justify-between text-xs text-slate-500 mb-2.5 font-medium'>
                                <span>Upcoming 7 Days</span>
                                <span>Step 1 of 2: Select Date</span>
                            </div>
                            <div className='flex gap-2.5 overflow-x-auto pb-2 scrollbar-none'>
                                {docSlots.map((daySlots, index) => {
                                    const dateObj = daySlots[0]?.datetime
                                    if (!dateObj) return null
                                    const isSelected = slotIndex === index
                                    const hasOpenSlots = daySlots.length > 0

                                    return (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setSlotIndex(index)
                                                setSlotTime('')
                                            }}
                                            className={`flex flex-col items-center justify-center min-w-[85px] py-3.5 px-3 rounded-2xl border text-xs transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md font-semibold'
                                                    : hasOpenSlots
                                                    ? 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    : 'bg-slate-50 text-slate-400 border-slate-200/60 opacity-60'
                                            }`}
                                        >
                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                                {DAYS_OF_WEEK[dateObj.getDay()]}
                                            </span>
                                            <span className='text-xl font-extrabold mt-0.5 font-mono tabular-nums'>
                                                {dateObj.getDate()}
                                            </span>
                                            <span className={`text-[11px] font-medium ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                                {MONTH_NAMES[dateObj.getMonth()]}
                                            </span>
                                            <span className={`text-[9px] mt-1 px-1.5 py-0.2 rounded-full ${
                                                isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : hasOpenSlots
                                                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {hasOpenSlots ? `${daySlots.length} open` : 'Full'}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Grouped Time Slots (Morning, Afternoon, Evening) */}
                        <div className='pt-4 border-t border-slate-100 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <span className='text-xs font-semibold text-slate-700 flex items-center gap-1.5'>
                                    <Clock className='w-4 h-4 text-primary' />
                                    <span>Available Time Slots for {selectedDateObj?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                </span>
                                <span className='text-xs text-slate-500 font-mono'>
                                    {docSlots[slotIndex]?.length || 0} slots available
                                </span>
                            </div>

                            {docSlots[slotIndex]?.length === 0 ? (
                                <div className='py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5'>
                                    <p className='text-xs font-semibold text-slate-700'>No Consultation Slots Open for this Date</p>
                                    <p className='text-[11px] text-slate-500'>Please select another day from the calendar row above.</p>
                                </div>
                            ) : (
                                <div className='space-y-4'>
                                    {/* Morning Slots */}
                                    {groupedSlots.morning.length > 0 && (
                                        <div className='space-y-2'>
                                            <div className='flex items-center gap-1.5 text-xs font-bold text-slate-700'>
                                                <Sun className='w-3.5 h-3.5 text-amber-500' />
                                                <span>Morning (10:00 AM – 12:00 PM)</span>
                                            </div>
                                            <div className='flex flex-wrap gap-2'>
                                                {groupedSlots.morning.map((item, idx) => {
                                                    const isSelected = item.time === slotTime
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setSlotTime(item.time)}
                                                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono tabular-nums transition-all border cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'
                                                            }`}
                                                        >
                                                            {item.time}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Afternoon Slots */}
                                    {groupedSlots.afternoon.length > 0 && (
                                        <div className='space-y-2'>
                                            <div className='flex items-center gap-1.5 text-xs font-bold text-slate-700'>
                                                <SunMedium className='w-3.5 h-3.5 text-orange-500' />
                                                <span>Afternoon (12:00 PM – 5:00 PM)</span>
                                            </div>
                                            <div className='flex flex-wrap gap-2'>
                                                {groupedSlots.afternoon.map((item, idx) => {
                                                    const isSelected = item.time === slotTime
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setSlotTime(item.time)}
                                                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono tabular-nums transition-all border cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'
                                                            }`}
                                                        >
                                                            {item.time}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evening Slots */}
                                    {groupedSlots.evening.length > 0 && (
                                        <div className='space-y-2'>
                                            <div className='flex items-center gap-1.5 text-xs font-bold text-slate-700'>
                                                <Moon className='w-3.5 h-3.5 text-indigo-500' />
                                                <span>Evening (5:00 PM – 9:00 PM)</span>
                                            </div>
                                            <div className='flex flex-wrap gap-2'>
                                                {groupedSlots.evening.map((item, idx) => {
                                                    const isSelected = item.time === slotTime
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setSlotTime(item.time)}
                                                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono tabular-nums transition-all border cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-primary text-white border-primary shadow-xs ring-2 ring-primary/20'
                                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary'
                                                            }`}
                                                        >
                                                            {item.time}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Reason for Visit & Clinical Symptom Chips */}
                        <div className='pt-6 border-t border-slate-100 space-y-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <label htmlFor='visit-reason-input' className='text-xs font-bold text-slate-800 flex items-center gap-1.5'>
                                    <ClipboardList className='w-4 h-4 text-primary' />
                                    <span>Reason for Consultation / Symptoms</span>
                                </label>
                                {location.state?.prefilledSymptoms && (
                                    <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-primary border border-sky-200 text-[11px] font-semibold'>
                                        <Sparkles className='w-3 h-3' /> AI Symptom Checker prefill
                                    </span>
                                )}
                            </div>

                            <span className='text-[11px] text-slate-500 block'>
                                Click a common reason or enter your specific health concern for the doctor.
                            </span>

                            {/* Quick Reason Chips */}
                            <div className='flex flex-wrap gap-2'>
                                {QUICK_REASONS.map((chip) => {
                                    const active = reasonForVisit === chip
                                    return (
                                        <button
                                            key={chip}
                                            type='button'
                                            onClick={() => setReasonForVisit(active ? '' : chip)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                                                active
                                                    ? 'bg-sky-50 text-primary border-primary font-semibold'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            {chip}
                                        </button>
                                    )
                                })}
                            </div>

                            <input
                                id='visit-reason-input'
                                type='text'
                                value={reasonForVisit}
                                onChange={(e) => setReasonForVisit(e.target.value)}
                                maxLength={220}
                                placeholder='Describe your symptoms or goals for this visit...'
                                className='w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-primary outline-none text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-colors'
                            />
                        </div>
                    </div>

                    {/* Patient Reviews Section */}
                    <ReviewSection docId={docId} />

                    {/* Related Specialists in the Same Department */}
                    <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
                </div>

                {/* RIGHT COLUMN: Sticky Booking Summary & Checkout Card (approx 35%) */}
                <div className='lg:col-span-4 sticky top-24 space-y-4'>
                    <div className='bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-5'>
                        {/* Summary Header */}
                        <div className='pb-4 border-b border-slate-100 flex items-center justify-between'>
                            <h3 className='text-sm font-bold text-slate-900'>Consultation Summary</h3>
                            <span className='px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200'>
                                30 Min Video Visit
                            </span>
                        </div>

                        {/* Doctor mini thumbnail */}
                        <div className='flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-100'>
                            <img
                                src={docInfo.image}
                                alt={docInfo.name}
                                className='w-12 h-12 rounded-xl object-cover bg-slate-200 border border-slate-300/80 shrink-0'
                            />
                            <div className='min-w-0'>
                                <h4 className='text-xs font-bold text-slate-900 truncate'>{docInfo.name}</h4>
                                <p className='text-[11px] text-slate-500 truncate'>{docInfo.speciality}</p>
                                <p className='text-[10px] text-primary font-semibold'>{docInfo.experience} Experience</p>
                            </div>
                        </div>

                        {/* Selected Appointment Slot Box */}
                        <div className='space-y-1.5 bg-sky-50/50 border border-sky-100 p-3.5 rounded-2xl'>
                            <span className='text-[11px] font-semibold text-slate-500 uppercase tracking-wider block'>
                                Scheduled Time
                            </span>
                            {slotTime && selectedDateObj ? (
                                <div className='space-y-0.5'>
                                    <div className='text-sm font-bold text-slate-900 flex items-center gap-1.5'>
                                        <Calendar className='w-4 h-4 text-sky-600' />
                                        <span>{selectedDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                    <div className='text-xs font-semibold text-sky-700 flex items-center gap-1.5 font-mono'>
                                        <Clock className='w-3.5 h-3.5 text-sky-600' />
                                        <span>{slotTime} (IST)</span>
                                    </div>
                                </div>
                            ) : (
                                <p className='text-xs text-amber-700 font-medium italic'>
                                    Please select a date and time slot from the schedule.
                                </p>
                            )}
                        </div>

                        {/* Transparent Price Breakdown */}
                        <div className='space-y-2 pt-2 border-t border-slate-100 text-xs'>
                            <div className='flex items-center justify-between text-slate-600'>
                                <span>Physician Consultation Fee</span>
                                <span className='font-mono font-semibold text-slate-900'>{currencySymbol}{docInfo.fees}</span>
                            </div>
                            <div className='flex items-center justify-between text-slate-600'>
                                <span>Telemedicine HD Room Service</span>
                                <span className='font-semibold text-emerald-600 font-mono'>Free</span>
                            </div>
                            <div className='flex items-center justify-between text-slate-600'>
                                <span>Digital Rx & Calendar Delivery</span>
                                <span className='font-semibold text-emerald-600 font-mono'>Free</span>
                            </div>
                            <div className='pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-extrabold text-slate-900'>
                                <span>Total Amount Payable</span>
                                <span className='text-lg font-mono text-primary'>{currencySymbol}{docInfo.fees}</span>
                            </div>
                        </div>

                        {/* Payment Selection Options */}
                        <div className='space-y-2 pt-2 border-t border-slate-100'>
                            <span className='text-[11px] font-bold text-slate-700 uppercase tracking-wider block'>
                                Payment Method
                            </span>

                            <div className='space-y-2'>
                                {/* Razorpay Option */}
                                <button
                                    type='button'
                                    onClick={() => setSelectedPaymentMethod('razorpay')}
                                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                        selectedPaymentMethod === 'razorpay'
                                            ? 'border-primary bg-sky-50/60 ring-2 ring-primary/20 shadow-2xs'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className='flex items-center gap-2.5'>
                                        <img className='h-4 object-contain' src={assets.razorpay_logo} alt="Razorpay" />
                                        <span className='text-xs font-semibold text-slate-800'>UPI / Cards / NetBanking</span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        selectedPaymentMethod === 'razorpay' ? 'border-primary bg-primary text-white' : 'border-slate-300'
                                    }`}>
                                        {selectedPaymentMethod === 'razorpay' && <Check className='w-3 h-3 stroke-[3]' />}
                                    </div>
                                </button>

                                {/* Stripe Option (if enabled) */}
                                {paymentConfig.stripeEnabled && (
                                    <button
                                        type='button'
                                        onClick={() => setSelectedPaymentMethod('stripe')}
                                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                            selectedPaymentMethod === 'stripe'
                                                ? 'border-primary bg-sky-50/60 ring-2 ring-primary/20 shadow-2xs'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className='flex items-center gap-2.5'>
                                            <img className='h-4 object-contain' src={assets.stripe_logo} alt="Stripe" />
                                            <span className='text-xs font-semibold text-slate-800'>International Card</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            selectedPaymentMethod === 'stripe' ? 'border-primary bg-primary text-white' : 'border-slate-300'
                                        }`}>
                                            {selectedPaymentMethod === 'stripe' && <Check className='w-3 h-3 stroke-[3]' />}
                                        </div>
                                    </button>
                                )}

                                {/* Dev Test Mode Bypass Option */}
                                {paymentConfig.testMode && (
                                    <button
                                        type='button'
                                        onClick={() => setSelectedPaymentMethod('test')}
                                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                                            selectedPaymentMethod === 'test'
                                                ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-400/30'
                                                : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                                        }`}
                                    >
                                        <div className='flex items-center gap-2'>
                                            <Zap className='w-3.5 h-3.5 text-amber-600' />
                                            <div>
                                                <p className='text-xs font-bold text-amber-900'>Dev Test Bypass</p>
                                                <p className='text-[10px] text-amber-700'>Instant scheduling without payment</p>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            selectedPaymentMethod === 'test' ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-300'
                                        }`}>
                                            {selectedPaymentMethod === 'test' && <Check className='w-3 h-3 stroke-[3]' />}
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Confirmation Button */}
                        <div className='pt-2'>
                            <button
                                onClick={handleBookAndPay}
                                disabled={booking || !slotTime}
                                className='w-full py-3.5 bg-primary hover:bg-sky-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer'
                            >
                                <span>
                                    {booking
                                        ? 'Processing Booking...'
                                        : !slotTime
                                        ? 'Select a Time Slot'
                                        : selectedPaymentMethod === 'test'
                                        ? 'Confirm Visit (Test Mode)'
                                        : `Pay ${currencySymbol}${docInfo.fees} & Book Visit`}
                                </span>
                                <ArrowRight className='w-4 h-4' />
                            </button>
                        </div>

                        {/* Trust & Guarantee Notes */}
                        <div className='space-y-1.5 pt-2 text-[11px] text-slate-500 border-t border-slate-100'>
                            <div className='flex items-center gap-1.5'>
                                <Lock className='w-3.5 h-3.5 text-emerald-600' />
                                <span>256-bit encrypted medical consultation</span>
                            </div>
                            <div className='flex items-center gap-1.5'>
                                <CalendarCheck className='w-3.5 h-3.5 text-sky-600' />
                                <span>Instant Google Calendar invite sent to email</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Appointment