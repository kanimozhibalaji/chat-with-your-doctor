import React, { useState, useRef, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
    MessageSquare,
    Send,
    X,
    Paperclip,
    Check,
    CheckCheck,
    Maximize2,
    Loader2
} from 'lucide-react'

const ChatWindow = ({ appointmentId, doctorName, doctorImage, onClose }) => {
    const navigate = useNavigate()
    const { backendUrl, token, userData, socket, fetchUnreadChatCount } = useContext(AppContext)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [otherTyping, setOtherTyping] = useState(false)
    const [uploading, setUploading] = useState(false)

    const messagesContainerRef = useRef(null)
    const fileInputRef = useRef(null)
    const typingTimeoutRef = useRef(null)

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, otherTyping])

    useEffect(() => {
        if (!appointmentId || !token) return

        const initChat = async () => {
            setLoading(true)
            try {
                await axios.post(
                    backendUrl + '/api/chat/get-or-create',
                    { appointmentId },
                    { headers: { token } }
                )
                const { data } = await axios.post(
                    backendUrl + '/api/chat/messages',
                    { appointmentId },
                    { headers: { token } }
                )
                if (data.success) {
                    setMessages(data.messages || [])
                }
            } catch (e) {
                console.error("Chat init error:", e)
            } finally {
                setLoading(false)
            }
        }

        initChat()

        if (socket) {
            socket.emit('join-room', appointmentId)
            socket.emit('mark-messages-read', { roomId: appointmentId, readerRole: 'user' })
            fetchUnreadChatCount()
        }

        return () => {
            if (socket && appointmentId) {
                socket.emit('leave-room', appointmentId)
            }
        }
    }, [appointmentId, token, backendUrl, socket])

    useEffect(() => {
        if (!socket || !appointmentId) return

        const handleMessage = (msg) => {
            if (msg.appointmentId && String(msg.appointmentId) !== String(appointmentId)) return
            setMessages((prev) => {
                if (msg._id && prev.some((m) => String(m._id) === String(msg._id))) return prev
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
                socket.emit('mark-messages-read', { roomId: appointmentId, readerRole: 'user' })
            }
        }

        const handleTyping = ({ roomId, sender, isTyping }) => {
            if (String(roomId) === String(appointmentId) && sender === 'doctor') {
                setOtherTyping(Boolean(isTyping))
            }
        }

        const handleRead = ({ roomId, readerRole }) => {
            if (String(roomId) === String(appointmentId) && readerRole === 'doctor') {
                setMessages((prev) =>
                    prev.map((m) =>
                        (m.readBy || []).includes('doctor')
                            ? m
                            : { ...m, readBy: [...(m.readBy || []), 'doctor'] }
                    )
                )
            }
        }

        socket.on('chat-message', handleMessage)
        socket.on('typing', handleTyping)
        socket.on('messages-read', handleRead)

        return () => {
            socket.off('chat-message', handleMessage)
            socket.off('typing', handleTyping)
            socket.off('messages-read', handleRead)
        }
    }, [socket, appointmentId])

    const sendPayload = ({ text = '', attachmentUrl = '', attachmentType = '', attachmentName = '' }) => {
        if (!text.trim() && !attachmentUrl) return
        const clientTempId = `temp_${Date.now()}`
        const message = {
            clientTempId,
            sender: 'user',
            senderName: userData?.name || 'Patient',
            text: text.trim(),
            attachmentUrl,
            attachmentType,
            attachmentName,
            readBy: ['user'],
            timestamp: new Date().toISOString()
        }

        setMessages((prev) => [...prev, message])
        setInput('')

        if (socket) {
            socket.emit('chat-message', {
                roomId: appointmentId,
                message
            })
            socket.emit('typing', {
                roomId: appointmentId,
                sender: 'user',
                senderName: userData?.name || 'Patient',
                isTyping: false
            })
        }
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        e.target.value = ''
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('attachment', file)
            const { data } = await axios.post(`${backendUrl}/api/chat/upload-attachment`, formData, {
                headers: { token }
            })
            if (data.success) {
                sendPayload({
                    text: input.trim(),
                    attachmentUrl: data.attachmentUrl,
                    attachmentType: data.attachmentType,
                    attachmentName: data.attachmentName
                })
            }
        } catch (err) {
            toast.error('Failed to upload file')
        } finally {
            setUploading(false)
        }
    }

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4'>
            <div
                className='w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col overflow-clip border border-slate-200'
                style={{ maxHeight: '84dvh' }}
            >
                {/* Header */}
                <div className='px-5 py-3.5 flex items-center justify-between bg-slate-900 border-b border-slate-800 text-white shrink-0'>
                    <div className='flex items-center gap-3'>
                        <img
                            src={doctorImage}
                            alt={doctorName}
                            className='w-10 h-10 rounded-xl bg-slate-800 object-cover border border-slate-700'
                        />
                        <div>
                            <p className='text-white font-bold text-sm truncate max-w-[180px]'>
                                {doctorName?.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
                            </p>
                            <p className='text-xs text-slate-300 flex items-center gap-1.5 mt-0.5'>
                                <span className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                {otherTyping ? 'Typing...' : socket?.connected ? 'Live Encrypted Chat' : 'Connecting...'}
                            </p>
                        </div>
                    </div>
                    <div className='flex items-center gap-1.5'>
                        <button
                            onClick={() => {
                                onClose()
                                navigate(`/chat/${appointmentId}`)
                            }}
                            className='w-8 h-8 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer'
                            title="Open Full Messenger"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={onClose}
                            className='w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer'
                            title="Close Chat"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages Body */}
                <div ref={messagesContainerRef} className='flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-slate-50/60' style={{ minHeight: '300px', maxHeight: '54dvh' }}>
                    {loading ? (
                        <div className='text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2'>
                            <Loader2 className='w-4 h-4 text-sky-600 animate-spin' />
                            <span>Loading messages...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className='text-center py-12 space-y-2'>
                            <div className='w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto'>
                                <MessageSquare className='w-5 h-5' />
                            </div>
                            <p className='text-slate-700 font-semibold text-sm'>
                                Message {doctorName?.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`}
                            </p>
                            <p className='text-xs text-slate-500 max-w-xs mx-auto'>
                                Ask a question or share an image before or after your appointment.
                            </p>
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isUser = msg.sender === 'user'
                            const isRead = (msg.readBy || []).includes('doctor')
                            return (
                                <div key={msg._id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs space-y-1 ${
                                        isUser
                                            ? 'bg-sky-600 text-white rounded-br-xs shadow-xs'
                                            : 'bg-white text-slate-800 rounded-bl-xs shadow-2xs border border-slate-200/80'
                                    }`}>
                                        {msg.attachmentUrl && msg.attachmentType === 'image' && (
                                            <img
                                                src={msg.attachmentUrl}
                                                alt="Attachment"
                                                className='max-h-44 rounded-xl object-cover mb-1.5'
                                            />
                                        )}
                                        {msg.text && <p className='leading-relaxed whitespace-pre-wrap'>{msg.text}</p>}
                                        <div className={`flex items-center justify-end gap-1 text-[10px] ${
                                            isUser ? 'text-sky-100' : 'text-slate-400'
                                        }`}>
                                            <span>{formatTime(msg.timestamp)}</span>
                                            {isUser && (
                                                isRead ? <CheckCheck className='w-3 h-3 text-emerald-300' /> : <Check className='w-3 h-3' />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                    {otherTyping && (
                        <div className='flex justify-start'>
                            <div className='bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl text-xs text-slate-500'>
                                Doctor is typing...
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Controls */}
                <div className='px-4 py-3 border-t border-slate-200 bg-white shrink-0'>
                    <div className='flex items-center gap-2'>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className='p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-sky-600 hover:bg-slate-50 transition-colors cursor-pointer'
                            title="Attach Image or Report"
                        >
                            {uploading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Paperclip className='w-4 h-4' />}
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value)
                                if (socket) {
                                    socket.emit('typing', { roomId: appointmentId, sender: 'user', isTyping: true })
                                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                                    typingTimeoutRef.current = setTimeout(() => {
                                        socket.emit('typing', { roomId: appointmentId, sender: 'user', isTyping: false })
                                    }, 1500)
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    sendPayload({ text: input })
                                }
                            }}
                            placeholder="Write a message..."
                            className='flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-sky-500 focus:bg-white transition-all'
                        />
                        <button
                            onClick={() => sendPayload({ text: input })}
                            disabled={!input.trim()}
                            className='p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors disabled:opacity-40 shadow-xs cursor-pointer'
                            title="Send Message"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatWindow
