import React, { useState, useRef, useEffect, useContext, useCallback, useId, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import PatientHealthDrawer from '../../components/PatientHealthDrawer'
import InPersonReferralModal from '../../components/InPersonReferralModal'
import DDIAlertPanel from '../../components/DDIAlertPanel'
import { useWebRTCCall, attachDialogLightDismissFallback } from '../../utils/useWebRTCCall'
import { computeNEWS2 } from '../../utils/news2Calculator'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  ArrowLeft,
  FileText,
  MessageSquare,
  HeartPulse,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Building2,
  Monitor,
  Camera,
  Settings,
  Volume2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  RefreshCw,
  Gauge,
  ArrowLeftRight,
  Send,
  Download,
  Radio,
  X,
  Sparkles,
  Smile,
  Lock,
  EyeOff,
  ShieldAlert
} from 'lucide-react'

const QUICK_RX_FORMULARY = [
  { name: 'Paracetamol 500mg', dosage: '1 Tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 Days', instructions: 'After meals' },
  { name: 'Amoxicillin 500mg', dosage: '1 Capsule', frequency: '1-1-1 (Thrice a day)', duration: '5 Days', instructions: 'After meals' },
  { name: 'Azithromycin 500mg', dosage: '1 Tablet', frequency: '1-0-0 (Morning)', duration: '3 Days', instructions: 'After food' },
  { name: 'Ibuprofen 400mg', dosage: '1 Tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 Days', instructions: 'Strictly after food' },
  { name: 'Pantoprazole 40mg', dosage: '1 Tablet', frequency: '1-0-0 (Morning)', duration: '10 Days', instructions: 'Before breakfast' },
  { name: 'Cetirizine 10mg', dosage: '1 Tablet', frequency: '0-0-1 (Night)', duration: '5 Days', instructions: 'At bedtime' }
]

const DOCTOR_QUICK_CUES = [
  { emoji: '👍', label: 'Audio & video clear' },
  { emoji: '🩺', label: 'Reviewing your chart' },
  { emoji: '💊', label: 'Preparing e-Prescription' },
  { emoji: '✅', label: 'All vitals look stable' }
]

