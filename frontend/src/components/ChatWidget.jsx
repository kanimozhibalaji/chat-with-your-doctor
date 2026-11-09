import React, { useState, useRef, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import {
  X,
  Send,
  RotateCcw,
  Bot,
  Sparkles,
  Info,
  FileText,
  ChevronRight,
  MessageCircleQuestion
} from 'lucide-react'

const ChatWidget = () => {
    const { backendUrl, userData, currencySymbol } = useContext(AppContext)
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([
        {
            role: 'bot',
            text: "Hi there! 👋 I'm your VitalSync Health Assistant. Ask me about your symptoms, which doctor to see, or how to book an appointment.",
            sources: [],
            doctors: []
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesContainerRef = useRef(null)
    const inputRef = useRef(null)

    const quickQuestions = [
        "Which doctor for headache?",
        "I have a fever and cough",
        "How do I book an appointment?",
        "What specialties are available?"
    ]

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    const sendMessage = async (text) => {
        const messageText = text || input.trim()
        if (!messageText || loading) return

        setMessages(prev => [...prev, { role: 'user', text: messageText, sources: [], doctors: [] }])
        setInput('')
        setLoading(true)

        try {
            const { data } = await axios.post(backendUrl + '/api/chatbot/chat', {
                message: messageText,
                userId: userData?._id || 'anonymous'
            })

            if (data.success) {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: data.response,
                    sources: data.sourcesUsed || [],
                    doctors: data.doctors || []
                }])
            } else {
                setMessages(prev => [...prev, {
                    role: 'bot',
                    text: "Sorry, I couldn't process that right now. Please try again or browse our Find Doctors page.",
                    sources: [],
                    doctors: []
                }])
            }
        } catch (error) {
            console.log(error)
            setMessages(prev => [...prev, {
                role: 'bot',
                text: "Our assistant is temporarily offline. You can use the Symptom Checker page or browse our Doctors list directly.",
                sources: [],
                doctors: []
            }])
        }

        setLoading(false)
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = async () => {
        try {
            await axios.post(backendUrl + '/api/chatbot/clear', {
                userId: userData?._id || 'anonymous'
            })
        } catch (e) { /* ignore */ }

        setMessages([{
            role: 'bot',
            text: "Chat cleared! How can I help you today?",
            sources: [],
            doctors: []
        }])
    }

    return (
        <>
            {/* Floating Trigger Button with Helpful Label on Desktop */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className='fixed bottom-6 right-6 z-50 px-4 h-12 rounded-full bg-primary hover:bg-sky-600 text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 cursor-pointer'
                aria-label="Ask Health Assistant"
            >
                {isOpen ? (
                    <>
                        <X className='w-5 h-5 text-white' />
                        <span className='text-xs font-bold'>Close</span>
                    </>
                ) : (
                    <>
                        <MessageCircleQuestion className='w-5 h-5 text-white' />
                        <span className='text-xs font-bold'>Need Help? Ask AI</span>
                    </>
                )}
            </button>

            {/* Chat Window Container */}
            <div className={`fixed bottom-20 right-6 z-50 transition-all duration-200 origin-bottom-right
                ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}
            `}>
                <div className='w-[360px] sm:w-[400px] max-h-[min(560px,80dvh)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-clip'>
                    
                    {/* Header */}
                    <div className='px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0'>
                        <div className='flex items-center gap-3'>
                            <div className='w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-sky-400'>
                                <Bot className='w-5 h-5' />
                            </div>
                            <div>
                                <div className='flex items-center gap-1.5'>
                                    <h3 className='font-bold text-sm tracking-tight text-white'>Health Assistant</h3>
                                    <span className='w-2 h-2 rounded-full bg-emerald-400' />
                                </div>
                                <p className='text-xs text-slate-300'>Ask about symptoms or doctors</p>
                            </div>
                        </div>

                        <div className='flex items-center gap-1'>
                            <button
                                onClick={clearChat}
                                className='p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer'
                                title="Start over"
                            >
                                <RotateCcw className='w-4 h-4' />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className='p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer'
                            >
                                <X className='w-4 h-4' />
                            </button>
                        </div>
                    </div>

                    {/* Friendly Note */}
                    <div className='bg-sky-50/70 px-3.5 py-2 border-b border-sky-100 flex items-center gap-2 text-xs text-slate-600 shrink-0'>
                        <Info className='w-3.5 h-3.5 text-primary shrink-0' />
                        <span>For general guidance only. In an emergency, call 108 / 911.</span>
                    </div>

                    {/* Messages Body */}
                    <div ref={messagesContainerRef} className='flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3 text-sm' style={{ maxHeight: '350px', minHeight: '220px' }}>
                        {messages.map((msg, i) => (
                            <div key={i} className='space-y-2'>
                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-primary text-white rounded-br-xs'
                                            : 'bg-slate-100 text-slate-800 border border-slate-200/60 rounded-bl-xs'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </div>

                                {/* Matched Doctor Recommendations */}
                                {msg.role === 'bot' && msg.doctors && msg.doctors.length > 0 && (
                                    <div className='space-y-2 pl-1'>
                                        <p className='text-xs font-semibold text-slate-500'>Suggested Doctors:</p>
                                        {msg.doctors.map((doc) => (
                                            <div
                                                key={doc._id}
                                                onClick={() => { navigate(`/appointment/${doc._id}`); setIsOpen(false); }}
                                                className='flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-primary hover:shadow-sm transition-all cursor-pointer group'
                                            >
                                                <div className='flex items-center gap-2.5 min-w-0'>
                                                    <img
                                                        src={doc.image}
                                                        alt={doc.name}
                                                        className='w-10 h-10 rounded-full object-cover border border-slate-100 bg-slate-50'
                                                    />
                                                    <div className='min-w-0'>
                                                        <p className='font-bold text-slate-900 truncate text-xs group-hover:text-primary transition-colors'>{doc.name}</p>
                                                        <p className='text-[11px] text-slate-500 truncate'>{doc.speciality} • {doc.experience}</p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-1.5 shrink-0 pl-2'>
                                                    <span className='font-bold text-slate-800 text-xs'>{currencySymbol}{doc.fees}</span>
                                                    <ChevronRight className='w-4 h-4 text-slate-400 group-hover:text-primary transition-colors' />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading State */}
                        {loading && (
                            <div className='flex justify-start'>
                                <div className='bg-slate-100 border border-slate-200/60 px-3.5 py-2.5 rounded-2xl rounded-bl-xs'>
                                    <div className='flex items-center gap-2 text-xs text-slate-600'>
                                        <Sparkles className='w-3.5 h-3.5 text-primary animate-spin' />
                                        <span>Finding the best answer...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 2 && (
                        <div className='px-4 pb-2.5'>
                            <p className='text-xs font-medium text-slate-400 mb-1.5'>Common questions:</p>
                            <div className='flex flex-wrap gap-1.5'>
                                {quickQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(q)}
                                        className='text-xs px-2.5 py-1.5 bg-slate-50 hover:bg-sky-50 hover:text-primary hover:border-sky-200 text-slate-700 border border-slate-200 rounded-lg transition-colors text-left cursor-pointer'
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Bar */}
                    <div className='p-3 border-t border-slate-100 bg-slate-50/50'>
                        <div className='flex items-center gap-2'>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask a question or describe symptoms..."
                                className='flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all'
                                disabled={loading}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                className='p-2.5 bg-primary text-white rounded-xl hover:bg-sky-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer'
                            >
                                <Send className='w-4 h-4' />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default ChatWidget
