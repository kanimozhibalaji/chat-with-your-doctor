import React, { useState, useEffect, useContext, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import HealthDashboard, { ClinicalRangeBar } from './HealthDashboard'
import MedicalRecords from './MedicalRecords'
import StandaloneVitals from '../components/StandaloneVitals'
import { checkAppointmentWindow } from '../utils/appointmentTime'
import {
    Activity,
    LineChart,
    FileText,
    HeartPulse,
    ShieldCheck,
    Sparkles,
    Calendar,
    Clock,
    Video,
    MessageSquare,
    Plus,
    ChevronRight,
    TrendingUp,
    Stethoscope,
    UploadCloud
} from 'lucide-react'

const HealthHub = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { token, backendUrl, userData } = useContext(AppContext)

    // Current active tab: 'overview' | 'trends' | 'records' | 'vitals'
    const rawTab = searchParams.get('tab') || 'overview'
    // Backward compatibility: 'dashboard' -> 'trends'
    const tabParam = rawTab === 'dashboard' ? 'trends' : rawTab
    const [activeTab, setActiveTab] = useState(tabParam)

    // Data states for the dashboard
    const [trends, setTrends] = useState([])
    const [score, setScore] = useState(100)
    const [appointments, setAppointments] = useState([])
    const [vitalsHistory, setVitalsHistory] = useState([])
    const [records, setRecords] = useState([])
    const [loadingData, setLoadingData] = useState(true)

    // Sync tab with URL
    useEffect(() => {
        if (tabParam && tabParam !== activeTab) {
            setActiveTab(tabParam)
        }
    }, [tabParam])

    const handleTabChange = (tabId) => {
        setActiveTab(tabId)
        setSearchParams({ tab: tabId })
    }

    // Fetch all user health data in parallel
    const loadDashboardData = async () => {
        if (!token) return
        setLoadingData(true)

        try {
            const [trendsRes, apptsRes, vitalsRes, recordsRes] = await Promise.allSettled([
                axios.get(`${backendUrl}/api/health/trends`, { headers: { token } }),
                axios.get(`${backendUrl}/api/user/appointments`, { headers: { token } }),
                axios.get(`${backendUrl}/api/vitals/history`, { headers: { token } }),
                axios.post(`${backendUrl}/api/records/list`, {}, { headers: { token } })
            ])

            if (trendsRes.status === 'fulfilled' && trendsRes.value.data.success) {
                setTrends(trendsRes.value.data.trends || [])
                setScore(trendsRes.value.data.cardiometabolicScore || 100)
            }

            if (apptsRes.status === 'fulfilled' && apptsRes.value.data.success) {
                setAppointments(apptsRes.value.data.appointments || [])
            }

            if (vitalsRes.status === 'fulfilled' && vitalsRes.value.data.success) {
                setVitalsHistory(vitalsRes.value.data.vitals || [])
            }

            if (recordsRes.status === 'fulfilled' && recordsRes.value.data.success) {
                setRecords(recordsRes.value.data.records || [])
            }
        } catch (err) {
            console.error('Error loading patient dashboard data:', err)
        } finally {
            setLoadingData(false)
        }
    }

    useEffect(() => {
        loadDashboardData()
    }, [token])

    // Find next upcoming appointment
    const nextAppointment = useMemo(() => {
        if (!appointments || appointments.length === 0) return null
        const active = appointments.filter(a => !a.cancelled && !a.isCompleted)
        if (active.length === 0) return null

        return active.sort((a, b) => {
            const [d1, m1, y1] = a.slotDate.split('_').map(Number)
            const [d2, m2, y2] = b.slotDate.split('_').map(Number)
            const dateA = new Date(y1, (m1 || 1) - 1, d1)
            const dateB = new Date(y2, (m2 || 1) - 1, d2)
            return dateA - dateB
        })[0]
    }, [appointments])

    // Check appointment window for next appointment
    const nextApptWindow = useMemo(() => {
        if (!nextAppointment) return null
        return checkAppointmentWindow(nextAppointment.slotDate, nextAppointment.slotTime)
    }, [nextAppointment])

    // Latest heart rate from vitals history or fallback
    const latestHeartRate = useMemo(() => {
        if (vitalsHistory && vitalsHistory.length > 0) {
            return vitalsHistory[0].heartRate || vitalsHistory[0].bpm || 72
        }
        return 72
    }, [vitalsHistory])

    // Latest Glucose
    const glucoseTrend = useMemo(() => {
        return trends.find(t => t.key === 'glucose') || null
    }, [trends])

    // Latest Cholesterol
    const lipidTrend = useMemo(() => {
        return trends.find(t => t.key === 'cholesterol') || null
    }, [trends])

    // Latest Creatinine
    const renalTrend = useMemo(() => {
        return trends.find(t => t.key === 'creatinine') || null
    }, [trends])

    // Time of day greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 17) return 'Good afternoon'
        return 'Good evening'
    }, [])

    const patientFirstName = userData?.name ? userData.name.split(' ')[0] : 'Patient'

    // Format slot date
    const formatSlotDisplay = (slotDate, slotTime) => {
        if (!slotDate) return ''
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const parts = slotDate.split('_')
        const day = parts[0]
        const month = months[Number(parts[1]) - 1] || parts[1]
        const year = parts[2]
        return `${day} ${month} ${year}${slotTime ? ` at ${slotTime}` : ''}`
    }

    const tabs = [
        {
            id: 'overview',
            label: 'Overview & Care Plan',
            sublabel: 'Health score, upcoming consultation, and key vital gauges',
            icon: Activity,
            badge: 'Summary'
        },
        {
            id: 'trends',
            label: 'Biomarkers & Trends',
            sublabel: 'Longitudinal charts, normal envelopes & 30-day projections',
            icon: LineChart,
            badge: 'Analytics'
        },
        {
            id: 'records',
            label: 'Medical Reports',
            sublabel: 'Upload lab tests, OCR extraction & AI summaries',
            icon: FileText,
            badge: `${records.length} Reports`
        },
        {
            id: 'vitals',
            label: 'Heart Rate Scan',
            sublabel: 'Optical pulse measurement via camera sensor',
            icon: HeartPulse,
            badge: 'Instant rPPG'
        }
    ]

    const getScoreBadge = (sc) => {
        if (sc >= 85) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Optimal Health Profile' }
        if (sc >= 70) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate — Monitor Trends' }
        return { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Doctor Review Recommended' }
    }

    const scoreBadge = getScoreBadge(score)

    return (
        <div className="min-h-[85vh] py-6 max-w-6xl mx-auto space-y-6">
            {/* Patient Identity & Welcome Banner */}
            <header className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xs">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
                                <Sparkles className="w-3.5 h-3.5" /> Patient Command Center
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-slate-300 bg-slate-800/80 border border-slate-700/60">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Clinical Data Encrypted
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/50">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active Care Profile
                            </span>
                        </div>

                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                                {greeting}, {patientFirstName}
                            </h1>
                            <p className="text-slate-300 text-sm leading-relaxed mt-1">
                                Review your latest vital signs, upcoming specialist visits, and longitudinal laboratory biomarkers in one calm, clear view.
                            </p>
                        </div>

                        {/* Patient Quick Clinical Profile Tags */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                            {userData?.gender && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 font-medium text-slate-300">
                                    {userData.gender}
                                </span>
                            )}
                            {userData?.dob && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 font-medium text-slate-300">
                                    DOB: {userData.dob}
                                </span>
                            )}
                            {userData?.bloodGroup ? (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 font-semibold text-rose-300">
                                    Blood: {userData.bloodGroup}
                                </span>
                            ) : (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/70 font-medium text-slate-400">
                                    Blood Group: Not set
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Quick 1-Click Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                        <button
                            onClick={() => navigate('/doctors')}
                            className="px-4 py-2.5 bg-primary hover:bg-sky-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <Stethoscope className="w-4 h-4" /> Book Consultation
                        </button>
                        <button
                            onClick={() => handleTabChange('vitals')}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <HeartPulse className="w-4 h-4 text-rose-400" /> Measure Pulse
                        </button>
                        <button
                            onClick={() => handleTabChange('records')}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <UploadCloud className="w-4 h-4 text-sky-400" /> Upload Lab Report
                        </button>
                    </div>
                </div>

                <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
            </header>

            {/* Accessible Tab Navigation */}
            <nav
                role="tablist"
                aria-label="Patient Health Hub Sections"
                className="bg-slate-100/90 border border-slate-200/90 p-2 rounded-2xl grid grid-cols-2 lg:grid-cols-4 gap-2"
            >
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            id={`tab-${tab.id}`}
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer ${
                                isActive
                                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/90'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                            }`}
                        >
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    isActive
                                        ? 'bg-primary text-white shadow-xs'
                                        : 'bg-slate-200/80 text-slate-500'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold tracking-tight truncate">
                                        {tab.label}
                                    </span>
                                    <span
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                                            isActive
                                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}
                                    >
                                        {tab.badge}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-1">
                                    {tab.sublabel}
                                </p>
                            </div>
                        </button>
                    )
                })}
            </nav>

            {/* TAB 1: OVERVIEW & CARE PLAN */}
            {activeTab === 'overview' && (
                <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-6">
                    {/* Top 4 Health Metrics Matrix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Cardiometabolic Health Score */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 text-primary" /> Health Score
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${scoreBadge.bg} ${scoreBadge.color} border ${scoreBadge.border}`}>
                                    {score >= 85 ? 'Optimal' : score >= 70 ? 'Moderate' : 'Action'}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 pt-1">
                                <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">{score}</span>
                                <span className="text-xs font-semibold text-slate-400">/ 100</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {scoreBadge.label} across laboratory markers.
                            </p>
                        </div>

                        {/* Fasting Blood Glucose */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold flex items-center gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5 text-sky-600" /> Blood Glucose
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                    Target 70–99
                                </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 pt-1">
                                <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                                    {glucoseTrend ? glucoseTrend.metrics.latest : '94'}
                                </span>
                                <span className="text-xs font-semibold text-slate-400 font-mono">mg/dL</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {glucoseTrend ? `Trajectory: ${glucoseTrend.metrics.trajectory}` : 'Glycemic levels within normal limits.'}
                            </p>
                        </div>

                        {/* Resting Pulse / Heart Rate */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold flex items-center gap-1.5">
                                    <HeartPulse className="w-3.5 h-3.5 text-rose-500" /> Resting Pulse
                                </span>
                                <button
                                    onClick={() => handleTabChange('vitals')}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase hover:bg-rose-100 transition-colors"
                                >
                                    Scan Now
                                </button>
                            </div>
                            <div className="flex items-baseline gap-1.5 pt-1">
                                <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                                    {latestHeartRate}
                                </span>
                                <span className="text-xs font-semibold text-slate-400 font-mono">BPM</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Normal resting sinus rhythm (60–100 bpm).
                            </p>
                        </div>

                        {/* Next Scheduled Care */}
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span className="font-semibold flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Next Visit
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                    {nextAppointment ? 'Confirmed' : 'None'}
                                </span>
                            </div>
                            <div className="pt-1">
                                <div className="text-sm font-bold text-slate-900 truncate">
                                    {nextAppointment ? nextAppointment.docData.name : 'Schedule Visit'}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                    {nextAppointment ? nextAppointment.docData.speciality : 'Certified medical specialists'}
                                </div>
                            </div>
                            <p className="text-xs text-sky-600 font-semibold cursor-pointer hover:underline" onClick={() => nextAppointment ? navigate('/my-appointments') : navigate('/doctors')}>
                                {nextAppointment ? 'View consultation details →' : 'Browse available doctors →'}
                            </p>
                        </div>
                    </div>

                    {/* Spotlight: Next Upcoming Consultation Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Next Scheduled Consultation</h2>
                                    <p className="text-xs text-slate-500">Teleconsultation access, time window status, and doctor connection</p>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/my-appointments')}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                            >
                                <span>All Appointments</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {nextAppointment ? (
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={nextAppointment.docData.image}
                                        alt={nextAppointment.docData.name}
                                        className="w-14 h-14 rounded-2xl object-cover bg-slate-200 border border-slate-300/80 shrink-0"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-slate-900">{nextAppointment.docData.name}</h3>
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                                                {nextAppointment.docData.speciality}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-semibold text-slate-800">
                                                {formatSlotDisplay(nextAppointment.slotDate, nextAppointment.slotTime)}
                                            </span>
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {nextAppointment.docData.address?.line1 || 'Online Telehealth Consultation'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                    {nextApptWindow?.status === 'OPEN' ? (
                                        <button
                                            onClick={() => navigate(`/video-call/${nextAppointment._id}`)}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer animate-pulse"
                                        >
                                            <Video className="w-4 h-4" />
                                            <span>Join Video Consultation</span>
                                        </button>
                                    ) : nextApptWindow?.status === 'TOO_EARLY' ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium">
                                                <Clock className="w-3.5 h-3.5 text-sky-600" />
                                                Room opens in {nextApptWindow.formattedRemaining}
                                            </span>
                                            <button
                                                onClick={() => navigate(`/video-call/${nextAppointment._id}`)}
                                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                                title="Preview room setup"
                                            >
                                                <Video className="w-3.5 h-3.5" /> Preview Call
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => navigate(`/video-call/${nextAppointment._id}`)}
                                            className="px-4 py-2.5 bg-primary hover:bg-sky-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                                        >
                                            <Video className="w-4 h-4" /> Consultation Room
                                        </button>
                                    )}

                                    <button
                                        onClick={() => navigate(`/chat/${nextAppointment._id}`)}
                                        className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" /> Message
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-3">
                                <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                                    <Stethoscope className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">No Upcoming Doctor Appointments</p>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                                        Need a routine check-up, medical advice, or lab review? Book with verified specialists online.
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/doctors')}
                                    className="px-4 py-2 bg-primary hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Find a Specialist
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Key Biomarkers Physiological Gauge Snapshot */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Key Biomarker Reference Envelopes</h2>
                                <p className="text-xs text-slate-500">Your latest values mapped against clinical physiological target bounds</p>
                            </div>
                            <button
                                onClick={() => handleTabChange('trends')}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                            >
                                <span>Detailed Trends & Projections</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {trends.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                <p className="text-xs text-slate-500">No laboratory biomarker readings currently recorded.</p>
                                <button
                                    onClick={() => handleTabChange('trends')}
                                    className="text-xs font-semibold text-primary hover:underline"
                                >
                                    Log your first lab result or load sample demo panel →
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {trends.slice(0, 4).map((trend) => (
                                    <div key={trend.key} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-bold text-slate-900">{trend.name}</span>
                                                <span className="text-[10px] text-slate-500 ml-2 font-mono">
                                                    Target: {trend.referenceMin}–{trend.referenceMax} {trend.unit}
                                                </span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-900 font-mono">
                                                {trend.metrics.latest} <span className="text-xs text-slate-500 font-normal">{trend.unit}</span>
                                            </span>
                                        </div>
                                        <ClinicalRangeBar
                                            value={trend.metrics.latest}
                                            min={trend.referenceMin}
                                            max={trend.referenceMax}
                                            unit={trend.unit}
                                            status={trend.metrics.latestStatus}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Proactive Clinical Insights & Health Roadmap */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center gap-2 text-sky-800 text-xs font-bold">
                                <Activity className="w-4 h-4 text-sky-600" />
                                <span>Glycemic Equilibrium</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {glucoseTrend?.metrics.latestStatus === 'HIGH'
                                    ? 'Fasting glucose is slightly elevated. Consider reducing refined sugars and engaging in 20-minute post-meal walks.'
                                    : 'Fasting glucose remains stable within standard clinical limits. Continue balanced fiber and protein distribution.'}
                            </p>
                        </div>

                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center gap-2 text-indigo-800 text-xs font-bold">
                                <HeartPulse className="w-4 h-4 text-indigo-600" />
                                <span>Cardiovascular Vitality</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Resting heart rate is steady at {latestHeartRate} bpm. Consistent aerobic conditioning supports sustained endothelial elasticity.
                            </p>
                        </div>

                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <span>Preventive Follow-Up</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                {records.length > 0
                                    ? `You have ${records.length} digitized clinical reports on file. Regular bi-annual comprehensive panels are recommended.`
                                    : 'Upload past blood test reports to automatically digitize biomarker history and track your cardiometabolic trajectory.'}
                            </p>
                        </div>
                    </div>

                    {/* Recent Medical Reports Feed Snippet */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Latest Medical Reports & AI Summaries</h2>
                                <p className="text-xs text-slate-500">Digitized diagnostic laboratory documents and clinical insights</p>
                            </div>
                            <button
                                onClick={() => handleTabChange('records')}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                            >
                                <span>Upload / View All</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {records.length === 0 ? (
                            <div className="text-center py-6 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                <p className="text-xs text-slate-500">No diagnostic laboratory records uploaded yet.</p>
                                <button
                                    onClick={() => handleTabChange('records')}
                                    className="px-4 py-2 bg-primary hover:bg-sky-600 text-white rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                                >
                                    <UploadCloud className="w-4 h-4" /> Upload Lab PDF / Image
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {records.slice(0, 3).map((rec) => (
                                    <div key={rec._id} className="py-3 flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <FileText className="w-4 h-4 text-sky-600" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900">{rec.documentName}</h4>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    {rec.labName || 'Laboratory Test'} &bull; {new Date(rec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                {rec.aiExtractedData?.summary && (
                                                    <p className="text-xs text-slate-600 line-clamp-1 mt-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                        AI Summary: {rec.aiExtractedData.summary}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleTabChange('records')}
                                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg shrink-0 cursor-pointer"
                                        >
                                            View Report
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: BIOMARKERS & TRENDS */}
            {activeTab === 'trends' && (
                <div id="panel-trends" role="tabpanel" aria-labelledby="tab-trends">
                    <HealthDashboard
                        initialTrends={trends}
                        initialScore={score}
                        onRefresh={(data) => {
                            setTrends(data.trends || [])
                            setScore(data.cardiometabolicScore || 100)
                        }}
                        showHeader={false}
                    />
                </div>
            )}

            {/* TAB 3: MEDICAL REPORTS */}
            {activeTab === 'records' && (
                <div id="panel-records" role="tabpanel" aria-labelledby="tab-records">
                    <MedicalRecords />
                </div>
            )}

            {/* TAB 4: HEART RATE SCAN */}
            {activeTab === 'vitals' && (
                <div id="panel-vitals" role="tabpanel" aria-labelledby="tab-vitals">
                    <StandaloneVitals />
                </div>
            )}
        </div>
    )
}

export default HealthHub