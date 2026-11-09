import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import ConfirmActionModal from '../../components/ConfirmActionModal'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import {
  Stethoscope,
  CalendarCheck,
  Users,
  Star,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  IndianRupee,
  ShieldAlert,
  UserPlus,
  ArrowUpRight,
  Download,
  Award,
  Check,
  X,
  FileText,
  Video
} from 'lucide-react'

const Dashboard = () => {
  const {
    aToken,
    getDashData,
    cancelAppointment,
    completeAppointmentAdmin,
    dashData
  } = useContext(AdminContext)
  const { slotDateFormat, backendUrl, currency } = useContext(AppContext)
  const navigate = useNavigate()

  const [reviewStats, setReviewStats] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: 'cancel',
    appointment: null
  })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (aToken) {
      getDashData()
      fetchReviewStats()
    }
  }, [aToken, getDashData])

  const fetchReviewStats = async () => {
    try {
      const { data } = await axios.get(backendUrl + '/api/review/stats', {
        headers: { atoken: aToken }
      })
      if (data.success) {
        setReviewStats(data)
      }
    } catch (e) {
      console.log(e)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmModal.appointment) return
    setActionLoading(true)
    try {
      if (confirmModal.actionType === 'complete') {
        await completeAppointmentAdmin(confirmModal.appointment._id)
      } else {
        await cancelAppointment(confirmModal.appointment._id)
      }
      setConfirmModal({ isOpen: false, actionType: 'cancel', appointment: null })
    } finally {
      setActionLoading(false)
    }
  }

  const exportDashboardCSV = () => {
    if (!dashData?.latestAppointments?.length) return
    const headers = ['Booking ID', 'Patient Name', 'Doctor Name', 'Specialty', 'Date', 'Time', 'Fee', 'Paid Online', 'Status']
    const rows = dashData.latestAppointments.map((a) => [
      a._id,
      `"${(a.userData?.name || 'Patient').replace(/"/g, '""')}"`,
      `"${(a.docData?.name || 'Doctor').replace(/"/g, '""')}"`,
      `"${(a.docData?.speciality || '').replace(/"/g, '""')}"`,
      slotDateFormat(a.slotDate),
      a.slotTime,
      a.amount || 0,
      a.payment ? 'Yes' : 'No',
      a.cancelled ? 'Cancelled' : a.isCompleted ? 'Completed' : 'Upcoming'
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `vitalsync_clinic_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getSpecialityStats = () => {
    if (!dashData?.latestAppointments) return []

    const specMap = {}
    dashData.latestAppointments.forEach((a) => {
      const spec = a.docData?.speciality || 'Unknown'
      specMap[spec] = (specMap[spec] || 0) + 1
    })

    return Object.entries(specMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }

  if (!dashData) {
    return (
      <div className='flex-1 p-6 lg:p-8 max-w-7xl space-y-6'>
        <div className='h-24 bg-slate-200/70 rounded-3xl animate-pulse' />
        <div className='grid grid-cols-2 lg:grid-cols-3 gap-4'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className='h-28 bg-slate-200/70 rounded-2xl animate-pulse' />
          ))}
        </div>
      </div>
    )
  }

  const completedCount = dashData.completedAppointments ?? dashData.latestAppointments.filter((a) => a.isCompleted).length
  const cancelledCount = dashData.cancelledAppointments ?? dashData.latestAppointments.filter((a) => a.cancelled).length
  const activeCount = dashData.activeAppointments ?? dashData.latestAppointments.filter((a) => !a.isCompleted && !a.cancelled).length
  const totalRevenue = dashData.totalRevenue ?? dashData.latestAppointments
    .filter((a) => (a.isCompleted || a.payment) && !a.cancelled)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  const specStats = getSpecialityStats()
  const maxSpec = specStats.length > 0 ? Math.max(...specStats.map((s) => s.count)) : 1
  const specColors = ['#0284c7', '#0d9488', '#059669', '#d97706', '#6366f1', '#e11d48']
  const topDoctors = dashData.topDoctors || []

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 space-y-7'>
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={() => !actionLoading && setConfirmModal({ isOpen: false, actionType: 'cancel', appointment: null })}
        onConfirm={handleConfirmAction}
        actionType={confirmModal.actionType}
        appointment={confirmModal.appointment}
        slotDateFormat={slotDateFormat}
        currency={currency}
        loading={actionLoading}
      />

      {/* Executive Command Header */}
      <div className='bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6'>
        <div className='space-y-2 max-w-2xl'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/25 text-sky-300 text-xs font-semibold'>
            <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
            <span>Hospital & Clinic Command Center</span>
          </div>
          <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-white'>
            Clinic Administration Overview
          </h1>
          <p className='text-slate-300 text-xs sm:text-sm leading-relaxed'>
            Monitor live appointments, clinic revenue, specialist availability, patient records, and AI prescription safety alerts across your entire medical staff.
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2.5 shrink-0'>
          <button
            onClick={() => navigate('/add-doctor')}
            className='px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer'
          >
            <UserPlus className='w-4 h-4' />
            <span>Onboard New Doctor</span>
          </button>
          <button
            onClick={() => navigate('/doctor-list')}
            className='px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer'
          >
            <Stethoscope className='w-4 h-4 text-sky-300' />
            <span>Manage Doctors</span>
          </button>
          <button
            onClick={exportDashboardCSV}
            className='px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer'
            title='Export all bookings to CSV'
          >
            <Download className='w-4 h-4 text-emerald-300' />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Executive Telemedicine KPI Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {/* Revenue Card */}
        <div
          onClick={() => navigate('/all-appointments')}
          className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Clinic Revenue</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {currency}{totalRevenue.toLocaleString()}
            </p>
            <p className='text-xs text-emerald-600 font-semibold mt-1'>
              {dashData.paidAppointments || 0} online payments verified
            </p>
          </div>
          <div className='w-12 h-12 bg-emerald-50 border border-emerald-200/70 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform'>
            <IndianRupee className='w-6 h-6' />
          </div>
        </div>

        {/* Telemedicine Online Resolution Rate */}
        <div
          onClick={() => navigate('/all-appointments')}
          className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Resolved Fully Online</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-teal-600 mt-1 tabular-nums'>
              {dashData.onlineResolutionRate ?? 100}%
            </p>
            <p className='text-xs text-slate-500 font-medium mt-1'>
              {dashData.onlineResolvedCount ?? completedCount} queue-skipped • {dashData.inPersonReferralsCount ?? 0} referred
            </p>
          </div>
          <div className='w-12 h-12 bg-teal-50 border border-teal-200/70 text-teal-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform'>
            <Video className='w-6 h-6' />
          </div>
        </div>

        {/* Registered Doctors Card */}
        <div
          onClick={() => navigate('/doctor-list')}
          className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-sky-300 transition-all cursor-pointer flex items-center justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Medical Specialists</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.doctors}
            </p>
            <p className='text-xs text-sky-600 font-semibold mt-1'>
              {dashData.availableDoctors ?? dashData.doctors} currently accepting bookings
            </p>
          </div>
          <div className='w-12 h-12 bg-sky-50 border border-sky-200/70 text-sky-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform'>
            <Stethoscope className='w-6 h-6' />
          </div>
        </div>

        {/* Total Appointments Card */}
        <div
          onClick={() => navigate('/all-appointments')}
          className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Total Bookings</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.appointments}
            </p>
            <p className='text-xs text-indigo-600 font-semibold mt-1'>
              {activeCount} upcoming • {completedCount} completed
            </p>
          </div>
          <div className='w-12 h-12 bg-indigo-50 border border-indigo-200/70 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform'>
            <CalendarCheck className='w-6 h-6' />
          </div>
        </div>

        {/* Registered Patients Card */}
        <div
          onClick={() => navigate('/patients-list')}
          className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Registered Patients</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.patients}
            </p>
            <p className='text-xs text-teal-600 font-semibold mt-1 inline-flex items-center gap-1'>
              <span>View patient directory & allergies</span>
              <ArrowUpRight className='w-3.5 h-3.5' />
            </p>
          </div>
          <div className='w-12 h-12 bg-teal-50 border border-teal-200/70 text-teal-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform'>
            <Users className='w-6 h-6' />
          </div>
        </div>

        {/* Digital Prescriptions & AI Safety Card */}
        <div className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between'>
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Digital Prescriptions</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.prescriptionsCount || 0}
            </p>
            <p className='text-xs text-rose-600 font-semibold mt-1'>
              {dashData.safetyAlertsCaught || 0} allergy / drug conflicts caught by AI
            </p>
          </div>
          <div className='w-12 h-12 bg-rose-50 border border-rose-200/70 text-rose-600 rounded-2xl flex items-center justify-center'>
            <ShieldAlert className='w-6 h-6' />
          </div>
        </div>

        {/* Patient Satisfaction Rating Card */}
        <div className='bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between'>
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Clinic Satisfaction</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {reviewStats?.avgRating || '4.9'}
            </p>
            <p className='text-xs text-amber-600 font-semibold mt-1'>
              {reviewStats?.totalReviews || 0} verified patient reviews
            </p>
          </div>
          <div className='w-12 h-12 bg-amber-50 border border-amber-200/70 text-amber-500 rounded-2xl flex items-center justify-center'>
            <Star className='w-6 h-6 fill-amber-400' />
          </div>
        </div>
      </div>

      {/* 3-Column Analytics Row */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* 1. Appointment Status Breakdown */}
        <div className='bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs flex flex-col justify-between'>
          <div>
            <h3 className='font-extrabold text-slate-900 text-base mb-1'>Consultation Status</h3>
            <p className='text-xs text-slate-500 mb-5'>Completion and cancellation ratios</p>
            <div className='space-y-4'>
              {[
                { label: 'Completed Visits', count: completedCount, color: '#059669', bg: '#d1fae5' },
                { label: 'Upcoming / Active', count: activeCount, color: '#0284c7', bg: '#e0f2fe' },
                { label: 'Cancelled Visits', count: cancelledCount, color: '#e11d48', bg: '#ffe4e6' }
              ].map((item, i) => (
                <div key={i}>
                  <div className='flex justify-between text-xs font-bold mb-1.5'>
                    <span className='text-slate-600'>{item.label}</span>
                    <span style={{ color: item.color }}>
                      {item.count} ({dashData.appointments > 0 ? Math.round((item.count / dashData.appointments) * 100) : 0}%)
                    </span>
                  </div>
                  <div className='w-full h-2.5 rounded-full' style={{ backgroundColor: item.bg }}>
                    <div
                      className='h-2.5 rounded-full transition-all duration-700'
                      style={{
                        width: `${dashData.appointments > 0 ? (item.count / dashData.appointments) * 100 : 0}%`,
                        backgroundColor: item.color,
                        minWidth: item.count > 0 ? '8px' : '0'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='pt-4 border-t border-slate-100 mt-5 flex items-center justify-between text-xs'>
            <span className='text-slate-500 font-medium'>Total Collected Revenue</span>
            <span className='font-extrabold text-emerald-600 text-sm'>
              {currency}{totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 2. Most Booked Specialities */}
        <div className='bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs'>
          <h3 className='font-extrabold text-slate-900 text-base mb-1'>Demand by Specialty</h3>
          <p className='text-xs text-slate-500 mb-5'>Most booked departments across the clinic</p>
          <div className='space-y-3'>
            {specStats.map((spec, i) => (
              <div key={i} className='flex items-center gap-3'>
                <div className='w-32 text-xs font-semibold text-slate-700 truncate'>{spec.name}</div>
                <div className='flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden'>
                  <div
                    className='h-full rounded-lg flex items-center px-2.5 text-xs text-white font-bold transition-all duration-700'
                    style={{
                      width: `${(spec.count / maxSpec) * 100}%`,
                      backgroundColor: specColors[i % specColors.length],
                      minWidth: '28px'
                    }}
                  >
                    {spec.count}
                  </div>
                </div>
              </div>
            ))}
            {specStats.length === 0 && (
              <p className='text-slate-400 text-xs py-8 text-center'>No appointment data yet</p>
            )}
          </div>
        </div>

        {/* 3. Top Performing Doctors Leaderboard */}
        <div className='bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs'>
          <div className='flex items-center justify-between mb-1'>
            <h3 className='font-extrabold text-slate-900 text-base flex items-center gap-1.5'>
              <Award className='w-4 h-4 text-amber-500' />
              <span>Top Booked Doctors</span>
            </h3>
            <button
              onClick={() => navigate('/doctor-list')}
              className='text-xs font-semibold text-sky-600 hover:underline cursor-pointer'
            >
              View All
            </button>
          </div>
          <p className='text-xs text-slate-500 mb-4'>Ranked by patient visits and revenue</p>

          <div className='space-y-3'>
            {topDoctors.map((doc, idx) => (
              <div
                key={doc.docId || idx}
                className='flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-100'
              >
                <div className='flex items-center gap-2.5 min-w-0'>
                  <span className='w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold flex items-center justify-center shrink-0'>
                    {idx + 1}
                  </span>
                  <img
                    src={doc.image}
                    alt={doc.name}
                    className='w-9 h-9 rounded-xl object-cover bg-white border border-slate-200 shrink-0'
                  />
                  <div className='min-w-0'>
                    <p className='text-xs font-bold text-slate-900 truncate'>{doc.name}</p>
                    <p className='text-[11px] text-slate-500 truncate'>{doc.speciality}</p>
                  </div>
                </div>
                <div className='text-right shrink-0'>
                  <p className='text-xs font-extrabold text-slate-900'>{doc.bookings} visits</p>
                  <p className='text-[11px] font-semibold text-emerald-600'>
                    {currency}{doc.revenue}
                  </p>
                </div>
              </div>
            ))}
            {topDoctors.length === 0 && (
              <p className='text-slate-400 text-xs py-8 text-center'>No bookings recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Latest Clinic Bookings with Complete & Cancel Controls */}
      <div className='bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs'>
        <div className='px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h3 className='font-extrabold text-slate-900 text-base'>Recent Clinic Bookings</h3>
            <p className='text-xs text-slate-500'>
              Manage upcoming consultations or mark visits completed. All actions require confirmation.
            </p>
          </div>
          <button
            onClick={() => navigate('/all-appointments')}
            className='text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer'
          >
            <span>Open Full Appointments Desk</span>
            <ArrowUpRight className='w-3.5 h-3.5' />
          </button>
        </div>

        <div className='divide-y divide-slate-100'>
          {dashData.latestAppointments.slice(0, 8).map((item, index) => (
            <div
              className='flex flex-wrap items-center justify-between px-6 py-4 gap-3 hover:bg-slate-50/70 transition-colors'
              key={item._id || index}
            >
              <div className='flex items-center gap-3.5 min-w-0'>
                <img
                  className='rounded-2xl w-11 h-11 object-cover border border-slate-200 bg-slate-100'
                  src={item.docData?.image}
                  alt={item.docData?.name}
                />
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <p className='text-slate-900 font-bold text-sm truncate'>{item.docData?.name}</p>
                    <span className='text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-semibold'>
                      {item.docData?.speciality}
                    </span>
                  </div>
                  <p className='text-slate-500 text-xs flex flex-wrap items-center gap-2 mt-0.5'>
                    <span>
                      Patient: <strong className='text-slate-700'>{item.userData?.name}</strong>
                    </span>
                    <span>•</span>
                    <span className='inline-flex items-center gap-1'>
                      <Calendar className='w-3 h-3 text-sky-600' />
                      {slotDateFormat(item.slotDate)}
                    </span>
                    {item.slotTime && (
                      <span className='inline-flex items-center gap-1'>
                        <Clock className='w-3 h-3 text-sky-600' />
                        {item.slotTime}
                      </span>
                    )}
                    <span>•</span>
                    <span className='font-bold text-slate-800'>
                      {currency}{item.amount}
                    </span>
                    <span
                      className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                        item.payment
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.payment ? 'Paid Online' : 'Payment Pending'}
                    </span>
                    {item.inPersonReferral?.urgency && (
                      <span className='px-2 py-0.2 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200'>
                        Referral: {item.inPersonReferral.urgency}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {item.cancelled ? (
                <span className='inline-flex items-center gap-1.5 text-rose-700 text-xs font-bold px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl'>
                  <XCircle className='w-3.5 h-3.5' />
                  <span>Cancelled</span>
                </span>
              ) : item.isCompleted ? (
                <span className='inline-flex items-center gap-1.5 text-emerald-700 text-xs font-bold px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl'>
                  <CheckCircle2 className='w-3.5 h-3.5' />
                  <span>Completed</span>
                </span>
              ) : (
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() =>
                      setConfirmModal({
                        isOpen: true,
                        actionType: 'complete',
                        appointment: item
                      })
                    }
                    className='px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer'
                  >
                    <Check className='w-3.5 h-3.5' />
                    <span>Complete</span>
                  </button>
                  <button
                    type='button'
                    onClick={() =>
                      setConfirmModal({
                        isOpen: true,
                        actionType: 'cancel',
                        appointment: item
                      })
                    }
                    className='px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer'
                  >
                    <X className='w-3.5 h-3.5' />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
