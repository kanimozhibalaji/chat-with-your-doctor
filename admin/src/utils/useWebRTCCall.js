import { useState, useRef, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'

const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
]

/**
 * Safari / pre-Chrome-134 fallback for `<dialog closedby="any">`.
 * Requires both pointerdown and pointerup outside the dialog box so text-selection drags never dismiss.
 */
export const attachDialogLightDismissFallback = (dialogEl) => {
  if (!dialogEl || typeof HTMLDialogElement === 'undefined') return () => {}
  if ('closedBy' in HTMLDialogElement.prototype) return () => {}

  const isOutside = (e) => {
    const r = dialogEl.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }

  let pressedOutside = false
  const onPointerDown = (e) => {
    if (e.target !== dialogEl) {
      pressedOutside = false
      return
    }
    pressedOutside = isOutside(e)
  }
  const onPointerUp = (e) => {
    if (pressedOutside && e.target === dialogEl && isOutside(e)) {
      dialogEl.close()
    }
    pressedOutside = false
  }

  dialogEl.addEventListener('pointerdown', onPointerDown)
  dialogEl.addEventListener('pointerup', onPointerUp)
  return () => {
    dialogEl.removeEventListener('pointerdown', onPointerDown)
    dialogEl.removeEventListener('pointerup', onPointerUp)
  }
}

export const formatDuration = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60).toString().padStart(2, '0')
  const secs = (safe % 60).toString().padStart(2, '0')
  return hrs > 0 ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`
}

/**
 * Production WebRTC Teleconsultation Engine
 *  - W3C Perfect Negotiation + early ICE candidate queuing
 *  - JWT-authenticated `video:*` signaling with automatic reconnect & manual ICE restart
 *  - Pre-join Green Room preview, Web Audio RMS mic meter, speaker chime, mid-call device hot-swap
 *  - Screen sharing (`getDisplayMedia` + `replaceTrack`), Data-Saver bitrate capping, Live WebRTC `getStats()`
 *  - Real-time SpeechRecognition clinical captions + rolling transcript
 *  - Two-party consent composite consultation recording + clinical frame snapshot
 *  - Integrated appointment live chat synchronized with persistent MongoDB chat history
 */
export function useWebRTCCall({
  appointmentId,
  backendUrl,
  authPayload,
  role = 'doctor',
  displayName = '',
  override = false,
  onNotify,
  onVitalsReceived,
  onRxIssued
}) {
  const notify = useCallback(
    (msg, type = 'info') => {
      if (typeof onNotify === 'function') onNotify(msg, type)
    },
    [onNotify]
  )

  // Lifecycle & Peer States
  const [callStatus, setCallStatus] = useState('idle') // idle | connecting | connected | reconnecting | ended
  const [lobbyActive, setLobbyActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [remoteConnected, setRemoteConnected] = useState(false)
  const [peerInfo, setPeerInfo] = useState(null)
  const [replacedByOtherTab, setReplacedByOtherTab] = useState(false)
  const [peerMediaState, setPeerMediaState] = useState({
    audio: true,
    video: true,
    screen: false,
    dataSaver: false,
    handRaised: false
  })

  // Local Media & Device States
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isDataSaver, setIsDataSaver] = useState(false)
  const [isMirrored, setIsMirrored] = useState(true)
  const [isSwappedView, setIsSwappedView] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [devices, setDevices] = useState({ cameras: [], microphones: [], speakers: [] })
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [micLevel, setMicLevel] = useState(0)

  // Viewport States
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)

  // Real-Time Network Telemetry
  const [networkStats, setNetworkStats] = useState({
    rttMs: null,
    packetLossPct: 0,
    rxBitrateKbps: 0,
    txBitrateKbps: 0,
    resolution: '',
    fps: 0,
    candidateType: 'Connecting',
    qualityGrade: 'good' // excellent | good | fair | poor
  })

  // Live Captions & Transcript
  const SpeechRecognitionImpl =
    typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
  const captionsSupported = Boolean(SpeechRecognitionImpl)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [liveCaption, setLiveCaption] = useState(null)
  const [transcript, setTranscript] = useState([])

  // Quick Reactions
  const [floatingReactions, setFloatingReactions] = useState([])

  // Two-Party Consent Recording & Clinical Snapshots
  const [recordingState, setRecordingState] = useState('idle') // idle | requesting | active
  const [incomingRecordingRequest, setIncomingRecordingRequest] = useState(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [snapshots, setSnapshots] = useState([])

  // In-Call Chat
  const [chatMessages, setChatMessages] = useState([])
  const [peerTyping, setPeerTyping] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Refs
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const stageContainerRef = useRef(null)
  const socketRef = useRef(null)
  const peerRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS)

  // Perfect Negotiation Refs
  const politeRef = useRef(role === 'user')
  const peerSeatedRef = useRef(false)
  const makingOfferRef = useRef(false)
  const ignoreOfferRef = useRef(false)
  const isSettingRemoteAnswerPendingRef = useRef(false)
  const pendingCandidatesRef = useRef([])
  const pendingSignalsRef = useRef([])

  // Mirror state refs for event listeners
  const appointmentIdRef = useRef(appointmentId)
  const hasJoinedOnceRef = useRef(false)
  const callStatusRef = useRef('idle')
  const mediaStateRef = useRef({
    audio: true,
    video: true,
    screen: false,
    dataSaver: false,
    handRaised: false
  })
  const chatOpenRef = useRef(false)
  const captionsEnabledRef = useRef(false)
  const recognitionRef = useRef(null)
  const captionTimeoutRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Timers & Audio Metering Refs
  const callTimerRef = useRef(null)
  const statsIntervalRef = useRef(null)
  const prevStatsRef = useRef({ rxBytes: 0, txBytes: 0, ts: 0, packetsReceived: 0, packetsLost: 0 })
  const audioCtxRef = useRef(null)
  const meterAnimRef = useRef(null)

  // Recording Refs
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordCanvasAnimRef = useRef(null)
  const recordAudioCtxRef = useRef(null)
  const recordTimerRef = useRef(null)

  useEffect(() => {
    appointmentIdRef.current = appointmentId
  }, [appointmentId])

  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  // Sync local & remote streams whenever `<video>` elements mount or re-bind
  const syncVideoElements = useCallback(() => {
    const activeLocal = screenStreamRef.current || cameraStreamRef.current
    if (localVideoRef.current && activeLocal && localVideoRef.current.srcObject !== activeLocal) {
      localVideoRef.current.srcObject = activeLocal
    }
    if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
      if (selectedSpeakerId && typeof remoteVideoRef.current.setSinkId === 'function') {
        remoteVideoRef.current.setSinkId(selectedSpeakerId).catch(() => {})
      }
    }
  }, [selectedSpeakerId])

  useEffect(() => {
    syncVideoElements()
  }, [callStatus, lobbyActive, isScreenSharing, remoteConnected, isSwappedView, syncVideoElements])

  const broadcastMediaState = useCallback(
    (patch = {}) => {
      const next = { ...mediaStateRef.current, ...patch }
      mediaStateRef.current = next
      if (socketRef.current?.connected) {
        socketRef.current.emit('video:media-state', {
          appointmentId,
          ...next
        })
      }
    },
    [appointmentId]
  )

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const cameras = list.filter((d) => d.kind === 'videoinput')
      const microphones = list.filter((d) => d.kind === 'audioinput')
      const speakers = list.filter((d) => d.kind === 'audiooutput')
      setDevices({ cameras, microphones, speakers })

      if (!selectedCameraId && cameras[0]?.deviceId) setSelectedCameraId(cameras[0].deviceId)
      if (!selectedMicId && microphones[0]?.deviceId) setSelectedMicId(microphones[0].deviceId)
      if (!selectedSpeakerId && speakers[0]?.deviceId) setSelectedSpeakerId(speakers[0].deviceId)
    } catch (e) {}
  }, [selectedCameraId, selectedMicId, selectedSpeakerId])

  useEffect(() => {
    refreshDevices()
    if (!navigator.mediaDevices?.addEventListener) return
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const stopMicMeter = useCallback(() => {
    if (meterAnimRef.current) {
      cancelAnimationFrame(meterAnimRef.current)
      meterAnimRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setMicLevel(0)
  }, [])

  const startMicMeter = useCallback(
    (stream) => {
      stopMicMeter()
      const audioTrack = stream?.getAudioTracks?.()[0]
      if (!audioTrack || typeof window === 'undefined') return
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return

      try {
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]))
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.72
        source.connect(analyser)
        const buffer = new Uint8Array(analyser.frequencyBinCount)

        let lastTick = 0
        const tick = (now) => {
          if (!audioCtxRef.current) return
          if (now - lastTick > 80) {
            lastTick = now
            if (!audioTrack.enabled) {
              setMicLevel(0)
            } else {
              analyser.getByteTimeDomainData(buffer)
              let sumSq = 0
              for (let i = 0; i < buffer.length; i++) {
                const norm = (buffer[i] - 128) / 128
                sumSq += norm * norm
              }
              const rms = Math.sqrt(sumSq / buffer.length)
              setMicLevel(Math.min(100, Math.round(rms * 320)))
            }
          }
          meterAnimRef.current = requestAnimationFrame(tick)
        }
        meterAnimRef.current = requestAnimationFrame(tick)
      } catch (e) {}
    },
    [stopMicMeter]
  )

  const acquireLocalMedia = useCallback(
    async ({ audioOnly = false, camId = selectedCameraId, micId = selectedMicId } = {}) => {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(micId ? { deviceId: { ideal: micId } } : {})
      }
      const videoConstraints = audioOnly
        ? false
        : {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
            ...(camId ? { deviceId: { ideal: camId } } : {})
          }

      let stream = null
      let cameraAvailable = !audioOnly

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: videoConstraints
        })
      } catch (err) {
        if (!audioOnly) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: false
            })
            cameraAvailable = false
            notify('Camera unavailable — switched cleanly to Crystal-Clear Audio Mode.', 'info')
          } catch (audioErr) {
            throw audioErr
          }
        } else {
          throw err
        }
      }

      cameraStreamRef.current = stream
      const hasVid = cameraAvailable && stream.getVideoTracks().length > 0
      setHasCamera(hasVid)
      setIsVideoOff(!hasVid)
      setIsMuted(false)

      mediaStateRef.current = {
        ...mediaStateRef.current,
        audio: true,
        video: hasVid
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      startMicMeter(stream)
      await refreshDevices()
      return stream
    },
    [selectedCameraId, selectedMicId, notify, startMicMeter, refreshDevices]
  )

  const startLobbyPreview = useCallback(async () => {
    try {
      await acquireLocalMedia({ audioOnly: false })
      setLobbyActive(true)
    } catch (err) {
      notify('Could not access microphone/camera. Please allow permissions in your browser address bar.', 'error')
    }
  }, [acquireLocalMedia, notify])

  const stopLobbyPreview = useCallback(() => {
    if (callStatusRef.current !== 'idle' && callStatusRef.current !== 'ended') return
    stopMicMeter()
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    setLobbyActive(false)
  }, [stopMicMeter])

  const playTestTone = useCallback(async () => {
    const AudioCtx = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
    if (!AudioCtx) return
    try {
      const ctx = new AudioCtx()
      if (selectedSpeakerId && typeof ctx.setSinkId === 'function') {
        await ctx.setSinkId(selectedSpeakerId).catch(() => {})
      }
      const notes = [523.25, 659.25, 783.99]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = ctx.currentTime + idx * 0.14
        gain.gain.setValueAtTime(0.001, start)
        gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.3)
      })
      setTimeout(() => ctx.close().catch(() => {}), 900)
      notify('Playing speaker test chime...', 'success')
    } catch (e) {
      notify('Unable to play speaker test tone on this browser.', 'error')
    }
  }, [selectedSpeakerId, notify])

  const fetchChatHistory = useCallback(async () => {
    if (!appointmentId || !backendUrl) return
    const tokenVal = authPayload?.token || authPayload?.dToken
    if (!tokenVal) return
    try {
      const endpoint =
        role === 'doctor' ? `${backendUrl}/api/chat/doctor/messages` : `${backendUrl}/api/chat/messages`
      const headers = role === 'doctor' ? { dToken: authPayload.dToken } : { token: authPayload.token }
      const { data } = await axios.post(endpoint, { appointmentId }, { headers })
      if (data.success && Array.isArray(data.messages)) {
        setChatMessages(data.messages)
      }
    } catch (e) {}
  }, [appointmentId, backendUrl, authPayload, role])

  useEffect(() => {
    fetchChatHistory()
  }, [fetchChatHistory])

  const flushPendingCandidates = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription) return
    const queued = pendingCandidatesRef.current.splice(0)
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) {}
    }
  }, [])

  const applySenderBandwidthProfile = useCallback(async (pc, lowBandwidth) => {
    if (!pc) return
    const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video')
    if (!videoSender || typeof videoSender.getParameters !== 'function') return
    try {
      const params = videoSender.getParameters()
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}]
      }
      if (lowBandwidth) {
        params.encodings[0].maxBitrate = 180_000
        params.encodings[0].maxFramerate = 15
        params.encodings[0].scaleResolutionDownBy = 2
      } else {
        params.encodings[0].maxBitrate = 1_500_000
        params.encodings[0].maxFramerate = 30
        params.encodings[0].scaleResolutionDownBy = 1
      }
      await videoSender.setParameters(params)
    } catch (e) {}
  }, [])

  const handleSignalMessage = useCallback(
    async ({ description, candidate }) => {
      const pc = peerRef.current
      if (!pc) {
        pendingSignalsRef.current.push({ description, candidate })
        return
      }

      try {
        if (description) {
          const readyForOffer =
            !makingOfferRef.current &&
            (pc.signalingState === 'stable' || isSettingRemoteAnswerPendingRef.current)
          const offerCollision = description.type === 'offer' && !readyForOffer

          ignoreOfferRef.current = !politeRef.current && offerCollision
          if (ignoreOfferRef.current) return

          isSettingRemoteAnswerPendingRef.current = description.type === 'answer'
          if (offerCollision && pc.signalingState !== 'stable') {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(new RTCSessionDescription(description))
            ])
          } else {
            await pc.setRemoteDescription(new RTCSessionDescription(description))
          }
          isSettingRemoteAnswerPendingRef.current = false

          await flushPendingCandidates(pc)

          if (description.type === 'offer') {
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            socketRef.current?.emit('video:signal', {
              appointmentId,
              description: pc.localDescription
            })
          }
        } else if (candidate) {
          if (!pc.remoteDescription || isSettingRemoteAnswerPendingRef.current) {
            pendingCandidatesRef.current.push(candidate)
          } else {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate))
            } catch (err) {
              if (!ignoreOfferRef.current) {
                console.warn('ICE candidate error:', err.message)
              }
            }
          }
        }
      } catch (err) {
        isSettingRemoteAnswerPendingRef.current = false
        console.warn('WebRTC signaling error:', err.message)
      }
    },
    [appointmentId, flushPendingCandidates]
  )

  const createPeerConnection = useCallback(
    (iceServers) => {
      if (peerRef.current) {
        try {
          peerRef.current.close()
        } catch (e) {}
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServers?.length ? iceServers : DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 4
      })

      const inboundStream = new MediaStream()
      remoteStreamRef.current = inboundStream

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current?.connected) {
          socketRef.current.emit('video:signal', {
            appointmentId,
            candidate
          })
        }
      }

      pc.ontrack = (event) => {
        const stream = event.streams?.[0]
        if (stream) {
          remoteStreamRef.current = stream
        } else if (event.track) {
          inboundStream.addTrack(event.track)
          remoteStreamRef.current = inboundStream
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current
          if (selectedSpeakerId && typeof remoteVideoRef.current.setSinkId === 'function') {
            remoteVideoRef.current.setSinkId(selectedSpeakerId).catch(() => {})
          }
        }
        setRemoteConnected(true)
      }

      pc._readyForMidCallRenegotiation = false

      pc.onnegotiationneeded = async () => {
        if (!pc._readyForMidCallRenegotiation || !peerSeatedRef.current || !socketRef.current?.connected) {
          return
        }
        try {
          makingOfferRef.current = true
          const offer = await pc.createOffer()
          if (pc.signalingState !== 'stable') return
          await pc.setLocalDescription(offer)
          socketRef.current.emit('video:signal', {
            appointmentId,
            description: pc.localDescription
          })
        } catch (err) {
          console.warn('Negotiation error:', err.message)
        } finally {
          makingOfferRef.current = false
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallStatus('connected')
          setRemoteConnected(true)
          if (mediaStateRef.current.dataSaver) {
            applySenderBandwidthProfile(pc, true)
          }
        } else if (pc.connectionState === 'disconnected') {
          setCallStatus('reconnecting')
        } else if (pc.connectionState === 'failed') {
          setCallStatus('reconnecting')
          setRemoteConnected(false)
          if (typeof pc.restartIce === 'function') {
            pc.restartIce()
          }
        }
      }

      const audioTrack = cameraStreamRef.current?.getAudioTracks?.()[0]
      const activeVideoStream = screenStreamRef.current || cameraStreamRef.current
      const videoTrack = activeVideoStream?.getVideoTracks?.()[0]

      if (audioTrack && cameraStreamRef.current) {
        pc.addTrack(audioTrack, cameraStreamRef.current)
      }
      if (videoTrack && activeVideoStream) {
        pc.addTrack(videoTrack, activeVideoStream)
      }

      setTimeout(() => {
        pc._readyForMidCallRenegotiation = true
      }, 0)

      peerRef.current = pc
      return pc
    },
    [appointmentId, selectedSpeakerId, applySenderBandwidthProfile]
  )

  const sendExplicitOffer = useCallback(
    async (pc, { iceRestart = false } = {}) => {
      if (!pc || !socketRef.current?.connected) return
      try {
        makingOfferRef.current = true
        const offer = await pc.createOffer({ iceRestart })
        if (pc.signalingState !== 'stable') return
        await pc.setLocalDescription(offer)
        socketRef.current.emit('video:signal', {
          appointmentId,
          description: pc.localDescription
        })
      } catch (e) {
        console.warn('Offer error:', e.message)
      } finally {
        makingOfferRef.current = false
      }
    },
    [appointmentId]
  )

  const triggerIceRestart = useCallback(() => {
    const pc = peerRef.current
    if (!pc) return
    if (typeof pc.restartIce === 'function') pc.restartIce()
    sendExplicitOffer(pc, { iceRestart: true })
    notify('Refreshing encrypted media route (ICE Restart)...', 'info')
  }, [sendExplicitOffer, notify])

  useEffect(() => {
    if (callStatus !== 'connected' && callStatus !== 'reconnecting') {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
        statsIntervalRef.current = null
      }
      return
    }

    statsIntervalRef.current = setInterval(async () => {
      const pc = peerRef.current
      if (!pc) return
      try {
        const report = await pc.getStats()
        let rttMs = null
        let candidateType = 'Direct P2P'
        let rxBytes = 0
        let txBytes = 0
        let packetsReceived = 0
        let packetsLost = 0
        let frameWidth = 0
        let frameHeight = 0
        let fps = 0
        let nowTs = performance.now()

        let activePair = null
        report.forEach((stat) => {
          if (stat.type === 'candidate-pair' && (stat.nominated || stat.state === 'succeeded')) {
            if (!activePair || stat.nominated) activePair = stat
          }
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            rxBytes += stat.bytesReceived || 0
            packetsReceived += stat.packetsReceived || 0
            packetsLost += Math.max(0, stat.packetsLost || 0)
            if (stat.frameWidth) frameWidth = stat.frameWidth
            if (stat.frameHeight) frameHeight = stat.frameHeight
            if (stat.framesPerSecond) fps = Math.round(stat.framesPerSecond)
            if (stat.timestamp) nowTs = stat.timestamp
          }
          if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
            txBytes += stat.bytesSent || 0
          }
        })

        if (activePair) {
          if (typeof activePair.currentRoundTripTime === 'number') {
            rttMs = Math.round(activePair.currentRoundTripTime * 1000)
          }
          const localCand = activePair.localCandidateId ? report.get(activePair.localCandidateId) : null
          const remoteCand = activePair.remoteCandidateId ? report.get(activePair.remoteCandidateId) : null
          const cType = localCand?.candidateType || remoteCand?.candidateType || 'host'
          if (cType === 'relay' || remoteCand?.candidateType === 'relay') candidateType = 'TURN Relay'
          else if (cType === 'srflx' || cType === 'prflx') candidateType = 'STUN NAT'
          else candidateType = 'Direct P2P'
        }

        const prev = prevStatsRef.current
        const dtSec = prev.ts > 0 ? Math.max(0.5, (nowTs - prev.ts) / 1000) : 2
        const rxBitrateKbps =
          prev.ts > 0 ? Math.max(0, Math.round(((rxBytes - prev.rxBytes) * 8) / 1000 / dtSec)) : 0
        const txBitrateKbps =
          prev.ts > 0 ? Math.max(0, Math.round(((txBytes - prev.txBytes) * 8) / 1000 / dtSec)) : 0

        const dRecv = Math.max(0, packetsReceived - prev.packetsReceived)
        const dLost = Math.max(0, packetsLost - prev.packetsLost)
        const packetLossPct =
          dRecv + dLost > 0 ? Number(((dLost / (dRecv + dLost)) * 100).toFixed(1)) : 0

        prevStatsRef.current = { rxBytes, txBytes, ts: nowTs, packetsReceived, packetsLost }

        let qualityGrade = 'excellent'
        if ((rttMs !== null && rttMs > 420) || packetLossPct >= 7) qualityGrade = 'poor'
        else if ((rttMs !== null && rttMs > 240) || packetLossPct >= 3) qualityGrade = 'fair'
        else if ((rttMs !== null && rttMs > 120) || packetLossPct >= 1) qualityGrade = 'good'

        setNetworkStats({
          rttMs,
          packetLossPct,
          rxBitrateKbps,
          txBitrateKbps,
          resolution: frameWidth && frameHeight ? `${frameWidth}×${frameHeight}` : '',
          fps,
          candidateType,
          qualityGrade
        })
      } catch (e) {}
    }, 2000)

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current)
        statsIntervalRef.current = null
      }
    }
  }, [callStatus])

  useEffect(() => {
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
    }
  }, [callStatus])

  const stopLocalMediaRecorder = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
    if (recordCanvasAnimRef.current) {
      cancelAnimationFrame(recordCanvasAnimRef.current)
      recordCanvasAnimRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch (e) {}
    }
    if (recordAudioCtxRef.current) {
      recordAudioCtxRef.current.close().catch(() => {})
      recordAudioCtxRef.current = null
    }
    setRecordingState('idle')
    setRecordingDuration(0)
  }, [])

  const startCompositeRecorder = useCallback(() => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')

      const drawFrame = () => {
        ctx.fillStyle = '#020617'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const remVid = remoteVideoRef.current
        if (remVid && remVid.readyState >= 2) {
          ctx.drawImage(remVid, 0, 0, canvas.width, canvas.height)
        }

        const locVid = localVideoRef.current
        if (locVid && locVid.readyState >= 2) {
          const pipW = 260
          const pipH = 150
          const pipX = canvas.width - pipW - 24
          const pipY = canvas.height - pipH - 24
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4)
          ctx.drawImage(locVid, pipX, pipY, pipW, pipH)
        }

        ctx.fillStyle = 'rgba(2, 6, 23, 0.7)'
        ctx.fillRect(20, 20, 410, 34)
        ctx.fillStyle = '#f8fafc'
        ctx.font = 'bold 13px sans-serif'
        ctx.fillText(`VitalSync Consented Consultation • ${new Date().toLocaleString()}`, 32, 42)

        recordCanvasAnimRef.current = requestAnimationFrame(drawFrame)
      }
      recordCanvasAnimRef.current = requestAnimationFrame(drawFrame)

      const streamTracks = [...canvas.captureStream(24).getVideoTracks()]

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        const actx = new AudioCtx()
        recordAudioCtxRef.current = actx
        const dest = actx.createMediaStreamDestination()
        const localAudio = cameraStreamRef.current?.getAudioTracks?.()[0]
        const remoteAudio = remoteStreamRef.current?.getAudioTracks?.()[0]
        if (localAudio) {
          actx.createMediaStreamSource(new MediaStream([localAudio])).connect(dest)
        }
        if (remoteAudio) {
          actx.createMediaStreamSource(new MediaStream([remoteAudio])).connect(dest)
        }
        streamTracks.push(...dest.stream.getAudioTracks())
      }

      const combinedStream = new MediaStream(streamTracks)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm'

      const recorder = new MediaRecorder(combinedStream, { mimeType })
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `VitalSync-Consultation-${appointmentId.slice(-6)}-${Date.now()}.webm`
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(url), 10000)
          notify('Consultation recording saved to your device.', 'success')
        }
        recordedChunksRef.current = []
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setRecordingState('active')
      setRecordingDuration(0)
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.warn('Recording start error:', err.message)
      setRecordingState('idle')
      notify('Browser could not start local media recording.', 'error')
    }
  }, [appointmentId, notify])

  const startCall = useCallback(
    async ({ audioOnly = false } = {}) => {
      hasJoinedOnceRef.current = false
      setReplacedByOtherTab(false)
      setCallStatus('connecting')

      try {
        if (!cameraStreamRef.current) {
          await acquireLocalMedia({ audioOnly })
        } else if (audioOnly) {
          cameraStreamRef.current.getVideoTracks().forEach((t) => {
            t.enabled = false
          })
          setIsVideoOff(true)
          mediaStateRef.current.video = false
        }
        setLobbyActive(false)

        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }

        const socket = io(backendUrl, {
          auth: authPayload || {},
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000
        })
        socketRef.current = socket

        const joinVideoSession = (isResume = false) => {
          socket.emit('join-chat', { appointmentId })
          if (!isResume) {
            socket.emit('call-initiate', {
              roomId: appointmentId,
              callerRole: role,
              override
            })
          }

          socket.emit(
            'video:join',
            {
              appointmentId,
              override,
              resume: isResume,
              mediaState: mediaStateRef.current
            },
            async (ack) => {
              if (!ack?.ok) {
                notify(ack?.message || 'Unable to enter consultation room.', 'error')
                setCallStatus('idle')
                return
              }

              hasJoinedOnceRef.current = true
              politeRef.current = Boolean(ack.polite)
              if (ack.iceServers?.length) {
                iceServersRef.current = ack.iceServers
              }

              if (ack.peer) {
                peerSeatedRef.current = true
                setPeerInfo({
                  role: ack.peer.role,
                  name: ack.peer.name,
                  image: ack.peer.image
                })
                if (ack.peer.mediaState) {
                  setPeerMediaState((prev) => ({ ...prev, ...ack.peer.mediaState }))
                }
              } else {
                peerSeatedRef.current = false
              }

              const existingPc = peerRef.current
              const canReusePc =
                isResume &&
                existingPc &&
                existingPc.connectionState !== 'closed' &&
                existingPc.signalingState !== 'closed'

              const pc = canReusePc ? existingPc : createPeerConnection(iceServersRef.current)

              const earlySignals = pendingSignalsRef.current.splice(0)
              for (const sig of earlySignals) {
                await handleSignalMessage(sig)
              }

              if (ack.peer) {
                await sendExplicitOffer(pc, { iceRestart: isResume })
              }
            }
          )
        }

        socket.on('connect', () => {
          const isResume = Boolean(hasJoinedOnceRef.current)
          joinVideoSession(isResume)
        })

        socket.on('video:signal', handleSignalMessage)

        socket.on('video:peer-joined', ({ role: peerRole, name, image, resume, mediaState }) => {
          peerSeatedRef.current = true
          setPeerInfo({ role: peerRole, name, image })
          if (mediaState) {
            setPeerMediaState((prev) => ({ ...prev, ...mediaState }))
          }
          if (!resume || !peerRef.current || peerRef.current.signalingState === 'closed') {
            pendingCandidatesRef.current = []
            createPeerConnection(iceServersRef.current)
          }
          broadcastMediaState()
          if (resume) {
            notify(`${name || 'Participant'} reconnected.`, 'info')
          }
        })

        socket.on('video:media-state', (state) => {
          setPeerMediaState((prev) => ({ ...prev, ...state }))
        })

        socket.on('video:caption', (payload) => {
          setLiveCaption(payload)
          if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current)
          captionTimeoutRef.current = setTimeout(() => setLiveCaption(null), 5500)

          if (payload.isFinal && payload.text) {
            setTranscript((prev) => [
              ...prev.slice(-199),
              {
                id: `${payload.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
                speakerRole: payload.speakerRole,
                speakerName: payload.speakerName,
                text: payload.text,
                time: new Date(payload.timestamp || Date.now()).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
            ])
          }
        })

        socket.on('video:reaction', (reaction) => {
          setFloatingReactions((prev) => [...prev.slice(-8), reaction])
          setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id))
          }, 3600)
        })

        socket.on('video:recording', ({ action, by, name }) => {
          if (action === 'request') {
            setIncomingRecordingRequest({ by, name })
          } else if (action === 'accept') {
            notify(`${name || 'Participant'} consented to local consultation recording.`, 'success')
            startCompositeRecorder()
          } else if (action === 'decline') {
            setRecordingState('idle')
            notify(`${name || 'Participant'} declined recording consent.`, 'error')
          } else if (action === 'stop') {
            stopLocalMediaRecorder()
            notify('Consultation recording stopped.', 'info')
          }
        })

        socket.on('video:peer-left', ({ reason }) => {
          peerSeatedRef.current = false
          setRemoteConnected(false)
          if (reason === 'disconnected') {
            setCallStatus('reconnecting')
            notify('Participant connection interrupted — waiting for automatic reconnect...', 'info')
          } else {
            notify('Other participant left the room. You may stay or end the consultation.', 'info')
          }
        })

        socket.on('video:replaced', () => {
          setReplacedByOtherTab(true)
          notify('Consultation opened in another browser tab — switched active session.', 'info')
          endCallInternal({ notifyServer: false })
        })

        socket.on('video:ended', ({ name }) => {
          notify(`Consultation ended by ${name || 'participant'}.`, 'info')
          endCallInternal({ notifyServer: false })
        })

        socket.on('call-ended', () => {
          endCallInternal({ notifyServer: false })
        })

        socket.on('call-declined', () => {
          notify('Recipient is currently unavailable and declined the ring.', 'error')
        })

        socket.on('call-blocked', (data) => {
          notify(data?.message || 'Consultation room is currently locked.', 'error')
          setCallStatus('idle')
        })

        socket.on('vitals-update', (vitals) => {
          if (typeof onVitalsReceived === 'function') onVitalsReceived(vitals)
        })

        socket.on('vitals-saved', (payload) => {
          if (!payload || String(payload.appointmentId || '') !== String(appointmentId)) return
          if (payload.reading && typeof onVitalsReceived === 'function') {
            onVitalsReceived({
              ...payload.reading,
              bpm: payload.reading.heartRate || null
            })
          }
        })

        socket.on('video:rx-issued', (rxPayload) => {
          if (typeof onRxIssued === 'function') onRxIssued(rxPayload)
          notify('Your doctor just signed & issued your digital e-Prescription!', 'success')
        })

        socket.on('chat-message', (msg) => {
          if (String(msg.appointmentId || appointmentId) !== String(appointmentId)) return
          setChatMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(msg._id))) return prev
            return [...prev, msg]
          })
          if (!chatOpenRef.current && msg.sender !== role) {
            setUnreadChatCount((c) => c + 1)
          }
        })

        socket.on('typing', ({ sender, isTyping }) => {
          if (sender !== role) {
            setPeerTyping(Boolean(isTyping))
          }
        })
      } catch (error) {
        console.error('Media / signaling start error:', error)
        setCallStatus('idle')
        notify('Could not access microphone or camera. Please verify browser permissions.', 'error')
      }
    },
    [
      acquireLocalMedia,
      backendUrl,
      authPayload,
      appointmentId,
      role,
      override,
      notify,
      createPeerConnection,
      handleSignalMessage,
      sendExplicitOffer,
      broadcastMediaState,
      startCompositeRecorder,
      stopLocalMediaRecorder,
      onVitalsReceived,
      onRxIssued
    ]
  )

  const endCallInternal = useCallback(
    ({ notifyServer = true, endForAll = true } = {}) => {
      stopLocalMediaRecorder()
      stopMicMeter()

      if (recognitionRef.current) {
        captionsEnabledRef.current = false
        try {
          recognitionRef.current.stop()
        } catch (e) {}
        recognitionRef.current = null
        setCaptionsEnabled(false)
      }

      if (notifyServer && socketRef.current?.connected) {
        socketRef.current.emit('video:leave', { appointmentId, endForAll })
        if (endForAll) {
          socketRef.current.emit('call-ended', appointmentId)
        }
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
        screenStreamRef.current = null
        setIsScreenSharing(false)
      }

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop())
        cameraStreamRef.current = null
      }

      if (peerRef.current) {
        try {
          peerRef.current.close()
        } catch (e) {}
        peerRef.current = null
      }

      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }

      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {})
      }

      setRemoteConnected(false)
      setHandRaised(false)
      setIncomingRecordingRequest(null)
      hasJoinedOnceRef.current = false
      setCallStatus('ended')
    },
    [appointmentId, stopLocalMediaRecorder, stopMicMeter]
  )

  const endCall = useCallback(
    (endForAll = true) => {
      endCallInternal({ notifyServer: true, endForAll })
    },
    [endCallInternal]
  )

  const toggleMute = useCallback(() => {
    const audioTrack = cameraStreamRef.current?.getAudioTracks?.()[0]
    if (!audioTrack) return
    audioTrack.enabled = !audioTrack.enabled
    const muted = !audioTrack.enabled
    setIsMuted(muted)
    broadcastMediaState({ audio: audioTrack.enabled })
  }, [broadcastMediaState])

  const toggleVideo = useCallback(async () => {
    const videoTrack = cameraStreamRef.current?.getVideoTracks?.()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      const off = !videoTrack.enabled
      setIsVideoOff(off)
      broadcastMediaState({ video: videoTrack.enabled })
      return
    }
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(selectedCameraId ? { deviceId: { ideal: selectedCameraId } } : {})
        }
      })
      const newTrack = camStream.getVideoTracks()[0]
      if (!newTrack) return
      if (cameraStreamRef.current) {
        cameraStreamRef.current.addTrack(newTrack)
      } else {
        cameraStreamRef.current = camStream
      }
      if (!screenStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStreamRef.current
      }
      const pc = peerRef.current
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(newTrack)
        else pc.addTrack(newTrack, cameraStreamRef.current)
      }
      setHasCamera(true)
      setIsVideoOff(false)
      broadcastMediaState({ video: true })
    } catch (e) {
      notify('No camera available to enable.', 'error')
    }
  }, [selectedCameraId, broadcastMediaState, notify])

  const switchCamera = useCallback(
    async (deviceId) => {
      setSelectedCameraId(deviceId)
      if (!cameraStreamRef.current) return
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        const nextVideoTrack = nextStream.getVideoTracks()[0]
        if (!nextVideoTrack) return

        const oldTracks = cameraStreamRef.current.getVideoTracks()
        oldTracks.forEach((t) => {
          cameraStreamRef.current.removeTrack(t)
          t.stop()
        })
        nextVideoTrack.enabled = !isVideoOff
        cameraStreamRef.current.addTrack(nextVideoTrack)

        if (!screenStreamRef.current) {
          if (localVideoRef.current) localVideoRef.current.srcObject = cameraStreamRef.current
          const sender = peerRef.current?.getSenders?.().find((s) => s.track?.kind === 'video')
          if (sender) await sender.replaceTrack(nextVideoTrack)
        }
        setHasCamera(true)
        notify('Switched camera device.', 'success')
      } catch (e) {
        notify('Unable to switch to selected camera.', 'error')
      }
    },
    [isVideoOff, notify]
  )

  const switchMicrophone = useCallback(
    async (deviceId) => {
      setSelectedMicId(deviceId)
      if (!cameraStreamRef.current) return
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        const nextAudioTrack = nextStream.getAudioTracks()[0]
        if (!nextAudioTrack) return

        const oldTracks = cameraStreamRef.current.getAudioTracks()
        oldTracks.forEach((t) => {
          cameraStreamRef.current.removeTrack(t)
          t.stop()
        })
        nextAudioTrack.enabled = !isMuted
        cameraStreamRef.current.addTrack(nextAudioTrack)

        const sender = peerRef.current?.getSenders?.().find((s) => s.track?.kind === 'audio')
        if (sender) await sender.replaceTrack(nextAudioTrack)

        startMicMeter(cameraStreamRef.current)
        notify('Switched microphone device.', 'success')
      } catch (e) {
        notify('Unable to switch to selected microphone.', 'error')
      }
    },
    [isMuted, startMicMeter, notify]
  )

  const switchSpeaker = useCallback(
    async (deviceId) => {
      setSelectedSpeakerId(deviceId)
      if (remoteVideoRef.current && typeof remoteVideoRef.current.setSinkId === 'function') {
        try {
          await remoteVideoRef.current.setSinkId(deviceId)
          notify('Switched audio output speaker.', 'success')
        } catch (e) {
          notify('Browser prevented switching speaker output.', 'error')
        }
      }
    },
    [notify]
  )

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return
    screenStreamRef.current.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null
    setIsScreenSharing(false)

    const camTrack = cameraStreamRef.current?.getVideoTracks?.()[0] || null
    const sender = peerRef.current?.getSenders?.().find((s) => s.track?.kind === 'video')
    if (sender && camTrack) {
      await sender.replaceTrack(camTrack).catch(() => {})
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = cameraStreamRef.current
    }
    broadcastMediaState({ screen: false, video: Boolean(camTrack && camTrack.enabled) })
  }, [broadcastMediaState])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare()
      return
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      notify('Screen sharing is not supported on this device/browser.', 'error')
      return
    }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: { ideal: 25, max: 30 } },
        audio: false
      })
      const screenTrack = displayStream.getVideoTracks()[0]
      if (!screenTrack) return
      if ('contentHint' in screenTrack) {
        screenTrack.contentHint = 'detail'
      }

      screenStreamRef.current = displayStream
      setIsScreenSharing(true)

      const pc = peerRef.current
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(screenTrack)
        } else {
          pc.addTrack(screenTrack, displayStream)
        }
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream
      }

      screenTrack.onended = () => {
        stopScreenShare()
      }

      broadcastMediaState({ screen: true, video: true })
      notify('Sharing your screen securely with consultation participant.', 'success')
    } catch (err) {
      if (err?.name !== 'NotAllowedError') {
        notify('Could not start screen sharing.', 'error')
      }
    }
  }, [isScreenSharing, stopScreenShare, broadcastMediaState, notify])

  const toggleDataSaver = useCallback(async () => {
    const next = !isDataSaver
    setIsDataSaver(next)
    if (peerRef.current) {
      await applySenderBandwidthProfile(peerRef.current, next)
    }
    broadcastMediaState({ dataSaver: next })
    notify(
      next
        ? 'Low-Bandwidth Data Saver enabled (optimized for unstable networks).'
        : 'HD Video Mode restored.',
      'info'
    )
  }, [isDataSaver, applySenderBandwidthProfile, broadcastMediaState, notify])

  const toggleCaptions = useCallback(() => {
    if (!SpeechRecognitionImpl) {
      notify('Live Speech-to-Text captions require Chrome or Edge.', 'error')
      return
    }

    if (captionsEnabledRef.current) {
      captionsEnabledRef.current = false
      setCaptionsEnabled(false)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {}
        recognitionRef.current = null
      }
      return
    }

    try {
      const recognition = new SpeechRecognitionImpl()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      const speakerLabel = displayName || (role === 'doctor' ? 'Doctor' : 'Patient')

      recognition.onresult = (event) => {
        let interim = ''
        let finalChunk = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0]?.transcript || ''
          if (event.results[i].isFinal) finalChunk += piece
          else interim += piece
        }

        const textToShow = (finalChunk || interim).trim()
        if (!textToShow) return
        const isFinal = Boolean(finalChunk.trim())

        const captionObj = {
          text: textToShow,
          isFinal,
          speakerRole: role,
          speakerName: speakerLabel,
          timestamp: Date.now()
        }
        setLiveCaption(captionObj)
        if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current)
        captionTimeoutRef.current = setTimeout(() => setLiveCaption(null), 5500)

        socketRef.current?.emit('video:caption', {
          appointmentId,
          text: textToShow,
          isFinal
        })

        if (isFinal) {
          setTranscript((prev) => [
            ...prev.slice(-199),
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              speakerRole: role,
              speakerName: speakerLabel,
              text: finalChunk.trim(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ])
        }
      }

      recognition.onerror = () => {}
      recognition.onend = () => {
        if (
          captionsEnabledRef.current &&
          (callStatusRef.current === 'connected' || callStatusRef.current === 'connecting')
        ) {
          try {
            recognition.start()
          } catch (e) {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition
      captionsEnabledRef.current = true
      setCaptionsEnabled(true)
      notify('Live clinical captions enabled.', 'success')
    } catch (e) {
      notify('Unable to start live speech recognition.', 'error')
    }
  }, [SpeechRecognitionImpl, appointmentId, displayName, role, notify])

  const exportTranscriptText = useCallback(() => {
    if (!transcript.length) return ''
    return transcript.map((t) => `[${t.time}] ${t.speakerName}: ${t.text}`).join('\n')
  }, [transcript])

  const toggleRaiseHand = useCallback(() => {
    const next = !handRaised
    setHandRaised(next)
    broadcastMediaState({ handRaised: next })
    if (next && socketRef.current?.connected) {
      socketRef.current.emit('video:reaction', {
        appointmentId,
        emoji: '✋',
        label: 'Raised Hand'
      })
    }
  }, [handRaised, appointmentId, broadcastMediaState])

  const sendReaction = useCallback(
    (emoji, label = '') => {
      const localItem = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        emoji,
        label,
        by: role,
        name: 'You'
      }
      setFloatingReactions((prev) => [...prev.slice(-8), localItem])
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== localItem.id))
      }, 3600)

      socketRef.current?.emit('video:reaction', {
        appointmentId,
        emoji,
        label
      })
    },
    [appointmentId, role]
  )

  const requestRecording = useCallback(() => {
    if (!remoteConnected || !socketRef.current?.connected) {
      notify('Wait for the other participant to connect before requesting recording consent.', 'error')
      return
    }
    setRecordingState('requesting')
    socketRef.current.emit('video:recording', { appointmentId, action: 'request' })
    notify('Sent recording consent request to participant...', 'info')
  }, [remoteConnected, appointmentId, notify])

  const respondRecordingConsent = useCallback(
    (accepted) => {
      setIncomingRecordingRequest(null)
      if (!socketRef.current?.connected) return
      socketRef.current.emit('video:recording', {
        appointmentId,
        action: accepted ? 'accept' : 'decline'
      })
      if (accepted) {
        setRecordingState('active')
        notify('Recording consent granted — session is being recorded by requester.', 'info')
      }
    },
    [appointmentId, notify]
  )

  const stopRecording = useCallback(() => {
    stopLocalMediaRecorder()
    socketRef.current?.emit('video:recording', { appointmentId, action: 'stop' })
  }, [appointmentId, stopLocalMediaRecorder])

  const captureSnapshot = useCallback(
    (subjectLabel = 'Consultation') => {
      const vid = remoteVideoRef.current
      if (!vid || vid.readyState < 2 || !vid.videoWidth) {
        notify('Remote video stream is not active yet to capture a snapshot.', 'error')
        return null
      }
      const canvas = document.createElement('canvas')
      canvas.width = vid.videoWidth
      canvas.height = vid.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)

      // 1. In-Pixel Dynamic Forensic Watermark (prevents unauthorized redistribution / leaking)
      ctx.save()
      ctx.rotate(-22 * Math.PI / 180)
      ctx.font = 'bold 14px monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
      ctx.shadowBlur = 3
      const watermarkTag = `CONFIDENTIAL PHI • ${subjectLabel} • APT-${appointmentId.slice(-6).toUpperCase()} • ${new Date().toISOString()}`
      for (let x = -canvas.width; x < canvas.width * 2; x += 360) {
        for (let y = -canvas.height; y < canvas.height * 2; y += 120) {
          ctx.fillText(watermarkTag, x, y)
        }
      }
      ctx.restore()

      // 2. Clinical compliance footer bar
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'
      ctx.fillRect(0, canvas.height - 38, canvas.width, 38)
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 13px sans-serif'
      ctx.fillText(
        `🔒 VitalSync Clinical Exam Frame • ${subjectLabel} • ${new Date().toLocaleString()} [PHI PROTECTED • RAW EXPORT RESTRICTED]`,
        14,
        canvas.height - 14
      )

      const dataUrl = canvas.toDataURL('image/png')
      const snap = {
        id: `${Date.now()}`,
        dataUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        subjectLabel
      }
      setSnapshots((prev) => [snap, ...prev.slice(0, 9)])

      // Raw unencrypted local downloads strictly eliminated for HIPAA/GDPR clinical compliance
      notify('Clinical exam frame secured with in-pixel forensic watermark (raw downloads restricted for PHI privacy).', 'success')
      return snap
    },
    [appointmentId, notify]
  )

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await stageContainerRef.current?.requestFullscreen?.()
      } else {
        await document.exitFullscreen()
      }
    } catch (e) {
      notify('Fullscreen mode is blocked by browser permissions.', 'error')
    }
  }, [notify])

  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
        setIsPiP(false)
      } else if (remoteVideoRef.current && document.pictureInPictureEnabled) {
        await remoteVideoRef.current.requestPictureInPicture()
        setIsPiP(true)
      } else {
        notify('Picture-in-Picture requires an active remote video stream.', 'info')
      }
    } catch (e) {
      notify('Unable to enter Picture-in-Picture right now.', 'info')
    }
  }, [notify])

  const setChatOpenState = useCallback(
    (isOpen) => {
      chatOpenRef.current = Boolean(isOpen)
      if (isOpen) {
        setUnreadChatCount(0)
        socketRef.current?.emit('mark-messages-read', {
          roomId: appointmentId,
          readerRole: role
        })
      }
    },
    [appointmentId, role]
  )

  const sendChatMessage = useCallback(
    async (text) => {
      const clean = String(text || '').trim()
      if (!clean) return false
      const senderLabel = displayName || (role === 'doctor' ? 'Doctor' : 'Patient')

      if (socketRef.current?.connected) {
        socketRef.current.emit('chat-message', {
          roomId: appointmentId,
          message: {
            sender: role,
            senderName: senderLabel,
            text: clean,
            timestamp: new Date().toISOString()
          }
        })
        return true
      }

      try {
        const endpoint =
          role === 'doctor'
            ? `${backendUrl}/api/chat/doctor/send-message`
            : `${backendUrl}/api/chat/send-message`
        const headers = role === 'doctor' ? { dToken: authPayload?.dToken } : { token: authPayload?.token }
        const { data } = await axios.post(
          endpoint,
          { appointmentId, sender: role, senderName: senderLabel, text: clean },
          { headers }
        )
        if (data.success && data.message) {
          setChatMessages((prev) => [...prev, data.message])
          return true
        }
      } catch (e) {
        notify('Failed to send chat message.', 'error')
      }
      return false
    },
    [appointmentId, backendUrl, authPayload, displayName, role, notify]
  )

  const emitChatTyping = useCallback(() => {
    if (!socketRef.current?.connected) return
    socketRef.current.emit('typing', {
      roomId: appointmentId,
      sender: role,
      senderName: displayName || (role === 'doctor' ? 'Doctor' : 'Patient'),
      isTyping: true
    })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', {
        roomId: appointmentId,
        sender: role,
        isTyping: false
      })
    }, 1600)
  }, [appointmentId, role, displayName])

  const emitVitalsUpdate = useCallback(
    (vitals) => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('video:vitals', { appointmentId, vitals })
    },
    [appointmentId]
  )

  const emitRxIssued = useCallback(
    (diagnosisText = '') => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit('video:rx-issued', { appointmentId, diagnosis: diagnosisText })
    },
    [appointmentId]
  )

  // Browser Tab Switch Survival (`visibilitychange` wake-up + Automatic OS Picture-in-Picture)
  useEffect(() => {
    const onVisibilityChange = () => {
      const st = callStatusRef.current
      if (st !== 'connecting' && st !== 'connected' && st !== 'reconnecting') return

      if (document.visibilityState === 'visible') {
        remoteVideoRef.current?.play?.().catch(() => {})
        localVideoRef.current?.play?.().catch(() => {})
        if (socketRef.current && !socketRef.current.connected) {
          socketRef.current.connect()
        }
        if (peerRef.current?.connectionState === 'failed') {
          triggerIceRestart()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [triggerIceRestart])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession?.setActionHandler) return
    if (callStatus !== 'connected') return
    try {
      navigator.mediaSession.setActionHandler('enterpictureinpicture', () => {
        if (remoteVideoRef.current && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
          remoteVideoRef.current.requestPictureInPicture().catch(() => {})
          setIsPiP(true)
        }
      })
    } catch (e) {}
    return () => {
      try {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', null)
      } catch (e) {}
    }
  }, [callStatus])

  const stopLocalMediaRecorderRef = useRef(stopLocalMediaRecorder)
  const stopMicMeterRef = useRef(stopMicMeter)
  stopLocalMediaRecorderRef.current = stopLocalMediaRecorder
  stopMicMeterRef.current = stopMicMeter

  useEffect(() => {
    return () => {
      stopLocalMediaRecorderRef.current?.()
      stopMicMeterRef.current?.()
      if (recognitionRef.current) {
        captionsEnabledRef.current = false
        try {
          recognitionRef.current.stop()
        } catch (e) {}
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (peerRef.current) {
        try {
          peerRef.current.close()
        } catch (e) {}
      }
      if (socketRef.current) {
        socketRef.current.emit('video:leave', { appointmentId: appointmentIdRef.current, endForAll: false })
        socketRef.current.disconnect()
      }
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current)
    }
  }, [])

  return {
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
    refreshDevices,
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
    emitVitalsUpdate,
    emitRxIssued
  }
}
