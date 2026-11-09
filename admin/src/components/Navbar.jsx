import React, { useContext, useState, useRef, useEffect } from 'react'
import { DoctorContext } from '../context/DoctorContext'
import { AdminContext } from '../context/AdminContext'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  MessageSquare,
  Calendar,
  Video,
  CheckCheck,
  PhoneOff,
  HeartPulse,
  AlertTriangle
} from 'lucide-react'

const Navbar = () => {
  const {
    dToken,
    setDToken,
    notifications,
    unreadNotifCount,
    markDoctorNotificationRead,
    unreadChatCount,
    incomingCall,
    setIncomingCall,
    declineIncomingCall
  } = useContext(DoctorContext)
  const { aToken, setAToken } = useContext(AdminContext)

  const navigate = useNavigate()
  const location = useLocation()
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const notifRef = useRef(null)

  const logout = () => {
    navigate('/')
    dToken && setDToken('')
    dToken && localStorage.removeItem('dToken')
    aToken && setAToken('')
    aToken && localStorage.removeItem('aToken')
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleCustomNavigate = (e) => {
      if (e.detail?.notifId) {
        markDoctorNotificationRead(e.detail.notifId)
      }
      if (e.detail?.path) {
        navigate(e.detail.path)
      }
    }
    window.addEventListener('vitalsync:doctor-navigate', handleCustomNavigate)
    window.addEventListener('prescripto:doctor-navigate', handleCustomNavigate)
    return () => {
      window.removeEventListener('vitalsync:doctor-navigate', handleCustomNavigate)
      window.removeEventListener('prescripto:doctor-navigate', handleCustomNavigate)
    }
  }, [navigate, markDoctorNotificationRead])

  useEffect(() => {
    setShowNotifDropdown(false)
  }, [location.pathname])

  const formatNotifTime = (dateStr) => {
    if (!dateStr) return ''
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const getNotifIcon = (type) => {
    switch (type) {
      case 'message':
        return <MessageSquare className='w-4 h-4 text-sky-600' />
      case 'call_incoming':
        return <Video className='w-4 h-4 text-rose-500' />
      case 'vitals_recorded':
        return <HeartPulse className='w-4 h-4 text-rose-500' />
      case 'allergy_conflict':
        return <AlertTriangle className='w-4 h-4 text-rose-600' />
      case 'allergy_updated':
        return <AlertTriangle className='w-4 h-4 text-amber-600' />
      default:
        return <Calendar className='w-4 h-4 text-indigo-600' />
    }
  }

  return (
    <>
      {/* Live Incoming Patient Video Call Modal */}
      {incomingCall && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
          <div className='bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-5 animate-in zoom-in-95 duration-200'>
            <div className='relative w-20 h-20 mx-auto'>
              <span className='absolute inset-0 rounded-full bg-emerald-400/30 animate-ping' />
              {incomingCall.callerImage ? (
                <img
                  src={incomingCall.callerImage}
                  alt={incomingCall.callerName}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName || 'Patient')}&background=059669&color=fff&bold=true`
                  }}
                  className='relative w-20 h-20 rounded-full object-cover border-2 border-emerald-500 bg-slate-100 shadow-sm'
                />
              ) : (
                <div className='relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-sm'>
                  <Video className='w-8 h-8' />
                </div>
              )}
            </div>

            <div>
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2'>
                <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
                Patient waiting in video room
              </span>
              <h3 className='text-lg font-bold text-slate-900'>{incomingCall.callerName}</h3>
              <p className='text-xs text-slate-500 mt-0.5'>{incomingCall.speciality || 'Ready for video consultation'}</p>
            </div>

            <div className='flex items-center gap-2.5 pt-1'>
              <button
                onClick={declineIncomingCall}
                className='flex-1 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer'
              >
                <PhoneOff className='w-4 h-4' />
                <span>Decline</span>
              </button>
              <button
                onClick={() => {
                  const aptId = incomingCall.appointmentId
                  setIncomingCall(null)
                  navigate(`/doctor-video-call/${aptId}`)
                }}
                className='flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/25 transition-all cursor-pointer'
              >
                <Video className='w-4 h-4' />
                <span>Join room</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className='flex justify-between items-center h-16 px-4 sm:px-8 border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-30'>
        <div className='flex items-center gap-3 text-xs'>
          <div
            onClick={() => navigate('/')}
            className='inline-flex items-center gap-2.5 cursor-pointer select-none group'
          >
            <div className='relative w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 via-sky-700 to-teal-600 flex items-center justify-center shadow-xs ring-1 ring-white/20 group-hover:scale-[1.02] transition-transform'>
              <svg className='w-5 h-5 text-white' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path
                  d='M9.5 4C9.5 3.44772 9.94772 3 10.5 3H13.5C14.0523 3 14.5 3.44772 14.5 4V9.5H20C20.5523 9.5 21 9.94772 21 10.5V13.5C21 14.0523 20.5523 14.5 20 14.5H14.5V20C14.5 20.5523 14.0523 21 13.5 21H10.5C9.94772 21 9.5 20.5523 9.5 20V14.5H4C3.44772 14.5 3 14.0523 3 13.5V10.5C3 9.94772 3.44772 9.5 4 9.5H9.5V4Z'
                  fill='currentColor'
                  fillOpacity='0.18'
                />
                <path
                  d='M3.5 12H7.5L9.5 7.5L12.5 16.5L14.8 10L16.5 12H20.5'
                  stroke='currentColor'
                  strokeWidth='2.2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
              <span className='absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white' />
            </div>
            <div className='flex flex-col leading-none'>
              <span className='text-lg font-extrabold tracking-tight text-slate-900'>
                Vital<span className='text-sky-600'>Sync</span>
              </span>
              <span className='text-[8.5px] font-bold tracking-[0.16em] text-slate-400 uppercase mt-0.5'>
                Clinical Portal
              </span>
            </div>
          </div>

          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold text-xs whitespace-nowrap'>
            <span className='w-1.5 h-1.5 rounded-full bg-sky-600' />
            {aToken ? 'Admin workspace' : 'Doctor workspace'}
          </span>
        </div>

        <div className='flex items-center gap-2'>
          {dToken && (
            <>
              {/* Quick Patient Messages Button */}
              <button
                onClick={() => navigate('/doctor-chat')}
                className='relative p-2.5 rounded-xl text-slate-600 hover:text-sky-600 hover:bg-slate-100 transition-colors cursor-pointer'
                title='Patient messages'
              >
                <MessageSquare className='w-4 h-4' />
                {unreadChatCount > 0 && (
                  <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-white'>
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>

              {/* Doctor Real-Time Notifications Dropdown */}
              <div className='relative' ref={notifRef}>
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className='relative p-2.5 rounded-xl text-slate-600 hover:text-sky-600 hover:bg-slate-100 transition-colors cursor-pointer'
                  title='Clinical alerts'
                >
                  <Bell className='w-4 h-4' />
                  {unreadNotifCount > 0 && (
                    <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center ring-2 ring-white animate-pulse'>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className='absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 animate-in fade-in slide-in-from-top-2 duration-150'>
                    <div className='bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden'>
                      <div className='px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs font-bold text-slate-900'>Clinical alerts</span>
                          {unreadNotifCount > 0 && (
                            <span className='px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold tabular-nums border border-rose-200'>
                              {unreadNotifCount} new
                            </span>
                          )}
                        </div>
                        {unreadNotifCount > 0 && (
                          <button
                            onClick={() => markDoctorNotificationRead(null)}
                            className='text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer'
                          >
                            <CheckCheck className='w-3.5 h-3.5' />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>

                      <div className='max-h-96 overflow-y-auto overscroll-contain divide-y divide-slate-100'>
                        {notifications.length === 0 ? (
                          <div className='py-10 px-4 text-center'>
                            <Bell className='w-6 h-6 text-slate-300 mx-auto mb-2' />
                            <p className='text-xs font-bold text-slate-700'>No new alerts</p>
                            <p className='text-[11px] text-slate-400 mt-0.5'>
                              Patient bookings, messages, payments, and video call alerts appear here live.
                            </p>
                          </div>
                        ) : (
                          notifications.slice(0, 15).map((notif) => (
                            <button
                              key={notif._id}
                              onClick={() => {
                                markDoctorNotificationRead(notif._id)
                                setShowNotifDropdown(false)
                                if (notif.link) navigate(notif.link)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-sky-50/60 transition-colors cursor-pointer ${
                                !notif.isRead ? 'bg-sky-50/30' : ''
                              }`}
                            >
                              <div className='w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/70 flex items-center justify-center shrink-0 mt-0.5'>
                                {getNotifIcon(notif.type)}
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='flex items-center justify-between gap-2'>
                                  <p className={`text-xs truncate ${!notif.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                    {notif.title}
                                  </p>
                                  <span className='text-[10px] text-slate-400 tabular-nums shrink-0'>
                                    {formatNotifTime(notif.createdAt)}
                                  </span>
                                </div>
                                <p className='text-[11px] text-slate-500 line-clamp-2 mt-0.5'>
                                  {notif.body}
                                </p>
                              </div>
                              {!notif.isRead && (
                                <span className='w-2 h-2 rounded-full bg-sky-600 shrink-0 mt-2' />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={() => logout()}
            className='bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 sm:px-4.5 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-2xs'
          >
            Sign out
          </button>
        </div>
      </header>
    </>
  )
}

export default Navbar
