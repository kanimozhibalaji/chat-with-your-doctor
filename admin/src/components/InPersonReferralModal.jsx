import React, { useState, useEffect, useRef, useId } from 'react'
import {
  Building2,
  AlertTriangle,
  Clock,
  X,
  CheckCircle2,
  FileText,
  Trash2,
  ShieldAlert,
  ArrowRight
} from 'lucide-react'

const REFERRAL_REASONS = [
  'Physical Examination Required (Palpation / auscultation / abdominal exam)',
  'Diagnostic Imaging (X-Ray / CT Scan / MRI / Ultrasound)',
  'Laboratory Blood / Specimen Workup (Fasting blood test, cultures, biopsy)',
  'Clinical In-Person Procedure / Wound Care / Injections',
  'Emergency Department Evaluation (Acute chest pain, severe dyspnea, trauma)',
  'Specialist In-Person Hospital Review'
]

const URGENCY_OPTIONS = [
  { id: 'ROUTINE', label: 'Routine', sub: 'Within 2–4 weeks', badge: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'WITHIN_WEEK', label: 'Within 7 Days', sub: 'Non-emergency review', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'URGENT', label: 'Urgent (24–48 Hours)', sub: 'Requires timely hospital visit', badge: 'bg-orange-50 text-orange-800 border-orange-200' },
  { id: 'EMERGENCY', label: 'Emergency', sub: 'Go to nearest hospital immediately', badge: 'bg-rose-50 text-rose-800 border-rose-300' }
]

const InPersonReferralModal = ({
  isOpen,
  onClose,
  appointment,
  onSaveReferral,
  loading = false
}) => {
  const dialogRef = useRef(null)
  const titleId = useId()

  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState('ROUTINE')
  const [facility, setFacility] = useState('')
  const [notes, setNotes] = useState('')

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

  // Native backdrop click and close listeners
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

  useEffect(() => {
    if (appointment?.inPersonReferral) {
      const ref = appointment.inPersonReferral
      setReason(ref.reason || '')
      setUrgency(ref.urgency || 'ROUTINE')
      setFacility(ref.facility || '')
      setNotes(ref.notes || '')
    } else {
      setReason(REFERRAL_REASONS[0])
      setUrgency('ROUTINE')
      setFacility('')
      setNotes('')
    }
  }, [appointment, isOpen])

  if (!isOpen || !appointment) return null

  const hasExistingReferral = Boolean(appointment.inPersonReferral)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSaveReferral({
      appointmentId: appointment._id,
      reason,
      urgency,
      facility,
      notes,
      clear: false
    })
  }

  const handleClear = () => {
    if (window.confirm('Withdraw this in-person hospital referral? The patient will be notified that the case was fully resolved online.')) {
      onSaveReferral({
        appointmentId: appointment._id,
        clear: true
      })
    }
  }

  return (
    <dialog
      ref={dialogRef}
      {...{ closedby: 'any' }}
      aria-labelledby={titleId}
      className='m-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl max-w-xl w-[calc(100%-2rem)] overflow-hidden backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs overscroll-contain'
    >
      <div className='p-6 sm:p-7 space-y-5 max-h-[88vh] overflow-y-auto overscroll-contain'>
        {/* Header */}
        <div className='flex items-start justify-between gap-4 pb-4 border-b border-slate-100'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0'>
              <Building2 className='w-6 h-6' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <h3 id={titleId} className='text-base font-extrabold text-slate-900'>
                  Recommend In-Person Hospital Visit
                </h3>
              </div>
              <p className='text-xs text-slate-500 mt-0.5'>
                Patient: <strong className='text-slate-800'>{appointment.userData?.name}</strong> • Only recommend when teleconsultation cannot safely or fully resolve the case.
              </p>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Philosophy Note */}
        <div className='bg-sky-50/80 border border-sky-200/80 rounded-2xl p-3.5 text-xs text-sky-900 flex items-start gap-2.5 leading-relaxed'>
          <AlertTriangle className='w-4 h-4 text-sky-600 shrink-0 mt-0.5' />
          <div>
            <span className='font-bold'>Queue-Skip Philosophy: </span>
            Most routine follow-ups, minor illnesses, and prescription refills are resolved 100% online. Use this referral when hands-on examination, imaging, or urgent physical intervention is necessary.
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Reason Selection */}
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2'>
              Clinical Reason for In-Person Visit *
            </label>
            <div className='space-y-1.5'>
              {REFERRAL_REASONS.map((r, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    reason === r
                      ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type='radio'
                    name='referralReason'
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className='mt-0.5 text-sky-600 focus:ring-sky-500'
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2'>
              Urgency Level *
            </label>
            <div className='grid grid-cols-2 gap-2'>
              {URGENCY_OPTIONS.map((u) => {
                const selected = urgency === u.id
                return (
                  <button
                    key={u.id}
                    type='button'
                    onClick={() => setUrgency(u.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <p className='text-xs font-bold'>{u.label}</p>
                    <p className={`text-[11px] mt-0.5 ${selected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {u.sub}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Suggested Hospital / Facility */}
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5'>
              Suggested Hospital / Clinic Center (Optional)
            </label>
            <input
              type='text'
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder='e.g., City General Hospital Emergency or Nearest Radiology Center'
              className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-sky-500 text-slate-800'
            />
          </div>

          {/* Doctor Notes */}
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5'>
              Doctor's Instructions for In-Person Team (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='Specific instructions (e.g. Please bring complete fasting blood workup; Rule out appendicitis)...'
              className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-sky-500 text-slate-800 resize-none'
            />
          </div>

          {/* Actions */}
          <div className='pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3'>
            {hasExistingReferral ? (
              <button
                type='button'
                onClick={handleClear}
                disabled={loading}
                className='px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer'
              >
                <Trash2 className='w-3.5 h-3.5' />
                <span>Withdraw Referral (Resolved Online)</span>
              </button>
            ) : (
              <div />
            )}

            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading || !reason}
                className='px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5'
              >
                <CheckCircle2 className='w-3.5 h-3.5' />
                <span>{hasExistingReferral ? 'Update Referral' : 'Send In-Person Referral'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  )
}

export default InPersonReferralModal
