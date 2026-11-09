import React, { useState, useEffect, useRef, useId } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Info,
  Pill,
  Zap,
  BookOpen,
  X
} from 'lucide-react'

const OVERRIDE_PRESETS = [
  'Benefit outweighs risk — close laboratory & clinical monitoring ordered',
  'Prior documented patient tolerance to this agent without adverse reaction',
  'Short-course acute regimen with dose adjustment & protective co-therapy'
]

const DDIAlertPanel = ({ report, onClose, onProceed }) => {
  const dialogRef = useRef(null)
  const titleId = useId()
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (report) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [report])

  // Native backdrop click & close listeners
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleNativeClose = () => {
      if (report) onClose()
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
  }, [report, onClose])

  if (!report) return null

  const {
    overallRisk,
    interactions = [],
    allergyAlerts = [],
    totalInteractions,
    totalAllergyAlerts,
    layer1LatencyMs
  } = report
  const isSevere = overallRisk === 'SEVERE'
  const canOverrideSevere = !isSevere || overrideReason.trim().length >= 5

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'SEVERE':
        return {
          bg: 'bg-rose-600',
          text: 'text-white',
          title: 'CRITICAL / SEVERE RISK DETECTED',
          desc: 'Contraindicated combinations or severe allergy conflicts identified. Major clinical intervention recommended.',
          Icon: ShieldAlert
        }
      case 'MODERATE':
        return {
          bg: 'bg-amber-500',
          text: 'text-white',
          title: 'MODERATE RISK — USE WITH CAUTION',
          desc: 'Significant clinical interactions detected. Dose adjustment or patient monitoring required.',
          Icon: AlertTriangle
        }
      case 'MILD':
        return {
          bg: 'bg-amber-400',
          text: 'text-slate-900',
          title: 'MILD / MINOR RISK',
          desc: 'Minor interaction detected. Usually clinically manageable with standard precautions.',
          Icon: Info
        }
      default:
        return {
          bg: 'bg-emerald-600',
          text: 'text-white',
          title: 'NO KNOWN INTERACTIONS DETECTED',
          desc: 'All prescribed medicines and known patient allergies cleared clinical safety rules.',
          Icon: ShieldCheck
        }
    }
  }

  const badge = getRiskBadge(overallRisk)
  const BadgeIcon = badge.Icon

  return (
    <dialog
      ref={dialogRef}
      {...{ closedby: 'any' }}
      aria-labelledby={titleId}
      className='m-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl max-w-3xl w-[calc(100%-2rem)] overflow-hidden backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs overscroll-contain'
    >
      <div className='flex flex-col max-h-[88vh] overflow-hidden'>
        {/* Header */}
        <div className={`${badge.bg} ${badge.text} p-6 relative shrink-0`}>
          <button
            type='button'
            onClick={onClose}
            className='absolute top-4 right-4 p-1.5 rounded-lg bg-black/15 hover:bg-black/25 text-white transition-colors cursor-pointer'
          >
            <X className='w-4 h-4' />
          </button>
          <div className='flex items-start gap-3.5 pr-8'>
            <div className='p-2.5 rounded-xl bg-black/15 shrink-0'>
              <BadgeIcon className='w-6 h-6' />
            </div>
            <div>
              <h3 id={titleId} className='text-lg font-bold tracking-tight'>{badge.title}</h3>
              <p className='text-xs opacity-90 mt-0.5'>{badge.desc}</p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2.5 mt-4 text-xs font-semibold'>
            <span className='inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-md'>
              <Pill className='w-3.5 h-3.5' />
              <span>Medicine Interactions: {totalInteractions}</span>
            </span>
            <span className='inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-md'>
              <Zap className='w-3.5 h-3.5' />
              <span>Allergy Conflicts: {totalAllergyAlerts}</span>
            </span>
            <span className='inline-flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-md'>
              <ShieldCheck className='w-3.5 h-3.5' />
              <span>
                Dual-Layer CDSS {typeof layer1LatencyMs === 'number' ? `(O(1) Hash: ${layer1LatencyMs}ms)` : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className='p-6 overflow-y-auto overscroll-contain space-y-6 flex-1 min-h-0 text-sm'>
          {/* Allergy Alerts First */}
          {allergyAlerts.length > 0 && (
            <div>
              <h4 className='font-bold text-rose-700 flex items-center gap-2 mb-3 text-sm uppercase tracking-wider'>
                <AlertTriangle className='w-4 h-4 text-rose-600' />
                <span>Patient Allergy Cross-Reactivity Alerts ({allergyAlerts.length})</span>
              </h4>
              <div className='space-y-3'>
                {allergyAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className='border-l-4 border-rose-500 bg-rose-50/70 p-4 rounded-r-xl space-y-2'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <span className='font-bold text-rose-950 text-xs sm:text-sm'>
                        Allergen: <span className='underline uppercase'>{alert.allergen}</span> →
                        Prescribed: <span className='underline uppercase'>{alert.drug}</span>
                      </span>
                      <span className='bg-rose-600 text-white text-[11px] px-2 py-0.5 rounded font-semibold uppercase'>
                        {alert.severity}
                      </span>
                    </div>
                    <p className='text-slate-700 text-xs'>
                      <strong className='text-slate-900'>Cross-Reactivity Rate:</strong>{' '}
                      {alert.crossReactivityRate}
                    </p>
                    <p className='text-slate-700 text-xs'>
                      <strong className='text-slate-900'>Clinical Effect:</strong> {alert.effect}
                    </p>
                    <div className='bg-white p-2.5 rounded-lg border border-rose-200 text-xs text-rose-800 font-medium'>
                      Recommendation: {alert.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drug-Drug Interactions */}
          {interactions.length > 0 && (
            <div>
              <h4 className='font-bold text-slate-800 flex items-center gap-2 mb-3 text-sm uppercase tracking-wider'>
                <Pill className='w-4 h-4 text-sky-600' />
                <span>Pharmacological Drug Interactions ({interactions.length})</span>
              </h4>
              <div className='space-y-3'>
                {interactions.map((interaction, idx) => {
                  const isSevereAlert = interaction.severity === 'SEVERE'
                  const isMod = interaction.severity === 'MODERATE'
                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-4 transition-all ${
                        isSevereAlert
                          ? 'border-rose-200 bg-rose-50/40'
                          : isMod
                          ? 'border-amber-200 bg-amber-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className='flex flex-wrap items-center justify-between gap-2 mb-2'>
                        <div className='font-bold text-slate-900 text-sm'>
                          {interaction.drugA} &nbsp;↔&nbsp; {interaction.drugB}
                        </div>
                        <div className='flex items-center gap-2'>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase ${
                              isSevereAlert
                                ? 'bg-rose-600 text-white'
                                : isMod
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-200 text-slate-900'
                            }`}
                          >
                            {interaction.severity}
                          </span>
                          <span className='text-[11px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-medium'>
                            {interaction.evidence}
                          </span>
                        </div>
                      </div>

                      <div className='space-y-1.5 text-xs text-slate-700'>
                        <p>
                          <strong className='text-slate-900'>Mechanism:</strong>{' '}
                          {interaction.mechanism}
                        </p>
                        <p>
                          <strong className='text-slate-900'>Clinical Effect:</strong>{' '}
                          {interaction.effect}
                        </p>
                        <div className='mt-2 bg-white p-2.5 rounded-lg border border-slate-200/80 text-xs text-slate-800'>
                          <strong className='text-sky-700'>Clinical Action:</strong>{' '}
                          {interaction.recommendation}
                        </div>
                        {interaction.references && interaction.references.length > 0 && (
                          <p className='text-[11px] text-slate-500 pt-1 flex items-center gap-1'>
                            <BookOpen className='w-3 h-3 shrink-0' />
                            <span>Reference: {interaction.references.join(', ')}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {interactions.length === 0 && allergyAlerts.length === 0 && (
            <div className='text-center py-8'>
              <div className='w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3'>
                <ShieldCheck className='w-6 h-6' />
              </div>
              <h4 className='text-base font-bold text-emerald-800'>Clear Clinical Profile</h4>
              <p className='text-slate-500 text-xs max-w-md mx-auto mt-1'>
                No documented drug-drug interactions or cross-reactivity warnings found for this medication regimen against patient records.
              </p>
            </div>
          )}

          {/* Mandatory ISMP Clinical Override Justification for SEVERE Contraindications */}
          {isSevere && onProceed && (
            <div className='bg-rose-50/90 border border-rose-300 rounded-xl p-4 space-y-2.5'>
              <p className='text-xs font-extrabold uppercase tracking-wider text-rose-900'>
                Mandatory Physician Override Justification (ISMP CDSS Audit Log) *
              </p>
              <div className='flex flex-wrap gap-1.5'>
                {OVERRIDE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type='button'
                    onClick={() => setOverrideReason(preset)}
                    className='text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold transition-colors cursor-pointer text-left'
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder='Document clinical rationale for overriding this contraindication (min 5 chars, logged to prescription audit trail)...'
                className='w-full bg-white border border-rose-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-rose-600'
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className='text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/80'>
            {report.disclaimer ||
              'This automated safety check is for clinical decision support only. It does not replace professional pharmaceutical judgment.'}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className='bg-slate-50/80 px-6 py-3.5 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0'>
          <button
            type='button'
            onClick={onClose}
            className='h-9 px-3.5 border border-slate-200/90 bg-white rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer'
          >
            Modify Prescription
          </button>
          {onProceed && (
            <button
              type='button'
              disabled={!canOverrideSevere}
              onClick={() => onProceed(overrideReason.trim())}
              className={`h-9 px-4 rounded-lg font-semibold text-xs text-white transition-all ${
                !canOverrideSevere
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : overallRisk === 'SEVERE'
                  ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                  : 'bg-sky-600 hover:bg-sky-700 cursor-pointer'
              }`}
            >
              {overallRisk === 'SEVERE'
                ? 'Log Justification & Override'
                : 'Proceed with Prescription'}
            </button>
          )}
        </div>
      </div>
    </dialog>
  )
}

export default DDIAlertPanel
