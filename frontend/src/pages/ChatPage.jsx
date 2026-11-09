import React, { useState, useRef, useEffect, useContext, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  Search,
  Send,
  Video,
  FileText,
  Lock,
  Paperclip,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Reply,
  Smile,
  X,
  Calendar,
  Clock,
  MessageSquare,
  ArrowLeft,
  ArrowDown,
  Sparkles,
  ExternalLink,
  Loader2,
  ShieldCheck
} from 'lucide-react'

const REACTION_EMOJIS = ['👍', '❤️', '🙏', '✅']

const QUICK_PROMPTS = [
  'Hello Doctor, I have a question about my symptoms.',
  'I am ready to join the video consultation.',
  'Could you clarify how to take the prescribed medicine?',
  'Sharing a photo / medical report for your review.'
]

const ChatPage = () => {
  const { appointmentId: routeAppointmentId } = useParams()
  const navigate = useNavigate()
  const {
    backendUrl,
    token,
    userData,
    socket,
    isDoctorOnline,
    fetchUnreadChatCount
  } = useContext(AppContext)

  const [threads, setThreads] = useState([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(routeAppointmentId || '')
  const [threadSearch, setThreadSearch] = useState('')
  const [threadFilter, setThreadFilter] = useState('all') // 'all' | 'unread' | 'active'

  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [appointment, setAppointment] = useState(null)

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

  // Keep selectedAppointmentId synced with URL param
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

  // Fetch all inbox threads
  const fetchInbox = async (silent = false) => {
    if (!token) return
    if (!silent) setThreadsLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/chat/inbox`, {
        headers: { token }
      })
      if (data.success) {
        const list = data.threads || []
        setThreads(list)
        if (!selectedAppointmentId && !routeAppointmentId && list.length > 0 && window.innerWidth >= 1024) {
          setSelectedAppointmentId(list[0].appointmentId)
        }
      }
    } catch (error) {
      console.error('Inbox load error:', error)
    } finally {
      if (!silent) setThreadsLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchInbox()
  }, [token])

  // Listen for live inbox updates from AppContext custom events
  useEffect(() => {
    const handleThreadUpdate = () => fetchInbox(true)
    window.addEventListener('vitalsync:chat-thread-updated', handleThreadUpdate)
    window.addEventListener('prescripto:chat-thread-updated', handleThreadUpdate)
    window.addEventListener('vitalsync:appointment-updated', handleThreadUpdate)
    window.addEventListener('prescripto:appointment-updated', handleThreadUpdate)
    return () => {
      window.removeEventListener('vitalsync:chat-thread-updated', handleThreadUpdate)
      window.removeEventListener('prescripto:chat-thread-updated', handleThreadUpdate)
      window.removeEventListener('vitalsync:appointment-updated', handleThreadUpdate)
      window.removeEventListener('prescripto:appointment-updated', handleThreadUpdate)
    }
  }, [token])

  // Load selected conversation details + messages + join socket room
  useEffect(() => {
    if (!selectedAppointmentId || !token) return

    let isMounted = true

    const loadConversation = async () => {
      setMessagesLoading(true)
      setOtherTyping(false)
      setReplyTo(null)

      try {
        const [chatInitRes, msgRes, aptRes] = await Promise.all([
          axios.post(`${backendUrl}/api/chat/get-or-create`, { appointmentId: selectedAppointmentId }, { headers: { token } }),
          axios.post(`${backendUrl}/api/chat/messages`, { appointmentId: selectedAppointmentId }, { headers: { token } }),
          axios.get(`${backendUrl}/api/user/appointment/${selectedAppointmentId}`, { headers: { token } })
        ])

        if (!isMounted) return

        if (aptRes.data?.success) {
          setAppointment(aptRes.data.appointment)
        } else if (chatInitRes.data?.appointment) {
          setAppointment(chatInitRes.data.appointment)
        }

        if (msgRes.data?.success) {
          setMessages(msgRes.data.messages || [])
        }
      } catch (err) {
        console.error('Error loading conversation:', err)
      } finally {
        if (isMounted) setMessagesLoading(false)
      }
    }

    loadConversation()

    if (socket) {
      socket.emit('join-room', selectedAppointmentId)
      socket.emit('mark-messages-read', { roomId: selectedAppointmentId, readerRole: 'user' })
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
  }, [selectedAppointmentId, token, backendUrl, socket])

  // Socket listeners for active room events
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

      if (msg.sender !== 'user') {
        setOtherTyping(false)
        socket.emit('mark-messages-read', { roomId: selectedAppointmentId, readerRole: 'user' })
      }
    }

    const handleTyping = ({ roomId, sender, isTyping }) => {
      if (String(roomId) === String(selectedAppointmentId) && sender === 'doctor') {
        setOtherTyping(Boolean(isTyping))
      }
    }

    const handleMessagesRead = ({ roomId, readerRole }) => {
      if (String(roomId) === String(selectedAppointmentId) && readerRole === 'doctor') {
        setMessages((prev) =>
          prev.map((m) => {
            const readBy = m.readBy || []
            return readBy.includes('doctor') ? m : { ...m, readBy: [...readBy, 'doctor'] }
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

  const emitTypingState = (isTyping) => {
    if (!socket || !selectedAppointmentId) return
    socket.emit('typing', {
      roomId: selectedAppointmentId,
      sender: 'user',
      senderName: userData?.name || 'Patient',
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
      sender: 'user',
      senderName: userData?.name || 'Patient',
      text: text.trim(),
      attachmentUrl,
      attachmentType,
      attachmentName,
      replyTo: replyTo
        ? {
            messageId: String(replyTo._id || ''),
            senderName: replyTo.sender === 'user' ? 'You' : `Dr. ${activeThread?.doctorName || appointment?.docData?.name || 'Doctor'}`,
            text: replyTo.text || 'Attachment'
          }
        : null,
      reactions: [],
      readBy: ['user'],
      timestamp: new Date().toISOString()
    }

    // Optimistic append
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
          `${backendUrl}/api/chat/send-message`,
          { appointmentId: selectedAppointmentId, ...messageObj },
          { headers: { token } }
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

      const { data } = await axios.post(`${backendUrl}/api/chat/upload-attachment`, formData, {
        headers: { token }
      })

      if (data.success) {
        await sendPayload({
          text: input.trim(),
          attachmentUrl: data.attachmentUrl,
          attachmentType: data.attachmentType,
          attachmentName: data.attachmentName
        })
      } else {
        toast.error(data.message || 'Could not upload file')
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
      sender: 'user',
      emoji
    })
    setActiveReactionPicker(null)
  }

  const selectThread = (aptId) => {
    setSelectedAppointmentId(aptId)
    navigate(`/chat/${aptId}`, { replace: true })
  }

  const activeThread = useMemo(
    () => threads.find((t) => String(t.appointmentId) === String(selectedAppointmentId)),
    [threads, selectedAppointmentId]
  )

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (threadFilter === 'unread' && (!t.unreadCount || t.unreadCount === 0)) return false
      if (threadFilter === 'active' && (t.cancelled || t.isCompleted)) return false
      if (threadSearch.trim()) {
        const q = threadSearch.toLowerCase()
        return (
          t.doctorName?.toLowerCase().includes(q) ||
          t.doctorSpeciality?.toLowerCase().includes(q) ||
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

  const docName = activeThread?.doctorName || appointment?.docData?.name || 'Doctor'
  const docImage = activeThread?.doctorImage || appointment?.docData?.image || ''
  const docSpeciality = activeThread?.doctorSpeciality || appointment?.docData?.speciality || ''
  const docId = activeThread?.doctorId || appointment?.docId || ''
  const docOnline = docId ? isDoctorOnline(docId) : false

  return (
    <div className='py-1 sm:py-2 max-w-7xl mx-auto'>
      {/* Lightbox Modal for Image Attachments */}
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

      {/* Main Split-Pane Messenger Container */}
      <div className='bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-clip grid grid-cols-1 lg:grid-cols-12 grid-rows-[minmax(0,1fr)] h-[calc(100dvh-96px)] min-h-[480px] max-h-[860px]'>
        
        {/* LEFT PANE: Conversations Sidebar */}
        <div
          className={`lg:col-span-4 border-r border-slate-200/80 flex flex-col bg-slate-50/40 h-full min-h-0 overflow-hidden ${
            selectedAppointmentId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header */}
          <div className='p-4 sm:p-5 border-b border-slate-200/80 bg-white space-y-3.5 shrink-0'>
            <div className='flex items-center justify-between'>
              <div>
                <h1 className='text-lg font-extrabold text-slate-900 tracking-tight'>Doctor Messages</h1>
                <p className='text-xs text-slate-500'>Instant, private chat with your doctors</p>
              </div>
              <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200'>
                <Lock className='w-3 h-3' /> Encrypted
              </span>
            </div>

            {/* Search Threads */}
            <div className='relative'>
              <Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2' />
              <input
                type='text'
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder='Search doctor or speciality...'
                className='w-full pl-9 pr-3.5 py-2 bg-slate-100/80 border border-slate-200/70 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-sky-500 transition-all'
              />
            </div>

            {/* Filter Pills */}
            <div className='flex items-center gap-1.5'>
              {[
                { id: 'all', label: 'All Chats' },
                { id: 'unread', label: 'Unread' },
                { id: 'active', label: 'Upcoming Visits' }
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

          {/* Threads List */}
          <div className='flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100'>
            {threadsLoading ? (
              <div className='py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2'>
                <Loader2 className='w-5 h-5 animate-spin text-sky-600' />
                <span>Loading your conversations...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className='py-16 px-6 text-center space-y-3'>
                <div className='w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400'>
                  <MessageSquare className='w-5 h-5' />
                </div>
                <p className='text-sm font-bold text-slate-800'>No conversations found</p>
                <p className='text-xs text-slate-500 leading-relaxed'>
                  Book an appointment with any doctor to start a direct chat thread.
                </p>
                <button
                  onClick={() => navigate('/doctors')}
                  className='px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold hover:bg-sky-700 transition-colors cursor-pointer'
                >
                  Find a Doctor
                </button>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = String(thread.appointmentId) === String(selectedAppointmentId)
                const online = isDoctorOnline(thread.doctorId)
                return (
                  <div
                    key={thread.appointmentId}
                    onClick={() => selectThread(thread.appointmentId)}
                    className={`p-4 flex items-start gap-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50/90 border-l-4 border-l-sky-600'
                        : 'bg-white hover:bg-slate-50/90'
                    }`}
                  >
                    {/* Doctor Avatar + Live Presence Dot */}
                    <div className='relative shrink-0'>
                      <img
                        src={thread.doctorImage}
                        alt={thread.doctorName}
                        onError={(e) => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(thread.doctorName || 'Doctor')}&background=0284c7&color=fff&bold=true`
                        }}
                        className='w-12 h-12 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          online ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={online ? 'Doctor is Online' : 'Offline'}
                      />
                    </div>

                    {/* Thread Content */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-1'>
                        <h3 className={`text-xs sm:text-sm truncate ${thread.unreadCount > 0 ? 'font-extrabold text-slate-950' : 'font-bold text-slate-900'}`}>
                          {thread.doctorName.startsWith('Dr.') ? thread.doctorName : `Dr. ${thread.doctorName}`}
                        </h3>
                        <span className={`text-[11px] shrink-0 ${thread.unreadCount > 0 ? 'text-sky-600 font-bold' : 'text-slate-400'}`}>
                          {thread.lastMessage
                            ? formatTimeShort(thread.lastMessage.timestamp)
                            : thread.slotDate?.replace(/_/g, '/')}
                        </span>
                      </div>

                      <div className='flex items-center gap-1.5 mt-0.5'>
                        <span className='text-[11px] font-semibold text-sky-600 truncate'>
                          {thread.doctorSpeciality}
                        </span>
                        <span className='text-slate-300'>•</span>
                        <span className='text-[10px] text-slate-400 truncate'>
                          {thread.slotDate?.replace(/_/g, '/')} {thread.slotTime}
                        </span>
                      </div>

                      <div className='flex items-center justify-between gap-2 mt-1.5'>
                        <p className={`text-xs truncate ${thread.unreadCount > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                          {thread.lastMessage ? (
                            <>
                              {thread.lastMessage.sender === 'user' && (
                                <span className='text-slate-400 font-normal'>You: </span>
                              )}
                              {thread.lastMessage.text}
                            </>
                          ) : (
                            <span className='text-sky-600 font-medium italic'>Tap to start chatting →</span>
                          )}
                        </p>

                        {thread.unreadCount > 0 && (
                          <span className='min-w-[20px] h-5 px-1.5 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0'>
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

        {/* RIGHT PANE: Active Conversation Workspace */}
        <div
          className={`lg:col-span-8 flex flex-col bg-white h-full min-h-0 overflow-hidden relative ${
            selectedAppointmentId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!selectedAppointmentId ? (
            <div className='flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30'>
              <div className='w-16 h-16 rounded-3xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mb-4 shadow-2xs'>
                <MessageSquare className='w-8 h-8' />
              </div>
              <h2 className='text-lg font-extrabold text-slate-900'>Select a Conversation</h2>
              <p className='text-xs sm:text-sm text-slate-500 max-w-sm mt-1 leading-relaxed'>
                Choose any doctor from the left panel to ask follow-up questions, share photos or lab reports, or join your video consultation.
              </p>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className='px-4 sm:px-6 py-3.5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0'>
                <div className='flex items-center gap-3 min-w-0'>
                  <button
                    onClick={() => {
                      setSelectedAppointmentId('')
                      navigate('/chat')
                    }}
                    className='lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                  >
                    <ArrowLeft className='w-4 h-4' />
                  </button>

                  <div className='relative shrink-0'>
                    <img
                      src={docImage}
                      alt={docName}
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(docName || 'Doctor')}&background=0284c7&color=fff&bold=true`
                      }}
                      className='w-11 h-11 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        docOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>

                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h2 className='text-sm sm:text-base font-extrabold text-slate-900 truncate'>
                        {docName.startsWith('Dr.') ? docName : `Dr. ${docName}`}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          docOnline
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${docOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {docOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <p className='text-xs text-slate-500 truncate'>
                      {otherTyping ? (
                        <span className='text-sky-600 font-semibold animate-pulse'>
                          Dr. {docName.replace(/^Dr\.\s*/i, '')} is typing...
                        </span>
                      ) : (
                        <>
                          {docSpeciality}
                          {appointment && (
                            <span>
                              {' '}• Visit: {appointment.slotDate?.replace(/_/g, '/')} at {appointment.slotTime}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className='flex items-center gap-2 shrink-0'>
                  <button
                    onClick={() => setShowMsgSearch(!showMsgSearch)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      showMsgSearch
                        ? 'bg-sky-50 border-sky-200 text-sky-600'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    title='Search in conversation'
                  >
                    <Search className='w-4 h-4' />
                  </button>

                  {appointment && !appointment.cancelled && !appointment.isCompleted && (
                    <button
                      onClick={() => navigate(`/video-call/${selectedAppointmentId}`)}
                      className='px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap'
                    >
                      <Video className='w-3.5 h-3.5' />
                      <span className='hidden sm:inline'>Video Call</span>
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/prescription/${selectedAppointmentId}`)}
                    className='px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap'
                  >
                    <FileText className='w-3.5 h-3.5 text-sky-600' />
                    <span className='hidden sm:inline'>Prescription</span>
                  </button>
                </div>
              </div>

              {/* Optional In-Conversation Search Bar */}
              {showMsgSearch && (
                <div className='px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 shrink-0'>
                  <Search className='w-3.5 h-3.5 text-slate-400' />
                  <input
                    type='text'
                    value={msgSearch}
                    onChange={(e) => setMsgSearch(e.target.value)}
                    placeholder='Search messages in this chat...'
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
                      <ShieldCheck className='w-6 h-6' />
                    </div>
                    <div className='space-y-1'>
                      <h4 className='font-bold text-slate-900 text-sm'>
                        Start Your Consultation Chat with {docName.startsWith('Dr.') ? docName : `Dr. ${docName}`}
                      </h4>
                      <p className='text-xs text-slate-500 max-w-sm mx-auto leading-relaxed'>
                        Share your symptoms, upload photos or lab reports, or click one of the quick starters below.
                      </p>
                    </div>
                    <div className='flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto pt-2'>
                      {QUICK_PROMPTS.map((prompt, idx) => (
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
                    const isUser = msg.sender === 'user'
                    const prevMsg = visibleMessages[index - 1]
                    const showDateSeparator =
                      !prevMsg ||
                      new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString()
                    const isReadByDoctor = (msg.readBy || []).includes('doctor')

                    return (
                      <React.Fragment key={msg._id || msg.clientTempId || index}>
                        {showDateSeparator && (
                          <div className='flex items-center justify-center my-3'>
                            <span className='px-3 py-1 rounded-full bg-slate-200/75 text-slate-600 text-[10px] font-bold uppercase tracking-wider'>
                              {formatDateSeparator(msg.timestamp)}
                            </span>
                          </div>
                        )}

                        <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-end gap-2 max-w-[82%] sm:max-w-[72%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Message Bubble */}
                            <div
                              className={`relative px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                                isUser
                                  ? 'bg-sky-600 text-white rounded-br-xs'
                                  : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                              }`}
                            >
                              {/* Quoted Reply Box */}
                              {msg.replyTo && (msg.replyTo.text || msg.replyTo.senderName) && (
                                <div
                                  className={`mb-2 px-3 py-1.5 rounded-xl border-l-2 text-xs ${
                                    isUser
                                      ? 'bg-sky-700/70 border-sky-200 text-sky-100'
                                      : 'bg-slate-100 border-sky-500 text-slate-600'
                                  }`}
                                >
                                  <p className='font-bold text-[10px] opacity-90'>{msg.replyTo.senderName}</p>
                                  <p className='truncate text-[11px] opacity-85'>{msg.replyTo.text}</p>
                                </div>
                              )}

                              {/* Attachment Rendering */}
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
                                  onClick={() => navigate(msg.attachmentUrl)}
                                  className={`mb-2 p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                    isUser
                                      ? 'bg-sky-700/60 border-sky-400/40 text-white'
                                      : 'bg-emerald-50/90 border-emerald-200 text-emerald-950 hover:bg-emerald-100/80'
                                  }`}
                                >
                                  <div className='flex items-center gap-2.5'>
                                    <div className='w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0'>
                                      <FileText className='w-4 h-4' />
                                    </div>
                                    <div>
                                      <p className='text-xs font-bold'>{msg.attachmentName || 'Digital Prescription'}</p>
                                      <p className='text-[10px] opacity-75'>Tap to view & print signed Rx</p>
                                    </div>
                                  </div>
                                  <ExternalLink className='w-4 h-4 shrink-0 opacity-70' />
                                </div>
                              )}

                              {msg.attachmentUrl && msg.attachmentType === 'document' && (
                                <a
                                  href={msg.attachmentUrl}
                                  target='_blank'
                                  rel='noreferrer'
                                  className={`mb-2 p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                                    isUser
                                      ? 'bg-sky-700/60 border-sky-400/40 text-white'
                                      : 'bg-slate-100 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <FileText className='w-4 h-4 shrink-0' />
                                  <span className='truncate'>{msg.attachmentName || 'View Document'}</span>
                                  <ExternalLink className='w-3.5 h-3.5 shrink-0 ml-auto' />
                                </a>
                              )}

                              {/* Message Text */}
                              {msg.text && <p className='whitespace-pre-wrap break-words'>{msg.text}</p>}

                              {/* Timestamp + Read Receipt */}
                              <div
                                className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${
                                  isUser ? 'text-sky-100' : 'text-slate-400'
                                }`}
                              >
                                <span>{formatBubbleTime(msg.timestamp)}</span>
                                {isUser && (
                                  isReadByDoctor ? (
                                    <CheckCheck className='w-3.5 h-3.5 text-emerald-300' title='Seen by Doctor' />
                                  ) : (
                                    <Check className='w-3.5 h-3.5 text-sky-200' title='Sent' />
                                  )
                                )}
                              </div>

                              {/* Reactions Pill */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div
                                  className={`absolute -bottom-2.5 ${
                                    isUser ? 'right-2' : 'left-2'
                                  } flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white border border-slate-200 shadow-xs text-[11px]`}
                                >
                                  {msg.reactions.map((r, ri) => (
                                    <span key={ri}>{r.emoji}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Hover Actions: Reply & React */}
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

                {/* Live Typing Bubble */}
                {otherTyping && (
                  <div className='flex items-start gap-2'>
                    <div className='bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs flex items-center gap-1.5'>
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '0ms' }} />
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '150ms' }} />
                      <span className='w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce' style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {/* Floating Scroll-to-Bottom Button */}
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

              {/* Quick Prompts Strip */}
              <div className='px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0'>
                <Sparkles className='w-3.5 h-3.5 text-sky-600 shrink-0 mr-1' />
                {QUICK_PROMPTS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(chip)}
                    className='whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 text-[11px] font-medium transition-colors cursor-pointer'
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Reply Preview Banner */}
              {replyTo && (
                <div className='px-4 py-2 bg-sky-50/90 border-t border-sky-200/80 flex items-center justify-between gap-2 text-xs shrink-0'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <Reply className='w-3.5 h-3.5 text-sky-600 shrink-0' />
                    <div className='truncate'>
                      <span className='font-bold text-sky-900'>
                        Replying to {replyTo.sender === 'user' ? 'yourself' : `Dr. ${docName.replace(/^Dr\.\s*/i, '')}`}:
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

              {/* Message Composer Bar */}
              <div className='p-3 sm:p-4 border-t border-slate-200/80 bg-white shrink-0'>
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
                    title='Share photo or medical report'
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
                    placeholder={`Message ${docName.startsWith('Dr.') ? docName : 'Dr. ' + docName}...`}
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

export default ChatPage
