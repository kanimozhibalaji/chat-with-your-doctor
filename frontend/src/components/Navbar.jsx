import React, { useContext, useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { googleLogout } from '@react-oauth/google'
import { AppContext } from '../context/AppContext'
import {
  HeartPulse,
  Stethoscope,
  Pill,
  ShieldCheck,
  Calendar,
  MessageSquare,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Home,
  Info,
  PhoneCall,
  Bell,
  FileText,
  Video,
  CheckCheck,
  PhoneOff,
  AlertTriangle
} from 'lucide-react'

export const BrandLogo = ({ subtitle = 'HEALTHCARE', className = '' }) => (
  <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
    {/* Modern Medical Squircle Mark */}
    <div className='relative w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 via-sky-700 to-teal-600 flex items-center justify-center shadow-sm shadow-sky-600/20 ring-1 ring-white/20 group-hover:scale-[1.02] transition-transform'>
      <svg className='w-6 h-6 text-white' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
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
      <span className='absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white' />
    </div>

    {/* Brand Wordmark */}
    <div className='flex flex-col leading-none'>
      <span className='text-xl font-extrabold tracking-tight text-slate-900'>
        Vital<span className='text-sky-600'>Sync</span>
      </span>
      <span className='text-[9px] font-bold tracking-[0.16em] text-slate-400 uppercase mt-0.5'>
        {subtitle}
      </span>
    </div>
  </div>
)

const Navbar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const notifRef = useRef(null)

  const {
    token,
    setToken,
    userData,
    notifications,
    unreadNotifCount,
    markNotificationRead,
    unreadChatCount,
    incomingCall,
    setIncomingCall,
    declineIncomingCall
  } = useContext(AppContext)

  const logout = () => {
    try {
      googleLogout()
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('token')
    setToken(false)
    setShowDropdown(false)
    navigate('/login')
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Listen to custom toast navigation events
  useEffect(() => {
    const handleCustomNavigate = (e) => {
      if (e.detail?.notifId) {
        markNotificationRead(e.detail.notifId)
      }
      if (e.detail?.path) {
        navigate(e.detail.path)
      }
    }
    window.addEventListener('vitalsync:navigate', handleCustomNavigate)
    window.addEventListener('prescripto:navigate', handleCustomNavigate)
    return () => {
      window.removeEventListener('vitalsync:navigate', handleCustomNavigate)
      window.removeEventListener('prescripto:navigate', handleCustomNavigate)
    }
  }, [navigate, markNotificationRead])

  // Close menus on route change
  useEffect(() => {
    setShowMenu(false)
    setShowDropdown(false)
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
      case 'prescription_created':
      case 'prescription_updated':
        return <FileText className='w-4 h-4 text-emerald-600' />
      case 'call_incoming':
        return <Video className='w-4 h-4 text-rose-500' />
      case 'allergy_conflict':
        return <AlertTriangle className='w-4 h-4 text-rose-600' />
      default:
        return <Calendar className='w-4 h-4 text-indigo-600' />
    }
  }

  const navItemClass = ({ isActive }) =>
    `whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] transition-all duration-150 ${
      isActive
        ? 'bg-white text-sky-600 font-semibold shadow-2xs ring-1 ring-slate-200/80'
        : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
    }`

  return (
    <>
      {/* Live Incoming Video Call Modal */}
      {incomingCall && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-200'>
          <div className='bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-5'>
            <div className='relative w-20 h-20 mx-auto'>
              <span className='absolute inset-0 rounded-full bg-emerald-400/30 animate-ping' />
              {incomingCall.callerImage ? (
                <img
                  src={incomingCall.callerImage}
                  alt={incomingCall.callerName}
                  className='relative w-20 h-20 rounded-full object-cover border-2 border-emerald-500 bg-slate-100'
                />
              ) : (
                <div className='relative w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600'>
                  <Video className='w-8 h-8' />
                </div>
              )}
            </div>

            <div>
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2'>
                <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
                Incoming Video Consultation
              </span>
              <h3 className='text-lg font-extrabold text-slate-900'>{incomingCall.callerName}</h3>
              <p className='text-xs text-slate-500 mt-0.5'>{incomingCall.speciality || 'is inviting you to join the video call'}</p>
            </div>

            <div className='flex items-center gap-3 pt-1'>
              <button
                onClick={declineIncomingCall}
                className='flex-1 py-3 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer'
              >
                <PhoneOff className='w-4 h-4' />
                <span>Decline</span>
              </button>
              <button
                onClick={() => {
                  const aptId = incomingCall.appointmentId
                  setIncomingCall(null)
                  navigate(`/video-call/${aptId}`)
                }}
                className='flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer'
              >
                <Video className='w-4 h-4' />
                <span>Join Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header
        className={`sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 ${
          location.pathname.startsWith('/chat') ? 'mb-2' : 'mb-6'
        }`}
      >
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between h-16 sm:h-[70px] gap-3'>
            
            {/* Brand Logo */}
            <div
              className='cursor-pointer shrink-0'
              onClick={() => navigate('/')}
            >
              <BrandLogo />
            </div>

            {/* Center Pill Navigation (Single-Line, Never Wraps) */}
            <nav className='hidden lg:flex items-center gap-0.5 bg-slate-100/85 border border-slate-200/70 p-1 rounded-full'>
              <NavLink to='/' className={navItemClass}>
                Home
              </NavLink>

              <NavLink to='/doctors' className={navItemClass}>
                Find Doctors
              </NavLink>

              <NavLink to='/symptom-checker' className={navItemClass}>
                Symptom Checker
              </NavLink>

              <NavLink to='/drug-checker' className={navItemClass}>
                Medicine Safety
              </NavLink>

              {token && (
                <NavLink to='/health' className={navItemClass}>
                  My Health
                </NavLink>
              )}

              <NavLink to='/about' className={navItemClass}>
                About
              </NavLink>

              <NavLink to='/contact' className={navItemClass}>
                Contact
              </NavLink>
            </nav>

            {/* Right Side Actions / User Menu */}
            <div className='flex items-center gap-2 shrink-0'>
              {token && userData ? (
                <div className='flex items-center gap-1.5 sm:gap-2'>
                  {/* Direct Quick Button for My Appointments on Desktop */}
                  <button
                    onClick={() => navigate('/my-appointments')}
                    className='hidden xl:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer whitespace-nowrap'
                  >
                    <Calendar className='w-3.5 h-3.5 text-sky-600 shrink-0' />
                    <span>Appointments</span>
                  </button>

                  {/* Live Messages Icon Button with Unread Counter */}
                  <button
                    onClick={() => navigate('/chat')}
                    className='relative p-2.5 rounded-full text-slate-600 hover:text-sky-600 hover:bg-slate-100 transition-colors cursor-pointer'
                    title='Doctor Messages'
                  >
                    <MessageSquare className='w-4 h-4' />
                    {unreadChatCount > 0 && (
                      <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white'>
                        {unreadChatCount > 9 ? '9+' : unreadChatCount}
                      </span>
                    )}
                  </button>

                  {/* Real-Time Notifications Bell Dropdown */}
                  <div className='relative' ref={notifRef}>
                    <button
                      onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                      className='relative p-2.5 rounded-full text-slate-600 hover:text-sky-600 hover:bg-slate-100 transition-colors cursor-pointer'
                      title='Notifications'
                    >
                      <Bell className='w-4 h-4' />
                      {unreadNotifCount > 0 && (
                        <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-pulse'>
                          {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                        </span>
                      )}
                    </button>

                    {showNotifDropdown && (
                      <div className='absolute right-0 top-full mt-2.5 w-80 sm:w-96 z-50 animate-in fade-in duration-150'>
                        <div className='bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden'>
                          <div className='px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between'>
                            <div className='flex items-center gap-2'>
                              <span className='text-xs font-bold text-slate-900'>Live Notifications</span>
                              {unreadNotifCount > 0 && (
                                <span className='px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200'>
                                  {unreadNotifCount} new
                                </span>
                              )}
                            </div>
                            {unreadNotifCount > 0 && (
                              <button
                                onClick={() => markNotificationRead(null)}
                                className='text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer'
                              >
                                <CheckCheck className='w-3.5 h-3.5' />
                                <span>Mark all read</span>
                              </button>
                            )}
                          </div>

                          <div className='max-h-96 overflow-y-auto divide-y divide-slate-100'>
                            {notifications.length === 0 ? (
                              <div className='py-10 px-4 text-center'>
                                <Bell className='w-6 h-6 text-slate-300 mx-auto mb-2' />
                                <p className='text-xs font-semibold text-slate-700'>All caught up!</p>
                                <p className='text-[11px] text-slate-400 mt-0.5'>
                                  Messages, prescription updates, and video call alerts appear here instantly.
                                </p>
                              </div>
                            ) : (
                              notifications.slice(0, 15).map((notif) => (
                                <button
                                  key={notif._id}
                                  onClick={() => {
                                    markNotificationRead(notif._id)
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
                                      <span className='text-[10px] text-slate-400 shrink-0'>
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

                  {/* Profile Dropdown Trigger */}
                  <div className='relative' ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className='flex items-center gap-2 p-1 pr-3 rounded-full border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap'
                    >
                      <img
                        className='w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0'
                        src={userData.image}
                        alt={userData.name}
                      />
                      <span className='hidden md:block text-xs font-semibold text-slate-800 max-w-[96px] truncate'>
                        {userData.name.split(' ')[0]}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                          showDropdown ? 'rotate-180 text-slate-700' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                      <div className='absolute right-0 top-full mt-2.5 w-64 z-50 animate-in fade-in duration-150'>
                        <div className='bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 divide-y divide-slate-100 text-sm'>
                          {/* User Header */}
                          <div className='px-4 py-3'>
                            <p className='text-[11px] font-medium text-slate-400'>Signed in as</p>
                            <p className='text-sm font-bold text-slate-900 truncate mt-0.5'>{userData.name}</p>
                            <p className='text-xs text-slate-500 truncate'>{userData.email}</p>
                          </div>

                          {/* Navigation Items */}
                          <div className='py-1.5'>
                            <button
                              onClick={() => navigate('/my-appointments')}
                              className='w-full px-4 py-2.5 text-left flex items-start gap-3 text-slate-700 hover:bg-sky-50/70 transition-colors cursor-pointer group'
                            >
                              <Calendar className='w-4 h-4 text-sky-600 mt-0.5 shrink-0' />
                              <div>
                                <p className='text-xs font-semibold text-slate-900 group-hover:text-sky-600'>My Appointments</p>
                                <p className='text-[11px] text-slate-500'>Bookings, video calls & prescriptions</p>
                              </div>
                            </button>

                            <button
                              onClick={() => navigate('/health')}
                              className='w-full px-4 py-2.5 text-left flex items-start gap-3 text-slate-700 hover:bg-sky-50/70 transition-colors cursor-pointer group'
                            >
                              <HeartPulse className='w-4 h-4 text-rose-500 mt-0.5 shrink-0' />
                              <div>
                                <p className='text-xs font-semibold text-slate-900 group-hover:text-sky-600'>My Health & Reports</p>
                                <p className='text-[11px] text-slate-500'>Lab trends, uploaded reports & heart rate</p>
                              </div>
                            </button>

                            <button
                              onClick={() => navigate('/chat')}
                              className='w-full px-4 py-2.5 text-left flex items-start gap-3 text-slate-700 hover:bg-sky-50/70 transition-colors cursor-pointer group'
                            >
                              <MessageSquare className='w-4 h-4 text-sky-600 mt-0.5 shrink-0' />
                              <div className='flex-1'>
                                <div className='flex items-center justify-between'>
                                  <p className='text-xs font-semibold text-slate-900 group-hover:text-sky-600'>Doctor Messages</p>
                                  {unreadChatCount > 0 && (
                                    <span className='px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[10px] font-bold'>
                                      {unreadChatCount}
                                    </span>
                                  )}
                                </div>
                                <p className='text-[11px] text-slate-500'>Chat directly with your doctors</p>
                              </div>
                            </button>

                            <button
                              onClick={() => navigate('/my-profile')}
                              className='w-full px-4 py-2.5 text-left flex items-start gap-3 text-slate-700 hover:bg-sky-50/70 transition-colors cursor-pointer group'
                            >
                              <User className='w-4 h-4 text-slate-600 mt-0.5 shrink-0' />
                              <div>
                                <p className='text-xs font-semibold text-slate-900 group-hover:text-sky-600'>My Profile & Allergies</p>
                                <p className='text-[11px] text-slate-500'>Personal info, allergies & medicines</p>
                              </div>
                            </button>
                          </div>

                          {/* Logout */}
                          <div className='pt-1.5'>
                            <button
                              onClick={logout}
                              className='w-full px-4 py-2.5 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 font-semibold text-xs transition-colors cursor-pointer'
                            >
                              <LogOut className='w-4 h-4 text-red-500' />
                              <span>Log Out</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className='flex items-center gap-2 whitespace-nowrap'>
                  <button
                    onClick={() => navigate('/login')}
                    className='hidden sm:inline-flex px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-sky-600 transition-colors cursor-pointer'
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className='px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-full text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer'
                  >
                    Get Started
                  </button>
                </div>
              )}

              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setShowMenu(true)}
                className='p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer'
                aria-label='Open menu'
              >
                <Menu className='w-6 h-6' />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        <div
          className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden ${
            showMenu ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setShowMenu(false)}
        >
          <div
            className={`fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl p-6 flex flex-col justify-between transition-transform duration-300 ease-in-out overflow-y-auto ${
              showMenu ? 'translate-x-0' : 'translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className='flex items-center justify-between pb-5 border-b border-slate-100'>
                <BrandLogo />
                <button
                  onClick={() => setShowMenu(false)}
                  className='p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              <nav className='flex flex-col gap-1 mt-5 text-sm font-medium'>
                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/'
                  className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                >
                  <Home className='w-4 h-4 text-slate-500' />
                  <span>Home</span>
                </NavLink>

                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/doctors'
                  className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                >
                  <Stethoscope className='w-4 h-4 text-sky-600' />
                  <span>Find Doctors</span>
                </NavLink>

                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/symptom-checker'
                  className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                >
                  <Sparkles className='w-4 h-4 text-sky-600' />
                  <span>Symptom Checker</span>
                </NavLink>

                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/drug-checker'
                  className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                >
                  <Pill className='w-4 h-4 text-amber-600' />
                  <span>Medicine Safety Checker</span>
                </NavLink>

                {token && (
                  <>
                    <div className='my-2.5 border-t border-slate-100' />
                    <p className='px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400'>
                      My Account
                    </p>
                    <NavLink
                      onClick={() => setShowMenu(false)}
                      to='/my-appointments'
                      className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                    >
                      <Calendar className='w-4 h-4 text-sky-600' />
                      <span>My Appointments</span>
                    </NavLink>
                    <NavLink
                      onClick={() => setShowMenu(false)}
                      to='/health'
                      className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                    >
                      <HeartPulse className='w-4 h-4 text-rose-500' />
                      <span>My Health & Reports</span>
                    </NavLink>
                    <NavLink
                      onClick={() => setShowMenu(false)}
                      to='/chat'
                      className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center justify-between'
                    >
                      <div className='flex items-center gap-3'>
                        <MessageSquare className='w-4 h-4 text-sky-600' />
                        <span>Doctor Messages</span>
                      </div>
                      {unreadChatCount > 0 && (
                        <span className='px-2 py-0.5 rounded-full bg-sky-600 text-white text-xs font-bold'>
                          {unreadChatCount}
                        </span>
                      )}
                    </NavLink>
                    <NavLink
                      onClick={() => setShowMenu(false)}
                      to='/my-profile'
                      className='px-3.5 py-2.5 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center gap-3'
                    >
                      <User className='w-4 h-4 text-slate-600' />
                      <span>My Profile & Allergies</span>
                    </NavLink>
                  </>
                )}

                <div className='my-2.5 border-t border-slate-100' />
                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/about'
                  className='px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-3'
                >
                  <Info className='w-4 h-4 text-slate-400' />
                  <span>About Us</span>
                </NavLink>
                <NavLink
                  onClick={() => setShowMenu(false)}
                  to='/contact'
                  className='px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-3'
                >
                  <PhoneCall className='w-4 h-4 text-slate-400' />
                  <span>Contact & Help</span>
                </NavLink>
              </nav>
            </div>

            <div className='pt-4 border-t border-slate-100'>
              {token ? (
                <button
                  onClick={() => {
                    logout()
                    setShowMenu(false)
                  }}
                  className='w-full py-3 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 flex items-center justify-center gap-2'
                >
                  <LogOut className='w-4 h-4' />
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigate('/login')
                    setShowMenu(false)
                  }}
                  className='w-full py-3 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700'
                >
                  Sign In / Create Account
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

export default Navbar
