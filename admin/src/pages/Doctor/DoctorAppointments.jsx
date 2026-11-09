import React, { useContext, useEffect, useState, useMemo } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import ConfirmActionModal from '../../components/ConfirmActionModal'
import PatientHealthDrawer from '../../components/PatientHealthDrawer'
import InPersonReferralModal from '../../components/InPersonReferralModal'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  MessageSquare,
  Video,
  FileText,
  Check,
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Clock,
  CalendarCheck,
  X,
  HeartPulse,
  ClipboardList,
  Building2,
  Sparkles,
  Users
} from 'lucide-react'

const DoctorAppointments = () => {
  const {
    dToken,
    appointments,
    getAppointments,
    cancelAppointment,
    completeAppointment,
    isPatientOnline,
    unreadChatCount,
    backendUrl
  } = useContext(DoctorContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'upcoming' | 'completed' | 'cancelled'
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: 'complete',
    appointment: null
  })
  const [actionLoading, setActionLoading] = useState(false)
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
        getAppointments()
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
      getAppointments()
    }
  }, [dToken, getAppointments])

  const counts = useMemo(() => {
    const all = appointments.length
    const upcoming = appointments.filter((a) => !a.cancelled && !a.isCompleted).length
    const completed = appointments.filter((a) => a.isCompleted).length
    const cancelled = appointments.filter((a) => a.cancelled).length
    return { all, upcoming, completed, cancelled }
  }, [appointments])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      if (statusFilter === 'upcoming' && (item.cancelled || item.isCompleted)) return false
      if (statusFilter === 'completed' && !item.isCompleted) return false
      if (statusFilter === 'cancelled' && !item.cancelled) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const name = (item.userData?.name || '').toLowerCase()
        const dateStr = (slotDateFormat(item.slotDate) || '').toLowerCase()
        const timeStr = (item.slotTime || '').toLowerCase()
        const reasonStr = (item.reasonForVisit || '').toLowerCase()
        return name.includes(q) || dateStr.includes(q) || timeStr.includes(q) || reasonStr.includes(q)
      }
      return true
    })
  }, [appointments, statusFilter, searchQuery, slotDateFormat])

  const formatPatientSubtext = (userData) => {
    const rawAge = calculateAge(userData?.dob)
    const validAge = !isNaN(rawAge) && rawAge > 0 && rawAge < 130 ? `${rawAge} yrs` : null
    const rawGender = userData?.gender
    const validGender =
      rawGender && rawGender.toLowerCase() !== 'not selected' ? rawGender : null

    if (validAge && validGender) return `${validAge} • ${validGender}`
    if (validAge) return validAge
    if (validGender) return validGender
    if (userData?.email) return userData.email
    return 'Registered Patient'
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

  const filterTabs = [
    { id: 'all', label: 'All Visits', count: counts.all },
    { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled }
  ]

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 mx-auto'>
      {/* Confirmation Modal */}
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

      {/* Page Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6'>
        <div>
          <div className='flex items-center gap-2'>
            <h1 id='appointments-table-heading' className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
              Patient Appointment Manager
            </h1>
            <span className='px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold tabular-nums'>
              {counts.all} Total
            </span>
          </div>
          <p className='text-xs sm:text-sm text-slate-500 mt-1'>
            Start video consultations, inspect patient health dossiers, message patients, and issue digitally signed prescriptions.
          </p>
        </div>

        <button
          type='button'
          onClick={() => navigate('/doctor-chat')}
          className='h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-all cursor-pointer self-start sm:self-auto shrink-0'
        >
          <MessageSquare className='w-4 h-4 text-sky-600' />
          <span>Patient Messenger</span>
          {unreadChatCount > 0 && (
            <span className='px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-extrabold tabular-nums'>
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Segmented Control + Search Bar */}
      <div className='bg-white border border-slate-200 rounded-2xl p-3 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs'>
        <div className='inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 border border-slate-200/80 rounded-xl'>
          {filterTabs.map((tab) => {
            const active = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type='button'
                onClick={() => setStatusFilter(tab.id)}
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

        <div className='relative w-full md:w-80'>
          <Search className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search patient, date, or chief complaint...'
            className='w-full h-9.5 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-sky-500 text-slate-800 placeholder-slate-400 transition-colors'
          />
          {searchQuery && (
            <button
              type='button'
              onClick={() => setSearchQuery('')}
              className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5'
              title='Clear search'
            >
              <X className='w-3.5 h-3.5' />
            </button>
          )}
        </div>
      </div>

      {/* Appointments Table */}
      <div className='bg-white border border-slate-200 rounded-2xl overflow-clip shadow-2xs'>
        {filteredAppointments.length === 0 ? (
          <div className='py-16 px-6 text-center'>
            <div className='w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3'>
              <CalendarCheck className='w-6 h-6' />
            </div>
            <p className='text-sm font-bold text-slate-800'>No appointments found</p>
            <p className='text-xs text-slate-400 mt-1 max-w-sm mx-auto'>
              Try adjusting your search keywords or switching between the status filter tabs above.
            </p>
            {searchQuery && (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                className='mt-3 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold hover:bg-sky-100 cursor-pointer transition-colors'
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div
            role='region'
            aria-labelledby='appointments-table-heading'
            tabIndex={0}
            className='overflow-x-auto max-h-[72dvh] overflow-y-auto overscroll-contain'
          >
            <table className='w-full border-collapse text-left'>
              <thead className='sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider'>
                <tr>
                  <th className='py-3.5 pl-5 pr-2 w-8'>#</th>
                  <th className='py-3.5 px-3 min-w-[200px]'>Patient details</th>
                  <th className='py-3.5 px-3 min-w-[130px]'>Appointment slot</th>
                  <th className='py-3.5 px-3 min-w-[110px]'>Billing</th>
                  <th className='py-3.5 px-3 min-w-[280px]'>Clinical tools</th>
                  <th className='py-3.5 pl-3 pr-5 text-right min-w-[160px]'>Status & action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100 text-sm'>
                {filteredAppointments.map((item, index) => {
                  const online = isPatientOnline && isPatientOnline(item.userId)
                  return (
                    <tr
                      key={item._id || index}
                      className='hover:bg-slate-50/70 transition-colors group'
                    >
                      <td className='py-4 pl-5 pr-2 text-xs font-semibold text-slate-400 tabular-nums whitespace-nowrap'>
                        {index + 1}
                      </td>

                      {/* Patient Details */}
                      <td className='py-4 px-3'>
                        <div className='flex items-center gap-3 min-w-0'>
                          <div className='relative shrink-0'>
                            <img
                              src={item.userData?.image}
                              className='w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                              alt={item.userData?.name}
                              onError={(e) => {
                                e.currentTarget.onerror = null
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userData?.name || 'Patient')}&background=0284c7&color=fff&bold=true`
                              }}
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                                online ? 'bg-emerald-500' : 'bg-slate-300'
                              }`}
                              title={online ? 'Patient online now' : 'Patient offline'}
                            />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-2'>
                              <p className='font-bold text-slate-900 text-xs sm:text-sm whitespace-nowrap'>
                                {item.userData?.name}
                              </p>
                              {online && (
                                <span className='inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0'>
                                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                                  Online
                                </span>
                              )}
                            </div>
                            <p className='text-xs text-slate-500 mt-0.5 font-medium whitespace-nowrap'>
                              {formatPatientSubtext(item.userData)}
                            </p>
                            {item.reasonForVisit && (
                              <p
                                className='mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80 text-[11px] font-medium max-w-[200px] truncate'
                                title={`Reason for visit: ${item.reasonForVisit}`}
                              >
                                <ClipboardList className='w-3 h-3 text-sky-600 shrink-0' />
                                <span className='truncate'>{item.reasonForVisit}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Appointment Slot */}
                      <td className='py-4 px-3 whitespace-nowrap'>
                        <div className='text-xs space-y-1 tabular-nums'>
                          <p className='font-bold text-slate-800 flex items-center gap-1.5'>
                            <Calendar className='w-3.5 h-3.5 text-sky-600 shrink-0' />
                            <span>{slotDateFormat(item.slotDate)}</span>
                            {item.rescheduledAt && (
                              <span className='px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold'>
                                Rescheduled
                              </span>
                            )}
                          </p>
                          <p className='text-slate-500 flex items-center gap-1.5 font-medium'>
                            <Clock className='w-3.5 h-3.5 text-slate-400 shrink-0' />
                            <span>{item.slotTime}</span>
                          </p>
                        </div>
                      </td>

                      {/* Fee & Billing */}
                      <td className='py-4 px-3 whitespace-nowrap'>
                        <div className='flex items-center gap-2'>
                          <span className='font-extrabold text-slate-900 text-xs sm:text-sm tabular-nums'>
                            {currency}{item.amount}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.payment
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {item.payment ? 'Paid Online' : 'Pending'}
                          </span>
                        </div>
                      </td>

                      {/* Clinical Tools — Compact Segmented Toolbar */}
                      <td className='py-4 px-3 whitespace-nowrap'>
                        {!item.cancelled ? (
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
                              title='View patient health records, lab reports & vitals'
                            >
                              <HeartPulse className='w-3.5 h-3.5 text-indigo-600' />
                              <span>Records</span>
                            </button>

                            <button
                              type='button'
                              onClick={() => navigate(`/doctor-chat/${item._id}`)}
                              className='h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-sky-600 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                              title='Chat with patient'
                            >
                              <MessageSquare className='w-3.5 h-3.5 text-slate-400' />
                              <span>Chat</span>
                            </button>

                            {!item.isCompleted && (
                              <button
                                type='button'
                                onClick={() => navigate(`/doctor-video-call/${item._id}`)}
                                className='h-8 px-2.5 text-xs font-semibold text-sky-700 bg-sky-50/60 hover:bg-sky-100/80 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                                title='Launch video consultation'
                              >
                                <Video className='w-3.5 h-3.5 text-sky-600' />
                                <span>Video</span>
                              </button>
                            )}

                            <button
                              type='button'
                              onClick={() => navigate(`/doctor-prescription/${item._id}`)}
                              className='h-8 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer'
                              title='Write or view digital prescription'
                            >
                              <FileText className='w-3.5 h-3.5 text-slate-400' />
                              <span>Rx</span>
                            </button>

                            <button
                              type='button'
                              onClick={() => setReferralModal({ isOpen: true, appointment: item })}
                              className={`h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                item.inPersonReferral
                                  ? 'bg-amber-100 text-amber-900 font-bold'
                                  : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                              }`}
                              title='Recommend in-person hospital referral'
                            >
                              <Building2 className={`w-3.5 h-3.5 ${item.inPersonReferral ? 'text-amber-700' : 'text-slate-400'}`} />
                              <span>{item.inPersonReferral ? 'Referral' : 'Refer'}</span>
                            </button>
                          </div>
                        ) : (
                          <span className='text-xs text-slate-400 font-medium'>—</span>
                        )}
                      </td>

                      {/* Status & Actions */}
                      <td className='py-4 pl-3 pr-5 whitespace-nowrap text-right'>
                        <div className='flex flex-col items-end gap-1.5'>
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
                            <div className='inline-flex items-center justify-end gap-1.5'>
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
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DoctorAppointments
