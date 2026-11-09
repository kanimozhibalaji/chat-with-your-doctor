import React, { useEffect, useRef, useId } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Calendar, Clock, User, ShieldAlert, Sparkles } from 'lucide-react'

/**
 * Reusable Confirmation Modal for Appointment Actions (Complete Visit / Cancel Visit)
 * Prevents accidental single-click state changes and clearly explains what the action does.
 */
const ConfirmActionModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionType = 'complete', // 'complete' | 'cancel'
  appointment = null,
  slotDateFormat = (d) => d,
  currency = '₹',
  loading = false
}) => {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  // Fallback for browsers without native <dialog closedby="any"> support
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleNativeClose = () => {
      if (isOpen) onClose()
    }
    dialog.addEventListener('close', handleNativeClose)

    let handleBackdropClick = null
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        if (isDialogContent) return
        dialog.close()
      }
      dialog.addEventListener('click', handleBackdropClick)
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose)
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen || !appointment) return null

  const isComplete = actionType === 'complete'
  const patientName = appointment.userData?.name || 'Patient'
  const patientImage = appointment.userData?.image
  const doctorName = appointment.docData?.name
  const formattedDate = appointment.slotDate ? slotDateFormat(appointment.slotDate) : ''
  const slotTime = appointment.slotTime || ''

  return (
    <dialog
      ref={dialogRef}
      {...{ closedby: 'any' }}
      aria-labelledby={titleId}
      className='m-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl max-w-md w-[calc(100%-2rem)] overflow-hidden backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs'
    >
      <div className='p-6 sm:p-7'>
        {/* Top Icon + Header */}
        <div className='flex items-start gap-4'>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isComplete
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            {isComplete ? <CheckCircle2 className='w-6 h-6' /> : <AlertTriangle className='w-6 h-6' />}
          </div>

          <div className='flex-1 min-w-0'>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
                isComplete
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isComplete ? 'Confirm Completion' : 'Confirm Cancellation'}
            </span>
            <h2 id={titleId} className='text-lg font-extrabold text-slate-900 leading-snug'>
              {isComplete ? 'Mark this consultation as completed?' : 'Cancel this patient appointment?'}
            </h2>
          </div>
        </div>

        {/* Patient & Appointment Context Card */}
        <div className='mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5'>
          {patientImage ? (
            <img
              src={patientImage}
              alt={patientName}
              className='w-12 h-12 rounded-full object-cover border border-slate-200 bg-white shrink-0'
            />
          ) : (
            <div className='w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0'>
              <User className='w-5 h-5' />
            </div>
          )}
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-bold text-slate-900 truncate'>{patientName}</p>
            {doctorName && (
              <p className='text-xs text-slate-500 truncate'>Doctor: {doctorName}</p>
            )}
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-600 font-medium'>
              {formattedDate && (
                <span className='inline-flex items-center gap-1'>
                  <Calendar className='w-3.5 h-3.5 text-sky-600' />
                  {formattedDate}
                </span>
              )}
              {slotTime && (
                <span className='inline-flex items-center gap-1'>
                  <Clock className='w-3.5 h-3.5 text-sky-600' />
                  {slotTime}
                </span>
              )}
              {appointment.amount !== undefined && (
                <span className='font-bold text-slate-800'>
                  {currency}{appointment.amount} ({appointment.payment ? 'Paid Online' : 'Payment Pending'})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clear Context Explanation of What This Action Does */}
        <div
          className={`mt-4 p-4 rounded-2xl border text-xs space-y-2 ${
            isComplete
              ? 'bg-emerald-50/50 border-emerald-200/80 text-slate-700'
              : 'bg-rose-50/50 border-rose-200/80 text-slate-700'
          }`}
        >
          <p className='font-bold text-slate-900 flex items-center gap-1.5'>
            {isComplete ? (
              <>
                <Sparkles className='w-4 h-4 text-emerald-600 shrink-0' />
                <span>What happens when you mark as completed:</span>
              </>
            ) : (
              <>
                <ShieldAlert className='w-4 h-4 text-rose-600 shrink-0' />
                <span>What happens when you cancel this visit:</span>
              </>
            )}
          </p>
          {isComplete ? (
            <ul className='list-disc list-inside space-y-1 text-slate-600 leading-relaxed'>
              <li>Records this visit as <strong>Completed</strong> and adds the fee to your earnings.</li>
              <li>Sends an instant real-time notification to <strong>{patientName}</strong>.</li>
              <li>You can still view or update their digital prescription anytime.</li>
            </ul>
          ) : (
            <ul className='list-disc list-inside space-y-1 text-slate-600 leading-relaxed'>
              <li>Marks this appointment as <strong>Cancelled</strong> and releases the {slotTime} slot.</li>
              <li>Immediately notifies <strong>{patientName}</strong> so they can rebook if needed.</li>
              <li>This action cannot be undone once confirmed.</li>
            </ul>
          )}
        </div>

        {/* Action Buttons */}
        <div className='mt-6 flex items-center justify-end gap-3'>
          <button
            type='button'
            disabled={loading}
            onClick={() => dialogRef.current?.close()}
            className='px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer'
          >
            Go Back
          </button>
          <button
            type='button'
            disabled={loading}
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              isComplete
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
            }`}
          >
            {isComplete ? <CheckCircle2 className='w-4 h-4' /> : <XCircle className='w-4 h-4' />}
            <span>
              {loading
                ? 'Processing...'
                : isComplete
                ? 'Yes, Mark Visit Completed'
                : 'Yes, Cancel Appointment'}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default ConfirmActionModal
