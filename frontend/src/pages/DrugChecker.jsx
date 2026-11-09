import React, { useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  Pill,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  Info,
  BookOpen,
  User,
  HeartPulse
} from 'lucide-react'

const DrugChecker = () => {
  const { backendUrl, token, userData } = useContext(AppContext)
  const navigate = useNavigate()

  const [medicines, setMedicines] = useState([{ name: '' }, { name: '' }])
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)

  const samplePairs = [
    { label: 'Warfarin + Aspirin', meds: ['Warfarin', 'Aspirin'] },
    { label: 'Ibuprofen + Lisinopril', meds: ['Ibuprofen', 'Lisinopril'] },
    { label: 'Paracetamol + Cetirizine', meds: ['Paracetamol', 'Cetirizine'] },
    { label: 'Metformin + Atorvastatin', meds: ['Metformin', 'Atorvastatin'] }
  ]

  const addMedicine = () => {
    setMedicines((prev) => [...prev, { name: '' }])
  }

  const removeMedicine = (index) => {
    if (medicines.length <= 1) return
    setMedicines((prev) => prev.filter((_, i) => i !== index))
  }

  const updateMedicine = (index, value) => {
    setMedicines((prev) => prev.map((med, i) => (i === index ? { name: value } : med)))
  }

  const loadSample = (medsArray) => {
    setMedicines(medsArray.map((name) => ({ name })))
    setReport(null)
  }

  const checkInteractions = async () => {
    const validMeds = medicines.filter((m) => m.name.trim())
    if (validMeds.length === 0) {
      toast.error('Please enter at least one medicine name')
      return
    }

    setLoading(true)
    setReport(null)

    try {
      const payload = {
        medicines: validMeds,
        userId: token && userData?._id ? userData._id : undefined,
        patientAllergies: userData?.allergies || [],
        currentMedications: userData?.currentMedications || []
      }

      const { data } = await axios.post(backendUrl + '/api/ddi/check', payload)
      if (data.success) {
        setReport(data.report)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error('Interaction check failed:', error)
      toast.error('Could not check medicines right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getRiskStyles = (risk) => {
    switch (risk) {
      case 'SEVERE':
        return {
          bg: 'bg-rose-50/90',
          border: 'border-rose-300',
          badge: 'bg-rose-600 text-white',
          label: 'Critical / Contraindicated',
          Icon: ShieldAlert
        }
      case 'MODERATE':
        return {
          bg: 'bg-amber-50/90',
          border: 'border-amber-300',
          badge: 'bg-amber-600 text-white',
          label: 'Moderate Risk — Consult Physician',
          Icon: AlertTriangle
        }
      case 'MILD':
        return {
          bg: 'bg-amber-50/70',
          border: 'border-amber-200',
          badge: 'bg-amber-500 text-white',
          label: 'Mild Interaction',
          Icon: Info
        }
      default:
        return {
          bg: 'bg-emerald-50/90',
          border: 'border-emerald-200',
          badge: 'bg-emerald-600 text-white',
          label: 'Clear Clinical Profile',
          Icon: ShieldCheck
        }
    }
  }

  const userAllergies = userData?.allergies || []

  return (
    <div className='min-h-[85vh] py-8 max-w-5xl mx-auto space-y-8'>
      {/* Hero Header */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 max-w-2xl space-y-3'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold'>
            <Pill className='w-4 h-4 text-sky-400' />
            <span>Clinical Pharmacology Engine</span>
          </div>

          <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight'>
            Medicine Safety & Allergy Checker
          </h1>

          <p className='text-slate-300 text-sm sm:text-base leading-relaxed'>
            Enter two or more medications to analyze potential drug-drug interactions, cross-reactions, and conflicts with your recorded patient allergies before taking them.
          </p>
        </div>
      </section>

      {/* Patient Profile Link Strip (If logged in) */}
      {token && userData && (
        <section className='bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shrink-0'>
              <User className='w-5 h-5' />
            </div>
            <div>
              <p className='text-xs font-bold text-slate-900'>
                Checking against patient: <span className='text-sky-600'>{userData.name}</span>
              </p>
              <p className='text-[11px] text-slate-500 mt-0.5'>
                {userAllergies.length > 0
                  ? `Known allergies screened: ${userAllergies.join(', ')}`
                  : 'No reported allergies in your profile.'}
              </p>
            </div>
          </div>

          <button
            type='button'
            onClick={() => navigate('/my-profile')}
            className='text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer shrink-0 self-start sm:self-auto'
          >
            Update Allergies in Profile →
          </button>
        </section>
      )}

      {/* Main Form & Fast Samples */}
      <section className='bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6'>
        <div>
          <div className='flex flex-wrap items-center justify-between gap-2 mb-3'>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700'>
              Try a Quick Clinical Example:
            </label>
            <span className='text-[11px] text-slate-400'>Click any combination below</span>
          </div>

          <div className='flex flex-wrap gap-2'>
            {samplePairs.map((pair, idx) => (
              <button
                key={idx}
                type='button'
                onClick={() => loadSample(pair.meds)}
                className='px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 text-xs font-semibold text-slate-700 hover:text-sky-800 transition-colors cursor-pointer'
              >
                + {pair.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Medicine Inputs */}
        <div className='space-y-3 pt-3 border-t border-slate-100'>
          <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700'>
            Enter Medicines to Compare:
          </label>

          <div className='space-y-2.5 max-w-xl'>
            {medicines.map((med, index) => (
              <div key={index} className='flex items-center gap-2.5'>
                <div className='relative flex-1'>
                  <Pill className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none' />
                  <input
                    type='text'
                    value={med.name}
                    onChange={(e) => updateMedicine(index, e.target.value)}
                    placeholder={`Medicine #${index + 1} (e.g. Aspirin, Paracetamol, Metformin)`}
                    className='w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500 bg-white transition-colors'
                  />
                </div>

                {medicines.length > 1 && (
                  <button
                    type='button'
                    onClick={() => removeMedicine(index)}
                    className='p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer'
                    title='Remove medicine'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className='flex flex-wrap items-center gap-3 pt-2'>
            <button
              type='button'
              onClick={addMedicine}
              className='px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer'
            >
              <Plus className='w-3.5 h-3.5' />
              <span>Add Another Medicine</span>
            </button>

            <button
              type='button'
              disabled={loading}
              onClick={checkInteractions}
              className='px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50'
            >
              <Sparkles className='w-4 h-4' />
              <span>{loading ? 'Analyzing Clinical Safety...' : 'Run Interaction Analysis'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {report && (
        <section className='space-y-6 animate-fadeIn'>
          {(() => {
            const riskConfig = getRiskStyles(report.overallRisk)
            const RiskIcon = riskConfig.Icon
            const interactions = report.interactions || []
            const allergyAlerts = report.allergyAlerts || []

            return (
              <div className={`p-6 sm:p-8 rounded-3xl border ${riskConfig.bg} ${riskConfig.border} shadow-sm space-y-6`}>
                {/* Result Header */}
                <div className='flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80'>
                  <div className='flex items-center gap-3.5'>
                    <div className='p-3 rounded-2xl bg-white shadow-2xs'>
                      <RiskIcon className='w-7 h-7 text-slate-900' />
                    </div>
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${riskConfig.badge}`}>
                        {riskConfig.label}
                      </span>
                      <h3 className='text-lg sm:text-xl font-extrabold text-slate-900 mt-1'>
                        Analysis Complete: {interactions.length} Interactions, {allergyAlerts.length} Allergy Alerts
                      </h3>
                    </div>
                  </div>

                  <span className='text-xs font-bold bg-white/80 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700'>
                    Pharmacological CDSS v2.0
                  </span>
                </div>

                {/* AI Plain-English Summary */}
                {report.aiSummary && (
                  <div className='bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5'>
                    <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700'>
                      <Sparkles className='w-4 h-4 text-sky-600' />
                      <span>Clinical Safety Summary</span>
                    </div>
                    <p className='text-xs sm:text-sm text-slate-700 leading-relaxed'>
                      {report.aiSummary}
                    </p>
                  </div>
                )}

                {/* Patient Allergy Cross-Reactivity Alerts */}
                {allergyAlerts.length > 0 && (
                  <div className='space-y-3'>
                    <h4 className='text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-2'>
                      <ShieldAlert className='w-4 h-4 text-rose-600' />
                      <span>Reported Allergy Conflicts ({allergyAlerts.length})</span>
                    </h4>

                    {allergyAlerts.map((alert, i) => (
                      <div key={i} className='bg-white p-4.5 rounded-2xl border border-rose-200 text-xs space-y-2 shadow-2xs'>
                        <div className='flex items-center justify-between'>
                          <span className='font-bold text-rose-950 text-sm'>
                            Patient Allergy: <strong className='underline uppercase'>{alert.allergen}</strong> → Medicine: <strong className='underline uppercase'>{alert.drug}</strong>
                          </span>
                          <span className='px-2.5 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase'>
                            {alert.severity}
                          </span>
                        </div>
                        <p className='text-slate-700'>{alert.effect}</p>
                        <div className='bg-rose-50 p-2.5 rounded-xl border border-rose-100 font-semibold text-rose-900'>
                          Recommendation: {alert.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drug-Drug Interactions Breakdown */}
                {interactions.length > 0 && (
                  <div className='space-y-3'>
                    <h4 className='text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2'>
                      <Pill className='w-4 h-4 text-sky-600' />
                      <span>Drug Interaction Details ({interactions.length})</span>
                    </h4>

                    {interactions.map((item, i) => (
                      <div key={i} className='bg-white p-5 rounded-2xl border border-slate-200 text-xs space-y-2.5 shadow-2xs'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <h5 className='text-sm font-extrabold text-slate-900'>
                            {item.drugA} &nbsp;↔&nbsp; {item.drugB}
                          </h5>
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                              item.severity === 'SEVERE'
                                ? 'bg-rose-600 text-white'
                                : item.severity === 'MODERATE'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 text-slate-800'
                            }`}
                          >
                            {item.severity} Risk
                          </span>
                        </div>

                        <div className='space-y-1 text-slate-700'>
                          <p>
                            <strong className='text-slate-900'>Mechanism:</strong> {item.mechanism}
                          </p>
                          <p>
                            <strong className='text-slate-900'>Clinical Effect:</strong> {item.effect}
                          </p>
                        </div>

                        <div className='bg-sky-50/70 p-3 rounded-xl border border-sky-100 text-sky-900 font-medium'>
                          <strong>Recommended Precaution:</strong> {item.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* If severe, offer direct doctor booking CTA */}
                {report.overallRisk === 'SEVERE' && (
                  <div className='bg-rose-100/90 border border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4'>
                    <div className='text-xs text-rose-950'>
                      <strong>Contraindication Notice:</strong> Do not adjust prescription regimens without speaking to a qualified physician.
                    </div>
                    <button
                      type='button'
                      onClick={() => navigate('/doctors')}
                      className='px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0'
                    >
                      <span>Consult a Doctor</span>
                      <ArrowRight className='w-3.5 h-3.5' />
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </section>
      )}
    </div>
  )
}

export default DrugChecker
