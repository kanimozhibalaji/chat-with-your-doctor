import React, { useContext, useEffect, useState, useMemo } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import ConfirmActionModal from '../../components/ConfirmActionModal'
import PatientHealthDrawer from '../../components/PatientHealthDrawer'
import InPersonReferralModal from '../../components/InPersonReferralModal'
import {
  Wallet,
  CalendarClock,
  Check,
  CheckCircle2,
  XCircle,
  Users,
  MessageSquare,
  Video,
  FileText,
  ArrowRight,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Calendar,
  HeartPulse,
  ClipboardList,
  Building2,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'

const DoctorDashboard = () => {
  const {
    dToken,
    dashData,
    getDashData,
    cancelAppointment,
    completeAppointment,
    profileData,
    getProfileData,
    isPatientOnline,
    unreadChatCount
  } = useContext(DoctorContext)
  const { slotDateFormat, currency, backendUrl } = useContext(AppContext)
  const navigate = useNavigate()

  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'upcoming' | 'completed' | 'cancelled'
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: 'complete',
    appointment: null
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [togglingAvailability, setTogglingAvailability] = useState(false)
  const [healthDrawer, setHealthDrawer] = useState({
    isOpen: false,
    userId: null,
    patientFallback: null,
    reasonForVisit: ''
  })
  const [referralModal, setReferralModal] = useState({
    isOpen: false,
    appointment: null
  })
  const [referralLoading, setReferralLoading] = useState(false)

  const handleSaveReferral = async (payload) => {
    setReferralLoading(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/doctor/in-person-referral`, payload, {
        headers: { dToken }
      })
      if (data.success) {
        toast.success(data.message)
        setReferralModal({ isOpen: false, appointment: null })
        getDashData()
      } else {
        toast.error(data.message)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReferralLoading(false)
    }
  }

  useEffect(() => {
    if (dToken) {
      getDashData()
      getProfileData()
    }
  }, [dToken, getDashData, getProfileData])

  const handleToggleAvailability = async () => {
    if (!profileData || togglingAvailability) return
    setTogglingAvailability(true)
    try {
      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        {
          address: profileData.address,
          fees: profileData.fees,
          about: profileData.about,
          available: !profileData.available
        },
        { headers: { dToken } }
      )
      if (data.success) {
        toast.success(
          !profileData.available
            ? 'You are now marked as Available for new patient bookings'
            : 'New patient bookings are now paused'
        )
        getProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setTogglingAvailability(false)
    }
  }

  const openConfirmModal = (actionType, appointment) => {
    setConfirmModal({
      isOpen: true,
      actionType,
      appointment
    })
  }

  const closeConfirmModal = () => {
    if (actionLoading) return
    setConfirmModal({
      isOpen: false,
      actionType: 'complete',
      appointment: null
    })
  }

  const handleConfirmAction = async () => {
    if (!confirmModal.appointment) return
    setActionLoading(true)
    try {
      if (confirmModal.actionType === 'complete') {
        await completeAppointment(confirmModal.appointment._id)
      } else {
        await cancelAppointment(confirmModal.appointment._id)
      }
      setConfirmModal({ isOpen: false, actionType: 'complete', appointment: null })
    } finally {
      setActionLoading(false)
    }
  }

  const latestList = useMemo(() => dashData?.latestAppointments || [], [dashData])
  const upcomingList = useMemo(() => latestList.filter((a) => !a.cancelled && !a.isCompleted), [latestList])
  const upcomingCount = upcomingList.length
  const completedCount = useMemo(() => latestList.filter((a) => a.isCompleted).length, [latestList])
  const cancelledCount = useMemo(() => latestList.filter((a) => a.cancelled).length, [latestList])

  // Imminent next consultation spotlight
  const nextUpPatient = upcomingList[0] || null

  const filteredBookings = useMemo(() => {
    return latestList.filter((item) => {
      if (filterStatus === 'upcoming') return !item.cancelled && !item.isCompleted
      if (filterStatus === 'completed') return item.isCompleted
      if (filterStatus === 'cancelled') return item.cancelled
      return true
    })
  }, [latestList, filterStatus])

  if (!dashData) {
    return (
      <div className='flex-1 p-6 sm:p-8'>
        <div className='animate-pulse space-y-6 max-w-7xl mx-auto'>
          <div className='h-36 bg-slate-200/80 rounded-3xl' />
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='h-28 bg-slate-200/80 rounded-2xl' />
            <div className='h-28 bg-slate-200/80 rounded-2xl' />
            <div className='h-28 bg-slate-200/80 rounded-2xl' />
            <div className='h-28 bg-slate-200/80 rounded-2xl' />
          </div>
          <div className='h-96 bg-slate-200/80 rounded-3xl' />
        </div>
      </div>
    )
  }

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 mx-auto'>
      {/* Confirmation Modal for Complete / Cancel */}
      <ConfirmActionModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        actionType={confirmModal.actionType}
        appointment={confirmModal.appointment}
        slotDateFormat={slotDateFormat}
        currency={currency}
        loading={actionLoading}
      />

      {/* Patient Health Records & Vitals Drawer */}
      <PatientHealthDrawer
        isOpen={healthDrawer.isOpen}
        onClose={() => setHealthDrawer({ isOpen: false, userId: null, patientFallback: null, reasonForVisit: '' })}
        userId={healthDrawer.userId}
        patientFallback={healthDrawer.patientFallback}
        reasonForVisit={healthDrawer.reasonForVisit}
      />

      {/* In-Person Hospital Visit Referral Modal */}
      <InPersonReferralModal
        isOpen={referralModal.isOpen}
        onClose={() => setReferralModal({ isOpen: false, appointment: null })}
        appointment={referralModal.appointment}
        onSaveReferral={handleSaveReferral}
        loading={referralLoading}
      />

      {/* Clinical Command Header */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-950/10 mb-7 relative overflow-hidden border border-slate-700/50'>
        {/* Subtle background glow */}
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6'>
          <div className='flex items-start sm:items-center gap-4'>
            {profileData?.image ? (
              <img
                src={profileData.image}
                alt={profileData.name}
                className='w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 bg-slate-800 shadow-md shrink-0'
              />
            ) : (
              <div className='w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sky-600/30 border border-sky-400/40 text-sky-200 font-extrabold text-2xl flex items-center justify-center shrink-0'>
                <Stethoscope className='w-8 h-8' />
              </div>
            )}

            <div className='space-y-1.5'>
              <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold'>
                <Sparkles className='w-3.5 h-3.5 text-sky-300' />
                <span>Physician Consultation Workstation</span>
                {profileData?.speciality && (
                  <>
                    <span className='w-1 h-1 rounded-full bg-sky-400' />
                    <span className='text-sky-100 font-semibold'>{profileData.speciality}</span>
                  </>
                )}
              </div>

              <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight'>
                {profileData?.name ? `Dr. ${profileData.name.replace(/^Dr\.\s*/i, '')}` : 'Clinical Overview'}
              </h1>

              <p className='text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed'>
                Manage your patient consultations, conduct high-definition teleconsultations, review longitudinal lab trends, and issue digitally signed prescriptions.
              </p>
            </div>
          </div>

          {/* Quick Action Station */}
          <div className='flex flex-wrap items-center gap-3 shrink-0'>
            {/* Quick Availability Switch */}
            {profileData && (
              <button
                type='button'
                onClick={handleToggleAvailability}
                disabled={togglingAvailability}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer shadow-sm ${
                  profileData.available
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100 hover:bg-emerald-500/30'
                    : 'bg-amber-500/20 border-amber-400/50 text-amber-100 hover:bg-amber-500/30'
                }`}
                title='Click to toggle whether patients can book new appointments with you'
              >
                {profileData.available ? (
                  <ToggleRight className='w-5 h-5 text-emerald-300' />
                ) : (
                  <ToggleLeft className='w-5 h-5 text-amber-300' />
                )}
                <div className='text-left'>
                  <span className='block text-[10px] uppercase tracking-wider text-slate-300 font-semibold'>
                    Availability Status
                  </span>
                  <span>{profileData.available ? 'Accepting Patients' : 'Bookings Paused'}</span>
                </div>
              </button>
            )}

            <button
              type='button'
              onClick={() => navigate('/doctor-chat')}
              className='px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer'
            >
              <MessageSquare className='w-4 h-4 text-sky-300' />
              <span>Patient Messages</span>
              {unreadChatCount > 0 && (
                <span className='px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-extrabold tabular-nums animate-pulse'>
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              type='button'
              onClick={() => navigate('/doctor-appointments')}
              className='px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-sky-600/30 transition-all cursor-pointer'
            >
              <span>All Appointments</span>
              <ArrowRight className='w-4 h-4' />
            </button>
          </div>
        </div>
      </section>

      {/* 4 Key Clinical Metrics Grid */}
      <section className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7'>
        {/* Total Earnings */}
        <div
          onClick={() => navigate('/doctor-appointments')}
          className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex items-start justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>Clinical Revenue</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {currency}{dashData.earnings}
            </p>
            <p className='text-[11px] text-slate-500 mt-1 font-medium'>From completed & paid visits</p>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <Wallet className='w-6 h-6' />
          </div>
        </div>

        {/* Upcoming Consultations */}
        <div
          onClick={() => setFilterStatus('upcoming')}
          className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer flex items-start justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>Upcoming Visits</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {upcomingCount}
            </p>
            <p className='text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1'>
              <span className={`w-1.5 h-1.5 rounded-full ${upcomingCount > 0 ? 'bg-amber-500 animate-ping' : 'bg-slate-400'}`} />
              {upcomingCount > 0 ? 'Awaiting consultation' : 'Queue clear'}
            </p>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <CalendarClock className='w-6 h-6' />
          </div>
        </div>

        {/* Total Bookings / Completed Visits */}
        <div
          onClick={() => setFilterStatus('completed')}
          className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex items-start justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>Total Consultations</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.appointments}
            </p>
            <p className='text-[11px] text-sky-700 font-semibold mt-1 tabular-nums'>
              {completedCount} completed recently
            </p>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200/80 text-sky-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <Calendar className='w-6 h-6' />
          </div>
        </div>

        {/* Unique Patients */}
        <div
          onClick={() => navigate('/doctor-appointments')}
          className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-start justify-between group'
        >
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-500'>Active Patients</p>
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tabular-nums'>
              {dashData.patients}
            </p>
            <p className='text-[11px] text-slate-500 mt-1 font-medium'>Under your primary care</p>
          </div>
          <div className='w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform'>
            <Users className='w-6 h-6' />
          </div>
        </div>
      </section>

      {/* Next Up Consultation Spotlight (if upcoming appointment exists) */}
      {nextUpPatient && (
        <section className='mb-7 bg-white rounded-3xl border border-sky-200/90 shadow-sm p-5 sm:p-6 relative overflow-hidden bg-gradient-to-r from-sky-50/50 via-white to-white'>
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-5'>
            <div className='flex items-start sm:items-center gap-4 min-w-0'>
              <div className='relative shrink-0'>
                <img
                  src={nextUpPatient.userData?.image}
                  alt={nextUpPatient.userData?.name}
                  className='w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white shadow-xs bg-slate-100'
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    isPatientOnline && isPatientOnline(nextUpPatient.userId)
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  }`}
                  title={isPatientOnline && isPatientOnline(nextUpPatient.userId) ? 'Patient is online now' : 'Patient offline'}
                />
              </div>

              <div className='space-y-1 min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='px-2.5 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-extrabold uppercase tracking-wider'>
                    Next Up Consultation
                  </span>
                  {isPatientOnline && isPatientOnline(nextUpPatient.userId) && (
                    <span className='px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1'>
                      <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping' />
                      Patient Online Now
                    </span>
                  )}
                </div>

                <h3 className='text-lg font-extrabold text-slate-900 truncate'>
                  {nextUpPatient.userData?.name}
                </h3>

                <div className='flex flex-wrap items-center gap-3 text-xs text-slate-600'>
                  <span className='inline-flex items-center gap-1 font-semibold text-slate-900 tabular-nums'>
                    <Calendar className='w-3.5 h-3.5 text-sky-600' />
                    {slotDateFormat(nextUpPatient.slotDate)}
                  </span>
                  <span className='inline-flex items-center gap-1 font-semibold text-slate-900 tabular-nums'>
                    <Clock className='w-3.5 h-3.5 text-sky-600' />
                    {nextUpPatient.slotTime}
                  </span>
                  {nextUpPatient.reasonForVisit && (
                    <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-100/70 text-sky-900 border border-sky-200/80 font-medium truncate max-w-xs'>
                      <ClipboardList className='w-3 h-3 text-sky-600 shrink-0' />
                      <span className='truncate'>{nextUpPatient.reasonForVisit}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Spotlight Quick Actions */}
            <div className='flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100'>
              <button
                type='button'
                onClick={() =>
                  setHealthDrawer({
                    isOpen: true,
                    userId: nextUpPatient.userId,
                    patientFallback: nextUpPatient.userData,
                    reasonForVisit: nextUpPatient.reasonForVisit || ''
                  })
                }
                className='h-10 px-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer'
              >
                <HeartPulse className='w-4 h-4 text-indigo-600' />
                <span>Health Dossier</span>
              </button>

              <button
                type='button'
                onClick={() => navigate(`/doctor-chat/${nextUpPatient._id}`)}
                className='h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer'
              >
                <MessageSquare className='w-4 h-4 text-slate-500' />
                <span>Chat</span>
              </button>

              <button
                type='button'
                onClick={() => navigate(`/doctor-video-call/${nextUpPatient._id}`)}
                className='h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm shadow-sky-600/30 transition-all cursor-pointer'
              >
                <Video className='w-4 h-4' />
                <span>Start Video Call</span>
              </button>

              <button
                type='button'
                onClick={() => openConfirmModal('complete', nextUpPatient)}
                className='h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer'
              >
                <Check className='w-4 h-4 stroke-[2.5]' />
                <span>Complete</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent Bookings & Action Queue */}
      <section className='bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden'>
        {/* Table Header + Filter Segmented Control */}
        <div className='px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/60'>
          <div>
            <h2 className='text-base sm:text-lg font-extrabold text-slate-900'>
              Recent Patient Appointments
            </h2>
            <p className='text-xs text-slate-500 mt-0.5'>
              Safety-guarded workflow with confirmation dialogs before completing or cancelling patient records.
            </p>
          </div>

          <div className='inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-xl'>
            {[
              { id: 'all', label: 'All', count: latestList.length },
              { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
              { id: 'completed', label: 'Completed', count: completedCount },
              { id: 'cancelled', label: 'Cancelled', count: cancelledCount }
            ].map((tab) => {
              const active = filterStatus === tab.id
              return (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-extrabold tabular-nums ${
                      active ? 'bg-sky-50 text-sky-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Appointment Rows */}
        {filteredBookings.length === 0 ? (
          <div className='py-16 px-6 text-center'>
            <div className='w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3'>
              <CalendarClock className='w-6 h-6' />
            </div>
            <p className='text-sm font-bold text-slate-800'>No appointments match this filter</p>
            <p className='text-xs text-slate-400 mt-1 max-w-sm mx-auto'>
              Switch the filter tab above or open the complete appointment history manager.
            </p>
          </div>
        ) : (
          <div className='divide-y divide-slate-100'>
            {filteredBookings.map((item, index) => {
              const online = isPatientOnline && isPatientOnline(item.userId)
              return (
                <div
                  key={item._id || index}
                  className='p-5 sm:px-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors'
                >
                  {/* Left: Patient Info & Schedule */}
                  <div className='flex items-start sm:items-center gap-3.5 min-w-0'>
                    <div className='relative shrink-0'>
                      <img
                        className='rounded-2xl w-12 h-12 object-cover border border-slate-200 bg-slate-100'
                        src={item.userData?.image}
                        alt={item.userData?.name}
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          online ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={online ? 'Patient is online now' : 'Patient offline'}
                      />
                    </div>

                    <div className='min-w-0 space-y-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='text-sm font-bold text-slate-900 truncate'>
                          {item.userData?.name}
                        </p>
                        {online && (
                          <span className='px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold'>
                            Online Now
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${
                            item.payment
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {item.payment ? `Paid (${currency}${item.amount})` : `Pending (${currency}${item.amount})`}
                        </span>
                      </div>

                      <div className='flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium tabular-nums'>
                        <span className='inline-flex items-center gap-1 text-slate-700 font-semibold'>
                          <Calendar className='w-3.5 h-3.5 text-sky-600' />
                          {slotDateFormat(item.slotDate)}
                        </span>
                        {item.slotTime && (
                          <span className='inline-flex items-center gap-1 text-slate-600'>
                            <Clock className='w-3.5 h-3.5 text-sky-600' />
                            {item.slotTime}
                          </span>
                        )}
                        {item.rescheduledAt && (
                          <span className='px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold'>
                            Rescheduled
                          </span>
                        )}
                        {item.reasonForVisit && (
                          <span
                            className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80 text-[11px] font-medium max-w-xs truncate'
                            title={`Reason for Visit: ${item.reasonForVisit}`}
                          >
                            <ClipboardList className='w-3 h-3 text-sky-600 shrink-0' />
                            <span className='truncate'>{item.reasonForVisit}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Consultation Shortcuts + Explicit Status / Confirmed Decision Buttons */}
                  <div className='flex flex-wrap items-center justify-between xl:justify-end gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100'>
                    {/* Quick Clinical Tools — Segmented Bar */}
                    {!item.cancelled && (
                      <div className='inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs divide-x divide-slate-200 overflow-hidden'>
                        <button
                          type='button'
                          onClick={() =>
                            setHealthDrawer({
                              isOpen: true,
                              userId: item.userId,
                              patientFallback: item.userData,
                              reasonForVisit: item.reasonForVisit || ''
                            })
                          }
                          className='h-8 px-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50/40 hover:bg-indigo-100/70 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                          title='View Patient Lab Reports, AI Summaries & Heart Rate Vitals'
                        >
                          <HeartPulse className='w-3.5 h-3.5 text-indigo-600' />
                          <span>Health Records</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => navigate(`/doctor-chat/${item._id}`)}
                          className='h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-sky-600 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                          title='Message this patient'
                        >
                          <MessageSquare className='w-3.5 h-3.5 text-slate-400' />
                          <span>Chat</span>
                        </button>

                        {!item.isCompleted && (
                          <button
                            type='button'
                            onClick={() => navigate(`/doctor-video-call/${item._id}`)}
                            className='h-8 px-2.5 text-xs font-semibold text-sky-700 bg-sky-50/60 hover:bg-sky-100/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                            title='Start video consultation with patient'
                          >
                            <Video className='w-3.5 h-3.5 text-sky-600' />
                            <span>Video Call</span>
                          </button>
                        )}

                        <button
                          type='button'
                          onClick={() => navigate(`/doctor-prescription/${item._id}`)}
                          className='h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                          title='Write or view digital prescription'
                        >
                          <FileText className='w-3.5 h-3.5 text-slate-400' />
                          <span>Prescription</span>
                        </button>

                        <button
                          type='button'
                          onClick={() => setReferralModal({ isOpen: true, appointment: item })}
                          className={`h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                            item.inPersonReferral
                              ? 'bg-amber-100 text-amber-900 font-bold'
                              : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                          title='Recommend in-person hospital visit if case cannot be resolved online'
                        >
                          <Building2 className={`w-3.5 h-3.5 ${item.inPersonReferral ? 'text-amber-700' : 'text-slate-400'}`} />
                          <span>{item.inPersonReferral ? 'Referral Sent' : 'Hospital Referral'}</span>
                        </button>
                      </div>
                    )}

                    {/* Status Badge OR Explicit Action Buttons (Safe confirmation) */}
                    <div className='flex items-center gap-2'>
                      {item.inPersonReferral && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.inPersonReferral.urgency === 'EMERGENCY'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                          title={item.inPersonReferral.reason}
                        >
                          <Building2 className='w-3 h-3' />
                          <span>Hospital: {item.inPersonReferral.urgency}</span>
                        </span>
                      )}

                      {item.cancelled ? (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold'>
                          <XCircle className='w-3.5 h-3.5' />
                          <span>Cancelled</span>
                        </span>
                      ) : item.isCompleted ? (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold'>
                          <CheckCircle2 className='w-3.5 h-3.5' />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <div className='flex items-center gap-1.5 pl-1 xl:border-l xl:border-slate-200'>
                          <button
                            type='button'
                            onClick={() => openConfirmModal('complete', item)}
                            className='h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer'
                            title='Mark this consultation as completed'
                          >
                            <Check className='w-3.5 h-3.5 stroke-[2.5]' />
                            <span>Complete</span>
                          </button>

                          <button
                            type='button'
                            onClick={() => openConfirmModal('cancel', item)}
                            className='h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-medium inline-flex items-center gap-1 transition-colors cursor-pointer'
                            title='Cancel this appointment'
                          >
                            <span>Cancel</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer link to all appointments */}
        <div className='px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between'>
          <span className='text-xs text-slate-500 font-medium tabular-nums'>
            Showing {filteredBookings.length} of {latestList.length} recent appointments
          </span>
          <button
            type='button'
            onClick={() => navigate('/doctor-appointments')}
            className='text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors'
          >
            <span>Open Full Appointment Manager</span>
            <ArrowRight className='w-3.5 h-3.5' />
          </button>
        </div>
      </section>
    </div>
  )
}

export default DoctorDashboard
