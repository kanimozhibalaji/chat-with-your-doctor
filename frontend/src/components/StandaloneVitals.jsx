import React, { useState, useEffect, useRef, useContext, useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import { RPPGEngine } from '../utils/rppgEngine'
import { computeNEWS2 } from '../utils/news2Calculator'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  Activity,
  HeartPulse,
  Camera,
  Square,
  Save,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Stethoscope
} from 'lucide-react'

const RISK_STYLES = {
  LOW: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  LOW_MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  MEDIUM: 'bg-orange-50 text-orange-800 border-orange-200',
  HIGH: 'bg-rose-50 text-rose-800 border-rose-200'
}

const StandaloneVitals = () => {
  const { backendUrl, token } = useContext(AppContext)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const engineRef = useRef(null)
  const canvasRef = useRef(null)

  // Structured Home-Device Clinical Vitals (Primary)
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [temperatureF, setTemperatureF] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')
  const [bloodGlucose, setBloodGlucose] = useState('')
  const [notes, setNotes] = useState('')
  const [hrFromOptical, setHrFromOptical] = useState(false)

  // 15-Second Guided Stationary POS-rPPG Spot-Check (Adjunct)
  const [showSpotCheckPanel, setShowSpotCheckPanel] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [vitals, setVitals] = useState({
    bpm: null,
    confidence: 0,
    signalQuality: 'CALIBRATING',
    progressPct: 0,
    motionWarning: false,
    isLocked: false,
    waveform: []
  })

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState(false)

  const triage = useMemo(
    () =>
      computeNEWS2({
        heartRate,
        systolicBp,
        diastolicBp,
        spo2,
        temperatureF,
        respiratoryRate,
        bloodGlucose
      }),
    [heartRate, systolicBp, diastolicBp, spo2, temperatureF, respiratoryRate, bloodGlucose]
  )

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/vitals/history`, {
        headers: { token }
      })
      if (data.success) {
        setHistory(data.vitals || [])
      }
    } catch (error) {
      console.error('Failed to fetch vitals history:', error)
    }
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (token) {
      fetchHistory()
    }
  }, [token])

  useEffect(() => {
    return () => {
      stopScan()
    }
  }, [])

  // Draw POS chrominance pulse waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    if (!vitals.waveform || vitals.waveform.length < 2) {
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    const min = Math.min(...vitals.waveform)
    const max = Math.max(...vitals.waveform)
    const range = max - min || 1

    ctx.strokeStyle = vitals.motionWarning ? '#f59e0b' : '#10b981'
    ctx.lineWidth = 2.2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    ctx.beginPath()
    const step = w / (vitals.waveform.length - 1)
    vitals.waveform.forEach((val, i) => {
      const x = i * step
      const normY = (val - min) / range
      const y = h - (normY * (h - 10) + 5)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [vitals.waveform, vitals.motionWarning])

  const releaseCameraTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const stopScan = () => {
    if (engineRef.current) {
      engineRef.current.stop()
      engineRef.current = null
    }
    releaseCameraTracks()
    setIsScanning(false)
  }

  const startSpotCheck = async () => {
    setShowSpotCheckPanel(true)
    stopScan()
    setVitals({
      bpm: null,
      confidence: 0,
      signalQuality: 'CALIBRATING',
      progressPct: 0,
      motionWarning: false,
      isLocked: false,
      waveform: []
    })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        },
        audio: false
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const engine = new RPPGEngine(
        videoRef.current,
        (newVitals) => {
          setVitals(newVitals)
        },
        {
          spotCheckMode: true,
          spotCheckTargetSec: 15,
          onComplete: (lockedData) => {
            engineRef.current = null
            releaseCameraTracks()
            setIsScanning(false)
            if (lockedData?.bpm) {
              setHeartRate(String(lockedData.bpm))
              setHrFromOptical(true)
              toast.success(
                `15s stationary spot-check locked at ${lockedData.bpm} BPM and filled into your clinical vitals log!`
              )
            }
          }
        }
      )
      engineRef.current = engine
      engine.start()
      setIsScanning(true)
      toast.info('Sit still facing soft ambient light for 15 seconds without speaking.')
    } catch (err) {
      console.error('Camera access error:', err)
      toast.error('Unable to access webcam. You can still log all clinical vitals manually.')
    }
  }

  const handleSaveClinicalVitals = async (e) => {
    if (e) e.preventDefault()

    const hasAnyVital = Boolean(
      heartRate || systolicBp || spo2 || temperatureF || bloodGlucose
    )
    if (!hasAnyVital) {
      toast.warning('Enter at least one physiological vital sign (BP, SpO₂, Temp, Pulse, or Glucose).')
      return
    }

    const hasOtherDevice = Boolean(systolicBp || spo2 || temperatureF || respiratoryRate || bloodGlucose)
    const source = hrFromOptical ? (hasOtherDevice ? 'hybrid' : 'rppg_spot_check') : 'manual'

    setSaving(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/vitals/save`,
        {
          heartRate: heartRate ? Number(heartRate) : null,
          systolicBp: systolicBp ? Number(systolicBp) : null,
          diastolicBp: diastolicBp ? Number(diastolicBp) : null,
          spo2: spo2 ? Number(spo2) : null,
          temperatureF: temperatureF ? Number(temperatureF) : null,
          respiratoryRate: respiratoryRate ? Number(respiratoryRate) : null,
          bloodGlucose: bloodGlucose ? Number(bloodGlucose) : null,
          source,
          confidence: hrFromOptical ? vitals.confidence || 0.9 : 1.0,
          signalQuality: hrFromOptical ? 'POS_LOCKED_15S' : 'CLINICAL_DEVICE',
          notes: notes || 'Logged via Health Hub Clinical Vitals'
        },
        { headers: { token } }
      )

      if (data.success) {
        toast.success('Clinical vitals & NEWS2 triage recorded to your longitudinal health profile!')
        setSystolicBp('')
        setDiastolicBp('')
        setSpo2('')
        setTemperatureF('')
        setHeartRate('')
        setRespiratoryRate('')
        setBloodGlucose('')
        setNotes('')
        setHrFromOptical(false)
        fetchHistory()
      } else {
        toast.error(data.message || 'Unable to save clinical vitals')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to save vital reading')
    }
    setSaving(false)
  }

  return (
    <div className='max-w-5xl mx-auto space-y-6'>
      {/* Primary Structured Clinical Vitals & RCP NEWS2 Card */}
      <div className='bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-6'>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5'>
          <div className='space-y-1.5 max-w-2xl'>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200'>
              <Stethoscope className='w-3.5 h-3.5 text-sky-600' /> Clinical Vitals & RCP NEWS2 Triage
            </div>
            <h2 className='text-xl md:text-2xl font-bold text-slate-900 tracking-tight'>
              Log Home Clinical Vitals
            </h2>
            <p className='text-slate-600 text-sm leading-relaxed'>
              Record readings from your home BP cuff, pulse oximeter, thermometer, or glucometer for instant{' '}
              <strong>Royal College of Physicians NEWS2</strong> early-warning triage. Don&apos;t have a pulse oximeter?
              Run the optional <strong>15-second stationary POS-rPPG camera spot-check</strong> to fill your pulse.
            </p>
          </div>

          <div className='shrink-0'>
            {!isScanning ? (
              <button
                type='button'
                onClick={startSpotCheck}
                className='px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-xs transition-colors flex items-center gap-2 text-xs cursor-pointer'
              >
                <Camera className='w-4 h-4 text-emerald-400' /> 15s Camera Pulse Spot-Check
              </button>
            ) : (
              <button
                type='button'
                onClick={stopScan}
                className='px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs transition-colors flex items-center gap-2 text-xs cursor-pointer'
              >
                <Square className='w-4 h-4' /> Cancel Spot-Check
              </button>
            )}
          </div>
        </div>

        {/* Optional 15-Second Guided Stationary POS-rPPG Spot-Check Drawer */}
        {showSpotCheckPanel && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-lg'>
            <div className='relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800'>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${!isScanning ? 'hidden' : ''}`}
              />
              {!isScanning && (
                <div className='p-6 text-center space-y-2'>
                  <CheckCircle2 className='w-9 h-9 text-emerald-400 mx-auto' />
                  <p className='text-sm font-bold text-white'>
                    {vitals.isLocked && vitals.bpm
                      ? `Spot-Check Locked: ${vitals.bpm} BPM`
                      : 'Camera Released'}
                  </p>
                  <p className='text-xs text-slate-400'>
                    {vitals.isLocked
                      ? 'Validated pulse copied into the Pulse (BPM) field below.'
                      : 'Click Re-run 15s Spot-Check to measure resting optical pulse.'}
                  </p>
                </div>
              )}
              {isScanning && (
                <>
                  <div className='absolute inset-0 pointer-events-none flex items-center justify-center'>
                    <div
                      className={`w-40 h-52 border-2 border-dashed rounded-full ${
                        vitals.motionWarning ? 'border-amber-400' : 'border-emerald-400/60'
                      }`}
                    />
                  </div>
                  <div className='absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 border border-slate-700'>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        vitals.motionWarning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                      }`}
                    />
                    <span>
                      {vitals.signalQuality === 'HOLD_STILL'
                        ? 'Hold Still — Motion Paused Timer'
                        : vitals.signalQuality === 'LOW_LIGHT'
                        ? 'Low Light — Face Soft Lamp/Window'
                        : vitals.signalQuality === 'NO_FACE'
                        ? 'Center Uncovered Face in Oval'
                        : `POS Chrominance: ${vitals.signalQuality}`}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className='flex flex-col justify-between space-y-4'>
              <div>
                <div className='flex items-center justify-between text-xs font-bold text-emerald-400 uppercase tracking-wider'>
                  <span>15s Guided Resting Spot-Check</span>
                  <span className='text-[10px] font-semibold text-slate-400 normal-case'>
                    POS Chrominance + Zero-Phase Bandpass
                  </span>
                </div>
                <div className='flex items-baseline gap-2 mt-1.5'>
                  <span className='text-4xl font-black text-white tabular-nums'>
                    {vitals.bpm || '--'}
                  </span>
                  <span className='text-xs text-slate-400 font-semibold'>
                    BPM {vitals.isLocked ? '(Locked)' : '(Calibrating)'}
                  </span>
                </div>

                {/* 15s Progress Bar */}
                <div className='mt-3 space-y-1'>
                  <div className='flex items-center justify-between text-[11px] text-slate-300 font-semibold'>
                    <span>
                      {vitals.isLocked
                        ? '15s Stationary Window Complete'
                        : vitals.motionWarning
                        ? 'Stay still & silent to resume 15s capture...'
                        : 'Capturing clean arterial pulse frames...'}
                    </span>
                    <span className='font-mono text-emerald-400'>{vitals.progressPct || 0}%</span>
                  </div>
                  <div className='h-2 rounded-full bg-slate-800 overflow-hidden'>
                    <div
                      className={`h-full transition-all duration-200 ${
                        vitals.motionWarning ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${vitals.progressPct || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className='bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5'>
                <div className='flex items-center justify-between text-[11px] text-slate-400'>
                  <span>Filtered POS Pulse Waveform</span>
                  <span className='text-emerald-400 font-semibold'>
                    {Math.round((vitals.confidence || 0) * 100)}% Spectral Purity
                  </span>
                </div>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={54}
                  className='w-full h-12 bg-slate-950 rounded-lg border border-slate-800/80'
                />
              </div>

              <div className='flex items-center justify-between gap-2 text-[11px] text-slate-400'>
                <span>Optical wellness spot-check adjunct — not a diagnostic ECG.</span>
                <div className='flex items-center gap-2 shrink-0'>
                  {!isScanning && (
                    <button
                      type='button'
                      onClick={startSpotCheck}
                      className='px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer'
                    >
                      Re-run
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() => {
                      stopScan()
                      setShowSpotCheckPanel(false)
                    }}
                    className='px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer'
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Structured Multi-Parameter Clinical Vitals Form */}
        <form onSubmit={handleSaveClinicalVitals} className='space-y-5'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1.5'>
                Blood Pressure (Systolic / Diastolic mmHg)
              </label>
              <div className='grid grid-cols-2 gap-2'>
                <input
                  type='number'
                  min='50'
                  max='280'
                  placeholder='120 (Sys)'
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(e.target.value)}
                  className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
                />
                <input
                  type='number'
                  min='30'
                  max='180'
                  placeholder='80 (Dia)'
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(e.target.value)}
                  className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1.5'>
                Oxygen Saturation — SpO₂ (%)
              </label>
              <input
                type='number'
                min='60'
                max='100'
                placeholder='98'
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1.5'>
                Body Temperature (°F)
              </label>
              <input
                type='number'
                step='0.1'
                min='93'
                max='108'
                placeholder='98.6'
                value={temperatureF}
                onChange={(e) => setTemperatureF(e.target.value)}
                className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5'>
                <span>Heart Rate / Pulse (BPM)</span>
                {hrFromOptical && (
                  <span className='text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full'>
                    Filled by 15s POS-rPPG
                  </span>
                )}
              </label>
              <input
                type='number'
                min='30'
                max='220'
                placeholder='72'
                value={heartRate}
                onChange={(e) => {
                  setHeartRate(e.target.value)
                  setHrFromOptical(false)
                }}
                className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1.5'>
                Respiratory Rate (breaths/min)
              </label>
              <input
                type='number'
                min='6'
                max='50'
                placeholder='16 (Optional)'
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-xs font-bold text-slate-700 mb-1.5'>
                Blood Glucose (mg/dL)
              </label>
              <input
                type='number'
                min='30'
                max='600'
                placeholder='95 (Optional)'
                value={bloodGlucose}
                onChange={(e) => setBloodGlucose(e.target.value)}
                className='w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-sky-500'
              />
            </div>
          </div>

          {/* Live RCP NEWS2 Triage Assessment Banner */}
          {(heartRate || systolicBp || spo2 || temperatureF || respiratoryRate || bloodGlucose) && (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${RISK_STYLES[triage.news2Risk]}`}>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider'>
                  {triage.news2Risk === 'LOW' ? (
                    <ShieldCheck className='w-4 h-4' />
                  ) : (
                    <ShieldAlert className='w-4 h-4' />
                  )}
                  <span>
                    RCP NEWS2 Score: {triage.news2Score} — {triage.riskLabel}
                  </span>
                </div>
                {triage.clinicalFlags.length > 0 ? (
                  <p className='text-xs font-semibold'>
                    Detected physiological flags: {triage.clinicalFlags.join(' • ')}
                  </p>
                ) : (
                  <p className='text-xs opacity-90'>
                    Entered parameters are within standard adult resting physiological reference intervals.
                  </p>
                )}
              </div>
              <span className='px-3 py-1 rounded-full bg-white/80 text-[11px] font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-center'>
                {triage.news2Risk.replace('_', '-')} RISK
              </span>
            </div>
          )}

          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3'>
            <input
              type='text'
              placeholder='Optional clinical context (e.g., fasting morning check, post-medication, mild dizziness)'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className='flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500'
            />
            <button
              type='submit'
              disabled={saving}
              className='px-6 py-2.5 bg-primary hover:bg-sky-600 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50 shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0'
            >
              <Save className='w-4 h-4' />
              <span>{saving ? 'Recording to EHR...' : 'Save Clinical Vitals'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Longitudinal Clinical Vitals History Table */}
      <div className='bg-white rounded-2xl border border-slate-200/90 p-6 space-y-4 shadow-xs'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-base font-bold text-slate-900'>Longitudinal Clinical Vitals Log</h3>
            <p className='text-xs text-slate-500 mt-0.5'>
              Complete history of home device vitals, RCP NEWS2 triage scores, and 15s POS-rPPG spot-checks.
            </p>
          </div>
          <button
            type='button'
            onClick={fetchHistory}
            className='text-xs text-primary hover:text-sky-700 font-semibold flex items-center gap-1 cursor-pointer'
          >
            <RefreshCw className='w-3.5 h-3.5' />
            <span>Refresh</span>
          </button>
        </div>

        {loadingHistory ? (
          <div className='py-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2'>
            <div className='w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin' />
            <span>Loading clinical vitals...</span>
          </div>
        ) : history.length === 0 ? (
          <div className='text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200'>
            <Activity className='w-8 h-8 text-slate-400 mx-auto' />
            <p className='text-slate-700 font-semibold text-sm mt-2'>No clinical vitals recorded yet</p>
            <p className='text-slate-500 text-xs mt-1'>
              Log your blood pressure, SpO₂, temperature, or run a 15s pulse spot-check above.
            </p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-xs'>
              <thead>
                <tr className='border-b border-slate-200 text-slate-500 uppercase text-[11px]'>
                  <th className='pb-2.5 font-semibold'>Date & Time</th>
                  <th className='pb-2.5 font-semibold'>BP (mmHg)</th>
                  <th className='pb-2.5 font-semibold'>SpO₂</th>
                  <th className='pb-2.5 font-semibold'>Temp</th>
                  <th className='pb-2.5 font-semibold'>Pulse</th>
                  <th className='pb-2.5 font-semibold'>NEWS2 Risk</th>
                  <th className='pb-2.5 font-semibold'>Source / Notes</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {history.map((item, idx) => {
                  const riskKey = item.news2Risk || 'LOW'
                  return (
                    <tr key={item._id || idx} className='hover:bg-slate-50/60 align-top'>
                      <td className='py-3 text-slate-700 whitespace-nowrap pr-3'>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '--'}
                      </td>
                      <td className='py-3 font-semibold text-slate-900 whitespace-nowrap pr-3'>
                        {item.systolicBp && item.diastolicBp
                          ? `${item.systolicBp}/${item.diastolicBp}`
                          : item.systolicBp
                          ? `${item.systolicBp}/--`
                          : '—'}
                      </td>
                      <td className='py-3 font-semibold text-slate-900 whitespace-nowrap pr-3'>
                        {item.spo2 ? `${item.spo2}%` : '—'}
                      </td>
                      <td className='py-3 font-semibold text-slate-900 whitespace-nowrap pr-3'>
                        {item.temperatureF ? `${item.temperatureF}°F` : '—'}
                      </td>
                      <td className='py-3 font-bold text-slate-900 whitespace-nowrap pr-3'>
                        {item.heartRate ? (
                          <>
                            <span className='text-primary'>{item.heartRate}</span>{' '}
                            <span className='text-[11px] text-slate-500 font-normal'>BPM</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className='py-3 pr-3'>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            RISK_STYLES[riskKey] || RISK_STYLES.LOW
                          }`}
                        >
                          NEWS2 {item.news2Score ?? 0} • {riskKey.replace('_', '-')}
                        </span>
                        {Array.isArray(item.clinicalFlags) && item.clinicalFlags.length > 0 && (
                          <p className='text-[10px] text-rose-600 font-semibold mt-1 max-w-[200px]'>
                            {item.clinicalFlags.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className='py-3 text-slate-600'>
                        <span className='block font-semibold text-slate-700 text-[11px]'>
                          {item.source === 'rppg_spot_check'
                            ? '15s POS-rPPG Spot-Check'
                            : item.source === 'hybrid'
                            ? 'Home Devices + POS-rPPG'
                            : 'Home Clinical Devices'}
                        </span>
                        {item.notes && <span className='text-[11px] text-slate-500'>{item.notes}</span>}
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

export default StandaloneVitals
