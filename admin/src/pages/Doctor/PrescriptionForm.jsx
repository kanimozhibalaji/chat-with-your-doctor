import React, { useState, useContext, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import DDIAlertPanel from '../../components/DDIAlertPanel'
import PatientHealthDrawer from '../../components/PatientHealthDrawer'
import InPersonReferralModal from '../../components/InPersonReferralModal'
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Pill,
  Sparkles,
  Edit3,
  ArrowLeft,
  Plus,
  Trash2,
  HeartPulse,
  ClipboardList,
  Search,
  CheckCircle2,
  Building2,
  Calendar,
  Clock,
  User,
  Check,
  FileSignature
} from 'lucide-react'

// Curated Clinical Formulary for 1-Click Autocomplete & Instant Allergy Screening
const COMMON_MEDICINES = [
  {
    name: 'Paracetamol 500mg',
    generic: 'acetaminophen paracetamol dolo crocin tylenol',
    drugClass: 'Analgesic / Antipyretic',
    dosage: '1 Tablet (500mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'After meals (max 4g/day)'
  },
  {
    name: 'Dolo 650 (Paracetamol 650mg)',
    generic: 'acetaminophen paracetamol dolo crocin tylenol',
    drugClass: 'Analgesic / Antipyretic',
    dosage: '1 Tablet (650mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '3 Days',
    instructions: 'After meals for fever or body ache'
  },
  {
    name: 'Amoxicillin 500mg',
    generic: 'amoxicillin penicillin ampicillin augmentin beta-lactam',
    drugClass: 'Penicillin Antibiotic',
    dosage: '1 Capsule (500mg)',
    frequency: '1-1-1 (Thrice a day)',
    duration: '5 Days',
    instructions: 'Complete full antibiotic course after meals'
  },
  {
    name: 'Augmentin 625mg (Amoxicillin + Clavulanate)',
    generic: 'amoxicillin clavulanate penicillin augmentin beta-lactam',
    drugClass: 'Penicillin Antibiotic',
    dosage: '1 Tablet (625mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'Take at the start of a meal to reduce GI upset'
  },
  {
    name: 'Azithromycin 500mg',
    generic: 'azithromycin macrolide erythromycin clarithromycin',
    drugClass: 'Macrolide Antibiotic',
    dosage: '1 Tablet (500mg)',
    frequency: '1-0-0 (Morning)',
    duration: '3 Days',
    instructions: '1 hour before or 2 hours after meals'
  },
  {
    name: 'Ibuprofen 400mg',
    generic: 'ibuprofen nsaid advil brufen naproxen diclofenac aspirin',
    drugClass: 'NSAID Anti-inflammatory',
    dosage: '1 Tablet (400mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'Strictly after food with a full glass of water'
  },
  {
    name: 'Aspirin 75mg (Ecosprin)',
    generic: 'aspirin salicylate ecosprin nsaid',
    drugClass: 'Salicylate / Antiplatelet',
    dosage: '1 Tablet (75mg)',
    frequency: '0-0-1 (Night)',
    duration: '30 Days',
    instructions: 'After dinner; watch for any unusual bruising'
  },
  {
    name: 'Naproxen 500mg',
    generic: 'naproxen nsaid ibuprofen diclofenac',
    drugClass: 'NSAID Anti-inflammatory',
    dosage: '1 Tablet (500mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'Take after meals'
  },
  {
    name: 'Pantoprazole 40mg',
    generic: 'pantoprazole omeprazole rabeprazole esomeprazole ppi',
    drugClass: 'Proton Pump Inhibitor (PPI)',
    dosage: '1 Tablet (40mg)',
    frequency: '1-0-0 (Morning)',
    duration: '14 Days',
    instructions: '30 minutes before breakfast on an empty stomach'
  },
  {
    name: 'Omeprazole 20mg',
    generic: 'omeprazole pantoprazole ppi',
    drugClass: 'Proton Pump Inhibitor (PPI)',
    dosage: '1 Capsule (20mg)',
    frequency: '1-0-0 (Morning)',
    duration: '14 Days',
    instructions: '30 minutes before morning meal'
  },
  {
    name: 'Cetirizine 10mg',
    generic: 'cetirizine levocetirizine antihistamine zyrtec',
    drugClass: 'Antihistamine',
    dosage: '1 Tablet (10mg)',
    frequency: '0-0-1 (Night)',
    duration: '5 Days',
    instructions: 'Take at bedtime; may cause mild drowsiness'
  },
  {
    name: 'Montelukast 10mg + Levocetirizine 5mg',
    generic: 'montelukast levocetirizine cetirizine',
    drugClass: 'Respiratory / Anti-allergic',
    dosage: '1 Tablet',
    frequency: '0-0-1 (Night)',
    duration: '10 Days',
    instructions: 'Take in the evening after dinner'
  },
  {
    name: 'Ciprofloxacin 500mg',
    generic: 'ciprofloxacin levofloxacin ofloxacin fluoroquinolone',
    drugClass: 'Fluoroquinolone Antibiotic',
    dosage: '1 Tablet (500mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'Avoid dairy products or antacids within 2 hours'
  },
  {
    name: 'Metformin 500mg',
    generic: 'metformin biguanide glucophage',
    drugClass: 'Antidiabetic',
    dosage: '1 Tablet (500mg)',
    frequency: '1-0-1 (Morning & Night)',
    duration: '30 Days',
    instructions: 'Take with meals'
  },
  {
    name: 'Atorvastatin 20mg',
    generic: 'atorvastatin rosuvastatin simvastatin statin',
    drugClass: 'Statin (Lipid Lowering)',
    dosage: '1 Tablet (20mg)',
    frequency: '0-0-1 (Night)',
    duration: '30 Days',
    instructions: 'Take at night; avoid grapefruit juice'
  },
  {
    name: 'Amlodipine 5mg',
    generic: 'amlodipine nifedipine calcium channel blocker',
    drugClass: 'Antihypertensive (CCB)',
    dosage: '1 Tablet (5mg)',
    frequency: '1-0-0 (Morning)',
    duration: '30 Days',
    instructions: 'Take at the same time every morning'
  },
  {
    name: 'Losartan 50mg',
    generic: 'losartan telmisartan valsartan arb',
    drugClass: 'Antihypertensive (ARB)',
    dosage: '1 Tablet (50mg)',
    frequency: '1-0-0 (Morning)',
    duration: '30 Days',
    instructions: 'Monitor blood pressure regularly'
  },
  {
    name: 'Bactrim DS (Sulfamethoxazole + Trimethoprim)',
    generic: 'sulfamethoxazole trimethoprim sulfa sulfonamide bactrim',
    drugClass: 'Sulfonamide Antibiotic',
    dosage: '1 Tablet',
    frequency: '1-0-1 (Morning & Night)',
    duration: '5 Days',
    instructions: 'Drink plenty of water'
  }
]