const DoctorVideoCall = ({ appointmentIdProp, isMinimized = false, onActiveSessionChange }) => {
  const params = useParams()
  const appointmentId = appointmentIdProp || params.appointmentId
  const navigate = useNavigate()
  const { backendUrl, slotDateFormat } = useContext(AppContext)
  const { dToken, appointments, getAppointments, profileData, getProfileData } = useContext(DoctorContext)

  const settingsTitleId = useId()
  const consentTitleId = useId()
  const settingsDialogRef = useRef(null)
  const consentDialogRef = useRef(null)
  const chatEndRef = useRef(null)

  const [appointment, setAppointment] = useState(null)
  const [patientVitals, setPatientVitals] = useState(null)
  const [completingAppointment, setCompletingAppointment] = useState(false)

  // In-Call Clinical Side Panel States
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [sideTab, setSideTab] = useState('chart') // 'chart' | 'rx' | 'chat'
  const [showFullHealthDrawer, setShowFullHealthDrawer] = useState(false)
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [referralLoading, setReferralLoading] = useState(false)
  const [dossier, setDossier] = useState({
    patient: null,
    records: [],
    vitals: []
  })
  const [loadingDossier, setLoadingDossier] = useState(false)

  // In-Call Quick Prescription States
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', frequency: '1-0-1 (Morning & Night)', duration: '5 Days', instructions: 'After meals' }
  ])
  const [issuingRx, setIssuingRx] = useState(false)
  const [issuedRxSuccess, setIssuedRxSuccess] = useState(false)
  const [quickRxSafetyReport, setQuickRxSafetyReport] = useState(null)
  const [showQuickRxSafetyModal, setShowQuickRxSafetyModal] = useState(false)

  // UI Popovers & Chat Input
  const [chatInput, setChatInput] = useState('')
  const [showStatsPopover, setShowStatsPopover] = useState(false)
  const [showCueMenu, setShowCueMenu] = useState(false)

  const handleToastNotify = useCallback((msg, type = 'info') => {
    if (type === 'error') toast.error(msg)
    else if (type === 'success') toast.success(msg)
    else toast.info(msg)
  }, [])

  const authPayload = useMemo(() => (dToken ? { dToken } : {}), [dToken])

  const doctorDisplayName = useMemo(() => {
    const raw = profileData?.name || appointment?.docData?.name || 'Doctor'
    return raw.startsWith('Dr.') ? raw : `Dr. ${raw}`
  }, [profileData?.name, appointment?.docData?.name])

  const {
    localVideoRef,
    remoteVideoRef,
    stageContainerRef,
    callStatus,
    lobbyActive,
    callDuration,
    formatDuration,
    remoteConnected,
    peerInfo,
    peerMediaState,
    replacedByOtherTab,
    startLobbyPreview,
    stopLobbyPreview,
    startCall,
    endCall,
    triggerIceRestart,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isDataSaver,
    isMirrored,
    setIsMirrored,
    isSwappedView,
    setIsSwappedView,
    devices,
    selectedCameraId,
    selectedMicId,
    selectedSpeakerId,
    micLevel,
    toggleMute,
    toggleVideo,
    switchCamera,
    switchMicrophone,
    switchSpeaker,
    playTestTone,
    toggleScreenShare,
    toggleDataSaver,
    isFullscreen,
    isPiP,
    toggleFullscreen,
    togglePiP,
    networkStats,
    captionsSupported,
    captionsEnabled,
    liveCaption,
    transcript,
    toggleCaptions,
    exportTranscriptText,
    floatingReactions,
    sendReaction,
    recordingState,
    incomingRecordingRequest,
    recordingDuration,
    snapshots,
    requestRecording,
    respondRecordingConsent,
    stopRecording,
    captureSnapshot,
    chatMessages,
    peerTyping,
    unreadChatCount,
    setChatOpenState,
    sendChatMessage,
    emitChatTyping,
    emitRxIssued
  } = useWebRTCCall({
    appointmentId,
    backendUrl,
    authPayload,
    role: 'doctor',
    displayName: doctorDisplayName,
    override: true,
    onNotify: handleToastNotify,
    onVitalsReceived: (vitals) => {
      setPatientVitals(vitals)
      if (vitals?._id) {
        setDossier((prev) => {
          if (prev.vitals.some((v) => String(v._id) === String(vitals._id))) return prev
          return { ...prev, vitals: [vitals, ...prev.vitals] }
        })
      }
    }
  })

  // Secure Clinical Snapshot Ephemeral Inspection & Anti-Capture Privacy Shield
  const [activeExamSnapshot, setActiveExamSnapshot] = useState(null)
  const [isWindowBlurred, setIsWindowBlurred] = useState(false)

  useEffect(() => {
    const onBlur = () => setIsWindowBlurred(true)
    const onFocus = () => setIsWindowBlurred(false)
    const onVis = () => {
      if (document.hidden) setIsWindowBlurred(true)
      else setIsWindowBlurred(false)
    }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // Safari light-dismiss fallback on `<dialog closedby="any">`
  useEffect(() => {
    return attachDialogLightDismissFallback(settingsDialogRef.current)
  }, [])

  // Native `showModal()` for Two-Party Recording Consent
  useEffect(() => {
    const dlg = consentDialogRef.current
    if (!dlg) return
    if (incomingRecordingRequest && !dlg.open) {
      dlg.showModal()
    } else if (!incomingRecordingRequest && dlg.open) {
      dlg.close()
    }
  }, [incomingRecordingRequest])

  const openSettingsModal = () => {
    const dlg = settingsDialogRef.current
    if (dlg && !dlg.open) dlg.showModal()
  }

  // Sync unread chat count with active side tab
  useEffect(() => {
    setChatOpenState(sidePanelOpen && sideTab === 'chat')
  }, [sidePanelOpen, sideTab, setChatOpenState])

  useEffect(() => {
    if (sidePanelOpen && sideTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, sidePanelOpen, sideTab])

  useEffect(() => {
    if (dToken && !profileData && typeof getProfileData === 'function') {
      getProfileData()
    }
  }, [dToken, profileData, getProfileData])

  useEffect(() => {
    if (!appointments.length && dToken) {
      getAppointments()
    } else {
      const apt = appointments.find((a) => a._id === appointmentId)
      if (apt) {
        setAppointment(apt)
        if (apt.reasonForVisit && !diagnosis) {
          setDiagnosis(apt.reasonForVisit)
        }
      }
    }
  }, [appointments, appointmentId, dToken, getAppointments])

  // Keyboard shortcuts (`M`, `V`, `S`, `F`) — ignored while typing in Rx/Chat inputs
  useEffect(() => {
    const onKeyDown = (e) => {
      if (callStatus !== 'connecting' && callStatus !== 'connected' && callStatus !== 'reconnecting') return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'm') {
        e.preventDefault()
        toggleMute()
      } else if (key === 'v') {
        e.preventDefault()
        toggleVideo()
      } else if (key === 's') {
        e.preventDefault()
        toggleScreenShare()
      } else if (key === 'f') {
        e.preventDefault()
        toggleFullscreen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [callStatus, toggleMute, toggleVideo, toggleScreenShare, toggleFullscreen])

  const handleSaveReferral = async (payload) => {
    setReferralLoading(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/doctor/in-person-referral`, payload, {
        headers: { dToken }
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

  // Load patient dossier & any existing prescription for this appointment
  const fetchInCallPatientData = useCallback(async () => {
    if (!dToken || !appointment?.userId) return
    setLoadingDossier(true)
    try {
      const [dossierRes, rxRes] = await Promise.all([
        axios.get(`${backendUrl}/api/doctor/patient-dossier/${appointment.userId}`, {
          headers: { dToken }
        }),
        axios.get(`${backendUrl}/api/prescription/doctor/${appointmentId}`, {
          headers: { dtoken: dToken }
        })
      ])

      if (dossierRes.data.success) {
        setDossier({
          patient: dossierRes.data.patient,
          records: dossierRes.data.records || [],
          vitals: dossierRes.data.vitals || []
        })
      }

      if (rxRes.data.success && rxRes.data.prescription) {
        const rx = rxRes.data.prescription
        setDiagnosis(rx.diagnosis || '')
        setNotes(rx.notes || '')
        if (Array.isArray(rx.medicines) && rx.medicines.length > 0) {
          setMedicines(rx.medicines)
        }
        setIssuedRxSuccess(true)
      }
    } catch (e) {
      console.log('In-call dossier load error:', e.message)
    } finally {
      setLoadingDossier(false)
    }
  }, [dToken, appointment?.userId, appointmentId, backendUrl])

  useEffect(() => {
    if (appointment?.userId) {
      fetchInCallPatientData()
    }
  }, [appointment?.userId, fetchInCallPatientData])

  const submitQuickRxPayload = async (overrideReason = '') => {
    const validMeds = medicines.filter((m) => m.name.trim() && m.dosage.trim())
    if (!diagnosis.trim()) {
      return toast.warning('Please enter a diagnosis first')
    }
    if (validMeds.length === 0) {
      return toast.warning('Please add at least one medicine with dosage')
    }

    const cleanReason = typeof overrideReason === 'string' ? overrideReason.trim() : ''

    setIssuingRx(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/prescription/create`,
        {
          appointmentId,
          diagnosis,
          medicines: validMeds,
          notes,
          clinicalOverrideConfirmed: Boolean(cleanReason),
          clinicalOverrideReason: cleanReason
        },
        { headers: { dtoken: dToken } }
      )
      if (data.success) {
        toast.success('Digital Prescription signed & delivered to patient live!')
        setShowQuickRxSafetyModal(false)
        setIssuedRxSuccess(true)
        emitRxIssued(diagnosis)
      } else if (data.requiresClinicalOverride && data.safetyReport) {
        setQuickRxSafetyReport(data.safetyReport)
        setShowQuickRxSafetyModal(true)
        toast.warn(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIssuingRx(false)
    }
  }

  const handleIssueQuickRx = async (e) => {
    e.preventDefault()
    await submitQuickRxPayload('')
  }

  const handleCompleteAndEnd = async () => {
    setCompletingAppointment(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/doctor/complete-appointment`,
        { appointmentId },
        { headers: { dToken } }
      )
      if (data.success) {
        toast.success('Consultation marked Completed!')
        setAppointment((prev) => (prev ? { ...prev, isCompleted: true } : prev))
        getAppointments()
      } else {
        toast.error(data.message)
      }
      endCall(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCompletingAppointment(false)
    }
  }

  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const text = chatInput
    setChatInput('')
    await sendChatMessage(text)
  }

  const handleInsertTranscriptIntoNotes = () => {
    const text = exportTranscriptText()
    if (!text) {
      toast.info('No live caption lines captured yet.')
      return
    }
    const snippet = transcript
      .slice(-12)
      .map((t) => `${t.speakerName}: ${t.text}`)
      .join(' | ')
    setNotes((prev) => (prev ? `${prev}\n\n[Consultation Summary]: ${snippet}` : `[Consultation Summary]: ${snippet}`))
    setSideTab('rx')
    toast.success('Inserted live transcript into Prescription Clinical Notes!')
  }

  const handleDownloadTranscript = () => {
    const content = exportTranscriptText()
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VitalSync-Clinical-Transcript-${appointmentId.slice(-6)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const patient = dossier.patient || appointment?.userData || {}
  const allergies = Array.isArray(patient.allergies) ? patient.allergies.filter(Boolean) : []
  const regularMeds = Array.isArray(patient.currentMedications)
    ? patient.currentMedications
        .map((m) => (typeof m === 'string' ? m : `${m.name || ''} ${m.dosage || ''}`.trim()))
        .filter(Boolean)
    : []

  const isInActiveSession =
    callStatus === 'connecting' || callStatus === 'connected' || callStatus === 'reconnecting'

  useEffect(() => {
    if (typeof onActiveSessionChange === 'function') {
      onActiveSessionChange(isInActiveSession)
    }
  }, [isInActiveSession, onActiveSessionChange])

  useEffect(() => {
    return () => {
      if (typeof onActiveSessionChange === 'function') {
        onActiveSessionChange(false)
      }
    }
  }, [onActiveSessionChange])

  const qualityBadgeStyle = {
    excellent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    good: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    fair: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    poor: 'bg-rose-500/25 text-rose-300 border-rose-500/50'
  }[networkStats.qualityGrade || 'good']

  return (
    <div
      className={
        isMinimized
          ? 'fixed bottom-5 right-5 z-50 w-80 sm:w-96 rounded-2xl overflow-hidden shadow-2xl border-2 border-sky-500/70 bg-slate-950 select-none'
          : 'flex-1 p-4 sm:p-6 lg:p-7 max-w-[1480px]'
      }
    >
      {/* Full Patient Health Dossier Modal */}
      <PatientHealthDrawer
        isOpen={showFullHealthDrawer}
        onClose={() => setShowFullHealthDrawer(false)}
        userId={appointment?.userId}
        patientFallback={patient}
        reasonForVisit={appointment?.reasonForVisit || ''}
      />

      {showQuickRxSafetyModal && quickRxSafetyReport && (
        <DDIAlertPanel
          report={quickRxSafetyReport}
          onClose={() => setShowQuickRxSafetyModal(false)}
          onProceed={submitQuickRxPayload}
        />
      )}

      {/* In-Person Hospital Visit Referral Modal */}
      <InPersonReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        appointment={appointment}
        onSaveReferral={handleSaveReferral}
        loading={referralLoading}
      />

      {/* Native Light-Dismissable Audio/Video Device Settings Dialog */}
      <dialog
        ref={settingsDialogRef}
        {...{ closedby: 'any' }}
        aria-labelledby={settingsTitleId}
        className='m-auto w-full max-w-lg rounded-3xl bg-slate-900 text-slate-100 border border-slate-700/80 p-0 shadow-2xl'
      >
        <div className='p-5 sm:p-6 space-y-5'>
          <div className='flex items-center justify-between border-b border-slate-800 pb-3.5'>
            <div>
              <h2 id={settingsTitleId} className='text-base font-bold text-white flex items-center gap-2'>
                <Settings className='w-4 h-4 text-sky-400' /> Clinical Console Audio & Camera
              </h2>
              <p className='text-xs text-slate-400 mt-0.5'>Hot-swap devices live without dropping the call</p>
            </div>
            <form method='dialog'>
              <button
                type='submit'
                aria-label='Close device settings'
                className='p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
              >
                <X className='w-4 h-4' />
              </button>
            </form>
          </div>

          <div className='space-y-4 text-xs'>
            <div>
              <label className='block font-bold uppercase tracking-wider text-slate-400 mb-1.5'>
                Camera Input ({devices.cameras.length})
              </label>
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className='w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 outline-none focus:border-sky-500'
              >
                {devices.cameras.length === 0 && <option value=''>Default / No Camera</option>}
                {devices.cameras.map((cam, i) => (
                  <option key={cam.deviceId || i} value={cam.deviceId}>
                    {cam.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='font-bold uppercase tracking-wider text-slate-400'>
                  Microphone Input ({devices.microphones.length})
                </label>
                <span className='text-[11px] text-emerald-400 font-semibold'>Level: {micLevel}%</span>
              </div>
              <select
                value={selectedMicId}
                onChange={(e) => switchMicrophone(e.target.value)}
                className='w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 outline-none focus:border-sky-500'
              >
                {devices.microphones.length === 0 && <option value=''>Default Microphone</option>}
                {devices.microphones.map((mic, i) => (
                  <option key={mic.deviceId || i} value={mic.deviceId}>
                    {mic.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
              <div className='mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-75'
                  style={{ width: `${Math.min(100, micLevel)}%` }}
                />
              </div>
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='font-bold uppercase tracking-wider text-slate-400'>Speaker / Headset Output</label>
                <button
                  type='button'
                  onClick={playTestTone}
                  className='inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold cursor-pointer'
                >
                  <Volume2 className='w-3.5 h-3.5' /> Test Chime
                </button>
              </div>
              <select
                value={selectedSpeakerId}
                onChange={(e) => switchSpeaker(e.target.value)}
                className='w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 outline-none focus:border-sky-500'
              >
                {devices.speakers.length === 0 && <option value=''>System Default Output</option>}
                {devices.speakers.map((spk, i) => (
                  <option key={spk.deviceId || i} value={spk.deviceId}>
                    {spk.label || `Speaker ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1'>
              <button
                type='button'
                onClick={() => setIsMirrored((m) => !m)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  isMirrored
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <p className='font-bold'>Mirror Self-View</p>
                <p className='text-[11px] text-slate-400 mt-0.5'>{isMirrored ? 'Enabled' : 'Disabled'}</p>
              </button>

              <button
                type='button'
                onClick={toggleDataSaver}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  isDataSaver
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <p className='font-bold'>Low-Bandwidth Mode</p>
                <p className='text-[11px] text-slate-400 mt-0.5'>
                  {isDataSaver ? 'Active (180 kbps cap)' : 'Off (720p HD)'}
                </p>
              </button>
            </div>
          </div>

          <div className='flex justify-end pt-2 border-t border-slate-800'>
            <form method='dialog'>
              <button
                type='submit'
                autoFocus
                className='px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer'
              >
                Done
              </button>
            </form>
          </div>
        </div>
      </dialog>

      {/* Native Two-Party Recording Consent Modal */}
      <dialog
        ref={consentDialogRef}
        aria-labelledby={consentTitleId}
        onClose={() => {
          if (incomingRecordingRequest) respondRecordingConsent(false)
        }}
        className='m-auto w-full max-w-md rounded-3xl bg-slate-900 text-slate-100 border border-slate-700 p-6 shadow-2xl'
      >
        <div className='space-y-4'>
          <div className='w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400'>
            <Radio className='w-6 h-6' />
          </div>
          <div>
            <h2 id={consentTitleId} className='text-base font-extrabold text-white'>
              Patient Recording Consent Request
            </h2>
            <p className='text-xs text-slate-300 leading-relaxed mt-1.5'>
              <strong>{incomingRecordingRequest?.name || 'Patient'}</strong> is requesting permission to record this
              teleconsultation locally. Recording only begins if you explicitly consent.
            </p>
          </div>
          <div className='flex items-center justify-end gap-2.5 pt-2'>
            <button
              type='button'
              autoFocus
              onClick={() => respondRecordingConsent(false)}
              className='px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer'
            >
              Decline
            </button>
            <button
              type='button'
              onClick={() => respondRecordingConsent(true)}
              className='px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer'
            >
              Allow Recording
            </button>
          </div>
        </div>
      </dialog>

      <div
        className={
          isMinimized
            ? 'flex flex-col bg-slate-950'
            : 'bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-2xs flex flex-col'
        }
      >
        {/* Top Clinical Header */}
        <div
          className={
            isMinimized
              ? 'hidden'
              : 'flex flex-wrap justify-between items-center gap-4 mb-5 pb-4 border-b border-slate-200'
          }
        >
          <div className='flex items-center gap-3.5'>
            <button
              onClick={() => navigate('/doctor-appointments')}
              className='p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer'
              title={isInActiveSession ? 'Minimize call to floating PiP & view appointments' : 'Back to appointments'}
            >
              <ArrowLeft className='w-4 h-4' />
            </button>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <h1 className='text-lg sm:text-xl font-bold text-slate-900'>
                  Clinical video consultation console
                </h1>
                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold'>
                  <ShieldCheck className='w-3.5 h-3.5' />
                  DTLS-SRTP encrypted
                </span>
                {recordingState === 'active' && (
                  <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold tabular-nums'>
                    <span className='w-2 h-2 rounded-full bg-rose-600 animate-ping' />
                    REC • {formatDuration(recordingDuration)}
                  </span>
                )}
              </div>
              {appointment && (
                <p className='text-xs text-slate-500 mt-0.5'>
                  Patient: <strong className='text-slate-900'>{appointment.userData?.name}</strong>
                  {appointment.slotDate
                    ? ` • ${slotDateFormat(appointment.slotDate)} at ${appointment.slotTime}`
                    : ''}
                  {appointment.isCompleted && (
                    <span className='ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]'>
                      Completed
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={openSettingsModal}
              className='px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs'
            >
              <Settings className='w-3.5 h-3.5 text-slate-500' />
              <span>AV devices</span>
            </button>
            <button
              type='button'
              onClick={() => setShowReferralModal(true)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                appointment?.inPersonReferral
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200'
              }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${appointment?.inPersonReferral ? 'text-amber-700' : 'text-slate-400'}`} />
              <span>{appointment?.inPersonReferral ? 'In-person referral' : 'Hospital referral'}</span>
            </button>
            <button
              type='button'
              onClick={() => setShowFullHealthDrawer(true)}
              className='px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs'
            >
              <HeartPulse className='w-3.5 h-3.5 text-indigo-600' />
              <span>Full lab reports ({dossier.records.length})</span>
            </button>
            <button
              type='button'
              onClick={() => setSidePanelOpen((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border relative shadow-2xs ${
                sidePanelOpen
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
              }`}
            >
              {sidePanelOpen ? (
                <>
                  <PanelRightClose className='w-3.5 h-3.5' />
                  <span>Hide clinical panel</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className='w-3.5 h-3.5' />
                  <span>Clinical & chat drawer</span>
                  {unreadChatCount > 0 && (
                    <span className='ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums'>
                      {unreadChatCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Split Layout: Video Stage (Left) + Collapsible Clinical & Chat Drawer (Right) */}
        <div className={isMinimized ? 'block' : 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'}>
          {/* Left Column: Video Stage + Control Bar */}
          <div
            className={`${
              isMinimized
                ? 'w-full'
                : sidePanelOpen
                ? 'lg:col-span-7'
                : 'lg:col-span-12 max-w-5xl mx-auto'
            } w-full flex flex-col items-center`}
          >
            <div
              ref={stageContainerRef}
              className={`relative w-full bg-slate-950 overflow-hidden select-none ${
                isMinimized ? '' : 'rounded-3xl shadow-xl border border-slate-800'
              }`}
              style={{ aspectRatio: '16/9' }}
            >
              {/* REMOTE PATIENT VIDEO CONTAINER */}
              <div
                onClick={() => {
                  if (isSwappedView && isInActiveSession) setIsSwappedView(false)
                }}
                className={
                  isSwappedView && isInActiveSession
                    ? 'absolute bottom-4 right-4 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 z-20 cursor-pointer'
                    : 'absolute inset-0 w-full h-full z-0'
                }
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full ${
                    peerMediaState.screen ? 'object-contain bg-slate-950' : 'object-cover'
                  }`}
                />
                {remoteConnected && !peerMediaState.video && !peerMediaState.screen && (
                  <div className='absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-slate-300 gap-2'>
                    {appointment?.userData?.image ? (
                      <img
                        src={appointment.userData.image}
                        alt={appointment.userData.name}
                        className='w-20 h-20 rounded-3xl object-cover border-2 border-slate-700'
                      />
                    ) : (
                      <VideoOff className='w-8 h-8 text-slate-500' />
                    )}
                    <span className='text-xs font-semibold text-slate-400'>Patient Camera Off (Audio Active)</span>
                  </div>
                )}
                {isSwappedView && isInActiveSession && (
                  <span className='absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-semibold'>
                    {peerInfo?.name || appointment?.userData?.name || 'Patient'} (Click to Expand)
                  </span>
                )}
              </div>

              {/* Placeholder / Green Room / Post-Call Summary when Remote Not Connected */}
              {!remoteConnected && !lobbyActive && (
                <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center'>
                  {appointment?.userData?.image && (
                    <img
                      src={appointment.userData.image}
                      alt={appointment.userData.name}
                      className='w-24 h-24 rounded-3xl bg-slate-800 object-cover mb-4 border-2 border-white/15 shadow-lg'
                    />
                  )}
                  <p className='text-white font-bold text-base sm:text-lg'>
                    {appointment?.userData?.name || 'Patient Consultation Room'}
                  </p>
                  <p className='text-slate-400 text-xs mt-1 max-w-md leading-relaxed'>
                    {callStatus === 'idle' &&
                      'Preview your camera & headset in the Green Room, or click Start Consultation Call to ring the patient immediately.'}
                    {callStatus === 'connecting' &&
                      'Ringing patient now... Media will connect automatically as soon as the patient joins.'}
                    {callStatus === 'reconnecting' &&
                      'Temporary network handoff detected — restoring encrypted peer connection...'}
                    {callStatus === 'ended' &&
                      (replacedByOtherTab
                        ? 'Session moved to another open console tab.'
                        : `Consultation call ended (${formatDuration(callDuration)}).`)}
                  </p>

                  {callStatus === 'idle' && (
                    <div className='mt-5 flex flex-wrap items-center justify-center gap-2.5'>
                      <button
                        type='button'
                        onClick={startLobbyPreview}
                        className='px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer'
                      >
                        <Settings className='w-3.5 h-3.5 text-sky-400' /> Green Room Preview
                      </button>
                      <button
                        type='button'
                        onClick={() => startCall({ audioOnly: false })}
                        className='px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer'
                      >
                        <Video className='w-4 h-4' /> Start Consultation Call
                      </button>
                    </div>
                  )}

                  {callStatus === 'connecting' && (
                    <div className='mt-4 flex gap-2'>
                      <span className='w-2.5 h-2.5 bg-sky-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }} />
                      <span className='w-2.5 h-2.5 bg-sky-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }} />
                      <span className='w-2.5 h-2.5 bg-sky-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              )}

              {/* LOCAL DOCTOR VIDEO CONTAINER (Green Room full preview, Swapped full view, or PiP) */}
              <div
                onClick={() => {
                  if (!isSwappedView && isInActiveSession) setIsSwappedView(true)
                }}
                title={isInActiveSession && !isSwappedView ? 'Click to swap your video to main view' : ''}
                className={
                  lobbyActive && !isInActiveSession
                    ? 'absolute inset-0 w-full h-full z-10 bg-slate-950'
                    : isSwappedView && isInActiveSession
                    ? 'absolute inset-0 w-full h-full z-0 bg-slate-950'
                    : isInActiveSession
                    ? isMinimized
                      ? 'absolute bottom-2 right-2 w-20 h-14 rounded-lg overflow-hidden shadow-lg border border-white/25 bg-slate-900 z-20 cursor-pointer'
                      : 'absolute bottom-4 right-4 w-36 sm:w-44 h-24 sm:h-28 rounded-2xl overflow-hidden shadow-xl border-2 border-white/20 hover:border-sky-400/70 bg-slate-900 z-20 cursor-pointer transition-all'
                    : 'hidden'
                }
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full ${
                    isScreenSharing
                      ? 'object-contain bg-slate-950'
                      : `object-cover ${isMirrored ? '-scale-x-100' : ''}`
                  }`}
                />
                {isVideoOff && !isScreenSharing && (
                  <div className='absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400'>
                    <VideoOff className='w-5 h-5 mb-1' />
                    <span className='text-[10px] font-semibold'>Camera Off</span>
                  </div>
                )}

                {lobbyActive && !isInActiveSession && (
                  <div className='absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-transparent flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex items-center gap-3'>
                      <button
                        type='button'
                        onClick={toggleMute}
                        className={`p-2.5 rounded-xl border cursor-pointer ${
                          isMuted
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-slate-900/80 border-slate-700 text-white'
                        }`}
                      >
                        {isMuted ? <MicOff className='w-4 h-4' /> : <Mic className='w-4 h-4' />}
                      </button>
                      <button
                        type='button'
                        onClick={toggleVideo}
                        className={`p-2.5 rounded-xl border cursor-pointer ${
                          isVideoOff
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-slate-900/80 border-slate-700 text-white'
                        }`}
                      >
                        {isVideoOff ? <VideoOff className='w-4 h-4' /> : <Video className='w-4 h-4' />}
                      </button>
                      <div className='w-28 sm:w-36'>
                        <div className='text-[10px] text-slate-300 font-semibold mb-1'>Mic Level</div>
                        <div className='h-1.5 rounded-full bg-slate-800 overflow-hidden'>
                          <div
                            className='h-full bg-emerald-400 transition-all duration-75'
                            style={{ width: `${Math.min(100, micLevel)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        type='button'
                        onClick={playTestTone}
                        className='px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-700 text-sky-300 text-[11px] font-semibold cursor-pointer'
                      >
                        Test Speaker
                      </button>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        type='button'
                        onClick={stopLobbyPreview}
                        className='px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer'
                      >
                        Close
                      </button>
                      <button
                        type='button'
                        onClick={() => startCall({ audioOnly: false })}
                        className='px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer'
                      >
                        Ring Patient & Start
                      </button>
                    </div>
                  </div>
                )}

                {isInActiveSession && !isSwappedView && (
                  <span className='absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-semibold'>
                    {isScreenSharing ? 'Sharing Screen' : 'You (Doctor)'}
                  </span>
                )}
              </div>

              {/* Top-Left HUD: Live Timer & Patient Media State Badges */}
              {isInActiveSession && (
                <div className='absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 max-w-[60%]'>
                  <div className='bg-slate-900/85 text-white px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/15 flex items-center gap-2 tabular-nums'>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        callStatus === 'connected' ? 'bg-rose-500 animate-pulse' : 'bg-amber-400 animate-ping'
                      }`}
                    />
                    <span>
                      {callStatus === 'connected'
                        ? formatDuration(callDuration)
                        : callStatus === 'reconnecting'
                        ? 'Reconnecting...'
                        : 'Ringing Patient...'}
                    </span>
                  </div>

                  {remoteConnected && !peerMediaState.audio && (
                    <span className='bg-rose-950/85 border border-rose-500/40 text-rose-200 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1'>
                      <MicOff className='w-3 h-3' /> Patient Muted
                    </span>
                  )}
                  {remoteConnected && peerMediaState.screen && (
                    <span className='bg-sky-950/85 border border-sky-500/40 text-sky-200 px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1'>
                      <Monitor className='w-3 h-3' /> Patient Sharing Screen
                    </span>
                  )}
                  {remoteConnected && peerMediaState.handRaised && (
                    <span className='bg-amber-500 text-slate-950 px-2.5 py-1 rounded-full text-[11px] font-extrabold animate-bounce'>
                      ✋ Patient Raised Hand
                    </span>
                  )}
                </div>
              )}

              {/* Top-Right HUD: Network Quality Telemetry + Live Contactless rPPG Patient Pulse */}
              {isInActiveSession && !isMinimized && (
                <div className='absolute top-3.5 right-3.5 z-30 flex flex-col items-end gap-2.5'>
                  {remoteConnected && (
                    <button
                      type='button'
                      onClick={() => setShowStatsPopover((s) => !s)}
                      className={`px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${qualityBadgeStyle}`}
                      title='Inspect Live WebRTC Telemetry'
                    >
                      <Gauge className='w-3.5 h-3.5' />
                      <span>
                        {networkStats.rttMs !== null ? `${networkStats.rttMs} ms` : 'Link'} •{' '}
                        {networkStats.candidateType}
                      </span>
                    </button>
                  )}

                  {showStatsPopover && remoteConnected && (
                    <div className='w-64 p-3.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 backdrop-blur-md text-slate-200 text-[11px] shadow-2xl space-y-2'>
                      <div className='flex items-center justify-between border-b border-slate-800 pb-1.5'>
                        <span className='font-extrabold uppercase tracking-wider text-slate-400'>
                          WebRTC Diagnostics
                        </span>
                        <span className='uppercase font-bold text-emerald-400'>{networkStats.qualityGrade}</span>
                      </div>
                      <div className='grid grid-cols-2 gap-y-1.5 text-slate-300'>
                        <span className='text-slate-400'>Latency (RTT):</span>
                        <span className='font-mono text-right'>{networkStats.rttMs ?? '--'} ms</span>
                        <span className='text-slate-400'>Packet Loss:</span>
                        <span className='font-mono text-right'>{networkStats.packetLossPct}%</span>
                        <span className='text-slate-400'>Bitrate (↓/↑):</span>
                        <span className='font-mono text-right'>
                          {networkStats.rxBitrateKbps}/{networkStats.txBitrateKbps} kbps
                        </span>
                        <span className='text-slate-400'>Patient Stream:</span>
                        <span className='font-mono text-right'>
                          {networkStats.resolution || 'Audio'} {networkStats.fps ? `@${networkStats.fps}fps` : ''}
                        </span>
                        <span className='text-slate-400'>Transport:</span>
                        <span className='font-semibold text-sky-300 text-right'>{networkStats.candidateType}</span>
                      </div>
                      <div className='pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2'>
                        <button
                          type='button'
                          onClick={toggleDataSaver}
                          className='px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold cursor-pointer'
                        >
                          {isDataSaver ? 'Restore HD' : 'Data Saver'}
                        </button>
                        <button
                          type='button'
                          onClick={triggerIceRestart}
                          className='px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 font-semibold flex items-center gap-1 cursor-pointer'
                        >
                          <RefreshCw className='w-3 h-3' /> ICE Restart
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Patient Real-Time Clinical Vitals & RCP NEWS2 HUD */}
                  {patientVitals && (() => {
                    const hrVal = patientVitals.heartRate ?? patientVitals.bpm ?? null
                    const liveTriage = computeNEWS2({
                      heartRate: hrVal,
                      systolicBp: patientVitals.systolicBp,
                      diastolicBp: patientVitals.diastolicBp,
                      spo2: patientVitals.spo2,
                      temperatureF: patientVitals.temperatureF,
                      respiratoryRate: patientVitals.respiratoryRate,
                      bloodGlucose: patientVitals.bloodGlucose
                    })
                    const riskLevel = patientVitals.news2Risk || liveTriage.news2Risk || 'LOW'
                    const scoreVal = patientVitals.news2Score ?? liveTriage.news2Score ?? 0
                    const flags = Array.isArray(patientVitals.clinicalFlags) && patientVitals.clinicalFlags.length > 0
                      ? patientVitals.clinicalFlags
                      : liveTriage.clinicalFlags
                    const hudRiskBadge = {
                      LOW: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      LOW_MEDIUM: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
                      MEDIUM: 'bg-orange-500/30 text-orange-200 border-orange-400/60',
                      HIGH: 'bg-rose-600/40 text-rose-100 border-rose-400 animate-pulse'
                    }[riskLevel] || 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'

                    return (
                      <div className='bg-slate-900/92 text-white p-3 rounded-2xl border border-slate-700/80 backdrop-blur-md shadow-xl w-72 space-y-2'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-[10px] text-slate-300 font-extrabold uppercase tracking-wider flex items-center gap-1.5'>
                            <HeartPulse className='w-3.5 h-3.5 text-rose-400' />
                            {patientVitals.source === 'rppg_spot_check'
                              ? '15s POS-rPPG Pulse'
                              : 'Patient Clinical Vitals'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${hudRiskBadge}`}>
                            NEWS2 {scoreVal} • {riskLevel.replace('_', '-')}
                          </span>
                        </div>

                        <div className='grid grid-cols-2 gap-1.5 text-xs'>
                          {patientVitals.systolicBp && (
                            <div className='bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800'>
                              <span className='text-[9px] text-slate-400 uppercase block'>BP (mmHg)</span>
                              <span className='font-mono font-black text-white'>
                                {patientVitals.systolicBp}/{patientVitals.diastolicBp || '--'}
                              </span>
                            </div>
                          )}
                          {patientVitals.spo2 && (
                            <div className='bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800'>
                              <span className='text-[9px] text-slate-400 uppercase block'>SpO₂</span>
                              <span className='font-mono font-black text-sky-300'>{patientVitals.spo2}%</span>
                            </div>
                          )}
                          {patientVitals.temperatureF && (
                            <div className='bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800'>
                              <span className='text-[9px] text-slate-400 uppercase block'>Temp</span>
                              <span className='font-mono font-black text-amber-300'>{patientVitals.temperatureF}°F</span>
                            </div>
                          )}
                          {hrVal && (
                            <div className='bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800'>
                              <span className='text-[9px] text-slate-400 uppercase block'>Pulse</span>
                              <span className='font-mono font-black text-emerald-400'>
                                {hrVal} <span className='text-[9px] text-slate-400 font-sans'>BPM</span>
                              </span>
                            </div>
                          )}
                        </div>

                        {flags.length > 0 && (
                          <div className='text-[10px] text-rose-300 font-semibold bg-rose-950/60 border border-rose-500/30 rounded-lg px-2 py-1'>
                            ⚠️ {flags.join(' • ')}
                          </div>
                        )}

                        {patientVitals.source === 'rppg_spot_check' && patientVitals.progressPct !== undefined && !patientVitals.isLocked && (
                          <div className='text-[10px] text-slate-400 flex items-center justify-between'>
                            <span>Stationary 15s capture...</span>
                            <span className='font-mono text-emerald-400'>{patientVitals.progressPct}%</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Floating Reactions */}
              {floatingReactions.length > 0 && (
                <div className='absolute bottom-16 left-4 z-30 flex flex-col gap-1.5 pointer-events-none'>
                  {floatingReactions.map((r) => (
                    <div
                      key={r.id}
                      className='px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-bounce'
                    >
                      <span className='text-base'>{r.emoji}</span>
                      <span>
                        {r.name}: {r.label || ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Speech-to-Text Closed Captions Overlay */}
              {liveCaption && (
                <div className='absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[82%] px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-white/15 text-white text-xs sm:text-sm text-center shadow-xl pointer-events-none'>
                  <span className='font-bold text-sky-300 mr-1.5'>{liveCaption.speakerName}:</span>
                  <span>{liveCaption.text}</span>
                </div>
              )}
            </div>

            {/* Floating Mini-Call Control Bar when Browsing Other Doctor Workspace Tabs */}
            {isMinimized && isInActiveSession && (
              <div className='w-full bg-slate-900 px-3 py-2 flex items-center justify-between gap-2 border-t border-slate-800'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0' />
                  <span className='text-[11px] font-bold text-white tabular-nums shrink-0'>
                    {callStatus === 'connected' ? formatDuration(callDuration) : 'Ringing...'}
                  </span>
                  <span className='text-[11px] text-slate-400 truncate'>
                    {appointment?.userData?.name || 'Patient'}
                  </span>
                </div>
                <div className='flex items-center gap-1.5 shrink-0'>
                  <button
                    type='button'
                    onClick={toggleMute}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                      isMuted ? 'bg-rose-500/25 text-rose-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                    title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                  >
                    {isMuted ? <MicOff className='w-3.5 h-3.5' /> : <Mic className='w-3.5 h-3.5' />}
                  </button>
                  <button
                    type='button'
                    onClick={toggleVideo}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                      isVideoOff ? 'bg-rose-500/25 text-rose-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                    title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                  >
                    {isVideoOff ? <VideoOff className='w-3.5 h-3.5' /> : <Video className='w-3.5 h-3.5' />}
                  </button>
                  <button
                    type='button'
                    onClick={() => navigate(`/doctor-video-call/${appointmentId}`)}
                    className='px-2.5 h-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer'
                    title='Return to Full Consultation Console'
                  >
                    <Maximize2 className='w-3 h-3' /> <span>Expand</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => endCall(true)}
                    className='w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer'
                    title='End Consultation'
                  >
                    <PhoneOff className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
            )}

            {/* Production Clinical Call Controls */}
            <div
              className={
                isMinimized
                  ? 'hidden'
                  : 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mt-4 flex flex-wrap items-center justify-between gap-2.5'
              }
            >
              {(callStatus === 'idle' || callStatus === 'ended') && (
                <div className='flex flex-wrap items-center justify-between gap-3 w-full'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => startCall({ audioOnly: false })}
                      className='px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer'
                    >
                      <Video className='w-4 h-4' />
                      <span>{callStatus === 'ended' ? 'Rejoin Video Call' : 'Start Consultation Call'}</span>
                    </button>
                    <button
                      type='button'
                      onClick={() => startCall({ audioOnly: true })}
                      className='px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer'
                    >
                      <Mic className='w-3.5 h-3.5 text-sky-600' />
                      <span>Start Audio-Only</span>
                    </button>
                  </div>
                  {callStatus === 'ended' && !appointment?.isCompleted && (
                    <button
                      type='button'
                      disabled={completingAppointment}
                      onClick={handleCompleteAndEnd}
                      className='px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50'
                    >
                      <CheckCircle2 className='w-4 h-4' />
                      <span>{completingAppointment ? 'Completing...' : 'Mark Appointment Completed'}</span>
                    </button>
                  )}
                </div>
              )}

              {isInActiveSession && (
                <>
                  <div className='flex flex-wrap items-center gap-2'>
                    {/* Mute */}
                    <button
                      type='button'
                      onClick={toggleMute}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                        isMuted
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title='Mute / Unmute Mic (M)'
                    >
                      {isMuted ? <MicOff className='w-4 h-4' /> : <Mic className='w-4 h-4' />}
                      <span className='hidden sm:inline'>{isMuted ? 'Unmute' : 'Mic'}</span>
                    </button>

                    {/* Camera */}
                    <button
                      type='button'
                      onClick={toggleVideo}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                        isVideoOff
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title='Turn Camera On/Off (V)'
                    >
                      {isVideoOff ? <VideoOff className='w-4 h-4' /> : <Video className='w-4 h-4' />}
                      <span className='hidden sm:inline'>{isVideoOff ? 'Cam On' : 'Cam'}</span>
                    </button>

                    {/* Screen Share (for walking patient through Lab Reports / Imaging) */}
                    <button
                      type='button'
                      onClick={toggleScreenShare}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                        isScreenSharing
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title='Share Lab Reports / Screen with Patient (S)'
                    >
                      <Monitor className='w-4 h-4' />
                      <span className='hidden md:inline'>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
                    </button>

                    {/* Clinical Exam Frame Snapshot */}
                    <button
                      type='button'
                      onClick={() => captureSnapshot(appointment?.userData?.name || 'Patient')}
                      className='px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                      title='Capture High-Res Clinical Exam Frame of Patient Video'
                    >
                      <Camera className='w-4 h-4 text-indigo-600' />
                      <span className='hidden xl:inline'>Exam Snap</span>
                    </button>

                    {/* Live Speech-to-Text Captions */}
                    {captionsSupported && (
                      <button
                        type='button'
                        onClick={toggleCaptions}
                        className={`px-3 py-2.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          captionsEnabled
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                        title='Live Speech-to-Text Consultation Transcript'
                      >
                        CC
                      </button>
                    )}

                    {/* Quick Clinical Cue */}
                    <div className='relative'>
                      <button
                        type='button'
                        onClick={() => setShowCueMenu((p) => !p)}
                        className='p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                        title='Send Quick Clinical Status Cue'
                      >
                        <Smile className='w-4 h-4' />
                      </button>
                      {showCueMenu && (
                        <div className='absolute bottom-12 left-0 z-30 p-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl flex items-center gap-1'>
                          {DOCTOR_QUICK_CUES.map((c) => (
                            <button
                              key={c.emoji}
                              type='button'
                              onClick={() => {
                                sendReaction(c.emoji, c.label)
                                setShowCueMenu(false)
                              }}
                              title={c.label}
                              className='w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-base cursor-pointer'
                            >
                              {c.emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Two-Party Consented Recording */}
                    <button
                      type='button'
                      onClick={recordingState === 'active' ? stopRecording : requestRecording}
                      disabled={recordingState === 'requesting'}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer disabled:opacity-50 ${
                        recordingState === 'active'
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title='Request Two-Party Consent Consultation Recording'
                    >
                      <Radio className='w-3.5 h-3.5 text-rose-500' />
                      <span className='hidden xl:inline'>
                        {recordingState === 'active'
                          ? 'Stop Rec'
                          : recordingState === 'requesting'
                          ? 'Consent Pending...'
                          : 'Record'}
                      </span>
                    </button>
                  </div>

                  {/* Viewport & End / Complete Actions */}
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => setIsSwappedView((v) => !v)}
                      className='p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                      title='Swap Patient / Self View'
                    >
                      <ArrowLeftRight className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={togglePiP}
                      className={`p-2.5 rounded-xl border cursor-pointer ${
                        isPiP
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title='Picture-in-Picture'
                    >
                      <PictureInPicture2 className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={toggleFullscreen}
                      className='p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer'
                      title='Fullscreen Stage (F)'
                    >
                      {isFullscreen ? <Minimize2 className='w-4 h-4' /> : <Maximize2 className='w-4 h-4' />}
                    </button>
                    {!appointment?.isCompleted && (
                      <button
                        type='button'
                        disabled={completingAppointment}
                        onClick={handleCompleteAndEnd}
                        className='px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50'
                        title='Mark Appointment Completed & End Call'
                      >
                        <CheckCircle2 className='w-4 h-4' />
                        <span className='hidden sm:inline'>Complete & End</span>
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={() => endCall(true)}
                      className='px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer'
                    >
                      <PhoneOff className='w-4 h-4' />
                      <span>End</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: In-Call Clinical Side Drawer (Chart • Write Rx • Chat & Transcript) */}
          {sidePanelOpen && !isMinimized && (
            <div className='lg:col-span-5 bg-slate-50/90 border border-slate-200/90 rounded-3xl overflow-hidden flex flex-col max-h-[78vh]'>
              {/* 3-Tab Clinical Navigation */}
              <div className='p-2 bg-white border-b border-slate-200 grid grid-cols-3 gap-1 shrink-0'>
                <button
                  type='button'
                  onClick={() => setSideTab('chart')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sideTab === 'chart' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <HeartPulse className='w-3.5 h-3.5' />
                  <span className='truncate'>Chart <span className='tabular-nums font-semibold'>({dossier.records.length})</span></span>
                </button>
                <button
                  type='button'
                  onClick={() => setSideTab('rx')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sideTab === 'rx' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileText className='w-3.5 h-3.5' />
                  <span>Write e-Rx</span>
                  {issuedRxSuccess && <CheckCircle2 className='w-3.5 h-3.5 text-emerald-300' />}
                </button>
                <button
                  type='button'
                  onClick={() => setSideTab('chat')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                    sideTab === 'chat' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className='w-3.5 h-3.5' />
                  <span>Chat & CC</span>
                  {unreadChatCount > 0 && (
                    <span className='px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums'>
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className='flex-1 overflow-y-auto p-4 space-y-4'>
                {sideTab === 'chart' && (
                  <>
                    {/* Reason for Visit */}
                    {appointment?.reasonForVisit && (
                      <div className='bg-sky-50 border border-sky-200 rounded-2xl p-3.5 text-xs'>
                        <p className='font-bold text-sky-900 uppercase tracking-wider text-[10px] flex items-center gap-1.5 mb-1'>
                          <ClipboardList className='w-3.5 h-3.5 text-sky-600' /> Chief complaint / reason for visit
                        </p>
                        <p className='text-slate-800 font-semibold'>{appointment.reasonForVisit}</p>
                      </div>
                    )}

                    {/* Allergies & Regular Medications */}
                    <div className='bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5'>
                      <div className='flex items-center justify-between'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5'>
                          <AlertTriangle
                            className={`w-3.5 h-3.5 ${allergies.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}
                          />
                          Known Drug Allergies
                        </span>
                      </div>
                      {allergies.length > 0 ? (
                        <div className='flex flex-wrap gap-1.5'>
                          {allergies.map((alg, i) => (
                            <span
                              key={i}
                              className='px-2.5 py-1 rounded-full bg-rose-600 text-white text-xs font-bold'
                            >
                              ⚠️ {alg}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className='text-xs text-emerald-700 font-semibold'>No known drug allergies</p>
                      )}

                      {regularMeds.length > 0 && (
                        <div className='pt-2 border-t border-slate-100'>
                          <span className='text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1'>
                            Regular Medications
                          </span>
                          <div className='flex flex-wrap gap-1.5'>
                            {regularMeds.map((m, i) => (
                              <span
                                key={i}
                                className='px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold'
                              >
                                💊 {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Captured In-Call Visual Exam Snapshots (Protected Ephemeral Preview) */}
                    {snapshots.length > 0 && (
                      <div className='bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5'>
                        <div className='flex items-center justify-between'>
                          <span className='text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5'>
                            <Camera className='w-3.5 h-3.5' /> In-Session Exam Frames ({snapshots.length})
                          </span>
                          <span className='text-[10px] font-semibold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full'>
                            <ShieldCheck className='w-3 h-3 text-emerald-600' /> Protected View
                          </span>
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                          {snapshots.map((snap) => (
                            <button
                              key={snap.id}
                              type='button'
                              onClick={() => setActiveExamSnapshot(snap)}
                              onContextMenu={(e) => e.preventDefault()}
                              className='group relative rounded-xl overflow-hidden border border-slate-200 block text-left cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all select-none'
                            >
                              <img
                                src={snap.dataUrl}
                                alt='Clinical exam snapshot'
                                draggable={false}
                                className='w-full h-24 object-cover pointer-events-none select-none'
                              />
                              <span className='absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[9px] font-mono select-none'>
                                {snap.timestamp}
                              </span>
                              <div className='absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/20 transition-colors flex items-center justify-center'>
                                <span className='opacity-0 group-hover:opacity-100 bg-white/95 text-slate-900 text-[10px] font-bold px-2 py-1 rounded shadow-xs transition-opacity'>
                                  View Securely
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <p className='text-[10px] text-slate-400 italic flex items-center gap-1'>
                          <Lock className='w-3 h-3 text-slate-400 shrink-0' /> Raw export restricted for patient privacy & telemedicine compliance.
                        </p>
                      </div>
                    )}

                    {/* Uploaded Lab Reports Summary */}
                    <div className='bg-white rounded-2xl border border-slate-200 p-3.5 space-y-3'>
                      <div className='flex items-center justify-between'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5'>
                          <FileText className='w-3.5 h-3.5 text-sky-600' /> Uploaded Lab Reports ({dossier.records.length})
                        </span>
                        <button
                          type='button'
                          onClick={() => setShowFullHealthDrawer(true)}
                          className='text-[11px] font-bold text-sky-600 hover:underline cursor-pointer'
                        >
                          Expand All ↗
                        </button>
                      </div>

                      {loadingDossier ? (
                        <p className='text-xs text-slate-400 py-4 text-center'>Loading patient reports...</p>
                      ) : dossier.records.length === 0 ? (
                        <p className='text-xs text-slate-400 py-3'>No lab reports uploaded by this patient yet.</p>
                      ) : (
                        <div className='space-y-2.5'>
                          {dossier.records.slice(0, 4).map((rec) => (
                            <div
                              key={rec._id}
                              onClick={() => setShowFullHealthDrawer(true)}
                              className='p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50/50 border border-slate-200/80 transition-colors cursor-pointer flex items-start gap-3'
                            >
                              <img
                                src={rec.fileUrl}
                                alt={rec.fileName}
                                className='w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0'
                              />
                              <div className='min-w-0 flex-1'>
                                <p className='text-xs font-bold text-slate-900 truncate'>{rec.fileName}</p>
                                <p className='text-[11px] text-slate-600 line-clamp-2 mt-0.5'>
                                  {rec.aiSummary ||
                                    rec.aiExtractedData?.summary ||
                                    'Click to view full report & run AI summary'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Historical Multi-Parameter Clinical Vitals & NEWS2 */}
                    {dossier.vitals.length > 0 && (
                      <div className='bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5'>
                          <HeartPulse className='w-3.5 h-3.5 text-rose-500' /> Historical Clinical Vitals & NEWS2
                        </span>
                        <div className='space-y-2'>
                          {dossier.vitals.slice(0, 4).map((v) => {
                            const risk = v.news2Risk || 'LOW'
                            const badgeCls =
                              risk === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : risk === 'MEDIUM' || risk === 'LOW_MEDIUM'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            return (
                              <div key={v._id} className='p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1'>
                                <div className='flex items-center justify-between gap-2'>
                                  <div className='flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900'>
                                    {v.systolicBp && <span>BP {v.systolicBp}/{v.diastolicBp || '--'}</span>}
                                    {v.spo2 && <span>SpO₂ {v.spo2}%</span>}
                                    {v.temperatureF && <span>{v.temperatureF}°F</span>}
                                    {v.heartRate && <span>HR {v.heartRate} BPM</span>}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border shrink-0 ${badgeCls}`}>
                                    NEWS2 {v.news2Score ?? 0}
                                  </span>
                                </div>
                                {Array.isArray(v.clinicalFlags) && v.clinicalFlags.length > 0 && (
                                  <p className='text-[10px] text-rose-600 font-semibold'>{v.clinicalFlags.join(' • ')}</p>
                                )}
                                <p className='text-[10px] text-slate-400 flex items-center justify-between'>
                                  <span>{v.source === 'rppg_spot_check' ? '15s POS-rPPG' : 'Home Clinical Devices'}</span>
                                  <span>{v.timestamp ? new Date(v.timestamp).toLocaleDateString() : ''}</span>
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {sideTab === 'rx' && (
                  /* TAB 2: IN-CALL QUICK E-PRESCRIPTION BUILDER */
                  <form onSubmit={handleIssueQuickRx} className='space-y-3.5'>
                    {allergies.length > 0 && (
                      <div className='p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2'>
                        <AlertTriangle className='w-4 h-4 text-rose-600 shrink-0' />
                        <span>
                          Allergies: <strong>{allergies.join(', ')}</strong>
                        </span>
                      </div>
                    )}

                    <div>
                      <label className='block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1'>
                        Diagnosis *
                      </label>
                      <input
                        type='text'
                        required
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder='e.g., Acute Viral Fever / Migraine'
                        className='w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-sky-500'
                      />
                    </div>

                    <div>
                      <span className='block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5'>
                        Quick-Add Medicine (1-Click)
                      </span>
                      <div className='flex flex-wrap gap-1.5'>
                        {QUICK_RX_FORMULARY.map((item, i) => (
                          <button
                            key={i}
                            type='button'
                            onClick={() => {
                              const emptyIdx = medicines.findIndex((m) => !m.name.trim())
                              if (emptyIdx !== -1) {
                                const next = [...medicines]
                                next[emptyIdx] = { ...item }
                                setMedicines(next)
                              } else {
                                setMedicines([...medicines, { ...item }])
                              }
                            }}
                            className='px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-[11px] font-semibold text-slate-700 cursor-pointer'
                          >
                            + {item.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className='space-y-2.5'>
                      <div className='flex items-center justify-between'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-slate-600'>
                          Medicines ({medicines.length})
                        </span>
                        <button
                          type='button'
                          onClick={() =>
                            setMedicines([
                              ...medicines,
                              {
                                name: '',
                                dosage: '1 Tablet',
                                frequency: '1-0-1 (Morning & Night)',
                                duration: '5 Days',
                                instructions: 'After meals'
                              }
                            ])
                          }
                          className='text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer'
                        >
                          <Plus className='w-3 h-3' /> Add Row
                        </button>
                      </div>

                      {medicines.map((med, idx) => (
                        <div key={idx} className='p-3 rounded-xl bg-white border border-slate-200 space-y-2'>
                          <div className='flex items-center gap-2'>
                            <input
                              type='text'
                              required
                              value={med.name}
                              onChange={(e) => {
                                const next = [...medicines]
                                next[idx].name = e.target.value
                                setMedicines(next)
                              }}
                              placeholder='Medicine name (e.g., Paracetamol 500mg)'
                              className='flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-sky-500'
                            />
                            {medicines.length > 1 && (
                              <button
                                type='button'
                                onClick={() => setMedicines(medicines.filter((_, i) => i !== idx))}
                                className='p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer'
                              >
                                <Trash2 className='w-3.5 h-3.5' />
                              </button>
                            )}
                          </div>
                          <div className='grid grid-cols-3 gap-1.5'>
                            <input
                              type='text'
                              required
                              value={med.dosage}
                              onChange={(e) => {
                                const next = [...medicines]
                                next[idx].dosage = e.target.value
                                setMedicines(next)
                              }}
                              placeholder='Dosage'
                              className='px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] outline-none focus:border-sky-500'
                            />
                            <select
                              value={med.frequency}
                              onChange={(e) => {
                                const next = [...medicines]
                                next[idx].frequency = e.target.value
                                setMedicines(next)
                              }}
                              className='px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] outline-none focus:border-sky-500 bg-white'
                            >
                              <option value='1-0-0 (Morning)'>1-0-0</option>
                              <option value='1-0-1 (Morning & Night)'>1-0-1</option>
                              <option value='1-1-1 (Thrice a day)'>1-1-1</option>
                              <option value='0-0-1 (Night)'>0-0-1</option>
                              <option value='SOS (As needed)'>SOS</option>
                            </select>
                            <input
                              type='text'
                              value={med.duration}
                              onChange={(e) => {
                                const next = [...medicines]
                                next[idx].duration = e.target.value
                                setMedicines(next)
                              }}
                              placeholder='5 Days'
                              className='px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] outline-none focus:border-sky-500'
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className='flex items-center justify-between mb-1'>
                        <label className='text-[11px] font-extrabold uppercase tracking-wider text-slate-600'>
                          Clinical Advice / Notes
                        </label>
                        {transcript.length > 0 && (
                          <button
                            type='button'
                            onClick={handleInsertTranscriptIntoNotes}
                            className='text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer'
                          >
                            <Sparkles className='w-3 h-3' /> Insert CC Transcript
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder='Drink plenty of warm fluids, rest...'
                        className='w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:border-sky-500 resize-none'
                      />
                    </div>

                    <div className='flex flex-col gap-2 pt-1'>
                      <button
                        type='submit'
                        disabled={issuingRx}
                        className='w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer'
                      >
                        {issuingRx
                          ? 'Checking DDI Safety & Signing Rx...'
                          : issuedRxSuccess
                          ? 'Update & Re-Send Prescription In-Call'
                          : 'Sign & Issue Prescription In-Call'}
                      </button>
                      <button
                        type='button'
                        onClick={() => navigate(`/doctor-prescription/${appointmentId}`)}
                        className='w-full py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer'
                      >
                        <span>Open Full Prescription Studio</span>
                        <ExternalLink className='w-3 h-3' />
                      </button>
                    </div>
                  </form>
                )}

                {sideTab === 'chat' && (
                  /* TAB 3: LIVE IN-CALL APPOINTMENT CHAT + SPEECH-TO-TEXT CONSULTATION TRANSCRIPT */
                  <div className='space-y-4'>
                    {/* Live Captions & Clinical Transcript Box */}
                    <div className='bg-white rounded-2xl border border-slate-200 p-3 space-y-2.5'>
                      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5'>
                          <Sparkles className='w-3.5 h-3.5' /> Live Clinical Transcript ({transcript.length})
                        </span>
                        <div className='flex items-center gap-1.5'>
                          {captionsSupported && (
                            <button
                              type='button'
                              onClick={toggleCaptions}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                captionsEnabled ? 'bg-rose-50 text-rose-700' : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {captionsEnabled ? 'Stop CC' : 'Start CC'}
                            </button>
                          )}
                          {transcript.length > 0 && (
                            <>
                              <button
                                type='button'
                                onClick={handleInsertTranscriptIntoNotes}
                                className='px-2 py-1 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-bold cursor-pointer'
                                title='Append transcript into Prescription Notes'
                              >
                                + To Rx Notes
                              </button>
                              <button
                                type='button'
                                onClick={handleDownloadTranscript}
                                className='p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                                title='Download Transcript'
                              >
                                <Download className='w-3.5 h-3.5' />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className='max-h-36 overflow-y-auto space-y-1.5 text-xs'>
                        {transcript.length === 0 ? (
                          <p className='text-[11px] text-slate-400 py-2 text-center'>
                            Enable <strong>CC</strong> to transcribe doctor–patient conversation in real time.
                          </p>
                        ) : (
                          transcript.map((line) => (
                            <div key={line.id} className='p-2 rounded-lg bg-slate-50 text-[11px]'>
                              <span className='font-bold text-slate-700'>{line.speakerName}: </span>
                              <span className='text-slate-600'>{line.text}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Persistent Appointment Live Chat */}
                    <div className='bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-80'>
                      <div className='px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between'>
                        <span className='text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5'>
                          <MessageSquare className='w-3.5 h-3.5 text-sky-600' /> In-Call Patient Chat
                        </span>
                        <button
                          type='button'
                          onClick={() => navigate(`/doctor-chat/${appointmentId}`)}
                          className='text-[10px] font-bold text-sky-600 hover:underline cursor-pointer'
                        >
                          Full Thread ↗
                        </button>
                      </div>

                      <div className='flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50'>
                        {chatMessages.length === 0 ? (
                          <p className='text-xs text-slate-400 text-center py-8'>
                            Send written instructions, links, or dosage clarifications directly to the patient.
                          </p>
                        ) : (
                          chatMessages.map((msg, idx) => {
                            const isDoc = msg.sender === 'doctor'
                            return (
                              <div key={msg._id || idx} className={`flex ${isDoc ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[84%] px-3 py-2 rounded-2xl text-xs ${
                                    isDoc
                                      ? 'bg-sky-600 text-white rounded-br-sm'
                                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                                  }`}
                                >
                                  {msg.text && <p className='leading-relaxed break-words'>{msg.text}</p>}
                                  {msg.attachmentUrl && (
                                    <a
                                      href={msg.attachmentUrl}
                                      target='_blank'
                                      rel='noreferrer'
                                      className='underline text-[11px] block mt-1 font-semibold'
                                    >
                                      Attachment ({msg.attachmentName || 'View'})
                                    </a>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                        {peerTyping && (
                          <p className='text-[11px] text-slate-400 italic px-1'>Patient is typing...</p>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      <form onSubmit={handleSendChat} className='p-2 bg-white border-t border-slate-200 flex gap-1.5'>
                        <input
                          type='text'
                          value={chatInput}
                          onChange={(e) => {
                            setChatInput(e.target.value)
                            emitChatTyping()
                          }}
                          placeholder='Send written note to patient...'
                          className='flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-sky-500'
                        />
                        <button
                          type='submit'
                          disabled={!chatInput.trim()}
                          className='px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer'
                        >
                          <Send className='w-3.5 h-3.5' />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secure Clinical Snapshot Ephemeral Inspection Modal with Privacy Shield */}
      {activeExamSnapshot && (
        <div
          role='dialog'
          aria-modal='true'
          aria-label='Secure Clinical Exam Snapshot'
          className='fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 select-none'
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className='bg-slate-900 rounded-3xl border border-slate-700 max-w-2xl w-full overflow-hidden shadow-2xl space-y-0'>
            {/* Modal Header */}
            <div className='px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white'>
              <div className='flex items-center gap-2'>
                <Camera className='w-4 h-4 text-indigo-400' />
                <span className='text-xs font-bold uppercase tracking-wider'>
                  Clinical Exam Frame ({activeExamSnapshot.timestamp})
                </span>
                <span className='text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1'>
                  <ShieldCheck className='w-3 h-3' /> In-Pixel Watermark
                </span>
              </div>
              <button
                type='button'
                onClick={() => setActiveExamSnapshot(null)}
                className='text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Privacy Curtain Screen Shield */}
            <div className='relative bg-black flex items-center justify-center min-h-[320px] max-h-[60vh] overflow-hidden select-none'>
              {isWindowBlurred ? (
                <div className='w-full h-80 flex flex-col items-center justify-center p-6 text-center select-none bg-slate-950/95'>
                  <EyeOff className='w-12 h-12 text-amber-400 mb-3 animate-pulse' />
                  <p className='text-sm font-bold text-white'>Privacy Shield Engaged</p>
                  <p className='text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed'>
                    Clinical view is automatically obscured while window focus is lost or external capture tools are detected.
                  </p>
                </div>
              ) : (
                <img
                  src={activeExamSnapshot.dataUrl}
                  alt='Clinical Exam Frame'
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className='max-h-[60vh] w-auto object-contain pointer-events-none select-none'
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className='px-5 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400'>
              <span className='flex items-center gap-1.5 text-[11px]'>
                <Lock className='w-3.5 h-3.5 text-indigo-400' />
                Confidential PHI • Forensic ID embedded in pixels • Local download disabled
              </span>
              <button
                type='button'
                onClick={() => setActiveExamSnapshot(null)}
                className='px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold cursor-pointer transition-colors text-xs'
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorVideoCall
