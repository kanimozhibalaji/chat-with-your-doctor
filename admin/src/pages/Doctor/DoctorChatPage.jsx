import React, { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  Search,
  Send,
  Video,
  FileText,
  Lock,
  Paperclip,
  Check,
  CheckCheck,
  Reply,
  Smile,
  X,
  MessageSquare,
  ArrowLeft,
  ArrowDown,
  Sparkles,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Pill,
  CheckCircle2
} from 'lucide-react'

const REACTION_EMOJIS = ['👍', '❤️', '🙏', '✅']

const DOCTOR_QUICK_REPLIES = [
  'Hello! Please share your main symptoms before our call.',
  'I am waiting in the video consultation room — please join now.',
  'I have issued your signed digital prescription. Please review it.',
  'Please upload a clear photo or PDF of your recent lab report.',
  'Take your prescribed medicines after meals and stay well hydrated.'
]

const DoctorChatPage = () => {
  const { appointmentId: routeAppointmentId } = useParams()
  const navigate = useNavigate()
  const { backendUrl } = useContext(AppContext)
  const {
    dToken,
    profileData,
    socket,
    isPatientOnline,
    fetchUnreadChatCount
  } = useContext(DoctorContext)

  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(routeAppointmentId || '')
  const [threadSearch, setThreadSearch] = useState('')
  const [threadFilter, setThreadFilter] = useState('all') // 'all' | 'unread' | 'active'

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [activeReactionPicker, setActiveReactionPicker] = useState(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [msgSearch, setMsgSearch] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)

  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const prevMsgCountRef = useRef(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (routeAppointmentId) {
      setSelectedAppointmentId(routeAppointmentId)
    }
  }, [routeAppointmentId])

  const scrollToBottom = (behavior = 'auto') => {
    const el = messagesContainerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      if (!messagesContainerRef.current) return
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      })
    })
  }

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distanceFromBottom > 120)
  }

  useEffect(() => {
    if (!messagesLoading) {
      scrollToBottom('auto')
      prevMsgCountRef.current = messages.length
    }
  }, [selectedAppointmentId, messagesLoading])

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      scrollToBottom('smooth')
    }
    prevMsgCountRef.current = messages.length
  }, [messages.length])

  useEffect(() => {
    if (otherTyping && !showScrollDown) {
      scrollToBottom('smooth')
    }
  }, [otherTyping, showScrollDown])

  const fetchInbox = async (silent = false) => {
    if (!dToken) return
    if (!silent) setThreadsLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/chat/doctor/inbox`, {
        headers: { dToken }
      })
      if (data.success) {
        const list = data.threads || []
        setThreads(list)
        if (!selectedAppointmentId && !routeAppointmentId && list.length > 0 && window.innerWidth >= 1024) {
          setSelectedAppointmentId(list[0].appointmentId)
        }
      }
    } catch (error) {
      console.error('Doctor inbox error:', error)
    } finally {
      if (!silent) setThreadsLoading(false)
    }
  }

  useEffect(() => {
    if (dToken) fetchInbox()
  }, [dToken])

  useEffect(() => {
    const handleThreadUpdate = () => fetchInbox(true)
    window.addEventListener('vitalsync:doctor-chat-updated', handleThreadUpdate)
    window.addEventListener('prescripto:doctor-chat-updated', handleThreadUpdate)
    window.addEventListener('vitalsync:doctor-appointment-updated', handleThreadUpdate)
    window.addEventListener('prescripto:doctor-appointment-updated', handleThreadUpdate)
    return () => {
      window.removeEventListener('vitalsync:doctor-chat-updated', handleThreadUpdate)
      window.removeEventListener('prescripto:doctor-chat-updated', handleThreadUpdate)
      window.removeEventListener('vitalsync:doctor-appointment-updated', handleThreadUpdate)
      window.removeEventListener('prescripto:doctor-appointment-updated', handleThreadUpdate)
    }
  }, [dToken])

  useEffect(() => {
    if (!selectedAppointmentId || !dToken) return

    let isMounted = true

    const loadConversation = async () => {
      setMessagesLoading(true)
      setOtherTyping(false)
      setReplyTo(null)

      try {
        await axios.post(
          `${backendUrl}/api/chat/doctor/get-or-create`,
          { appointmentId: selectedAppointmentId },
          { headers: { dtoken: dToken, dToken } }
        )
        const { data } = await axios.post(
          `${backendUrl}/api/chat/doctor/messages`,
          { appointmentId: selectedAppointmentId },
          { headers: { dtoken: dToken, dToken } }
        )
        if (isMounted && data.success) {
          setMessages(data.messages || [])
        }
      } catch (err) {
        console.error('Load doctor chat error:', err)
      } finally {
        if (isMounted) setMessagesLoading(false)
      }
    }

    loadConversation()

    if (socket) {
      socket.emit('join-room', selectedAppointmentId)
      socket.emit('mark-messages-read', { roomId: selectedAppointmentId, readerRole: 'doctor' })
      fetchUnreadChatCount()
      setThreads((prev) =>
        prev.map((t) =>
          t.appointmentId === selectedAppointmentId ? { ...t, unreadCount: 0 } : t
        )
      )
    }

    return () => {
      isMounted = false
      if (socket && selectedAppointmentId) {
        socket.emit('leave-room', selectedAppointmentId)
      }
    }
  }, [selectedAppointmentId, dToken, backendUrl, socket])

  useEffect(() => {
    if (!socket || !selectedAppointmentId) return

    const handleIncomingMessage = (msg) => {
      if (msg.appointmentId && String(msg.appointmentId) !== String(selectedAppointmentId)) {
        return
      }

      setMessages((prev) => {
        if (msg._id && prev.some((m) => String(m._id) === String(msg._id))) {
          return prev
        }
        if (msg.clientTempId) {
          const idx = prev.findIndex((m) => m.clientTempId === msg.clientTempId)
          if (idx > -1) {
            const copy = [...prev]
            copy[idx] = msg
            return copy
          }
        }
        return [...prev, msg]
      })

      if (msg.sender !== 'doctor') {
        setOtherTyping(false)
        socket.emit('mark-messages-read', { roomId: selectedAppointmentId, readerRole: 'doctor' })
      }
    }

    const handleTyping = ({ roomId, sender, isTyping }) => {
      if (String(roomId) === String(selectedAppointmentId) && sender === 'user') {
        setOtherTyping(Boolean(isTyping))
      }
    }

    const handleMessagesRead = ({ roomId, readerRole }) => {
      if (String(roomId) === String(selectedAppointmentId) && readerRole === 'user') {
        setMessages((prev) =>
          prev.map((m) => {
            const readBy = m.readBy || []
            return readBy.includes('user') ? m : { ...m, readBy: [...readBy, 'user'] }
          })
        )
      }
    }

    const handleReactionUpdated = ({ roomId, messageId, reactions }) => {
      if (String(roomId) === String(selectedAppointmentId)) {
        setMessages((prev) =>
          prev.map((m) => (String(m._id) === String(messageId) ? { ...m, reactions } : m))
        )
      }
    }

    socket.on('chat-message', handleIncomingMessage)
    socket.on('typing', handleTyping)
    socket.on('messages-read', handleMessagesRead)
    socket.on('message-reaction-updated', handleReactionUpdated)

    return () => {
      socket.off('chat-message', handleIncomingMessage)
      socket.off('typing', handleTyping)
      socket.off('messages-read', handleMessagesRead)
      socket.off('message-reaction-updated', handleReactionUpdated)
    }
  }, [socket, selectedAppointmentId])

  const activeThread = useMemo(
    () => threads.find((t) => String(t.appointmentId) === String(selectedAppointmentId)),
    [threads, selectedAppointmentId]
  )

  const emitTypingState = (isTyping) => {
    if (!socket || !selectedAppointmentId) return
    socket.emit('typing', {
      roomId: selectedAppointmentId,
      sender: 'doctor',
      senderName: profileData?.name || 'Doctor',
      isTyping
    })
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    emitTypingState(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      emitTypingState(false)
    }, 1800)
  }

  const sendPayload = async ({ text = '', attachmentUrl = '', attachmentType = '', attachmentName = '' }) => {
    if ((!text.trim() && !attachmentUrl) || !selectedAppointmentId) return

    const clientTempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const messageObj = {
      clientTempId,
      sender: 'doctor',
      senderName: profileData?.name || 'Doctor',
      text: text.trim(),
      attachmentUrl,
      attachmentType,
      attachmentName,
      replyTo: replyTo
        ? {
            messageId: String(replyTo._id || ''),
            senderName: replyTo.sender === 'doctor' ? 'You' : activeThread?.patientName || 'Patient',
            text: replyTo.text || 'Attachment'
          }
        : null,
      reactions: [],
      readBy: ['doctor'],
      timestamp: new Date().toISOString()
    }

    setMessages((prev) => [...prev, messageObj])
    setInput('')
    setReplyTo(null)
    emitTypingState(false)

    if (socket && socket.connected) {
      socket.emit('chat-message', {
        roomId: selectedAppointmentId,
        message: messageObj
      })
    } else {
      try {
        const { data } = await axios.post(
          `${backendUrl}/api/chat/doctor/send-message`,
          { appointmentId: selectedAppointmentId, ...messageObj },
          { headers: { dtoken: dToken, dToken } }
        )
        if (data.success && data.message) {
          setMessages((prev) =>
            prev.map((m) => (m.clientTempId === clientTempId ? data.message : m))
          )
        }
      } catch (e) {
        toast.error('Failed to send message')
      }
    }

    fetchInbox(true)
  }

  const handleSendText = () => {
    if (!input.trim()) return
    sendPayload({ text: input })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedAppointmentId) return
    e.target.value = ''

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('attachment', file)

      const { data } = await axios.post(`${backendUrl}/api/chat/doctor/upload-attachment`, formData, {
        headers: { dtoken: dToken, dToken }
      })

      if (data.success) {
        await sendPayload({
          text: input.trim(),
          attachmentUrl: data.attachmentUrl,
          attachmentType: data.attachmentType,
          attachmentName: data.attachmentName
        })
      } else {
        toast.error(data.message || 'Could not upload attachment')
      }
    } catch (err) {
      toast.error('Failed to upload attachment')
    } finally {
      setUploading(false)
    }
  }

  const toggleReaction = (messageId, emoji) => {
    if (!socket || !selectedAppointmentId || !messageId) return
    socket.emit('message-reaction', {
      roomId: selectedAppointmentId,
      messageId,
      sender: 'doctor',
      emoji
    })
    setActiveReactionPicker(null)
  }

  const selectThread = (aptId) => {
    setSelectedAppointmentId(aptId)
    navigate(`/doctor-chat/${aptId}`, { replace: true })
  }

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (threadFilter === 'unread' && (!t.unreadCount || t.unreadCount === 0)) return false
      if (threadFilter === 'active' && (t.cancelled || t.isCompleted)) return false
      if (threadSearch.trim()) {
        const q = threadSearch.toLowerCase()
        return (
          t.patientName?.toLowerCase().includes(q) ||
          t.lastMessage?.text?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [threads, threadFilter, threadSearch])

  const visibleMessages = useMemo(() => {
    if (!msgSearch.trim()) return messages
    const q = msgSearch.toLowerCase()
    return messages.filter(
      (m) =>
        m.text?.toLowerCase().includes(q) ||
        m.attachmentName?.toLowerCase().includes(q)
    )
  }, [messages, msgSearch])

  const formatTimeShort = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const diffMs = Date.now() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const formatBubbleTime = (timestamp) => {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateSeparator = (timestamp) => {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const patientName = activeThread?.patientName || 'Patient'
  const patientImage = activeThread?.patientImage || ''
  const patientOnline = activeThread?.patientId ? isPatientOnline(activeThread.patientId) : false
  const allergies = activeThread?.patientAllergies || []
  const medications = activeThread?.patientMedications || []

  return (
    <div className='w-full max-w-7xl m-2 sm:m-4 min-w-0'>
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className='fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4'
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className='absolute top-5 right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer'
          >
            <X className='w-6 h-6' />
          </button>
          <img
            src={lightboxImage}
            alt='Attachment preview'
            className='max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain'
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Split-Pane Clinical Messenger */}
      <div className='bg-white rounded-3xl border border-slate-200 shadow-sm overflow-clip grid grid-cols-1 lg:grid-cols-12 grid-rows-[minmax(0,1fr)] h-[calc(100dvh-96px)] min-h-[480px] max-h-[860px]'>
        
        {/* LEFT PANE: Patient Threads List */}
        <div
          className={`lg:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50 h-full min-h-0 overflow-hidden ${
            selectedAppointmentId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className='p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3 shrink-0'>
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-lg font-bold text-slate-900 tracking-tight'>Patient messages</h1>
                <p className='text-xs text-slate-500'>Real-time clinical chat & consultations</p>
              </div>
              <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold border border-sky-200'>
                <Lock className='w-3 h-3' /> Encrypted
              </span>
            </div>

            <div className='relative'>
              <Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' />
              <input
                type='text'
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder='Search patient name or message...'
                className='w-full pl-9 pr-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 transition-all'
              />
            </div>

            <div className='flex items-center gap-1.5'>
              {[
                { id: 'all', label: 'All patients' },
                { id: 'unread', label: 'Unread' },
                { id: 'active', label: 'Active visits' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setThreadFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    threadFilter === tab.id
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className='flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100'>
            {threadsLoading ? (
              <div className='py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2'>
                <Loader2 className='w-5 h-5 animate-spin text-sky-600' />
                <span>Loading patient conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className='py-16 px-6 text-center space-y-2'>
                <MessageSquare className='w-8 h-8 text-slate-300 mx-auto' />
                <p className='text-sm font-bold text-slate-800'>No patient threads found</p>
                <p className='text-xs text-slate-500'>
                  Patient conversations appear here automatically when appointments are booked.
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = String(thread.appointmentId) === String(selectedAppointmentId)
                const online = isPatientOnline(thread.patientId)
                return (
                  <div
                    key={thread.appointmentId}
                    onClick={() => selectThread(thread.appointmentId)}
                    className={`p-3.5 sm:p-4 flex items-start gap-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50/90 border-l-4 border-l-sky-600'
                        : 'bg-white hover:bg-slate-50/90'
                    }`}
                  >
                    <div className='relative shrink-0'>
                      <img
                        src={thread.patientImage}
                        alt={thread.patientName}
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(thread.patientName || 'Patient')}&background=0284c7&color=fff&bold=true`
                        }}
                        className='w-11 h-11 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          online ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={online ? 'Patient online' : 'Offline'}
                      />
                    </div>

                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-1'>
                        <h3 className={`text-xs sm:text-sm truncate ${thread.unreadCount > 0 ? 'font-bold text-slate-950' : 'font-semibold text-slate-900'}`}>
                          {thread.patientName}
                        </h3>
                        <span className={`text-[11px] tabular-nums shrink-0 ${thread.unreadCount > 0 ? 'text-sky-600 font-bold' : 'text-slate-400'}`}>
                          {thread.lastMessage
                            ? formatTimeShort(thread.lastMessage.timestamp)
                            : thread.slotDate?.replace(/_/g, '/')}
                        </span>
                      </div>

                      <div className='flex items-center gap-1.5 mt-0.5'>
                        <span className='text-[10px] text-slate-500 font-medium truncate'>
                          {thread.slotDate?.replace(/_/g, '/')} • {thread.slotTime}
                        </span>
                        {thread.patientAllergies?.length > 0 && (
                          <span className='px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold'>
                            {thread.patientAllergies.length} allergy
                          </span>
                        )}
                      </div>

                      <div className='flex items-center justify-between gap-2 mt-1.5'>
                        <p className={`text-xs truncate ${thread.unreadCount > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                          {thread.lastMessage ? (
                            <>
                              {thread.lastMessage.sender === 'doctor' && (
                                <span className='text-slate-400 font-normal'>You: </span>
                              )}
                              {thread.lastMessage.text}
                            </>
                          ) : (
                            <span className='text-sky-600 font-medium italic'>Send a message to patient →</span>
                          )}
                        </p>

                        {thread.unreadCount > 0 && (
                          <span className='min-w-[18px] h-4.5 px-1.5 rounded-full bg-sky-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center shrink-0'>
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Active Clinical Conversation */}
        <div
          className={`lg:col-span-8 flex flex-col bg-white h-full min-h-0 overflow-hidden relative ${
            selectedAppointmentId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedAppointmentId ? (
            <div className='flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40'>
              <div className='w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mb-3.5 shadow-2xs'>
                <MessageSquare className='w-7 h-7' />
              </div>
              <h2 className='text-base sm:text-lg font-bold text-slate-900'>Select a patient conversation</h2>
              <p className='text-xs text-slate-500 max-w-sm mt-1 leading-relaxed'>
                Choose any patient from the left panel to review messages, inspect shared lab reports, launch video consultations, or issue prescriptions.
              </p>
            </div>
          ) : (
            <>
              {/* Clinical Chat Header */}
              <div className='px-4 sm:px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0'>
                <div className='flex items-center gap-3 min-w-0'>
                  <button
                    onClick={() => {
                      setSelectedAppointmentId('')
                      navigate('/doctor-chat')
                    }}
                    className='lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                  >
                    <ArrowLeft className='w-4 h-4' />
                  </button>

                  <div className='relative shrink-0'>
                    <img
                      src={patientImage}
                      alt={patientName}
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(patientName || 'Patient')}&background=0284c7&color=fff&bold=true`
                      }}
                      className='w-10 h-10 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        patientOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h2 className='text-sm sm:text-base font-bold text-slate-900 truncate'>
                        {patientName}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          patientOnline
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${patientOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {patientOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className='text-xs text-slate-500 truncate'>
                      {otherTyping ? (
                        <span className='text-sky-600 font-semibold animate-pulse'>
                          {patientName} is typing...
                        </span>
                      ) : (
                        <>
                          Slot: {activeThread?.slotDate?.replace(/_/g, '/')} at {activeThread?.slotTime}
                          {activeThread?.patientGender && ` • ${activeThread.patientGender}`}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Clinical Actions */}
                <div className='flex items-center gap-2 shrink-0'>
                  <button
                    onClick={() => setShowMsgSearch(!showMsgSearch)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      showMsgSearch
                        ? 'bg-sky-50 border-sky-200 text-sky-600'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    title='Search messages'
                  >
                    <Search className='w-4 h-4' />
                  </button>

                  {!activeThread?.cancelled && (
                    <button
                      onClick={() => navigate(`/doctor-video-call/${selectedAppointmentId}`)}
                      className='px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap'
                    >
                      <Video className='w-3.5 h-3.5' />
                      <span className='hidden sm:inline'>Start call</span>
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/doctor-prescription/${selectedAppointmentId}`)}
                    className='px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap'
                  >
                    <FileText className='w-3.5 h-3.5' />
                    <span className='hidden sm:inline'>Write / edit Rx</span>
                  </button>
                </div>
              </div>

              {/* Clinical Allergy & Medication Strip */}
              {(allergies.length > 0 || medications.length > 0) && (
                <div className='px-4 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs shrink-0'>
                  {allergies.length > 0 && (
                    <div className='flex items-center gap-1.5 text-rose-800 font-semibold'>
                      <AlertTriangle className='w-3.5 h-3.5 text-rose-600 shrink-0' />
                      <span>Allergies:</span>
                      <span className='font-bold'>{allergies.join(', ')}</span>
                    </div>
                  )}
                  {medications.length > 0 && (
                    <div className='flex items-center gap-1.5 text-slate-700 font-medium'>
                      <Pill className='w-3.5 h-3.5 text-sky-600 shrink-0' />
                      <span>Current meds:</span>
                      <span className='font-semibold'>{medications.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Search Bar */}
              {showMsgSearch && (
                <div className='px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0'>
                  <Search className='w-3.5 h-3.5 text-slate-400' />
                  <input
                    type='text'
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder='Filter messages in this thread...'
                    className='flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none'
                    autoFocus
                  />
                  {msgSearch && (
                    <button
                      onClick={() => setMsgSearch('')}
                      className='text-xs text-slate-400 hover:text-slate-600 cursor-pointer'
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Messages Stream */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className='relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-4 bg-[#F8FAFC]'
              >
                {messagesLoading ? (
                  <div className='py-20 text-center text-xs text-slate-400 flex flex-col items-center gap-2'>
                    <Loader2 className='w-5 h-5 animate-spin text-sky-600' />
                    <span>Loading messages...</span>
                  </div>
                ) : visibleMessages.length === 0 ? (
                  <div className='py-6 sm:py-10 text-center space-y-4'>
                    <div className='w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto text-sky-600'>
                      <MessageSquare className='w-6 h-6' />
                    </div>
                    <div className='space-y-1'>
                      <h4 className='font-bold text-slate-900 text-sm'>
                        Message {patientName}
                      </h4>
                      <p className='text-xs text-slate-500 max-w-sm mx-auto'>
                        Send pre-consultation instructions, request lab reports, or use a quick clinical template below.
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto pt-2'>
                      {DOCTOR_QUICK_REPLIES.slice(0, 3).map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendPayload({ text: prompt })}
                          className='px-3 py-1.5 rounded-full bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-200 text-xs font-medium transition-all shadow-2xs cursor-pointer'
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  visibleMessages.map((msg, index) => {
                    const isDoctor = msg.sender === 'doctor'
                    const prevMsg = visibleMessages[index - 1]
                    const showDateSeparator =
                      !prevMsg ||
                      new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString()
                    const isReadByPatient = (msg.readBy || []).includes('user')

                    return (
                      <React.Fragment key={msg._id || msg.clientTempId || index}>
                        {showDateSeparator && (
                          <div className='flex items-center justify-center my-3'>
                            <span className='px-3 py-1 rounded-full bg-slate-200/75 text-slate-600 text-[10px] font-bold uppercase tracking-wider'>
                              {formatDateSeparator(msg.timestamp)}
                            </span>
                          </div>
                        )}

                        <div className={`group flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-end gap-2 max-w-[82%] sm:max-w-[72%] ${isDoctor ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div
                              className={`relative px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                                isDoctor
                                  ? 'bg-sky-600 text-white rounded-br-xs'
                                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                              }`}
                            >
                              {msg.replyTo && (msg.replyTo.text || msg.replyTo.senderName) && (
                                <div
                                  className={`mb-2 px-3 py-1.5 rounded-xl border-l-2 text-xs ${
                                    isDoctor
                                      ? 'bg-sky-700/70 border-sky-200 text-sky-100'
                                      : 'bg-slate-100 border-sky-500 text-slate-600'
                                  }`}
                                >
                                  <p className='font-bold text-[10px] opacity-90'>{msg.replyTo.senderName}</p>
                                  <p className='truncate text-[11px] opacity-85'>{msg.replyTo.text}</p>
                                </div>
                              )}

                              {msg.attachmentUrl && msg.attachmentType === 'image' && (
                                <div className='mb-2'>
                                  <img
                                    src={msg.attachmentUrl}
                                    alt={msg.attachmentName || 'Shared image'}
                                    onClick={() => setLightboxImage(msg.attachmentUrl)}
                                    className='max-h-60 rounded-xl object-cover cursor-zoom-in border border-white/20'
                                  />
                                </div>
                              )}

                              {msg.attachmentUrl && msg.attachmentType === 'prescription' && (
                                <div
                                  onClick={() => navigate(`/doctor-prescription/${selectedAppointmentId}`)}
                                  className={`mb-2 p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer ${
                                    isDoctor
                                      ? 'bg-sky-700/70 border-sky-300/40 text-white'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                                  }`}
                                >
                                  <div className='flex items-center gap-2.5'>
                                    <div className='w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0'>
                                      <FileText className='w-4 h-4' />
                                    </div>
                                    <div>
                                      <p className='text-xs font-bold'>{msg.attachmentName || 'Digital Prescription'}</p>
                                      <p className='text-[10px] opacity-80'>Click to view or update prescription</p>
                                    </div>
                                  </div>
                                  <ExternalLink className='w-4 h-4 shrink-0 opacity-75' />
                                </div>
                              )}

                              {msg.attachmentUrl && msg.attachmentType === 'document' && (
                                <a
                                  href={msg.attachmentUrl}
                                  target='_blank'
                                  rel='noreferrer'
                                  className={`mb-2 p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                                    isDoctor
                                      ? 'bg-sky-700/60 border-sky-400/40 text-white'
                                      : 'bg-slate-100 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <FileText className='w-4 h-4 shrink-0' />
                                  <span className='truncate'>{msg.attachmentName || 'Open Attachment'}</span>
                                  <ExternalLink className='w-3.5 h-3.5 shrink-0 ml-auto' />
                                </a>
                              )}

                              {msg.text && <p className='whitespace-pre-wrap break-words'>{msg.text}</p>}

                              <div
                                className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                                  isDoctor ? 'text-sky-100' : 'text-slate-400'
                                }`}
                              >
                                <span>{formatBubbleTime(msg.timestamp)}</span>
                                {isDoctor && (
                                  isReadByPatient ? (
                                    <CheckCheck className='w-3.5 h-3.5 text-emerald-300' title='Seen by Patient' />
                                  ) : (
                                    <Check className='w-3.5 h-3.5 text-sky-200' title='Sent' />
                                  )
                                )}
                              </div>

                              {msg.reactions && msg.reactions.length > 0 && (
                                <div
                                  className={`absolute -bottom-2.5 ${
                                    isDoctor ? 'right-2' : 'left-2'
                                  } flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white border border-slate-200 shadow-xs text-[11px]`}
                                >
                                  {msg.reactions.map((r, ri) => (
                                    <span key={ri}>{r.emoji}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Hover Actions */}
                            <div className='opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 relative'>
                              <button
                                onClick={() => setReplyTo(msg)}
                                className='p-1.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-sky-600 shadow-2xs cursor-pointer'
                                title='Reply'
                              >
                                <Reply className='w-3 h-3' />
                              </button>
                              {msg._id && (
                                <div className='relative'>
                                  <button
                                    onClick={() =>
                                      setActiveReactionPicker(
                                        activeReactionPicker === msg._id ? null : msg._id
                                      )
                                    }
                                    className='p-1.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-amber-500 shadow-2xs cursor-pointer'
                                    title='React'
                                  >
                                    <Smile className='w-3 h-3' />
                                  </button>
                                  {activeReactionPicker === msg._id && (
                                    <div className='absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-full shadow-lg px-2 py-1 flex items-center gap-1 z-20'>
                                      {REACTION_EMOJIS.map((em) => (
                                        <button
                                          key={em}
                                          onClick={() => toggleReaction(msg._id, em)}
                                          className='hover:scale-125 transition-transform text-xs px-1 cursor-pointer'
                                        >
                                          {em}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })
                )}

                {otherTyping && (
                  <div className='flex items-start gap-2'>
                    <div className='bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs flex items-center gap-1.5'>
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '0ms' }} />
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '150ms' }} />
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {showScrollDown && (
                  <div className='sticky bottom-2 flex justify-end pointer-events-none z-10'>
                    <button
                      type='button'
                      onClick={() => scrollToBottom('smooth')}
                      className='pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer'
                    >
                      <ArrowDown className='w-3.5 h-3.5' />
                      <span>Latest</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Clinical Quick Replies Strip */}
              <div className='px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0'>
                <Sparkles className='w-3.5 h-3.5 text-sky-600 shrink-0 mr-1' />
                {DOCTOR_QUICK_REPLIES.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(chip)}
                    className='whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[11px] font-medium transition-colors cursor-pointer'
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {replyTo && (
                <div className='px-4 py-2 bg-sky-50/90 border-t border-sky-200/80 flex items-center justify-between gap-2 text-xs shrink-0'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <Reply className='w-3.5 h-3.5 text-sky-600 shrink-0' />
                    <div className='truncate'>
                      <span className='font-bold text-sky-900'>
                        Replying to {replyTo.sender === 'doctor' ? 'yourself' : patientName}:
                      </span>{' '}
                      <span className='text-slate-600'>{replyTo.text || 'Attachment'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className='p-1 rounded-lg hover:bg-sky-100 text-slate-500 cursor-pointer'
                  >
                    <X className='w-3.5 h-3.5' />
                  </button>
                </div>
              )}

              {/* Composer Bar */}
              <div className='p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0'>
                <div className='flex items-center gap-2'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*,.pdf'
                    onChange={handleFileUpload}
                    className='hidden'
                  />
                  <button
                    type='button'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className='p-2.5 rounded-xl border border-slate-200 hover:border-sky-300 text-slate-600 hover:text-sky-600 hover:bg-sky-50/50 transition-all cursor-pointer disabled:opacity-50'
                    title='Share image or clinical attachment'
                  >
                    {uploading ? (
                      <Loader2 className='w-4 h-4 animate-spin text-sky-600' />
                    ) : (
                      <Paperclip className='w-4 h-4' />
                    )}
                  </button>

                  <input
                    type='text'
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendText()
                      }
                    }}
                    placeholder={`Message ${patientName}...`}
                    className='flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all'
                  />

                  <button
                    type='button'
                    onClick={handleSendText}
                    disabled={!input.trim()}
                    className='px-4 sm:px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer'
                  >
                    <span>Send</span>
                    <Send className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DoctorChatPage
