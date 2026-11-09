import React, { useState, useEffect, useContext } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import { AppContext } from '../context/AppContext'
import {
  X,
  FileText,
  Activity,
  HeartPulse,
  AlertTriangle,
  Pill,
  Sparkles,
  ZoomIn,
  ExternalLink,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Phone,
  Mail,
  ShieldAlert,
  ClipboardList,
  RefreshCw
} from 'lucide-react'

const PatientHealthDrawer = ({ isOpen, onClose, userId, patientFallback = null, reasonForVisit = '' }) => {
  const { dToken, backendUrl } = useContext(DoctorContext)
  const { calculateAge } = useContext(AppContext)

  const [loading, setLoading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [activeTab, setActiveTab] = useState('reports') // 'reports' | 'vitals' | 'prescriptions'
  const [dossier, setDossier] = useState({
    patient: null,
    records: [],
    biomarkers: [],
    vitals: [],
    prescriptions: []
  })
  const [lightboxRecord, setLightboxRecord] = useState(null)

  const fetchDossier = async () => {
    if (!userId || !dToken) return
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/doctor/patient-dossier/${userId}`, {
        headers: { dToken }
      })
      if (data.success) {
        setDossier({
          patient: data.patient,
          records: data.records || [],
          biomarkers: data.biomarkers || [],
          vitals: data.vitals || [],
          prescriptions: data.prescriptions || []
        })
      } else {
        toast.error(data.message || 'Could not load patient records')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userId) {
      fetchDossier()
    }
  }, [isOpen, userId])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleAnalyzeReport = async (recordId) => {
    setAnalyzingId(recordId)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/analyze-patient-record`,
        { recordId },
        { headers: { dToken } }
      )
      if (data.success) {
        toast.success('AI Lab Report Analysis Complete')
        fetchDossier()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setAnalyzingId(null)
    }
  }

  if (!isOpen) return null

  const patient = dossier.patient || patientFallback || {}
  const age = patient.dob ? calculateAge(patient.dob) : null
  const allergies = Array.isArray(patient.allergies) ? patient.allergies.filter(Boolean) : []
  const regularMeds = Array.isArray(patient.currentMedications)
    ? patient.currentMedications
        .map((m) => (typeof m === 'string' ? m : `${m.name || ''} ${m.dosage || ''}`.trim()))
        .filter(Boolean)
    : []

  return (
    <>
      <div 
        onClick={onClose}
        className='fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-fadeIn overscroll-contain'
      >
        <div
          className='relative w-full max-w-3xl bg-slate-50 h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden overscroll-contain'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className='bg-slate-900 text-white px-6 py-5 flex items-start justify-between gap-4 shrink-0'>
            <div className='flex items-center gap-4 min-w-0'>
              {patient.image ? (
                <img
                  src={patient.image}
                  alt={patient.name}
                  className='w-14 h-14 rounded-2xl object-cover border-2 border-white/20 bg-slate-800 shrink-0'
                />
              ) : (
                <div className='w-14 h-14 rounded-2xl bg-sky-600 text-white font-black text-xl flex items-center justify-center shrink-0'>
                  {(patient.name || 'P').charAt(0).toUpperCase()}
                </div>
              )}
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h2 className='text-lg font-extrabold tracking-tight truncate'>
                    {patient.name || 'Patient Health Dossier'}
                  </h2>
                  <span className='px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30'>
                    Clinical Records & Vitals
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1'>
                  {patient.gender && <span>{patient.gender}</span>}
                  {Number.isFinite(age) && <span>• {age} yrs</span>}
                  {patient.phone && (
                    <span className='inline-flex items-center gap-1'>
                      • <Phone className='w-3 h-3 text-sky-400' /> {patient.phone}
                    </span>
                  )}
                  {patient.email && (
                    <span className='inline-flex items-center gap-1 truncate'>
                      • <Mail className='w-3 h-3 text-sky-400' /> {patient.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <button
                onClick={fetchDossier}
                disabled={loading}
                title='Refresh Dossier'
                className='p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer'
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className='p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
          </div>

          {/* Reason for Visit + Allergies & Regular Medications Banner */}
          <div className='bg-white border-b border-slate-200 px-6 py-3.5 space-y-2.5 shrink-0'>
            {reasonForVisit && (
              <div className='flex items-start gap-2.5 bg-sky-50/90 border border-sky-200/80 rounded-xl px-3.5 py-2 text-xs'>
                <ClipboardList className='w-4 h-4 text-sky-600 shrink-0 mt-0.5' />
                <div>
                  <span className='font-bold text-sky-900'>Reason for Visit / Chief Complaint: </span>
                  <span className='text-sky-800 font-medium'>{reasonForVisit}</span>
                </div>
              </div>
            )}

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
              {/* Allergies */}
              <div
                className={`rounded-xl px-3.5 py-2 border flex items-center gap-2.5 ${
                  allergies.length > 0
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600'
                }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 ${allergies.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}
                />
                <div className='min-w-0 flex-1 text-xs'>
                  <span className='font-bold'>Known Allergies: </span>
                  {allergies.length > 0 ? (
                    <span className='font-extrabold text-rose-700'>{allergies.join(', ')}</span>
                  ) : (
                    <span className='text-slate-500'>No known drug allergies</span>
                  )}
                </div>
              </div>

              {/* Regular Meds */}
              <div className='rounded-xl px-3.5 py-2 border bg-amber-50/60 border-amber-200/80 flex items-center gap-2.5'>
                <Pill className='w-4 h-4 text-amber-600 shrink-0' />
                <div className='min-w-0 flex-1 text-xs'>
                  <span className='font-bold text-amber-900'>Regular Meds: </span>
                  {regularMeds.length > 0 ? (
                    <span className='font-semibold text-amber-800'>{regularMeds.join(', ')}</span>
                  ) : (
                    <span className='text-slate-500'>None reported</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className='bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-2 shrink-0 overflow-x-auto'>
            {[
              {
                id: 'reports',
                label: 'Uploaded Lab Reports & AI Summary',
                count: dossier.records.length,
                icon: FileText
              },
              {
                id: 'vitals',
                label: 'Vitals & Biomarker Trends',
                count: dossier.vitals.length + dossier.biomarkers.length,
                icon: HeartPulse
              },
              {
                id: 'prescriptions',
                label: 'Past Prescriptions',
                count: dossier.prescriptions.length,
                icon: Pill
              }
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className='w-3.5 h-3.5' />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Drawer Body */}
          <div className='flex-1 overflow-y-auto p-6 space-y-5'>
            {loading ? (
              <div className='py-20 text-center space-y-3'>
                <div className='w-9 h-9 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto' />
                <p className='text-xs font-semibold text-slate-500'>Loading patient clinical records & vitals...</p>
              </div>
            ) : activeTab === 'reports' ? (
              /* TAB 1: UPLOADED LAB REPORTS & AI SUMMARY */
              dossier.records.length === 0 ? (
                <div className='bg-white rounded-2xl border border-slate-200 p-12 text-center'>
                  <div className='w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3'>
                    <FileText className='w-6 h-6' />
                  </div>
                  <p className='text-sm font-bold text-slate-800'>No Uploaded Lab Reports Yet</p>
                  <p className='text-xs text-slate-500 mt-1 max-w-sm mx-auto'>
                    When this patient uploads blood tests, X-rays, or lab reports in their My Health portal, they will appear here automatically with AI summaries.
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {dossier.records.map((rec) => {
                    const ai = rec.aiExtractedData || {}
                    const metrics = ai.vitalMetrics ? Object.entries(ai.vitalMetrics) : []
                    const flagged = Array.isArray(ai.flaggedValues) ? ai.flaggedValues : []
                    const findings = Array.isArray(ai.keyFindings) ? ai.keyFindings : []

                    return (
                      <div
                        key={rec._id}
                        className='bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden'
                      >
                        {/* Report Top Bar */}
                        <div className='p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 border-b border-slate-100'>
                          {/* Thumbnail */}
                          <div
                            onClick={() => setLightboxRecord(rec)}
                            className='group relative w-full sm:w-28 h-36 sm:h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer'
                          >
                            <img
                              src={rec.fileUrl}
                              alt={rec.fileName}
                              className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                            />
                            <div className='absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
                              <span className='px-2.5 py-1 rounded-lg bg-white/95 text-slate-900 text-[11px] font-bold inline-flex items-center gap-1 shadow-sm'>
                                <ZoomIn className='w-3.5 h-3.5 text-sky-600' /> Enlarge
                              </span>
                            </div>
                          </div>

                          {/* Report Meta & Summary */}
                          <div className='flex-1 min-w-0 space-y-2'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                              <div>
                                <div className='flex flex-wrap items-center gap-2'>
                                  <h4 className='text-sm font-extrabold text-slate-900 truncate'>
                                    {rec.fileName || 'Medical Report'}
                                  </h4>
                                  {ai.reportType && (
                                    <span className='px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200'>
                                      {ai.reportType}
                                    </span>
                                  )}
                                </div>
                                <p className='text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5'>
                                  <Calendar className='w-3 h-3' />
                                  Uploaded{' '}
                                  {rec.uploadDate
                                    ? new Date(rec.uploadDate).toLocaleDateString('en-US', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                      })
                                    : 'Recently'}
                                </p>
                              </div>

                              <div className='flex items-center gap-2'>
                                <button
                                  onClick={() => setLightboxRecord(rec)}
                                  className='px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer'
                                >
                                  <ZoomIn className='w-3.5 h-3.5 text-sky-600' /> View Full Report
                                </button>
                                {!rec.isAnalyzed && (
                                  <button
                                    onClick={() => handleAnalyzeReport(rec._id)}
                                    disabled={analyzingId === rec._id}
                                    className='px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs'
                                  >
                                    <Sparkles className='w-3.5 h-3.5' />
                                    {analyzingId === rec._id ? 'Analyzing...' : 'Run AI Summary'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {rec.isAnalyzed && (rec.aiSummary || ai.summary) ? (
                              <div className='bg-sky-50/70 border border-sky-100 rounded-xl p-3 text-xs text-slate-700 leading-relaxed'>
                                <span className='font-bold text-sky-900 inline-flex items-center gap-1 mr-1.5'>
                                  <Sparkles className='w-3.5 h-3.5 text-sky-600' /> AI Clinical Summary:
                                </span>
                                {rec.aiSummary || ai.summary}
                              </div>
                            ) : (
                              <p className='text-xs text-slate-400 italic'>
                                AI summary not generated yet. Click "Run AI Summary" to extract key biomarkers and abnormal findings.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Extracted Biomarkers, Flagged Values & Key Findings */}
                        {rec.isAnalyzed && (flagged.length > 0 || metrics.length > 0 || findings.length > 0) && (
                          <div className='p-4 sm:p-5 bg-slate-50/60 space-y-4'>
                            {/* Flagged Abnormal Values */}
                            {flagged.length > 0 && (
                              <div className='bg-rose-50/90 border border-rose-200 rounded-xl p-3'>
                                <p className='text-[11px] font-extrabold uppercase tracking-wider text-rose-800 flex items-center gap-1.5 mb-1.5'>
                                  <AlertTriangle className='w-3.5 h-3.5 text-rose-600' /> Flagged / Abnormal Values
                                </p>
                                <div className='flex flex-wrap gap-1.5'>
                                  {flagged.map((val, idx) => (
                                    <span
                                      key={idx}
                                      className='px-2.5 py-1 rounded-lg bg-white text-rose-700 border border-rose-200 text-xs font-bold'
                                    >
                                      {val}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Extracted Vital Metrics Grid */}
                            {metrics.length > 0 && (
                              <div>
                                <p className='text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2'>
                                  Extracted Lab Values ({metrics.length})
                                </p>
                                <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5'>
                                  {metrics.map(([k, v], idx) => (
                                    <div
                                      key={idx}
                                      className='bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs'
                                    >
                                      <p className='text-[10px] font-semibold text-slate-400 uppercase truncate'>
                                        {k.replace(/_/g, ' ')}
                                      </p>
                                      <p className='text-xs font-extrabold text-slate-900 mt-0.5'>{String(v)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Key Findings */}
                            {findings.length > 0 && (
                              <div>
                                <p className='text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5'>
                                  Key Observations
                                </p>
                                <ul className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
                                  {findings.map((f, idx) => (
                                    <li
                                      key={idx}
                                      className='text-xs text-slate-700 flex items-start gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60'
                                    >
                                      <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5' />
                                      <span>{f}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : activeTab === 'vitals' ? (
              /* TAB 2: CLINICAL VITALS, RCP NEWS2 TRIAGE & BIOMARKER TRENDS */
              <div className='space-y-6'>
                {/* Section A: Structured Home Clinical Vitals & 15s POS-rPPG Readings */}
                <div className='bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs'>
                  <div className='flex items-center justify-between mb-4'>
                    <div>
                      <h3 className='text-sm font-extrabold text-slate-900 flex items-center gap-2'>
                        <HeartPulse className='w-4 h-4 text-rose-500' /> Clinical Vitals &amp; RCP NEWS2 Telemetry
                      </h3>
                      <p className='text-xs text-slate-500'>
                        Home BP cuff, pulse oximeter, thermometer, glucometer, and 15s stationary POS-rPPG spot-checks
                      </p>
                    </div>
                    <span className='px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200'>
                      {dossier.vitals.length} readings
                    </span>
                  </div>

                  {dossier.vitals.length === 0 ? (
                    <p className='text-xs text-slate-400 py-6 text-center'>
                      No clinical vital readings recorded by this patient yet.
                    </p>
                  ) : (
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                      {dossier.vitals.map((v) => {
                        const risk = v.news2Risk || (v.heartRate > 100 || (v.heartRate && v.heartRate < 55) ? 'LOW_MEDIUM' : 'LOW')
                        const isElevated = risk !== 'LOW'
                        const badgeCls =
                          risk === 'HIGH'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : risk === 'MEDIUM' || risk === 'LOW_MEDIUM'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'

                        return (
                          <div
                            key={v._id}
                            className={`p-3.5 rounded-xl border space-y-2 ${
                              risk === 'HIGH'
                                ? 'bg-rose-50/60 border-rose-200'
                                : isElevated
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-slate-50/70 border-slate-200/80'
                            }`}
                          >
                            <div className='flex items-center justify-between gap-2'>
                              <span className='text-[11px] font-bold text-slate-700'>
                                {v.source === 'rppg_spot_check'
                                  ? '15s POS-rPPG Spot-Check'
                                  : v.source === 'hybrid'
                                  ? 'Home Devices + POS-rPPG'
                                  : 'Home Clinical Devices'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeCls}`}>
                                NEWS2 {v.news2Score ?? 0} • {risk.replace('_', '-')}
                              </span>
                            </div>

                            <div className='flex flex-wrap items-center gap-2 text-xs'>
                              {v.systolicBp && (
                                <span className='px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 tabular-nums'>
                                  BP {v.systolicBp}/{v.diastolicBp || '--'} mmHg
                                </span>
                              )}
                              {v.spo2 && (
                                <span className='px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 tabular-nums'>
                                  SpO₂ {v.spo2}%
                                </span>
                              )}
                              {v.temperatureF && (
                                <span className='px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 tabular-nums'>
                                  Temp {v.temperatureF}°F
                                </span>
                              )}
                              {v.heartRate && (
                                <span className='px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 tabular-nums'>
                                  HR {v.heartRate} BPM
                                </span>
                              )}
                              {v.bloodGlucose && (
                                <span className='px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-900 tabular-nums'>
                                  Glu {v.bloodGlucose} mg/dL
                                </span>
                              )}
                            </div>

                            {Array.isArray(v.clinicalFlags) && v.clinicalFlags.length > 0 && (
                              <p className='text-[11px] text-rose-700 font-semibold'>
                                ⚠️ {v.clinicalFlags.join(' • ')}
                              </p>
                            )}

                            <p className='text-[11px] text-slate-500 flex items-center justify-between pt-0.5'>
                              <span className='truncate max-w-[60%]'>{v.notes || v.method || 'Clinical Log'}</span>
                              <span>
                                {v.timestamp
                                  ? new Date(v.timestamp).toLocaleDateString('en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : ''}
                              </span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Section B: Synced Health Biomarkers */}
                <div className='bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs'>
                  <div className='flex items-center justify-between mb-4'>
                    <div>
                      <h3 className='text-sm font-extrabold text-slate-900 flex items-center gap-2'>
                        <Activity className='w-4 h-4 text-sky-600' /> Tracked Lab Biomarkers
                      </h3>
                      <p className='text-xs text-slate-500'>
                        Longitudinal lab metrics synced from patient blood tests & manual logs
                      </p>
                    </div>
                    <span className='px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200'>
                      {dossier.biomarkers.length} entries
                    </span>
                  </div>

                  {dossier.biomarkers.length === 0 ? (
                    <p className='text-xs text-slate-400 py-6 text-center'>
                      No tracked biomarkers synced yet.
                    </p>
                  ) : (
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                      {dossier.biomarkers.map((b) => {
                        const isAbnormal = b.status && b.status !== 'NORMAL'
                        return (
                          <div
                            key={b._id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                              isAbnormal
                                ? 'bg-rose-50/50 border-rose-200'
                                : 'bg-slate-50/70 border-slate-200/80'
                            }`}
                          >
                            <div className='min-w-0'>
                              <div className='flex items-center gap-2'>
                                <p className='text-xs font-extrabold text-slate-900 truncate'>{b.name}</p>
                                <span className='text-[10px] font-semibold text-slate-400 uppercase'>
                                  {b.category}
                                </span>
                              </div>
                              <p className='text-[11px] text-slate-500 mt-0.5'>
                                Ref: {b.referenceMin}–{b.referenceMax} {b.unit} •{' '}
                                {b.testDate
                                  ? new Date(b.testDate).toLocaleDateString('en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : ''}
                              </p>
                            </div>
                            <div className='text-right shrink-0'>
                              <p className='text-sm font-black text-slate-900 tabular-nums'>
                                {b.value} <span className='text-[11px] font-semibold text-slate-500'>{b.unit}</span>
                              </p>
                              <span
                                className={`inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                                  isAbnormal
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {b.status || 'NORMAL'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 3: PAST PRESCRIPTIONS */
              dossier.prescriptions.length === 0 ? (
                <div className='bg-white rounded-2xl border border-slate-200 p-12 text-center'>
                  <p className='text-sm font-bold text-slate-800'>No Past Prescriptions Found</p>
                  <p className='text-xs text-slate-500 mt-1'>
                    Any digital prescriptions issued to this patient will be listed here.
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {dossier.prescriptions.map((rx) => (
                    <div
                      key={rx._id}
                      className='bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5'
                    >
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                          <p className='text-xs font-extrabold text-slate-900'>
                            Diagnosis: <span className='text-sky-700'>{rx.diagnosis || 'General Consultation'}</span>
                          </p>
                          <p className='text-[11px] text-slate-400'>
                            Issued{' '}
                            {rx.createdAt
                              ? new Date(rx.createdAt).toLocaleDateString('en-US', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : ''}
                          </p>
                        </div>
                        {rx.safetyReport?.overallRisk && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              rx.safetyReport.overallRisk === 'SAFE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            Safety: {rx.safetyReport.overallRisk}
                          </span>
                        )}
                      </div>

                      <div className='flex flex-wrap gap-1.5'>
                        {(rx.medicines || []).map((m, idx) => (
                          <span
                            key={idx}
                            className='px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700'
                          >
                            {m.name} • {m.dosage} ({m.frequency}, {m.duration})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Report Lightbox */}
      {lightboxRecord && (
        <div
          onClick={() => setLightboxRecord(null)}
          className='fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4'
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className='relative max-w-5xl w-full max-h-[92vh] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden flex flex-col'
          >
            <div className='px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white'>
              <div className='min-w-0'>
                <p className='text-sm font-bold truncate'>{lightboxRecord.fileName}</p>
                <p className='text-[11px] text-slate-400'>
                  {lightboxRecord.aiExtractedData?.reportType || 'Patient Uploaded Lab Report'}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <a
                  href={lightboxRecord.fileUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold inline-flex items-center gap-1.5'
                >
                  Open Original <ExternalLink className='w-3.5 h-3.5' />
                </a>
                <button
                  onClick={() => setLightboxRecord(null)}
                  className='p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950'>
              <img
                src={lightboxRecord.fileUrl}
                alt={lightboxRecord.fileName}
                className='max-w-full max-h-[80vh] object-contain rounded-lg'
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default PatientHealthDrawer
