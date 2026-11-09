import React, { useEffect, useContext, useState, useMemo } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import ConfirmActionModal from '../../components/ConfirmActionModal'
import {
  CheckCircle2,
  XCircle,
  Search,
  Calendar,
  Clock,
  X,
  CalendarCheck,
  Download,
  Check
} from 'lucide-react'

const AllAppointments = () => {
  const {
    aToken,
    appointments,
    cancelAppointment,
    completeAppointmentAdmin,
    getAllAppointments
  } = useContext(AdminContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'upcoming' | 'completed' | 'cancelled'
  const [paymentFilter, setPaymentFilter] = useState('all') // 'all' | 'paid' | 'pending'
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    actionType: 'cancel',
    appointment: null
  })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (aToken) {
      getAllAppointments()
    }
  }, [aToken, getAllAppointments])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      if (statusFilter === 'upcoming' && (item.cancelled || item.isCompleted)) return false
      if (statusFilter === 'completed' && !item.isCompleted) return false
      if (statusFilter === 'cancelled' && !item.cancelled) return false

      if (paymentFilter === 'paid' && !item.payment) return false
      if (paymentFilter === 'pending' && item.payment) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const patient = (item.userData?.name || '').toLowerCase()
        const doctor = (item.docData?.name || '').toLowerCase()
        const spec = (item.docData?.speciality || '').toLowerCase()
        const dateStr = (slotDateFormat(item.slotDate) || '').toLowerCase()
        return patient.includes(q) || doctor.includes(q) || spec.includes(q) || dateStr.includes(q)
      }
      return true
    })
  }, [appointments, statusFilter, paymentFilter, searchQuery, slotDateFormat])

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

  const exportAppointmentsCSV = () => {
    if (!filteredAppointments.length) return
    const headers = ['Booking ID', 'Patient Name', 'Patient Email', 'Doctor Name', 'Specialty', 'Date', 'Time', 'Fee', 'Payment Status', 'Visit Status']
    const rows = filteredAppointments.map((a) => [
      a._id,
      `"${(a.userData?.name || 'Patient').replace(/"/g, '""')}"`,
      `"${(a.userData?.email || '').replace(/"/g, '""')}"`,
      `"${(a.docData?.name || 'Doctor').replace(/"/g, '""')}"`,
      `"${(a.docData?.speciality || '').replace(/"/g, '""')}"`,
      slotDateFormat(a.slotDate),
      a.slotTime,
      a.amount || 0,
      a.payment ? 'Paid Online' : 'Payment Pending',
      a.cancelled ? 'Cancelled' : a.isCompleted ? 'Completed' : 'Upcoming'
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `clinic_appointments_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatAge = (dob) => {
    const age = calculateAge(dob)
    return !isNaN(age) && age > 0 && age < 130 ? `${age} yrs` : '—'
  }

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 space-y-6'>
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

      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
            All Teleconsultations & Appointments
          </h1>
          <p className='text-xs sm:text-sm text-slate-500 mt-0.5'>
            View, filter, export, and manage bookings across all specialists with confirmation safety.
          </p>
        </div>

        <button
          type='button'
          onClick={exportAppointmentsCSV}
          disabled={filteredAppointments.length === 0}
          className='px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 self-start sm:self-auto'
        >
          <Download className='w-4 h-4 text-sky-600' />
          <span>Export Filtered CSV ({filteredAppointments.length})</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className='bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs'>
        <div className='inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100/80 border border-slate-200/60 rounded-xl'>
          {[
            { id: 'all', label: `All (${appointments.length})` },
            {
              id: 'upcoming',
              label: `Upcoming (${appointments.filter((a) => !a.cancelled && !a.isCompleted).length})`
            },
            {
              id: 'completed',
              label: `Completed (${appointments.filter((a) => a.isCompleted).length})`
            },
            {
              id: 'cancelled',
              label: `Cancelled (${appointments.filter((a) => a.cancelled).length})`
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className='px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-sky-500 cursor-pointer'
          >
            <option value='all'>All Payment Types</option>
            <option value='paid'>Paid Online</option>
            <option value='pending'>Payment Pending</option>
          </select>

          <div className='relative flex-1 sm:w-72'>
            <Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search patient, doctor, specialty...'
              className='w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-sky-500 text-slate-800'
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className='bg-white border border-slate-200 rounded-3xl text-sm overflow-hidden shadow-2xs'>
        <div className='hidden lg:grid grid-cols-[0.4fr_2fr_0.7fr_1.8fr_2.2fr_1.2fr_1.6fr] py-3.5 px-6 border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider'>
          <p>#</p>
          <p>Patient</p>
          <p>Age</p>
          <p>Date & Time</p>
          <p>Assigned Doctor</p>
          <p>Fee & Payment</p>
          <p className='text-right'>Status / Action</p>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className='py-14 px-6 text-center'>
            <CalendarCheck className='w-10 h-10 text-slate-300 mx-auto mb-2.5' />
            <p className='text-sm font-bold text-slate-700'>No appointments match your filter</p>
          </div>
        ) : (
          <div className='divide-y divide-slate-100'>
            {filteredAppointments.map((item, index) => (
              <div
                className='flex flex-wrap justify-between max-lg:gap-3 lg:grid lg:grid-cols-[0.4fr_2fr_0.7fr_1.8fr_2.2fr_1.2fr_1.6fr] items-center text-slate-600 py-4 px-6 hover:bg-slate-50/70 transition-colors'
                key={item._id || index}
              >
                <p className='max-lg:hidden text-xs font-bold text-slate-400'>{index + 1}</p>

                <div className='flex items-center gap-2.5 min-w-0'>
                  <img
                    src={item.userData?.image}
                    className='w-9 h-9 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0'
                    alt=''
                  />
                  <div className='min-w-0'>
                    <p className='font-bold text-slate-900 text-xs sm:text-sm truncate'>{item.userData?.name}</p>
                    {item.userData?.allergies?.length > 0 && (
                      <span className='inline-block text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200'>
                        ⚠️ {item.userData.allergies.length} allerg{item.userData.allergies.length === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </div>
                </div>

                <p className='max-lg:hidden text-xs font-medium'>{formatAge(item.userData?.dob)}</p>

                <div className='text-xs space-y-0.5'>
                  <p className='font-bold text-slate-800 flex items-center gap-1'>
                    <Calendar className='w-3.5 h-3.5 text-sky-600' />
                    {slotDateFormat(item.slotDate)}
                  </p>
                  <p className='text-slate-500 flex items-center gap-1'>
                    <Clock className='w-3.5 h-3.5 text-sky-600' />
                    {item.slotTime}
                  </p>
                </div>

                <div className='flex items-center gap-2.5 min-w-0'>
                  <img
                    src={item.docData?.image}
                    className='w-9 h-9 rounded-xl object-cover bg-sky-50 border border-slate-200 shrink-0'
                    alt=''
                  />
                  <div className='min-w-0'>
                    <p className='font-bold text-slate-800 text-xs sm:text-sm truncate'>{item.docData?.name}</p>
                    <p className='text-[11px] text-sky-600 font-semibold truncate'>{item.docData?.speciality}</p>
                  </div>
                </div>

                <div>
                  <p className='font-extrabold text-slate-900 text-xs sm:text-sm'>
                    {currency}{item.amount}
                  </p>
                  <div className='flex flex-wrap items-center gap-1 mt-0.5'>
                    <span
                      className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                        item.payment
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.payment ? 'Paid Online' : 'Payment Pending'}
                    </span>
                    {item.inPersonReferral?.urgency && (
                      <span
                        className='inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 uppercase'
                        title={`In-Person Hospital Visit Recommended: ${item.inPersonReferral.reason || ''}`}
                      >
                        Ref: {item.inPersonReferral.urgency}
                      </span>
                    )}
                  </div>
                </div>

                <div className='flex items-center justify-end gap-1.5'>
                  {item.cancelled ? (
                    <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50/80 border border-rose-200/80 text-rose-700 text-xs font-semibold'>
                      <XCircle className='w-3.5 h-3.5' />
                      Cancelled
                    </span>
                  ) : item.isCompleted ? (
                    <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-emerald-700 text-xs font-semibold'>
                      <CheckCircle2 className='w-3.5 h-3.5' />
                      Completed
                    </span>
                  ) : (
                    <>
                      <button
                        type='button'
                        onClick={() =>
                          setConfirmModal({
                            isOpen: true,
                            actionType: 'complete',
                            appointment: item
                          })
                        }
                        className='px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer'
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
                        className='px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer'
                      >
                        <X className='w-3.5 h-3.5' />
                        <span>Cancel</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AllAppointments