// Client-side fuzzy + drug-class cross-reactivity allergy detector for instant typing feedback
const CROSS_REACTIVE_GROUPS = [
  ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'piperacillin', 'cephalexin', 'cefixime'],
  ['paracetamol', 'acetaminophen', 'dolo', 'crocin', 'tylenol', 'calpol'],
  ['aspirin', 'ecosprin', 'salicylate', 'ibuprofen', 'naproxen', 'diclofenac', 'nsaid', 'brufen', 'advil'],
  ['sulfa', 'sulfonamide', 'sulfamethoxazole', 'bactrim', 'septran'],
  ['ciprofloxacin', 'levofloxacin', 'ofloxacin', 'moxifloxacin', 'fluoroquinolone'],
  ['azithromycin', 'erythromycin', 'clarithromycin', 'macrolide']
]

const normalizeToken = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const isEditDistanceClose = (a, b) => {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 5) return false
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length] <= 2
}

const detectInlineAllergyConflict = (drugText, allergiesList = []) => {
  const cleanDrug = String(drugText || '').trim().toLowerCase()
  if (!cleanDrug || cleanDrug.length < 3 || !Array.isArray(allergiesList) || allergiesList.length === 0) {
    return null
  }

  const drugTokens = cleanDrug
    .split(/[\s,+()/.-]+/)
    .map(normalizeToken)
    .filter((t) => t.length >= 3 && !/^\d+mg$/.test(t))

  for (const rawAllergen of allergiesList) {
    const cleanAlg = String(rawAllergen || '').trim().toLowerCase()
    if (!cleanAlg) continue
    const algTokens = cleanAlg
      .split(/[\s,+()/.-]+/)
      .map(normalizeToken)
      .filter((t) => t.length >= 3)

    // Direct or typo-tolerant match
    for (const dt of drugTokens) {
      for (const at of algTokens) {
        if (isEditDistanceClose(dt, at)) {
          return {
            allergen: rawAllergen,
            reason: `Direct / phonetic match with patient's reported "${rawAllergen}" allergy`
          }
        }
      }
    }

    // Cross-reactive family check
    for (const group of CROSS_REACTIVE_GROUPS) {
      const drugInGroup = drugTokens.some((dt) => group.some((g) => isEditDistanceClose(dt, g)))
      const algInGroup = algTokens.some((at) => group.some((g) => isEditDistanceClose(at, g)))
      if (drugInGroup && algInGroup) {
        return {
          allergen: rawAllergen,
          reason: `Cross-reactive drug class conflict with patient's "${rawAllergen}" allergy`
        }
      }
    }
  }

  return null
}

const PrescriptionForm = () => {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const { dToken, appointments, getAppointments } = useContext(DoctorContext)
  const { backendUrl, slotDateFormat } = useContext(AppContext)

  const [appointment, setAppointment] = useState(null)
  const [patientProfile, setPatientProfile] = useState(null)
  const [existingPrescription, setExistingPrescription] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showHealthDrawer, setShowHealthDrawer] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [referralLoading, setReferralLoading] = useState(false)
  const [activeAutocompleteRow, setActiveAutocompleteRow] = useState(null)

  const handleSaveReferral = async (payload) => {
    setReferralLoading(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/doctor/in-person-referral`, payload, {
        headers: { dtoken: dToken }
      })
      if (data.success) {
        toast.success(data.message)
        setShowReferralModal(false)
        if (appointment) {
          setAppointment({
            ...appointment,
            inPersonReferral: payload.clear ? null : data.referral
          })
        }
      } else {
        toast.error(data.message)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setReferralLoading(false)
    }
  }

  // Form states
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
  ])

  // AI + Clinical Safety States
  const [safetyReport, setSafetyReport] = useState(null)
  const [checkingSafety, setCheckingSafety] = useState(false)
  const [showSafetyModal, setShowSafetyModal] = useState(false)

  useEffect(() => {
    if (!appointments.length && dToken) {
      getAppointments()
    } else {
      const apt = appointments.find((a) => a._id === appointmentId)
      if (apt) setAppointment(apt)
    }
  }, [appointments, appointmentId, dToken, getAppointments])

  const fetchPrescriptionAndPatient = useCallback(async () => {
    if (!dToken || !appointmentId) return
    try {
      const { data } = await axios.get(
        backendUrl + `/api/prescription/doctor/${appointmentId}`,
        { headers: { dtoken: dToken } }
      )
      if (data.user) {
        setPatientProfile(data.user)
      }
      if (data.success && data.prescription) {
        const rx = data.prescription
        setExistingPrescription(rx)
        setSafetyReport(rx.safetyReport || null)
        setDiagnosis(rx.diagnosis || '')
        setNotes(rx.notes || '')
        setFollowUpDate(rx.followUpDate ? rx.followUpDate.slice(0, 10) : '')
        if (Array.isArray(rx.medicines) && rx.medicines.length > 0) {
          setMedicines(
            rx.medicines.map((m) => ({
              name: m.name || '',
              dosage: m.dosage || '',
              frequency: m.frequency || '',
              duration: m.duration || '',
              instructions: m.instructions || ''
            }))
          )
        }
      }
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false)
    }
  }, [dToken, appointmentId, backendUrl])

  useEffect(() => {
    fetchPrescriptionAndPatient()

    const handleLiveUpdate = () => {
      fetchPrescriptionAndPatient()
    }
    window.addEventListener('vitalsync:doctor-appointment-updated', handleLiveUpdate)
    window.addEventListener('prescripto:doctor-appointment-updated', handleLiveUpdate)
    return () => {
      window.removeEventListener('vitalsync:doctor-appointment-updated', handleLiveUpdate)
      window.removeEventListener('prescripto:doctor-appointment-updated', handleLiveUpdate)
    }
  }, [fetchPrescriptionAndPatient])

  const liveAllergies = patientProfile?.allergies || appointment?.userData?.allergies || []
  const liveCurrentMeds = patientProfile?.currentMedications || appointment?.userData?.currentMedications || []

  const handleMedicineChange = (index, field, value) => {
    const newMedicines = [...medicines]
    newMedicines[index][field] = value
    setMedicines(newMedicines)
    if (field === 'name') {
      setSafetyReport(null)
    }
  }

  const handleSelectFormularyMedicine = (index, item) => {
    const newMedicines = [...medicines]
    newMedicines[index] = {
      name: item.name,
      dosage: newMedicines[index].dosage || item.dosage,
      frequency: newMedicines[index].frequency || item.frequency,
      duration: newMedicines[index].duration || item.duration,
      instructions: newMedicines[index].instructions || item.instructions
    }
    setMedicines(newMedicines)
    setSafetyReport(null)
    setActiveAutocompleteRow(null)
  }

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
    setSafetyReport(null)
  }

  const removeMedicineRow = (index) => {
    const newMedicines = medicines.filter((_, i) => i !== index)
    setMedicines(newMedicines)
    setSafetyReport(null)
  }

  const checkSafetyNow = async (forceShowModal = true) => {
    const validMedicines = medicines.filter((m) => m.name.trim() !== '')
    if (validMedicines.length === 0) {
      toast.info('Add medicine names first to check safety interactions & allergies')
      return null
    }
    setCheckingSafety(true)
    try {
      const { data } = await axios.post(backendUrl + '/api/ddi/check', {
        medicines: validMedicines,
        userId: patientProfile?._id || appointment?.userId,
        appointmentId,
        patientAllergies: liveAllergies,
        currentMedications: liveCurrentMeds
      })
      if (data.success) {
        setSafetyReport(data.report)
        if (forceShowModal) {
          setShowSafetyModal(true)
        }
        return data.report
      }
    } catch (error) {
      console.error(error)
      toast.error('Safety check failed: ' + error.message)
    } finally {
      setCheckingSafety(false)
    }
    return null
  }

  const savePrescriptionFinal = async (overrideReason = '') => {
    const validMedicines = medicines.filter((m) => m.name.trim() !== '' && m.dosage.trim() !== '')
    if (validMedicines.length === 0) {
      return toast.error('Please add at least one medicine with dosage')
    }
    if (!diagnosis.trim()) {
      return toast.error('Diagnosis is required')
    }

    const cleanReason = typeof overrideReason === 'string' ? overrideReason.trim() : ''

    try {
      const { data } = await axios.post(
        backendUrl + '/api/prescription/create',
        {
          appointmentId,
          diagnosis,
          medicines: validMedicines,
          notes,
          followUpDate,
          clinicalOverrideConfirmed: Boolean(cleanReason),
          clinicalOverrideReason: cleanReason
        },
        { headers: { dtoken: dToken } }
      )

      if (data.success) {
        toast.success(data.message)
        setShowSafetyModal(false)
        setExistingPrescription(data.prescription)
        setSafetyReport(data.prescription?.safetyReport || null)
        setIsEditing(false)
      } else if (data.requiresClinicalOverride && data.safetyReport) {
        setSafetyReport(data.safetyReport)
        setShowSafetyModal(true)
        toast.warn(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validMedicines = medicines.filter((m) => m.name.trim() !== '' && m.dosage.trim() !== '')
    if (validMedicines.length === 0) {
      return toast.error('Please add at least one medicine')
    }

    if (!diagnosis.trim()) {
      return toast.error('Diagnosis is required')
    }

    const report = safetyReport || (await checkSafetyNow(false))
    if (report && (report.overallRisk === 'SEVERE' || report.overallRisk === 'MODERATE')) {
      setShowSafetyModal(true)
      toast.warn(`⚠️ ${report.overallRisk} allergy or drug interaction detected! Please review the clinical alert before issuing.`)
      return
    }

    await savePrescriptionFinal('')
  }

  if (loading) {
    return (
      <div className='flex-1 p-6 sm:p-8 max-w-5xl mx-auto'>
        <div className='h-96 bg-slate-200/80 rounded-3xl animate-pulse' />
      </div>
    )
  }

  // Patient Clinical Dossier & Allergy Banner
  const PatientAllergyBanner = () => (
    <div
      className={`p-5 rounded-3xl border mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
        liveAllergies.length > 0
          ? 'bg-rose-50/90 border-rose-200 shadow-sm'
          : 'bg-white border-slate-200 shadow-2xs'
      }`}
    >
      <div className='space-y-2 min-w-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <AlertTriangle className={`w-4 h-4 ${liveAllergies.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          <span className='text-xs font-extrabold uppercase tracking-wider text-slate-800'>
            Patient Clinical Profile: {patientProfile?.name || appointment?.userData?.name || 'Patient'}
          </span>
          {appointment?.reasonForVisit && (
            <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold'>
              <ClipboardList className='w-3.5 h-3.5 text-sky-600' />
              Reason: {appointment.reasonForVisit}
            </span>
          )}
        </div>

        <div className='flex flex-wrap items-center gap-2 pt-0.5'>
          <span className='text-xs font-bold text-slate-600'>Reported Allergies:</span>
          {liveAllergies.length > 0 ? (
            liveAllergies.map((alg, i) => (
              <span
                key={i}
                className='px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-xs font-bold shadow-2xs inline-flex items-center gap-1'
              >
                <ShieldAlert className='w-3 h-3' />
                <span>{alg}</span>
              </span>
            ))
          ) : (
            <span className='text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1'>
              <ShieldCheck className='w-3.5 h-3.5 text-emerald-600' />
              No known allergies reported
            </span>
          )}
        </div>

        {liveCurrentMeds.length > 0 && (
          <div className='flex flex-wrap items-center gap-2 pt-1'>
            <span className='text-xs font-bold text-slate-600'>Regular Medications:</span>
            {liveCurrentMeds.map((med, i) => {
              const label = typeof med === 'string' ? med : `${med.name || ''} ${med.dosage || ''}`.trim()
              return (
                <span
                  key={i}
                  className='px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold'
                >
                  💊 {label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-2.5 shrink-0'>
        <button
          type='button'
          onClick={() => setShowReferralModal(true)}
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
            appointment?.inPersonReferral
              ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800'
          }`}
        >
          <Building2 className={`w-4 h-4 ${appointment?.inPersonReferral ? 'text-amber-700' : 'text-slate-400'}`} />
          <span>{appointment?.inPersonReferral ? 'Referral Active' : 'Hospital Referral'}</span>
        </button>

        <button
          type='button'
          onClick={() => setShowHealthDrawer(true)}
          className='px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-colors cursor-pointer'
        >
          <HeartPulse className='w-4 h-4' />
          <span>Patient Lab Reports & Vitals</span>
        </button>
      </div>
    </div>
  )

  // VIEW MODE: Already Issued Prescription
  if (existingPrescription && !isEditing) {
    const safety = safetyReport || existingPrescription.safetyReport || {}
    const allergyAlerts = safety.allergyAlerts || []
    const interactions = safety.interactions || []

    return (
      <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl min-w-0 mx-auto'>
        <PatientHealthDrawer
          isOpen={showHealthDrawer}
          onClose={() => setShowHealthDrawer(false)}
          userId={patientProfile?._id || appointment?.userId}
          patientFallback={patientProfile || appointment?.userData}
          reasonForVisit={appointment?.reasonForVisit || ''}
        />

        <InPersonReferralModal
          isOpen={showReferralModal}
          onClose={() => setShowReferralModal(false)}
          appointment={appointment}
          onSaveReferral={handleSaveReferral}
          loading={referralLoading}
        />

        <PatientAllergyBanner />

        <div className='bg-white rounded-3xl shadow-2xs border border-slate-200 p-6 sm:p-8 space-y-6'>
          {/* Header */}
          <div className='flex flex-wrap justify-between items-center gap-4 pb-6 border-b border-slate-200'>
            <div>
              <div className='flex items-center gap-2.5'>
                <h2 className='text-xl sm:text-2xl font-extrabold text-slate-900'>Prescription Issued</h2>
                <span className='bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-2xs'>
                  <ShieldCheck className='w-4 h-4 text-emerald-600' /> Digitally Signed
                </span>
              </div>
              <p className='text-slate-500 text-xs mt-1 tabular-nums'>
                Issued: {new Date(existingPrescription.createdAt).toLocaleString()}
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2.5'>
              <button
                type='button'
                onClick={() => setIsEditing(true)}
                className='px-4 py-2.5 bg-sky-600 text-white hover:bg-sky-500 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer'
              >
                <Edit3 className='w-3.5 h-3.5' />
                <span>Edit & Update Prescription</span>
              </button>
              <button
                type='button'
                onClick={() => checkSafetyNow(false)}
                disabled={checkingSafety}
                className='px-3.5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer'
              >
                <Sparkles className='w-3.5 h-3.5' />
                <span>{checkingSafety ? 'Checking...' : 'Re-Run AI Safety Check'}</span>
              </button>
              <button
                type='button'
                onClick={() => navigate('/doctor-appointments')}
                className='px-3.5 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors'
              >
                <ArrowLeft className='w-3.5 h-3.5' />
                <span>Back</span>
              </button>
            </div>
          </div>

          {/* Clinical Safety Report Card */}
          {safety && (
            <div
              className={`p-5 rounded-2xl border space-y-4 ${
                safety.overallRisk === 'SEVERE'
                  ? 'bg-rose-50/90 border-rose-300'
                  : safety.overallRisk === 'MODERATE'
                  ? 'bg-amber-50/90 border-amber-300'
                  : 'bg-emerald-50/90 border-emerald-200'
              }`}
            >
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='flex items-center gap-2.5'>
                  {safety.overallRisk === 'SEVERE' ? (
                    <ShieldAlert className='w-6 h-6 text-rose-600 shrink-0' />
                  ) : safety.overallRisk === 'MODERATE' ? (
                    <AlertTriangle className='w-6 h-6 text-amber-600 shrink-0' />
                  ) : (
                    <ShieldCheck className='w-6 h-6 text-emerald-600 shrink-0' />
                  )}
                  <div>
                    <h4 className='font-extrabold text-sm text-slate-900'>
                      AI Safety & Allergy Audit: {safety.overallRisk || 'SAFE'}
                    </h4>
                    {safety.aiSummary && (
                      <p className='text-xs text-slate-700 mt-0.5 leading-relaxed'>{safety.aiSummary}</p>
                    )}
                  </div>
                </div>
                <span className='text-xs text-slate-700 font-bold bg-white px-3 py-1 rounded-full border border-slate-200 tabular-nums shadow-2xs'>
                  {interactions.length} Interactions • {allergyAlerts.length} Allergy Conflicts
                </span>
              </div>

              {allergyAlerts.length > 0 && (
                <div className='space-y-2 pt-1'>
                  <p className='text-xs font-extrabold uppercase tracking-wider text-rose-900'>
                    Patient Allergy Conflicts ({allergyAlerts.length})
                  </p>
                  {allergyAlerts.map((alert, idx) => (
                    <div key={idx} className='bg-white p-3.5 rounded-xl border border-rose-200 text-xs space-y-1'>
                      <div className='flex items-center justify-between'>
                        <span className='font-bold text-rose-950'>
                          Allergen: <strong className='underline uppercase'>{alert.allergen}</strong> → Prescribed: <strong className='underline uppercase'>{alert.drug}</strong>
                        </span>
                        <span className='px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold uppercase'>
                          {alert.severity}
                        </span>
                      </div>
                      <p className='text-slate-700'>{alert.effect}</p>
                      <p className='font-semibold text-rose-800'>Recommendation: {alert.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {interactions.length > 0 && (
                <div className='space-y-2 pt-1'>
                  <p className='text-xs font-extrabold uppercase tracking-wider text-amber-900'>
                    Medicine Interactions ({interactions.length})
                  </p>
                  {interactions.map((item, idx) => (
                    <div key={idx} className='bg-white p-3.5 rounded-xl border border-amber-200 text-xs space-y-1'>
                      <div className='flex items-center justify-between'>
                        <span className='font-bold text-slate-900'>
                          {item.drugA} ↔ {item.drugB}
                        </span>
                        <span className='px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold uppercase'>
                          {item.severity}
                        </span>
                      </div>
                      <p className='text-slate-700'>{item.effect}</p>
                      <p className='font-semibold text-amber-900'>Recommendation: {item.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {safety.overallRisk && safety.overallRisk !== 'SAFE' && (
                <div className='pt-1'>
                  <button
                    type='button'
                    onClick={() => setIsEditing(true)}
                    className='px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs'
                  >
                    <Edit3 className='w-3.5 h-3.5' />
                    <span>Edit Prescription to Resolve Conflict</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Diagnosis & Medicines */}
          <div className='space-y-5 pt-2'>
            <div>
              <p className='font-bold text-slate-700 text-xs uppercase tracking-wider mb-1.5'>
                Diagnosis / Clinical Findings
              </p>
              <p className='text-slate-900 text-sm font-medium bg-slate-50 p-4 rounded-2xl border border-slate-200 leading-relaxed'>
                {existingPrescription.diagnosis}
              </p>
            </div>

            <div>
              <p className='font-bold text-slate-700 mb-2 text-xs uppercase tracking-wider'>
                Medicines Prescribed
              </p>
              <div className='border border-slate-200 rounded-2xl overflow-hidden'>
                <table className='w-full text-left text-sm'>
                  <thead className='bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider'>
                    <tr>
                      <th className='p-3.5 pl-5'>Medicine Name</th>
                      <th className='p-3.5'>Dosage</th>
                      <th className='p-3.5'>Frequency</th>
                      <th className='p-3.5'>Duration</th>
                      <th className='p-3.5 pr-5'>Instructions</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100 text-slate-700'>
                    {existingPrescription.medicines.map((med, i) => (
                      <tr key={i} className='hover:bg-slate-50/50'>
                        <td className='p-3.5 pl-5 font-bold text-slate-900'>{med.name}</td>
                        <td className='p-3.5 font-medium tabular-nums'>{med.dosage}</td>
                        <td className='p-3.5'>{med.frequency}</td>
                        <td className='p-3.5 tabular-nums'>{med.duration}</td>
                        <td className='p-3.5 pr-5 text-slate-500 text-xs'>{med.instructions || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {existingPrescription.notes && (
              <div>
                <p className='font-bold text-slate-700 text-xs uppercase tracking-wider mb-1.5'>Doctor's Notes</p>
                <p className='text-slate-700 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-200 leading-relaxed'>
                  {existingPrescription.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // EDIT / COMPOSE MODE
  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl min-w-0 mx-auto'>
      <PatientHealthDrawer
        isOpen={showHealthDrawer}
        onClose={() => setShowHealthDrawer(false)}
        userId={patientProfile?._id || appointment?.userId}
        patientFallback={patientProfile || appointment?.userData}
        reasonForVisit={appointment?.reasonForVisit || ''}
      />

      {showSafetyModal && safetyReport && (
        <DDIAlertPanel
          report={safetyReport}
          onClose={() => setShowSafetyModal(false)}
          onProceed={savePrescriptionFinal}
        />
      )}

      <InPersonReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        appointment={appointment}
        onSaveReferral={handleSaveReferral}
        loading={referralLoading}
      />

      <PatientAllergyBanner />

      <form onSubmit={handleSubmit} className='bg-white rounded-3xl shadow-2xs border border-slate-200 p-6 md:p-8'>
        {/* Top Header */}
        <div className='flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-slate-200'>
          <div>
            <h2 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
              {existingPrescription ? 'Edit & Update Prescription' : 'Write Digital Prescription'}
            </h2>
            {appointment && (
              <p className='text-xs sm:text-sm text-slate-500 mt-1 tabular-nums'>
                Patient: <span className='font-bold text-sky-600'>{appointment.userData?.name}</span> •{' '}
                Date: {slotDateFormat(appointment.slotDate)}, {appointment.slotTime}
              </p>
            )}
          </div>
          <button
            type='button'
            onClick={() => (existingPrescription ? setIsEditing(false) : navigate('/doctor-appointments'))}
            className='px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer'
          >
            Cancel
          </button>
        </div>

        {/* Diagnosis */}
        <div className='mb-6'>
          <div className='flex flex-wrap items-center justify-between gap-2 mb-2'>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700'>
              Diagnosis / Clinical Findings *
            </label>
            {appointment?.reasonForVisit && !diagnosis && (
              <button
                type='button'
                onClick={() => setDiagnosis(appointment.reasonForVisit)}
                className='text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer transition-colors'
              >
                + Copy Patient's Chief Complaint ("{appointment.reasonForVisit}")
              </button>
            )}
          </div>
          <textarea
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            className='w-full border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 min-h-[90px] text-slate-800'
            placeholder='e.g., Acute viral pharyngitis with mild dehydration'
          />
        </div>

        {/* Medicines Section */}
        <div className='mb-6'>
          <div className='flex flex-wrap justify-between items-center gap-3 mb-4'>
            <div className='flex flex-wrap items-center gap-3'>
              <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700'>
                Prescribed Medications *
              </label>
              <button
                type='button'
                onClick={() => checkSafetyNow(true)}
                disabled={checkingSafety}
                className={`text-xs px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                  safetyReport?.overallRisk === 'SEVERE'
                    ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                    : safetyReport?.overallRisk === 'MODERATE'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : safetyReport
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                }`}
              >
                <Sparkles className='w-3.5 h-3.5' />
                <span>
                  {checkingSafety
                    ? 'Running AI Safety & Allergy Check...'
                    : safetyReport
                    ? `AI Safety Check: ${safetyReport.overallRisk} (${(safetyReport.totalAllergyAlerts || 0) + (safetyReport.totalInteractions || 0)} alerts — Click to View)`
                    : 'Run AI Allergy & Interaction Check'}
                </span>
              </button>
            </div>
            <button
              type='button'
              onClick={addMedicineRow}
              className='px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors'
            >
              <Plus className='w-3.5 h-3.5' />
              <span>Add Medicine</span>
            </button>
          </div>

          <div className='space-y-4'>
            {medicines.map((med, index) => {
              const inlineAllergy = detectInlineAllergyConflict(med.name, liveAllergies)
              const q = med.name.trim().toLowerCase()
              const suggestions = COMMON_MEDICINES.filter((item) => {
                if (!q) return true
                return (
                  item.name.toLowerCase().includes(q) ||
                  item.generic.toLowerCase().includes(q) ||
                  item.drugClass.toLowerCase().includes(q)
                )
              }).slice(0, 7)

              return (
                <div
                  key={index}
                  className={`p-4 sm:p-5 rounded-2xl border relative transition-all ${
                    inlineAllergy
                      ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/15'
                      : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  {medicines.length > 1 && (
                    <button
                      type='button'
                      onClick={() => removeMedicineRow(index)}
                      className='absolute top-3.5 right-3.5 p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer'
                      title='Remove medicine row'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  )}

                  {/* Instant Inline Allergy Warning Banner while typing */}
                  {inlineAllergy && (
                    <div className='mb-3.5 p-3 rounded-xl bg-rose-600 text-white text-xs flex items-center justify-between gap-3 shadow-xs'>
                      <div className='flex items-center gap-2'>
                        <ShieldAlert className='w-4 h-4 shrink-0' />
                        <span>
                          <strong>Instant Allergy Alert:</strong> "{med.name}" conflicts with patient's reported allergy to{' '}
                          <strong className='underline uppercase'>{inlineAllergy.allergen}</strong> ({inlineAllergy.reason}).
                        </span>
                      </div>
                      <span className='px-2 py-0.5 rounded bg-white/20 text-[10px] font-extrabold uppercase shrink-0'>
                        Contraindicated
                      </span>
                    </div>
                  )}

                  <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-4'>
                    <div className='md:col-span-2 relative'>
                      <label className='block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between'>
                        <span>Medicine Name (Formulary Autocomplete)</span>
                        <span className='text-[10px] text-sky-600 font-bold'>Smart Search</span>
                      </label>
                      <div className='relative'>
                        <input
                          type='text'
                          required
                          value={med.name}
                          onFocus={() => setActiveAutocompleteRow(index)}
                          onBlur={() => setTimeout(() => setActiveAutocompleteRow((prev) => (prev === index ? null : prev)), 180)}
                          onChange={(e) => {
                            handleMedicineChange(index, 'name', e.target.value)
                            setActiveAutocompleteRow(index)
                          }}
                          placeholder='e.g., Paracetamol 500mg, Amoxicillin 500mg...'
                          className={`w-full bg-white border rounded-xl p-2.5 text-sm outline-none transition-colors ${
                            inlineAllergy
                              ? 'border-rose-400 focus:border-rose-600 text-rose-900 font-semibold'
                              : 'border-slate-200 focus:border-sky-500'
                          }`}
                        />

                        {/* Smart Autocomplete Dropdown */}
                        {activeAutocompleteRow === index && suggestions.length > 0 && (
                          <div className='absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100'>
                            <div className='px-3 py-1.5 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between'>
                              <span>Clinical Formulary Suggestions (Click to Auto-Fill)</span>
                              <span>{suggestions.length} matches</span>
                            </div>
                            {suggestions.map((item, sIdx) => {
                              const itemConflict = detectInlineAllergyConflict(
                                `${item.name} ${item.generic}`,
                                liveAllergies
                              )
                              return (
                                <button
                                  key={sIdx}
                                  type='button'
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSelectFormularyMedicine(index, item)
                                  }}
                                  className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                                    itemConflict
                                      ? 'bg-rose-50/70 hover:bg-rose-100/80'
                                      : 'hover:bg-sky-50/70'
                                  }`}
                                >
                                  <div className='min-w-0'>
                                    <div className='flex items-center gap-2'>
                                      <p className='text-xs font-bold text-slate-900 truncate'>
                                        {item.name}
                                      </p>
                                      <span className='px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold'>
                                        {item.drugClass}
                                      </span>
                                    </div>
                                    <p className='text-[11px] text-slate-500 truncate mt-0.5'>
                                      {item.dosage} • {item.frequency} • {item.duration}
                                    </p>
                                  </div>
                                  {itemConflict ? (
                                    <span className='px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shrink-0'>
                                      ⚠️ Allergy: {itemConflict.allergen}
                                    </span>
                                  ) : (
                                    <span className='text-[11px] font-bold text-sky-600 shrink-0'>
                                      + Fill
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-slate-600 mb-1'>Dosage *</label>
                      <input
                        type='text'
                        required
                        value={med.dosage}
                        onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                        placeholder='e.g., 1 tablet (500mg)'
                        className='w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-sky-500'
                      />
                    </div>

                    <div>
                      <label className='block text-xs font-semibold text-slate-600 mb-1'>Frequency *</label>
                      <select
                        required
                        value={med.frequency}
                        onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                        className='w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-sky-500'
                      >
                        <option value=''>Select</option>
                        <option value='1-0-0 (Morning)'>1-0-0 (Morning)</option>
                        <option value='1-0-1 (Morning & Night)'>1-0-1 (Morning & Night)</option>
                        <option value='1-1-1 (Thrice a day)'>1-1-1 (Thrice a day)</option>
                        <option value='0-0-1 (Night)'>0-0-1 (Night)</option>
                        <option value='SOS (As needed)'>SOS (As needed)</option>
                      </select>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <div>
                      <label className='block text-xs font-semibold text-slate-600 mb-1'>Duration *</label>
                      <input
                        type='text'
                        required
                        value={med.duration}
                        onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                        placeholder='e.g., 5 Days'
                        className='w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-sky-500'
                      />
                    </div>
                    <div className='md:col-span-2'>
                      <label className='block text-xs font-semibold text-slate-600 mb-1'>Special Instructions (Optional)</label>
                      <input
                        type='text'
                        value={med.instructions}
                        onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                        placeholder='e.g., Strictly after meals with water'
                        className='w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-sky-500'
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Additional Guidance */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2'>
              Advice / Doctor Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className='w-full border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-sky-500 min-h-[90px] text-slate-800'
              placeholder='e.g., Increase oral fluid intake, bed rest for 48 hours, return if fever persists'
            />
          </div>
          <div>
            <label className='block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2'>
              Follow-up Review Date (Optional)
            </label>
            <input
              type='date'
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className='w-full border border-slate-200 rounded-2xl p-3.5 text-sm outline-none focus:border-sky-500 text-slate-800'
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className='flex justify-end pt-5 border-t border-slate-200'>
          <button
            type='submit'
            className='px-7 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-md shadow-sky-600/25 transition-all cursor-pointer inline-flex items-center gap-2'
          >
            <FileSignature className='w-4 h-4' />
            <span>
              {existingPrescription ? 'Verify Safety, Re-Sign & Notify Patient' : 'Verify Safety, Sign & Issue Prescription'}
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default PrescriptionForm
