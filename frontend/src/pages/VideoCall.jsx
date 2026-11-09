import React, { useState, useRef, useEffect, useContext, useCallback, useId, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { RPPGEngine } from '../utils/rppgEngine'
import VitalsOverlay from '../components/VitalsOverlay'
import { checkAppointmentWindow } from '../utils/appointmentTime'
import { useWebRTCCall, attachDialogLightDismissFallback } from '../utils/useWebRTCCall'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Activity,
  Heart,
  ShieldCheck,
  Lock,
  Wifi,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  FileText,
  Calendar,
  Clock,
  CreditCard,
  FlaskConical,
  CalendarClock,
  Monitor,
  MessageSquare,
  Send,
  Settings,
  Volume2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  RefreshCw,
  Gauge,
  ArrowLeftRight,
  Hand,
  Smile,
  Download,
  Radio,
  X,
  Sparkles
} from 'lucide-react'

const QUICK_REACTIONS = [
  { emoji: '👍', label: 'Clear / Understood' },
  { emoji: '🙏', label: 'Thank you' },
  { emoji: '❓', label: 'Have a question' },
  { emoji: '❤️', label: 'Feeling reassured' }
]

const VideoCall = ({ appointmentIdProp, isMinimized = false, onActiveSessionChange }) => {
  const params = useParams()
  const appointmentId = appointmentIdProp || params.appointmentId
  const navigate = useNavigate()
  const { backendUrl, token, userData, currencySymbol } = useContext(AppContext)

  const settingsTitleId = useId()
  const consentTitleId = useId()
  const settingsDialogRef = useRef(null)
  const consentDialogRef = useRef(null)
  const rppgEngineRef = useRef(null)
  const chatEndRef = useRef(null)

  const [appointment, setAppointment] = useState(null)
  const [paymentConfig, setPaymentConfig] = useState({ testMode: false })
  const [bypassing, setBypassing] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [devOverride, setDevOverride] = useState(false)
  const [showVitals, setShowVitals] = useState(false)
  const [isSpotCheckRunning, setIsSpotCheckRunning] = useState(false)
  const [vitalsData, setVitalsData] = useState({
    bpm: null,
    confidence: 0,
    signalQuality: 'CALIBRATING',
    progressPct: 0,
    motionWarning: false,
    isLocked: false,
    waveform: []
  })
  const [isSavingVitals, setIsSavingVitals] = useState(false)
  const [notification, setNotification] = useState(null)
  const [rxIssuedBanner, setRxIssuedBanner] = useState(null)

  // UI Popovers & Sidebar Tabs
  const [rightTab, setRightTab] = useState('info') // 'info' | 'chat' | 'transcript'
  const [chatInput, setChatInput] = useState('')
  const [showStatsPopover, setShowStatsPopover] = useState(false)
  const [showReactionMenu, setShowReactionMenu] = useState(false)

  const triggerNotification = useCallback((msg, type = 'success') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4200)
  }, [])

  const authPayload = useMemo(() => (token ? { token } : {}), [token])

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
    hasCamera,
    isScreenSharing,
    isDataSaver,
    isMirrored,
    setIsMirrored,
    isSwappedView,
    setIsSwappedView,
    handRaised,
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
    toggleRaiseHand,
    recordingState,
    incomingRecordingRequest,
    recordingDuration,
    requestRecording,
    respondRecordingConsent,
    stopRecording,
    chatMessages,
    peerTyping,
    unreadChatCount,
    setChatOpenState,
    sendChatMessage,
    emitChatTyping,
    emitVitalsUpdate
  } = useWebRTCCall({
    appointmentId,
    backendUrl,
    authPayload,
    role: 'user',
    displayName: userData?.name || appointment?.userData?.name || 'Patient',
    override: devOverride || paymentConfig.testMode,
    onNotify: triggerNotification,
    onRxIssued: (rx) => setRxIssuedBanner(rx)
  })

  // Attach Safari light-dismiss fallback on `<dialog closedby="any">`
  useEffect(() => {
    return attachDialogLightDismissFallback(settingsDialogRef.current)
  }, [])

  // Show / close Two-Party Recording Consent modal via native `showModal()`
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

  // Sync unread badge state with active right sidebar tab
  useEffect(() => {
    setChatOpenState(rightTab === 'chat')
  }, [rightTab, setChatOpenState])

  useEffect(() => {
    if (rightTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, rightTab])

  // Stop rPPG cleanly when call ends or user switches to screen sharing
  useEffect(() => {
    if ((callStatus === 'ended' || isScreenSharing) && rppgEngineRef.current) {
      rppgEngineRef.current.stop()
      rppgEngineRef.current = null
      setIsSpotCheckRunning(false)
    }
    if (callStatus === 'ended') {
      setShowVitals(false)
    }
  }, [callStatus, isScreenSharing])

  useEffect(() => {
    return () => {
      if (rppgEngineRef.current) {
        rppgEngineRef.current.stop()
        rppgEngineRef.current = null
      }
    }
  }, [])

  // Fetch appointment details
  const fetchAppointment = useCallback(async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/appointment/${appointmentId}`, {
        headers: { token }
      })
      if (data.success) {
        setAppointment(data.appointment)
      }
    } catch (e) {
      console.error('Error fetching appointment:', e)
    }
  }, [backendUrl, appointmentId, token])

  useEffect(() => {
    if (token) fetchAppointment()
  }, [token, fetchAppointment])

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/payment-config`)
        if (data.success) setPaymentConfig(data)
      } catch (e) {
        console.error('Error fetching payment config:', e)
      }
    }
    fetchConfig()

    const timer = setInterval(() => setCurrentTime(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [backendUrl])

  const windowStatus = useMemo(() => {
    if (!appointment?.slotDate || !appointment?.slotTime) return { status: 'OPEN' }
    return checkAppointmentWindow(
      appointment.slotDate,
      appointment.slotTime,
      paymentConfig.testMode || devOverride
    )
  }, [appointment?.slotDate, appointment?.slotTime, paymentConfig.testMode, devOverride, currentTime])

  // Keyboard shortcuts during active consultation (`M`, `V`, `S`, `H`, `F`)
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
      } else if (key === 'h') {
        e.preventDefault()
        toggleRaiseHand()
      } else if (key === 'f') {
        e.preventDefault()
        toggleFullscreen()
      } else if (key === 'c') {
        e.preventDefault()
        setRightTab((prev) => (prev === 'chat' ? 'info' : 'chat'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [callStatus, toggleMute, toggleVideo, toggleScreenShare, toggleRaiseHand, toggleFullscreen])

  // Payment Gate Handlers
  const handleTestPaymentBypass = async () => {
    setBypassing(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/user/payment-test-bypass`,
        { appointmentId },
        { headers: { token } }
      )
      if (data.success) {
        triggerNotification('Payment bypassed successfully in test mode!')
        fetchAppointment()
      } else {
        triggerNotification(data.message || 'Bypass failed', 'error')
      }
    } catch (err) {
      triggerNotification(err.message, 'error')
    } finally {
      setBypassing(false)
    }
  }

  const initPay = (order, keyId) => {
    const razorpayKey = keyId || import.meta.env.VITE_RAZORPAY_KEY_ID
    if (!razorpayKey || razorpayKey.includes('---')) {
      triggerNotification('Razorpay key not configured', 'error')
      return
    }
    const options = {
      key: razorpayKey,
      amount: order.amount,
      currency: order.currency,
      name: 'VitalSync Teleconsultation',
      description: 'Online Doctor Video Consultation',
      order_id: order.id,
      receipt: order.receipt,
      handler: async (response) => {
        try {
          const { data } = await axios.post(`${backendUrl}/api/user/verifyRazorpay`, response, {
            headers: { token }
          })
          if (data.success) {
            triggerNotification('Payment verified! Room unlocked.')
            fetchAppointment()
          } else {
            triggerNotification(data.message || 'Payment verification failed', 'error')
          }
        } catch (err) {
          triggerNotification(err.message, 'error')
        }
      }
    }
    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  const appointmentRazorpay = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/user/payment-razorpay`,
        { appointmentId },
        { headers: { token } }
      )
      if (data.success) initPay(data.order, data.key_id)
      else triggerNotification(data.message, 'error')
    } catch (err) {
      triggerNotification(err.message, 'error')
    }
  }

  const appointmentStripe = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/user/payment-stripe`,
        { appointmentId },
        { headers: { token } }
      )
      if (data.success) window.location.replace(data.session_url)
      else triggerNotification(data.message, 'error')
    } catch (err) {
      triggerNotification(err.message, 'error')
    }
  }

  const handleJoinConsultation = async (audioOnly = false) => {
    if (!appointment || !appointment.payment) {
      triggerNotification('Consultation fee payment is required to unlock this room.', 'error')
      return
    }
    if (windowStatus.status !== 'OPEN' && !devOverride && !paymentConfig.testMode) {
      triggerNotification(windowStatus.message, 'error')
      return
    }
    await startCall({ audioOnly })
  }

  // Hybrid Clinical Vitals Panel & 15s Guided POS-rPPG Optical Spot-Check
  const stopSpotCheck = useCallback(() => {
    if (rppgEngineRef.current) {
      rppgEngineRef.current.stop()
      rppgEngineRef.current = null
    }
    setIsSpotCheckRunning(false)
  }, [])

  const startSpotCheck = useCallback(() => {
    if (isScreenSharing) {
      triggerNotification('Stop screen sharing first so your camera can measure facial pulse.', 'error')
      return
    }
    if (!hasCamera || isVideoOff || !localVideoRef.current) {
      triggerNotification('Turn on your camera first to run the 15-second stationary pulse spot-check.', 'error')
      return
    }
    stopSpotCheck()
    setVitalsData({
      bpm: null,
      confidence: 0,
      signalQuality: 'CALIBRATING',
      progressPct: 0,
      motionWarning: false,
      isLocked: false,
      waveform: []
    })

    const engine = new RPPGEngine(
      localVideoRef.current,
      (data) => {
        setVitalsData(data)
        if (data.bpm) {
          emitVitalsUpdate({
            ...data,
            heartRate: data.bpm,
            source: 'rppg_spot_check'
          })
        }
      },
      {
        spotCheckMode: true,
        spotCheckTargetSec: 15,
        onComplete: (finalData) => {
          rppgEngineRef.current = null
          setIsSpotCheckRunning(false)
          if (finalData?.bpm) {
            emitVitalsUpdate({
              ...finalData,
              heartRate: finalData.bpm,
              source: 'rppg_spot_check'
            })
            triggerNotification(`15s stationary spot-check locked at ${finalData.bpm} BPM!`)
          }
        }
      }
    )
    rppgEngineRef.current = engine
    engine.start()
    setIsSpotCheckRunning(true)
  }, [isScreenSharing, hasCamera, isVideoOff, localVideoRef, stopSpotCheck, emitVitalsUpdate, triggerNotification])

  const toggleVitals = () => {
    if (showVitals) {
      stopSpotCheck()
      setShowVitals(false)
    } else {
      setShowVitals(true)
    }
  }

  const saveClinicalVitalsToEHR = async (payload) => {
    setIsSavingVitals(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/vitals/save`,
        {
          appointmentId,
          ...payload
        },
        { headers: { token } }
      )
      if (data.success) {
        const saved = data.reading || payload
        emitVitalsUpdate({
          ...payload,
          ...saved,
          bpm: saved.heartRate || payload.heartRate || null
        })
        triggerNotification('Clinical vitals & NEWS2 triage recorded to Electronic Health Record.')
      } else {
        triggerNotification(data.message || 'Could not save clinical vitals.', 'error')
      }
    } catch (err) {
      triggerNotification('Failed to record clinical vitals to health record.', 'error')
    } finally {
      setIsSavingVitals(false)
    }
  }

  const handleSendChat = async (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const text = chatInput
    setChatInput('')
    await sendChatMessage(text)
  }

  const handleDownloadTranscript = () => {
    const content = exportTranscriptText()
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `VitalSync-Consultation-Transcript-${appointmentId.slice(-6)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

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
          : 'min-h-[85vh] py-5 max-w-7xl mx-auto px-2 sm:px-4'
      }
    >
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
                <Settings className='w-4 h-4 text-sky-400' /> Audio, Video & Bandwidth Settings
              </h2>
              <p className='text-xs text-slate-400 mt-0.5'>
                Switch devices live without interrupting your consultation
              </p>
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
                {devices.cameras.length === 0 && <option value=''>Default / No Camera Detected</option>}
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
                <span className='text-[11px] text-emerald-400 font-semibold'>Input Level: {micLevel}%</span>
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
                <label className='font-bold uppercase tracking-wider text-slate-400'>
                  Speaker / Headphones Output
                </label>
                <button
                  type='button'
                  onClick={playTestTone}
                  className='inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold cursor-pointer'
                >
                  <Volume2 className='w-3.5 h-3.5' /> Test Speaker Chime
                </button>
              </div>
              <select
                value={selectedSpeakerId}
                onChange={(e) => switchSpeaker(e.target.value)}
                className='w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 outline-none focus:border-sky-500'
              >
                {devices.speakers.length === 0 && <option value=''>System Default Audio Output</option>}
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
                <p className='font-bold'>Mirror My Camera</p>
                <p className='text-[11px] text-slate-400 mt-0.5'>{isMirrored ? 'Enabled (Natural)' : 'Disabled'}</p>
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
                <p className='font-bold'>Low-Bandwidth Saver</p>
                <p className='text-[11px] text-slate-400 mt-0.5'>
                  {isDataSaver ? 'Active (180 kbps cap)' : 'Off (Full 720p HD)'}
                </p>
              </button>
            </div>

            <div className='p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400'>
              <span className='font-bold text-slate-300'>Keyboard Shortcuts:</span>{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>M</kbd> Mute •{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>V</kbd> Camera •{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>S</kbd> Share Screen •{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>H</kbd> Raise Hand •{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>C</kbd> Chat •{' '}
              <kbd className='px-1.5 py-0.5 rounded bg-slate-800 text-slate-200'>F</kbd> Fullscreen
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
              Consultation Recording Consent Request
            </h2>
            <p className='text-xs text-slate-300 leading-relaxed mt-1.5'>
              <strong>{incomingRecordingRequest?.name || 'Your Doctor'}</strong> is requesting permission to record
              this consultation locally for clinical documentation. Recording never starts unless both parties consent.
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

      {/* Header & Status Bar */}
      <div
        className={
          isMinimized
            ? 'hidden'
            : 'flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-200'
        }
      >
        <div>
          <div className='flex flex-wrap items-center gap-2 mb-1.5'>
            <span className='inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20'>
              <Lock className='w-3.5 h-3.5' /> DTLS-SRTP Encrypted Teleconsultation
            </span>
            <span className='inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200'>
              <Wifi className='w-3.5 h-3.5 text-emerald-600' />{' '}
              {isDataSaver ? 'Low-Bandwidth Data Saver' : 'Adaptive HD Video & Audio'}
            </span>
            {recordingState === 'active' && (
              <span className='inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200'>
                <span className='w-2 h-2 rounded-full bg-rose-600 animate-ping' /> REC •{' '}
                {formatDuration(recordingDuration)}
              </span>
            )}
          </div>
          <h1 className='text-xl md:text-2xl font-bold text-slate-900 tracking-tight'>
            Video Consultation Room
          </h1>
          {appointment && (
            <p className='text-sm text-slate-600 mt-0.5 flex flex-wrap items-center gap-2'>
              Doctor: <span className='font-semibold text-slate-900'>{appointment.docData?.name}</span>
              <span className='text-slate-400'>•</span>
              <span className='text-primary font-medium'>{appointment.docData?.speciality}</span>
            </p>
          )}
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
          {callStatus === 'connected' && (
            <div className='flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tabular-nums'>
              <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
              <span>LIVE • {formatDuration(callDuration)}</span>
            </div>
          )}
          {(callStatus === 'connecting' || callStatus === 'reconnecting') && (
            <div className='flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold'>
              <span className='w-2 h-2 rounded-full bg-amber-500 animate-ping' />
              <span>{callStatus === 'reconnecting' ? 'Reconnecting Media...' : 'Ringing Doctor...'}</span>
            </div>
          )}
          <button
            type='button'
            onClick={openSettingsModal}
            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer'
          >
            <Settings className='w-3.5 h-3.5' /> Devices
          </button>
          <button
            type='button'
            onClick={() => navigate('/my-appointments')}
            className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer'
            title={isInActiveSession ? 'Minimize call to floating PiP & view appointments' : 'Back to appointments'}
          >
            <ArrowLeft className='w-3.5 h-3.5' /> {isInActiveSession ? 'Minimize' : 'Appointments'}
          </button>
        </div>
      </div>

      {/* Live Notification Banner */}
      {notification && !isMinimized && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-all ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : notification.type === 'info'
              ? 'bg-sky-50 border-sky-200 text-sky-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className='flex items-center gap-2'>
            <AlertCircle className='w-4 h-4 shrink-0' />
            <span>{notification.msg}</span>
          </div>
          <button type='button' onClick={() => setNotification(null)} className='text-slate-400 hover:text-slate-600'>
            <X className='w-3.5 h-3.5' />
          </button>
        </div>
      )}

      {/* Real-Time e-Prescription Issued Alert */}
      {rxIssuedBanner && !isMinimized && (
        <div className='mb-4 p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-semibold flex flex-wrap items-center justify-between gap-3 shadow-md'>
          <div className='flex items-center gap-2.5'>
            <Sparkles className='w-4 h-4 shrink-0' />
            <span>
              <strong>{rxIssuedBanner.doctorName || 'Your Doctor'}</strong> just signed & issued your Digital
              e-Prescription{rxIssuedBanner.diagnosis ? ` (${rxIssuedBanner.diagnosis})` : ''}!
            </span>
          </div>
          <button
            type='button'
            onClick={() => navigate(`/prescription/${appointmentId}`)}
            className='px-3 py-1.5 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 cursor-pointer'
          >
            View Prescription ↗
          </button>
        </div>
      )}

      {/* Gate 1: Unpaid Consultation Lock */}
      {appointment && !appointment.payment && !isInActiveSession ? (
        <div className='bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white max-w-xl mx-auto space-y-6 shadow-2xl my-8'>
          <div className='w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400'>
            <Lock className='w-8 h-8' />
          </div>
          <div className='space-y-2'>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-400/20'>
              <Video className='w-3.5 h-3.5' /> 100% Online Teleconsultation
            </span>
            <h2 className='text-2xl font-extrabold text-white'>Consultation Room Locked</h2>
            <p className='text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto'>
              To connect with <strong className='text-slate-200'>{appointment.docData?.name}</strong> (
              {appointment.docData?.speciality}), please complete the consultation fee payment.
            </p>
            <div className='mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-sm font-semibold text-slate-200 inline-flex items-center gap-2'>
              <span>Consultation Fee:</span>
              <span className='text-emerald-400 text-base font-extrabold'>
                {currencySymbol || '₹'}
                {appointment.amount}
              </span>
            </div>
          </div>

          <div className='space-y-3 pt-2 max-w-sm mx-auto'>
            <button
              onClick={appointmentRazorpay}
              className='w-full py-3 bg-primary hover:bg-sky-500 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer'
            >
              <CreditCard className='w-4 h-4' />
              <span>Pay Online with Razorpay / Cards</span>
            </button>
            <button
              onClick={appointmentStripe}
              className='w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer'
            >
              <span>Pay Online with Stripe</span>
            </button>
            {paymentConfig.testMode && (
              <button
                onClick={handleTestPaymentBypass}
                disabled={bypassing}
                className='w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50'
              >
                <FlaskConical className='w-4 h-4' />
                <span>{bypassing ? 'Bypassing...' : 'Skip Payment (Test Mode)'}</span>
              </button>
            )}
          </div>

          <div className='pt-4 border-t border-slate-800'>
            <button
              onClick={() => navigate('/my-appointments')}
              className='text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer'
            >
              <ArrowLeft className='w-3.5 h-3.5' /> Return to My Appointments
            </button>
          </div>
        </div>
      ) : windowStatus.status === 'TOO_EARLY' && !devOverride && !isInActiveSession ? (
        /* Gate 2: Scheduled Appointment Waiting Room / Time Gate */
        <div className='bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white max-w-xl mx-auto space-y-6 shadow-2xl my-8'>
          <div className='w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400'>
            <CalendarClock className='w-8 h-8' />
          </div>

          <div className='space-y-2'>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-400/20'>
              <Clock className='w-3.5 h-3.5' /> Scheduled Teleconsultation Room
            </span>
            <h2 className='text-2xl font-extrabold text-white'>Consultation Room Not Yet Open</h2>
            <p className='text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto'>
              Your video consultation with <strong className='text-slate-200'>{appointment?.docData?.name}</strong> is
              scheduled for{' '}
              <strong className='text-slate-200'>
                {appointment?.slotDate?.replace(/_/g, '/')} at {appointment?.slotTime}
              </strong>
              .
            </p>
          </div>

          <div className='p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2'>
            <p className='text-xs font-bold uppercase tracking-wider text-slate-400'>Video Room Opens In</p>
            <p className='text-3xl font-extrabold text-sky-400 font-mono tracking-tight'>
              {windowStatus.formattedRemaining || 'A few moments'}
            </p>
            <p className='text-[11px] text-slate-500'>
              The room unlocks automatically 10 minutes prior to your slot (
              {windowStatus.openTime
                ? windowStatus.openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
              ) so you can test your camera and microphone.
            </p>
          </div>

          <div className='pt-1'>
            <span className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs'>
              <Calendar className='w-3.5 h-3.5 text-sky-400' />
              <span>Calendar invite automatically delivered to your email</span>
            </span>
          </div>

          <div className='pt-2'>
            <button
              type='button'
              onClick={() => setDevOverride(true)}
              className='inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 text-xs font-bold transition-colors cursor-pointer'
            >
              <FlaskConical className='w-3.5 h-3.5' />
              <span>Bypass Time Gate (Testing Override)</span>
            </button>
          </div>
        </div>
      ) : windowStatus.status === 'EXPIRED' && !appointment?.isCompleted && !devOverride && !isInActiveSession ? (
        /* Gate 3: Expired Appointment Window */
        <div className='bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center text-white max-w-xl mx-auto space-y-6 shadow-2xl my-8'>
          <div className='w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400'>
            <Clock className='w-8 h-8' />
          </div>
          <div className='space-y-2'>
            <h2 className='text-2xl font-extrabold text-white'>Appointment Window Passed</h2>
            <p className='text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md mx-auto'>
              The scheduled teleconsultation slot has passed (
              {windowStatus.closeTime
                ? windowStatus.closeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
              ). You can reschedule a new slot from your dashboard.
            </p>
          </div>
          <div className='flex flex-wrap items-center justify-center gap-3 pt-2'>
            <button
              onClick={() => navigate('/my-appointments')}
              className='px-5 py-2.5 bg-primary hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer'
            >
              Reschedule from My Appointments
            </button>
            <button
              onClick={() => setDevOverride(true)}
              className='px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer'
            >
              Enter Video Room (Testing Override)
            </button>
          </div>
        </div>
      ) : (
        /* Main Consultation Workspace: Video Stage (Left 8 cols) + Multi-Tab Sidebar (Right 4 cols) */
        <div className={isMinimized ? 'block' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
          {/* Primary Video Stage & Control Dock */}
          <div className={isMinimized ? 'w-full' : 'lg:col-span-8 space-y-4'}>
            <div
              ref={stageContainerRef}
              className={`relative bg-slate-950 overflow-hidden aspect-video select-none ${
                isMinimized ? '' : 'rounded-3xl shadow-2xl border border-slate-800'
              }`}
            >
              {/* REMOTE VIDEO CONTAINER (Full stage normally, or PiP when `isSwappedView` is true) */}
              <div
                onClick={() => {
                  if (isSwappedView && isInActiveSession) setIsSwappedView(false)
                }}
                className={
                  isSwappedView && isInActiveSession
                    ? 'absolute bottom-3.5 right-3.5 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 z-20 cursor-pointer group'
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
                    {appointment?.docData?.image ? (
                      <img
                        src={appointment.docData.image}
                        alt={appointment.docData.name}
                        className='w-20 h-20 rounded-full object-cover border-2 border-slate-700'
                      />
                    ) : (
                      <VideoOff className='w-8 h-8 text-slate-500' />
                    )}
                    <span className='text-xs font-semibold text-slate-400'>Doctor Camera Paused (Audio Active)</span>
                  </div>
                )}
                {isSwappedView && isInActiveSession && (
                  <span className='absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-semibold'>
                    {peerInfo?.name || appointment?.docData?.name || 'Doctor'} (Click to Expand)
                  </span>
                )}
              </div>

              {/* Waiting / Green Room / Ended Overlay when Remote Not Connected */}
              {!remoteConnected && !lobbyActive && (
                <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-6 text-center'>
                  {appointment?.docData?.image ? (
                    <div className='relative mb-4'>
                      <img
                        src={appointment.docData.image}
                        alt={appointment.docData.name}
                        className='w-24 h-24 rounded-full border-2 border-slate-700 object-cover bg-slate-800 shadow-xl'
                      />
                      {isInActiveSession && (
                        <div className='absolute inset-0 rounded-full border-2 border-sky-400/40 animate-ping pointer-events-none' />
                      )}
                    </div>
                  ) : (
                    <div className='w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-4'>
                      <Video className='w-8 h-8' />
                    </div>
                  )}

                  <h3 className='text-slate-100 font-bold text-base sm:text-lg mb-1'>
                    {callStatus === 'idle' && 'Green Room Ready — Check Your Devices or Join Now'}
                    {callStatus === 'connecting' && 'Ringing Your Doctor...'}
                    {callStatus === 'reconnecting' && 'Restoring Encrypted Connection...'}
                    {callStatus === 'ended' &&
                      (replacedByOtherTab ? 'Session Moved to Another Tab' : 'Consultation Session Ended')}
                  </h3>

                  <p className='text-slate-400 text-xs max-w-md leading-relaxed'>
                    {callStatus === 'idle' &&
                      'Preview your camera and microphone before entering, or click Join Consultation to connect immediately.'}
                    {callStatus === 'connecting' &&
                      'Your doctor has been notified. Video and audio will connect automatically as soon as they join.'}
                    {callStatus === 'reconnecting' &&
                      'Temporary network change detected. Renegotiating the fastest media route automatically.'}
                    {callStatus === 'ended' &&
                      `Total consultation time: ${formatDuration(callDuration)}. You can rejoin if needed or view your prescription.`}
                  </p>

                  {callStatus === 'idle' && (
                    <div className='mt-5 flex flex-wrap items-center justify-center gap-2.5'>
                      <button
                        type='button'
                        onClick={startLobbyPreview}
                        className='px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer'
                      >
                        <Settings className='w-3.5 h-3.5 text-sky-400' /> Test Camera & Mic (Green Room)
                      </button>
                      <button
                        type='button'
                        onClick={() => handleJoinConsultation(false)}
                        className='px-5 py-2.5 rounded-xl bg-primary hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer'
                      >
                        <PhoneCall className='w-3.5 h-3.5' /> Join Video Consultation
                      </button>
                    </div>
                  )}

                  {callStatus === 'ended' && (
                    <div className='mt-5 flex flex-wrap items-center justify-center gap-2.5'>
                      <button
                        type='button'
                        onClick={() => handleJoinConsultation(false)}
                        className='px-4 py-2.5 rounded-xl bg-primary hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer'
                      >
                        <RefreshCw className='w-3.5 h-3.5' /> Rejoin Consultation
                      </button>
                      <button
                        type='button'
                        onClick={() => navigate(`/prescription/${appointmentId}`)}
                        className='px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer'
                      >
                        <FileText className='w-3.5 h-3.5' /> View Digital Prescription
                      </button>
                      {transcript.length > 0 && (
                        <button
                          type='button'
                          onClick={handleDownloadTranscript}
                          className='px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer'
                        >
                          <Download className='w-3.5 h-3.5' /> Download Transcript
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* LOCAL VIDEO CONTAINER (Full stage in Green Room Lobby or when Swapped; PiP during active call) */}
              <div
                onClick={() => {
                  if (!isSwappedView && isInActiveSession) setIsSwappedView(true)
                }}
                title={isInActiveSession && !isSwappedView ? 'Click to swap your camera to main view' : ''}
                className={
                  lobbyActive && !isInActiveSession
                    ? 'absolute inset-0 w-full h-full z-10 bg-slate-950'
                    : isSwappedView && isInActiveSession
                    ? 'absolute inset-0 w-full h-full z-0 bg-slate-950'
                    : isInActiveSession
                    ? isMinimized
                      ? 'absolute bottom-2 right-2 w-20 aspect-video rounded-lg overflow-hidden shadow-lg border border-white/25 bg-slate-900 z-20 cursor-pointer'
                      : 'absolute bottom-3.5 right-3.5 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/90 hover:border-sky-400/70 bg-slate-900 z-20 cursor-pointer transition-all'
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
                  <div className='absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5'>
                    <EyeOff className='w-5 h-5 text-slate-500' />
                    <span className='text-[10px] uppercase tracking-wider font-semibold'>Camera Off</span>
                  </div>
                )}

                {/* Green Room Pre-Join Overlay Controls */}
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
                        <div className='text-[10px] text-slate-300 font-semibold mb-1'>Mic Check</div>
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
                        Close Preview
                      </button>
                      <button
                        type='button'
                        onClick={() => handleJoinConsultation(false)}
                        className='px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer'
                      >
                        Join Room Now
                      </button>
                    </div>
                  </div>
                )}

                {isInActiveSession && !isSwappedView && (
                  <div className='absolute bottom-1.5 left-2 right-2 flex items-center justify-between pointer-events-none'>
                    <span className='bg-black/65 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-slate-100 font-semibold'>
                      {isScreenSharing ? 'Your Screen' : 'You'}
                    </span>
                    {!isMuted && (
                      <span className='w-5 h-1.5 rounded-full bg-black/60 overflow-hidden'>
                        <span
                          className='block h-full bg-emerald-400'
                          style={{ width: `${Math.min(100, micLevel)}%` }}
                        />
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Top-Left HUD: Connection Status & Remote Peer Media State Badges */}
              {isInActiveSession && (
                <div className='absolute top-3.5 left-3.5 z-20 flex flex-wrap items-center gap-2 max-w-[65%]'>
                  <div className='bg-slate-900/85 backdrop-blur-md border border-slate-700/70 px-3 py-1.5 rounded-xl text-xs text-slate-100 flex items-center gap-2 shadow-sm'>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        remoteConnected
                          ? 'bg-emerald-400'
                          : callStatus === 'reconnecting'
                          ? 'bg-rose-400 animate-ping'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <span className='font-semibold'>
                      {remoteConnected
                        ? peerInfo?.name || appointment?.docData?.name || 'Doctor Connected'
                        : callStatus === 'reconnecting'
                        ? 'Reconnecting...'
                        : 'Waiting for Doctor'}
                    </span>
                  </div>

                  {remoteConnected && !peerMediaState.audio && (
                    <span className='bg-rose-950/85 border border-rose-500/40 text-rose-200 px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1'>
                      <MicOff className='w-3 h-3' /> Doctor Muted
                    </span>
                  )}
                  {remoteConnected && peerMediaState.screen && (
                    <span className='bg-sky-950/85 border border-sky-500/40 text-sky-200 px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1'>
                      <Monitor className='w-3 h-3' /> Doctor Sharing Screen
                    </span>
                  )}
                  {remoteConnected && peerMediaState.handRaised && (
                    <span className='bg-amber-500 text-slate-950 px-2.5 py-1 rounded-xl text-[11px] font-extrabold'>
                      ✋ Doctor Raised Hand
                    </span>
                  )}
                </div>
              )}

              {/* Top-Right HUD: Network Quality Pill, Diagnostics Popover & Contactless rPPG Vitals */}
              {isInActiveSession && !isMinimized && (
                <div className='absolute top-3.5 right-3.5 z-30 flex flex-col items-end gap-2.5'>
                  <div className='flex items-center gap-2'>
                    {remoteConnected && (
                      <button
                        type='button'
                        onClick={() => setShowStatsPopover((s) => !s)}
                        className={`px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${qualityBadgeStyle}`}
                        title='View Live WebRTC Network Telemetry'
                      >
                        <Gauge className='w-3.5 h-3.5' />
                        <span>
                          {networkStats.rttMs !== null ? `${networkStats.rttMs} ms` : 'Net'} •{' '}
                          {networkStats.candidateType}
                        </span>
                      </button>
                    )}
                  </div>

                  {showStatsPopover && remoteConnected && (
                    <div className='w-64 p-3.5 rounded-2xl bg-slate-950/95 border border-slate-700/80 backdrop-blur-md text-slate-200 text-[11px] shadow-2xl space-y-2'>
                      <div className='flex items-center justify-between border-b border-slate-800 pb-1.5'>
                        <span className='font-extrabold uppercase tracking-wider text-slate-400'>
                          WebRTC Telemetry
                        </span>
                        <span className='uppercase font-bold text-emerald-400'>{networkStats.qualityGrade}</span>
                      </div>
                      <div className='grid grid-cols-2 gap-y-1.5 text-slate-300'>
                        <span className='text-slate-400'>Round-Trip:</span>
                        <span className='font-mono text-right'>{networkStats.rttMs ?? '--'} ms</span>
                        <span className='text-slate-400'>Packet Loss:</span>
                        <span className='font-mono text-right'>{networkStats.packetLossPct}%</span>
                        <span className='text-slate-400'>Bitrate (↓/↑):</span>
                        <span className='font-mono text-right'>
                          {networkStats.rxBitrateKbps}/{networkStats.txBitrateKbps} kbps
                        </span>
                        <span className='text-slate-400'>Video Stream:</span>
                        <span className='font-mono text-right'>
                          {networkStats.resolution || 'Audio'} {networkStats.fps ? `@${networkStats.fps}fps` : ''}
                        </span>
                        <span className='text-slate-400'>ICE Route:</span>
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
                          <RefreshCw className='w-3 h-3' /> Repair ICE
                        </button>
                      </div>
                    </div>
                  )}

                  {networkStats.qualityGrade === 'poor' && !isDataSaver && remoteConnected && (
                    <button
                      type='button'
                      onClick={toggleDataSaver}
                      className='px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-extrabold shadow-lg cursor-pointer'
                    >
                      Unstable Network — Switch to Data Saver
                    </button>
                  )}

                  {showVitals && (
                    <div className='max-w-xs'>
                      <VitalsOverlay
                        vitals={vitalsData}
                        isSpotCheckRunning={isSpotCheckRunning}
                        onStartSpotCheck={startSpotCheck}
                        onStopSpotCheck={stopSpotCheck}
                        onSaveClinicalVitals={saveClinicalVitalsToEHR}
                        onStreamPreview={emitVitalsUpdate}
                        onClose={toggleVitals}
                        isSaving={isSavingVitals}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Floating Quick Reactions */}
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

            {/* Floating Mini-Call Control Bar when Browsing Other App Tabs */}
            {isMinimized && isInActiveSession && (
              <div className='bg-slate-900 px-3 py-2 flex items-center justify-between gap-2 border-t border-slate-800'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0' />
                  <span className='text-[11px] font-bold text-white tabular-nums shrink-0'>
                    {callStatus === 'connected' ? formatDuration(callDuration) : 'Ringing...'}
                  </span>
                  <span className='text-[11px] text-slate-400 truncate'>
                    {appointment?.docData?.name || 'Consultation'}
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
                    onClick={() => navigate(`/video-call/${appointmentId}`)}
                    className='px-2.5 h-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer'
                    title='Return to Full Consultation Room'
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

            {/* Production Call Control Dock */}
            <div
              className={
                isMinimized
                  ? 'hidden'
                  : 'bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm'
              }
            >
              {callStatus === 'idle' && (
                <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full'>
                  <div className='text-xs text-slate-300 flex items-center gap-2'>
                    <ShieldCheck className='w-4 h-4 text-emerald-400 shrink-0' />
                    <span>Peer-to-peer encrypted video, live captions, screen sharing & optical pulse ready.</span>
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => handleJoinConsultation(true)}
                      className='inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs cursor-pointer'
                    >
                      <Mic className='w-3.5 h-3.5 text-sky-400' /> Audio-Only
                    </button>
                    <button
                      type='button'
                      onClick={() => handleJoinConsultation(false)}
                      className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-sky-500 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer'
                    >
                      <PhoneCall className='w-4 h-4' /> Join Video Call
                    </button>
                  </div>
                </div>
              )}

              {isInActiveSession && (
                <>
                  <div className='flex flex-wrap items-center gap-2'>
                    {/* Mic */}
                    <button
                      type='button'
                      onClick={toggleMute}
                      className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                        isMuted
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'
                      }`}
                      title='Toggle Microphone (M)'
                    >
                      {isMuted ? <MicOff className='w-4 h-4' /> : <Mic className='w-4 h-4' />}
                      <span className='hidden sm:inline'>{isMuted ? 'Unmute' : 'Mic'}</span>
                    </button>

                    {/* Camera */}
                    <button
                      type='button'
                      onClick={toggleVideo}
                      className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                        isVideoOff
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700'
                      }`}
                      title='Toggle Camera (V)'
                    >
                      {isVideoOff ? <VideoOff className='w-4 h-4' /> : <Video className='w-4 h-4' />}
                      <span className='hidden sm:inline'>{isVideoOff ? 'Start Cam' : 'Cam'}</span>
                    </button>

                    {/* Screen Share */}
                    <button
                      type='button'
                      onClick={toggleScreenShare}
                      className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                        isScreenSharing
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                      }`}
                      title='Share Screen / Reports (S)'
                    >
                      <Monitor className='w-4 h-4' />
                      <span className='hidden md:inline'>{isScreenSharing ? 'Stop Share' : 'Share'}</span>
                    </button>

                    {/* Clinical Vitals & 15s Pulse Spot-Check */}
                    <button
                      type='button'
                      onClick={toggleVitals}
                      className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                        showVitals
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title='Log Home Vitals (BP, SpO₂, Temp, HR + NEWS2) or Run 15s Pulse Spot-Check'
                    >
                      <Heart className={`w-4 h-4 ${isSpotCheckRunning ? 'text-rose-300 animate-ping' : 'text-rose-400'}`} />
                      <span className='hidden md:inline'>
                        {isSpotCheckRunning ? '15s Pulse...' : showVitals ? 'Hide Vitals' : 'Vitals'}
                      </span>
                    </button>

                    {/* Live Captions (CC) */}
                    {captionsSupported && (
                      <button
                        type='button'
                        onClick={toggleCaptions}
                        className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all border cursor-pointer ${
                          captionsEnabled
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                        title='Live Speech-to-Text Captions'
                      >
                        <span>CC</span>
                      </button>
                    )}

                    {/* Raise Hand */}
                    <button
                      type='button'
                      onClick={toggleRaiseHand}
                      className={`h-10 px-2.5 rounded-xl flex items-center gap-1 text-xs font-semibold transition-all border cursor-pointer ${
                        handRaised
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title='Raise Hand (H)'
                    >
                      <Hand className='w-4 h-4' />
                    </button>

                    {/* Reactions Popover */}
                    <div className='relative'>
                      <button
                        type='button'
                        onClick={() => setShowReactionMenu((prev) => !prev)}
                        className='h-10 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center cursor-pointer'
                        title='Send Quick Reaction'
                      >
                        <Smile className='w-4 h-4' />
                      </button>
                      {showReactionMenu && (
                        <div className='absolute bottom-12 left-0 z-30 p-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl flex items-center gap-1'>
                          {QUICK_REACTIONS.map((item) => (
                            <button
                              key={item.emoji}
                              type='button'
                              onClick={() => {
                                sendReaction(item.emoji, item.label)
                                setShowReactionMenu(false)
                              }}
                              title={item.label}
                              className='w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-base cursor-pointer'
                            >
                              {item.emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Two-Party Consent Recording */}
                    <button
                      type='button'
                      onClick={recordingState === 'active' ? stopRecording : requestRecording}
                      disabled={recordingState === 'requesting'}
                      className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all border cursor-pointer disabled:opacity-50 ${
                        recordingState === 'active'
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title='Two-Party Consented Local Recording'
                    >
                      <Radio className='w-3.5 h-3.5' />
                      <span className='hidden xl:inline'>
                        {recordingState === 'active'
                          ? 'Stop Rec'
                          : recordingState === 'requesting'
                          ? 'Awaiting Consent...'
                          : 'Record'}
                      </span>
                    </button>
                  </div>

                  {/* Viewport & End Controls */}
                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => setIsSwappedView((v) => !v)}
                      className='h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer'
                      title='Swap Main / PiP Video'
                    >
                      <ArrowLeftRight className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={togglePiP}
                      className={`h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer ${
                        isPiP
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title='Picture-in-Picture Floating Window'
                    >
                      <PictureInPicture2 className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      onClick={toggleFullscreen}
                      className='h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer'
                      title='Fullscreen Stage (F)'
                    >
                      {isFullscreen ? <Minimize2 className='w-4 h-4' /> : <Maximize2 className='w-4 h-4' />}
                    </button>
                    <button
                      type='button'
                      onClick={() => endCall(true)}
                      className='inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer'
                      title='End Consultation'
                    >
                      <PhoneOff className='w-4 h-4' /> <span>End</span>
                    </button>
                  </div>
                </>
              )}

              {callStatus === 'ended' && (
                <div className='flex flex-wrap items-center justify-between gap-3 w-full'>
                  <div className='text-xs text-slate-300 flex items-center gap-2'>
                    <CheckCircle2 className='w-4 h-4 text-emerald-400' />
                    <span>Consultation ended ({formatDuration(callDuration)}).</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <button
                      type='button'
                      onClick={() => handleJoinConsultation(false)}
                      className='px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer'
                    >
                      Rejoin
                    </button>
                    <button
                      type='button'
                      onClick={() => navigate('/my-appointments')}
                      className='inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer'
                    >
                      <ArrowLeft className='w-3.5 h-3.5' /> Back to Appointments
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Multi-Tab Consultation Companion (Info • Live Chat • Captions Transcript) */}
          <div
            className={
              isMinimized
                ? 'hidden'
                : 'lg:col-span-4 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs flex flex-col h-[540px]'
            }
          >
            {/* Tabs */}
            <div className='p-2 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-1 shrink-0'>
              <button
                type='button'
                onClick={() => setRightTab('info')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  rightTab === 'info' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Activity className='w-3.5 h-3.5' />
                <span>Session</span>
              </button>
              <button
                type='button'
                onClick={() => setRightTab('chat')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors relative ${
                  rightTab === 'chat' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <MessageSquare className='w-3.5 h-3.5' />
                <span>Live Chat</span>
                {unreadChatCount > 0 && (
                  <span className='px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-extrabold'>
                    {unreadChatCount}
                  </span>
                )}
              </button>
              <button
                type='button'
                onClick={() => setRightTab('transcript')}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  rightTab === 'transcript' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <FileText className='w-3.5 h-3.5' />
                <span>Captions ({transcript.length})</span>
              </button>
            </div>

            {/* Tab 1: Doctor & Appointment Info */}
            {rightTab === 'info' && (
              <div className='flex-1 overflow-y-auto p-4 space-y-4'>
                {appointment?.docData && (
                  <div className='flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80'>
                    <img
                      src={appointment.docData.image}
                      alt={appointment.docData.name}
                      className='w-12 h-12 rounded-xl object-cover bg-white border border-slate-200 shrink-0'
                    />
                    <div className='min-w-0'>
                      <p className='text-sm font-bold text-slate-900 truncate'>{appointment.docData.name}</p>
                      <p className='text-xs text-primary font-semibold truncate'>{appointment.docData.speciality}</p>
                      <p className='text-[11px] text-slate-500 mt-0.5'>{appointment.docData.degree || 'MBBS'}</p>
                    </div>
                  </div>
                )}

                {appointment && (
                  <div className='rounded-2xl border border-slate-200 p-3.5 space-y-2 text-xs text-slate-600'>
                    <div className='flex items-center justify-between py-1 border-b border-slate-100'>
                      <span className='text-slate-500 flex items-center gap-1.5'>
                        <Calendar className='w-3.5 h-3.5 text-slate-400' /> Date
                      </span>
                      <span className='font-semibold text-slate-900'>{appointment.slotDate?.replace(/_/g, '/')}</span>
                    </div>
                    <div className='flex items-center justify-between py-1 border-b border-slate-100'>
                      <span className='text-slate-500 flex items-center gap-1.5'>
                        <Clock className='w-3.5 h-3.5 text-slate-400' /> Slot
                      </span>
                      <span className='font-semibold text-slate-900'>{appointment.slotTime}</span>
                    </div>
                    <div className='flex items-center justify-between py-1'>
                      <span className='text-slate-500'>Fee Status</span>
                      <span className='font-bold text-emerald-700'>Paid & Verified</span>
                    </div>
                  </div>
                )}

                <div className='bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5'>
                  <h3 className='text-xs font-bold text-slate-900 flex items-center gap-1.5'>
                    <ShieldCheck className='w-3.5 h-3.5 text-emerald-600' /> Clinical Call Capabilities
                  </h3>
                  <ul className='text-xs text-slate-600 space-y-2 leading-relaxed'>
                    <li className='flex items-start gap-2'>
                      <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5' />
                      <span>
                        <strong>Clinical Vitals & NEWS2:</strong> Share home BP cuff, pulse oximeter, and thermometer
                        readings with automated RCP NEWS2 risk scoring—or run a 15-second stationary POS-rPPG pulse
                        spot-check.
                      </span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5' />
                      <span>
                        <strong>Share Screen:</strong> Present previous lab PDFs or imaging directly inside the call.
                      </span>
                    </li>
                    <li className='flex items-start gap-2'>
                      <CheckCircle2 className='w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5' />
                      <span>
                        <strong>Two-Party Privacy:</strong> Consultation recording is strictly disabled unless both you
                        and your doctor explicitly consent.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: Persistent In-Call Live Chat */}
            {rightTab === 'chat' && (
              <div className='flex-1 flex flex-col min-h-0'>
                <div className='flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/50'>
                  {chatMessages.length === 0 ? (
                    <div className='h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs'>
                      <MessageSquare className='w-7 h-7 mb-2 text-slate-300' />
                      <p className='font-semibold text-slate-600'>In-Call Consultation Chat</p>
                      <p className='mt-0.5'>
                        Messages sent here are saved directly to your appointment chat thread.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const isMe = msg.sender === 'user'
                      return (
                        <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs ${
                              isMe
                                ? 'bg-primary text-white rounded-br-sm'
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
                                View Attachment ({msg.attachmentName || 'File'})
                              </a>
                            )}
                            <span
                              className={`block text-[9px] mt-1 ${isMe ? 'text-sky-100' : 'text-slate-400'}`}
                            >
                              {msg.timestamp
                                ? new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                  {peerTyping && (
                    <div className='text-[11px] text-slate-400 italic px-1'>Doctor is typing...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className='p-2.5 bg-white border-t border-slate-200 flex gap-2'>
                  <input
                    type='text'
                    value={chatInput}
                    onChange={(e) => {
                      setChatInput(e.target.value)
                      emitChatTyping()
                    }}
                    placeholder='Type a message to your doctor...'
                    className='flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs outline-none focus:border-primary'
                  />
                  <button
                    type='submit'
                    disabled={!chatInput.trim()}
                    className='px-3.5 py-2 rounded-xl bg-primary hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center cursor-pointer'
                  >
                    <Send className='w-3.5 h-3.5' />
                  </button>
                </form>
              </div>
            )}

            {/* Tab 3: Live Captions & Consultation Transcript */}
            {rightTab === 'transcript' && (
              <div className='flex-1 flex flex-col min-h-0'>
                <div className='p-3 border-b border-slate-100 flex items-center justify-between bg-white'>
                  <span className='text-[11px] font-bold text-slate-600'>
                    {captionsEnabled ? 'Listening & Subtitling Live...' : 'Captions Paused'}
                  </span>
                  <div className='flex items-center gap-1.5'>
                    {captionsSupported && (
                      <button
                        type='button'
                        onClick={toggleCaptions}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          captionsEnabled ? 'bg-rose-50 text-rose-700' : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {captionsEnabled ? 'Stop CC' : 'Enable CC'}
                      </button>
                    )}
                    {transcript.length > 0 && (
                      <button
                        type='button'
                        onClick={handleDownloadTranscript}
                        className='p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer'
                        title='Download Transcript (.txt)'
                      >
                        <Download className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                </div>
                <div className='flex-1 overflow-y-auto p-3.5 space-y-2.5 text-xs'>
                  {transcript.length === 0 ? (
                    <div className='h-full flex flex-col items-center justify-center text-center text-slate-400 p-4'>
                      <p className='font-semibold text-slate-600'>No Captions Recorded Yet</p>
                      <p className='mt-1 text-[11px]'>
                        Enable <strong>CC</strong> during your call to generate real-time subtitles and a downloadable
                        visit transcript.
                      </p>
                    </div>
                  ) : (
                    transcript.map((line) => (
                      <div key={line.id} className='p-2.5 rounded-xl bg-slate-50 border border-slate-200/70'>
                        <div className='flex items-center justify-between text-[10px] text-slate-400 mb-0.5'>
                          <span className='font-bold text-slate-700'>{line.speakerName}</span>
                          <span>{line.time}</span>
                        </div>
                        <p className='text-slate-800 leading-relaxed'>{line.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoCall
