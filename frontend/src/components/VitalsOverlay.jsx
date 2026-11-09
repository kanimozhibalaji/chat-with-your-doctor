import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Heart, Activity, Save, Camera, Square, ShieldAlert, CheckCircle2, X, RefreshCw } from 'lucide-react'
import { computeNEWS2 } from '../utils/news2Calculator'

const VitalsOverlay = ({
  vitals,
  isSpotCheckRunning,
  onStartSpotCheck,
  onStopSpotCheck,
  onSaveClinicalVitals,
  onStreamPreview,
  onClose,
  isSaving
}) => {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('clinical') // 'clinical' | 'spotcheck'

  // Structured Home-Device Clinical Vitals
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [temperatureF, setTemperatureF] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')
  const [bloodGlucose, setBloodGlucose] = useState('')
  const [hrFromOptical, setHrFromOptical] = useState(false)

  const {
    bpm = null,
    confidence = 0,
    signalQuality = 'CALIBRATING',
    progressPct = 0,
    motionWarning = false,
    isLocked = false,
    waveform = []
  } = vitals || {}

  // Automatically populate Pulse when 15s Guided Spot-Check locks a validated BPM
  useEffect(() => {
    if (isLocked && bpm) {
      setHeartRate(String(bpm))
      setHrFromOptical(true)
    }
  }, [isLocked, bpm])

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

  // Draw POS optical pulse waveform in Spot-Check tab
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!waveform || waveform.length < 2) {
      ctx.strokeStyle = '#334155'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    const min = Math.min(...waveform)
    const max = Math.max(...waveform)
    const range = max - min || 1

    ctx.strokeStyle = motionWarning ? '#f59e0b' : '#10b981'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    const step = w / (waveform.length - 1)
    waveform.forEach((val, i) => {
      const x = i * step
      const normY = (val - min) / range
      const y = h - (normY * (h - 8) + 4)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }, [waveform, motionWarning, mode])

  const handleSubmitClinical = (e) => {
    e.preventDefault()
    const hasotherDevice = Boolean(systolicBp || spo2 || temperatureF || respiratoryRate || bloodGlucose)
    const source = hrFromOptical ? (hasotherDevice ? 'hybrid' : 'rppg_spot_check') : 'manual'

    const payload = {
      heartRate: heartRate ? Number(heartRate) : null,
      systolicBp: systolicBp ? Number(systolicBp) : null,
      diastolicBp: diastolicBp ? Number(diastolicBp) : null,
      spo2: spo2 ? Number(spo2) : null,
      temperatureF: temperatureF ? Number(temperatureF) : null,
      respiratoryRate: respiratoryRate ? Number(respiratoryRate) : null,
      bloodGlucose: bloodGlucose ? Number(bloodGlucose) : null,
      news2Score: triage.news2Score,
      news2Risk: triage.news2Risk,
      clinicalFlags: triage.clinicalFlags,
      source,
      confidence: hrFromOptical ? confidence || 0.9 : 1.0,
      signalQuality: hrFromOptical ? 'POS_LOCKED_15S' : 'CLINICAL_DEVICE'
    }

    if (typeof onStreamPreview === 'function') {
      onStreamPreview({
        ...payload,
        bpm: payload.heartRate
      })
    }
    if (typeof onSaveClinicalVitals === 'function') {
      onSaveClinicalVitals(payload)
    }
  }

  const riskBadgeStyle = {
    LOW: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    LOW_MEDIUM: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    MEDIUM: 'bg-orange-500/25 text-orange-200 border-orange-500/40',
    HIGH: 'bg-rose-600/30 text-rose-200 border-rose-500/50'
  }[triage.news2Risk]

  return (
    <div className='bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl border border-slate-700/90 shadow-2xl space-y-3 w-80'>
      {/* Header & Close */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Activity className='w-4 h-4 text-sky-400' />
          <span className='text-xs font-extrabold uppercase tracking-wider text-slate-100'>
            Clinical Vitals & NEWS2
          </span>
        </div>
        {onClose && (
          <button
            type='button'
            onClick={() => {
              if (isSpotCheckRunning && onStopSpotCheck) onStopSpotCheck()
              onClose()
            }}
            className='p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer'
            aria-label='Close vitals panel'
          >
            <X className='w-3.5 h-3.5' />
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className='grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold'>
        <button
          type='button'
          onClick={() => {
            if (isSpotCheckRunning && onStopSpotCheck) onStopSpotCheck()
            setMode('clinical')
          }}
          className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
            mode === 'clinical' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Home Vitals (Primary)
        </button>
        <button
          type='button'
          onClick={() => setMode('spotcheck')}
          className={`py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            mode === 'spotcheck' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Heart className='w-3 h-3' /> 15s Pulse Check
        </button>
      </div>

      {mode === 'clinical' ? (
        <form onSubmit={handleSubmitClinical} className='space-y-2.5 text-xs'>
          <div className='grid grid-cols-2 gap-2'>
            <div>
              <label className='block text-[10px] font-bold text-slate-400 mb-0.5'>BP (Sys / Dia mmHg)</label>
              <div className='flex items-center gap-1'>
                <input
                  type='number'
                  min='50'
                  max='260'
                  placeholder='120'
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(e.target.value)}
                  className='w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
                />
                <span className='text-slate-500'>/</span>
                <input
                  type='number'
                  min='30'
                  max='160'
                  placeholder='80'
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(e.target.value)}
                  className='w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
                />
              </div>
            </div>

            <div>
              <label className='block text-[10px] font-bold text-slate-400 mb-0.5'>SpO₂ (%)</label>
              <input
                type='number'
                min='60'
                max='100'
                placeholder='98'
                value={spo2}
                onChange={(e) => setSpo2(e.target.value)}
                className='w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-[10px] font-bold text-slate-400 mb-0.5'>Temp (°F)</label>
              <input
                type='number'
                step='0.1'
                min='93'
                max='108'
                placeholder='98.6'
                value={temperatureF}
                onChange={(e) => setTemperatureF(e.target.value)}
                className='w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='flex items-center justify-between text-[10px] font-bold text-slate-400 mb-0.5'>
                <span>Pulse (BPM)</span>
                {hrFromOptical && <span className='text-emerald-400'>POS Locked</span>}
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
                className='w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-[10px] font-bold text-slate-400 mb-0.5'>Resp (/min)</label>
              <input
                type='number'
                min='6'
                max='50'
                placeholder='16'
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                className='w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
              />
            </div>

            <div>
              <label className='block text-[10px] font-bold text-slate-400 mb-0.5'>Glucose (mg/dL)</label>
              <input
                type='number'
                min='30'
                max='600'
                placeholder='95'
                value={bloodGlucose}
                onChange={(e) => setBloodGlucose(e.target.value)}
                className='w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-sky-500'
              />
            </div>
          </div>

          {/* Deterministic RCP NEWS2 Early-Warning Summary */}
          <div className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${riskBadgeStyle}`}>
            <div className='flex items-center justify-between font-bold'>
              <span>RCP NEWS2 Score: {triage.news2Score}</span>
              <span className='uppercase text-[10px]'>{triage.news2Risk.replace('_', '-')}</span>
            </div>
            {triage.clinicalFlags.length > 0 ? (
              <p className='text-[10px] leading-snug opacity-95 flex items-start gap-1'>
                <ShieldAlert className='w-3.5 h-3.5 shrink-0 mt-0.5' />
                <span>{triage.clinicalFlags.join(' • ')}</span>
              </p>
            ) : (
              <p className='text-[10px] text-slate-300/90'>
                Enter pulse oximeter, BP cuff, or thermometer readings to stream live to your doctor.
              </p>
            )}
          </div>

          <button
            type='submit'
            disabled={isSaving || (!heartRate && !systolicBp && !spo2 && !temperatureF && !bloodGlucose)}
            className='w-full py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer'
          >
            <Save className='w-3.5 h-3.5' />
            <span>{isSaving ? 'Saving...' : 'Share Live & Save to EHR'}</span>
          </button>
        </form>
      ) : (
        /* TAB 2: 15-SECOND STATIONARY POS-rPPG SPOT-CHECK ADJUNCT */
        <div className='space-y-2.5 text-xs'>
          <div className='p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed'>
            <strong className='text-emerald-400'>Stationary Spot-Check:</strong> Sit facing soft light, hold your head
            still, and <strong>pause speaking for 15 seconds</strong>.
          </div>

          <div className='flex items-baseline justify-between px-0.5'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-3xl font-black text-white tabular-nums'>{bpm || '--'}</span>
              <span className='text-[11px] text-slate-400 font-bold uppercase'>BPM</span>
            </div>
            <div className='text-right text-[10px]'>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  isLocked
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                    : motionWarning || signalQuality === 'LOW_LIGHT' || signalQuality === 'NO_FACE'
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                }`}
              >
                {signalQuality === 'HOLD_STILL'
                  ? 'HOLD STILL'
                  : signalQuality === 'LOW_LIGHT'
                  ? 'LOW LIGHT'
                  : signalQuality === 'NO_FACE'
                  ? 'ALIGN FACE'
                  : signalQuality}
              </span>
              <div className='text-slate-400 mt-1'>POS + Harmonic Lock</div>
            </div>
          </div>

          {/* 15s Spot-Check Progress Bar */}
          <div className='space-y-1'>
            <div className='flex justify-between text-[10px] text-slate-400 font-semibold'>
              <span>
                {isLocked
                  ? '15s Spot-Check Complete & Locked'
                  : motionWarning
                  ? 'Motion detected — hold steady...'
                  : isSpotCheckRunning
                  ? 'Collecting clean stationary frames...'
                  : 'Ready to measure'}
              </span>
              <span className='tabular-nums text-emerald-400'>{progressPct}%</span>
            </div>
            <div className='h-2 w-full rounded-full bg-slate-800 overflow-hidden'>
              <div
                className={`h-full transition-all duration-200 ${
                  isLocked ? 'bg-emerald-400' : motionWarning ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
          </div>

          {/* Filtered POS Pulse Waveform */}
          <div className='bg-slate-950 rounded-xl p-2 border border-slate-800'>
            <canvas ref={canvasRef} width={240} height={38} className='w-full h-9 block rounded' />
          </div>

          <div className='flex items-center gap-2'>
            {!isSpotCheckRunning ? (
              <button
                type='button'
                onClick={onStartSpotCheck}
                className='flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer'
              >
                {isLocked ? <RefreshCw className='w-3.5 h-3.5' /> : <Camera className='w-3.5 h-3.5' />}
                <span>{isLocked ? 'Re-Run 15s Check' : 'Start 15s Spot-Check'}</span>
              </button>
            ) : (
              <button
                type='button'
                onClick={onStopSpotCheck}
                className='flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer'
              >
                <Square className='w-3.5 h-3.5' />
                <span>Stop Check</span>
              </button>
            )}

            {bpm && (
              <button
                type='button'
                onClick={() => {
                  setHeartRate(String(bpm))
                  setHrFromOptical(true)
                  if (isSpotCheckRunning && onStopSpotCheck) onStopSpotCheck()
                  setMode('clinical')
                }}
                className='px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer'
              >
                <CheckCircle2 className='w-3.5 h-3.5' />
                <span>Use {bpm}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VitalsOverlay
