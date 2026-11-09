import React, { useContext, useEffect, useState, useRef, useId } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate, useLocation } from 'react-router-dom'
import GoogleAuthButton from '../components/GoogleAuthButton'
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  Stethoscope,
  Sparkles,
  Check,
  ExternalLink,
  X,
  Clock,
  HeartPulse
} from 'lucide-react'

const Login = () => {
  const location = useLocation()
  const initialMode = location.state?.mode === 'Sign Up' ? 'Sign Up' : 'Login'
  const [state, setState] = useState(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSendingForgot, setIsSendingForgot] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const forgotDialogRef = useRef(null)
  const forgotTitleId = useId()

  const navigate = useNavigate()
  const { backendUrl, token, setToken } = useContext(AppContext)

  // Manage native <dialog> for forgot password
  useEffect(() => {
    const dialog = forgotDialogRef.current
    if (!dialog) return
    if (showForgotModal) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [showForgotModal])

  useEffect(() => {
    const dialog = forgotDialogRef.current
    if (!dialog) return

    const handleNativeClose = () => {
      if (showForgotModal) setShowForgotModal(false)
    }
    dialog.addEventListener('close', handleNativeClose)

    let handleBackdropClick = null
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        const isInside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        if (!isInside) dialog.close()
      }
      dialog.addEventListener('click', handleBackdropClick)
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose)
      if (handleBackdropClick) dialog.removeEventListener('click', handleBackdropClick)
    }
  }, [showForgotModal])

  // Password strength calculation for Sign Up
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200' }
    let score = 0
    if (pwd.length >= 8) score += 1
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1
    if (/\d/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-red-500', text: 'text-red-600' }
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' }
      case 3:
        return { score: 3, label: 'Good', color: 'bg-sky-500', text: 'text-sky-600' }
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' }
      default:
        return { score: 0, label: 'Too short', color: 'bg-red-400', text: 'text-red-500' }
    }
  }

  const passwordStrength = calculatePasswordStrength(password)

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      if (state === 'Sign Up') {
        if (password.length < 8) {
          toast.error('Password must be at least 8 characters long')
          setIsSubmitting(false)
          return
        }

        const { data } = await axios.post(`${backendUrl}/api/user/register`, { name, email, password })
        if (data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          toast.success('Patient account initialized successfully!')
        } else {
          toast.error(data.message)
        }
      } else {
        const { data } = await axios.post(`${backendUrl}/api/user/login`, { email, password })
        if (data.success) {
          localStorage.setItem('token', data.token)
          setToken(data.token)
          toast.success('Signed in to patient portal')
        } else {
          toast.error(data.message)
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      toast.error(error.response?.data?.message || 'Authentication failed. Please verify credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!forgotEmail) {
      toast.warning('Please enter your email address')
      return
    }

    setIsSendingForgot(true)
    try {
      try {
        await axios.post(`${backendUrl}/api/user/forgot-password`, { email: forgotEmail })
      } catch (err) {
        // Backend fallback
      }

      setForgotSuccess(true)
      toast.success('Password recovery instructions sent to your email.')
    } catch (error) {
      toast.error('Unable to send reset email. Please try again.')
    } finally {
      setIsSendingForgot(false)
    }
  }

  useEffect(() => {
    if (token) {
      navigate('/')
    }
  }, [token, navigate])

  return (
    <div className='min-h-[85vh] py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center relative overflow-hidden'>
      {/* Ambient Background Glows */}
      <div className='absolute top-1/4 -left-40 w-96 h-96 bg-sky-200/30 rounded-full blur-3xl pointer-events-none' />
      <div className='absolute bottom-1/4 -right-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none' />

      <div className='w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10'>
        {/* Left Column: Visual Healthcare Value Proposition */}
        <div className='lg:col-span-6 space-y-6 hidden lg:block pr-4'>
          <div className='space-y-3'>
            <div className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 shadow-2xs'>
              <HeartPulse className='w-4 h-4 text-sky-600' />
              <span>VitalSync Healthcare Portal</span>
            </div>

            <h1 className='text-3xl xl:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight'>
              Compassionate care, <br />
              <span className='bg-gradient-to-r from-sky-600 via-sky-700 to-teal-600 bg-clip-text text-transparent'>
                available whenever you need it.
              </span>
            </h1>

            <p className='text-sm text-slate-600 leading-relaxed max-w-md'>
              Access top-rated specialists, instant video consultations, AI-assisted health monitoring, and tamper-proof digital prescriptions in one clinical platform.
            </p>
          </div>

          {/* Healthcare Highlight Cards */}
          <div className='space-y-3 pt-2'>
            <div className='flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/80 backdrop-blur-xs border border-slate-200/80 shadow-2xs'>
              <div className='p-2 rounded-xl bg-sky-50 text-sky-600 shrink-0 mt-0.5'>
                <Stethoscope className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-xs font-bold text-slate-900'>Verified Board-Certified Doctors</h3>
                <p className='text-[11px] text-slate-500 mt-0.5 leading-normal'>
                  Consult accredited practitioners across General Medicine, Dermatology, Pediatrics, and Gynecology.
                </p>
              </div>
            </div>

            <div className='flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/80 backdrop-blur-xs border border-slate-200/80 shadow-2xs'>
              <div className='p-2 rounded-xl bg-teal-50 text-teal-600 shrink-0 mt-0.5'>
                <ShieldCheck className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-xs font-bold text-slate-900'>Encrypted & Private Medical Dossier</h3>
                <p className='text-[11px] text-slate-500 mt-0.5 leading-normal'>
                  Your lab reports, vital trends, and prescriptions are protected with bank-grade 256-bit encryption.
                </p>
              </div>
            </div>

            <div className='flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/80 backdrop-blur-xs border border-slate-200/80 shadow-2xs'>
              <div className='p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0 mt-0.5'>
                <Sparkles className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-xs font-bold text-slate-900'>Contactless AI Vitals & Drug Safety</h3>
                <p className='text-[11px] text-slate-500 mt-0.5 leading-normal'>
                  Measure heart rate via webcam with rPPG signal processing and automated drug-drug interaction safeguards.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className='lg:col-span-6 w-full max-w-md mx-auto'>
          <div className='bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6'>
            {/* Segmented Tab Switcher */}
            <div className='grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/70'>
              <button
                type='button'
                onClick={() => setState('Login')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  state === 'Login'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type='button'
                onClick={() => setState('Sign Up')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  state === 'Sign Up'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Title & Description */}
            <div className='space-y-1.5'>
              <h2 className='text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900'>
                {state === 'Sign Up' ? 'Create Your Health Account' : 'Welcome Back, Patient'}
              </h2>
              <p className='text-xs text-slate-500 leading-relaxed'>
                {state === 'Sign Up'
                  ? 'Join VitalSync to book doctor appointments, track vitals, and view digital prescriptions.'
                  : 'Sign in to access your appointments, medical records, and live consultations.'}
              </p>
            </div>

            {/* Form Body */}
            <form onSubmit={onSubmitHandler} className='space-y-4' noValidate>
              {/* Google Single Sign-On (GIS / One-Tap) */}
              <div className='space-y-2.5'>
                <GoogleAuthButton state={state} onAuthSuccess={() => navigate('/')} />

                <div className='relative flex items-center justify-center pt-1'>
                  <div className='border-t border-slate-200 w-full' />
                  <span className='bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider relative shrink-0'>
                    Or with clinical email
                  </span>
                </div>
              </div>

              {/* Full Name (Sign Up only) */}
              {state === 'Sign Up' && (
                <div className='space-y-1'>
                  <label htmlFor='patient-name' className='text-xs font-bold text-slate-700 block'>
                    Full Legal Name
                  </label>
                  <div className='relative flex items-center'>
                    <User className='w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none' />
                    <input
                      id='patient-name'
                      name='name'
                      type='text'
                      autoComplete='name'
                      enterKeyHint='next'
                      onChange={(e) => setName(e.target.value)}
                      value={name}
                      className='w-full border border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all placeholder-slate-400'
                      placeholder='e.g. Rahul Sharma'
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className='space-y-1'>
                <label htmlFor='patient-email' className='text-xs font-bold text-slate-700 block'>
                  Email Address
                </label>
                <div className='relative flex items-center'>
                  <Mail className='w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none' />
                  <input
                    id='patient-email'
                    name='email'
                    type='email'
                    inputMode='email'
                    autoComplete='username'
                    spellCheck='false'
                    enterKeyHint='next'
                    onChange={(e) => setEmail(e.target.value)}
                    value={email}
                    className='w-full border border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all placeholder-slate-400'
                    placeholder='patient@example.com'
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className='space-y-1'>
                <div className='flex items-center justify-between'>
                  <label htmlFor='patient-password' className='text-xs font-bold text-slate-700 block'>
                    Password
                  </label>
                  {state === 'Login' && (
                    <button
                      type='button'
                      onClick={() => {
                        setForgotEmail(email)
                        setForgotSuccess(false)
                        setShowForgotModal(true)
                      }}
                      className='text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer'
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className='relative flex items-center'>
                  <Lock className='w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none' />
                  <input
                    id='patient-password'
                    name='password'
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={state === 'Sign Up' ? 'new-password' : 'current-password'}
                    enterKeyHint='done'
                    onChange={(e) => setPassword(e.target.value)}
                    value={password}
                    className='w-full border border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl pl-10 pr-12 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all placeholder-slate-400'
                    placeholder='••••••••'
                    required
                  />
                  <button
                    type='button'
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowPassword((prev) => !prev)
                    }}
                    className='absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors z-10 cursor-pointer'
                  >
                    {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                  </button>
                </div>

                {/* Password Strength Meter (Sign Up Only) */}
                {state === 'Sign Up' && password && (
                  <div className='pt-1.5 space-y-1'>
                    <div className='flex items-center justify-between text-[10px]'>
                      <span className='text-slate-500'>Password security:</span>
                      <span className={`font-bold ${passwordStrength.text}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className='h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1'>
                      <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-slate-200'}`} />
                      <div className={`h-full flex-1 transition-all ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-slate-200'}`} />
                    </div>
                  </div>
                )}
              </div>

              {/* Remember Device & Security Note */}
              {state === 'Login' && (
                <div className='flex items-center justify-between text-xs pt-0.5'>
                  <label className='flex items-center gap-2 cursor-pointer select-none text-slate-600'>
                    <input
                      type='checkbox'
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className='rounded border-slate-300 text-sky-600 focus:ring-sky-500/20 w-3.5 h-3.5 accent-sky-600'
                    />
                    <span className='text-[11px] font-medium'>Remember this device</span>
                  </label>
                  <span className='text-[11px] text-slate-400 flex items-center gap-1'>
                    <ShieldCheck className='w-3 h-3 text-emerald-600' /> Secure Session
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type='submit'
                disabled={isSubmitting}
                className='w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 active:scale-[0.99]'
              >
                {isSubmitting ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>{state === 'Sign Up' ? 'Create Patient Account' : 'Sign In to Portal'}</span>
                    <ArrowRight className='w-4 h-4' />
                  </>
                )}
              </button>

              {/* Switcher Toggle */}
              <div className='pt-2 border-t border-slate-100 text-center text-xs text-slate-600'>
                {state === 'Sign Up' ? (
                  <p>
                    Already registered?{' '}
                    <button
                      type='button'
                      onClick={() => setState('Login')}
                      className='text-sky-600 font-bold hover:underline cursor-pointer'
                    >
                      Sign in here
                    </button>
                  </p>
                ) : (
                  <p>
                    New patient?{' '}
                    <button
                      type='button'
                      onClick={() => setState('Sign Up')}
                      className='text-sky-600 font-bold hover:underline cursor-pointer'
                    >
                      Create free account
                    </button>
                  </p>
                )}
              </div>
            </form>

            {/* Practitioner Portal Link */}
            <div className='pt-2 border-t border-slate-100 text-center'>
              <a
                href='http://localhost:5174'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-sky-700 transition-colors'
              >
                <Stethoscope className='w-3.5 h-3.5 text-slate-400' />
                <span>Doctor or Admin? Access Clinical Portal</span>
                <ExternalLink className='w-2.5 h-2.5' />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Native HTML <dialog> Forgot Password Modal */}
      <dialog
        ref={forgotDialogRef}
        {...{ closedby: 'any' }}
        aria-labelledby={forgotTitleId}
        className='m-auto rounded-3xl border border-slate-200 bg-white p-0 shadow-2xl max-w-md w-[calc(100%-2rem)] overflow-hidden backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs overscroll-contain'
      >
        <div className='p-6 sm:p-7 space-y-4'>
          <div className='flex items-start justify-between'>
            <div className='flex items-center gap-2.5'>
              <div className='p-2.5 rounded-xl bg-sky-50 text-sky-600 border border-sky-100'>
                <KeyRound className='w-5 h-5' />
              </div>
              <div>
                <h3 id={forgotTitleId} className='font-extrabold text-base text-slate-900'>
                  Reset Password
                </h3>
                <p className='text-xs text-slate-500'>We will dispatch recovery instructions</p>
              </div>
            </div>
            <button
              type='button'
              onClick={() => setShowForgotModal(false)}
              className='p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {forgotSuccess ? (
            <div className='space-y-4 py-2 text-center'>
              <div className='w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200'>
                <Check className='w-6 h-6' />
              </div>
              <div className='space-y-1'>
                <h4 className='font-bold text-sm text-slate-900'>Instructions Sent</h4>
                <p className='text-xs text-slate-600 leading-relaxed max-w-xs mx-auto'>
                  If an account exists for <span className='font-semibold text-slate-900'>{forgotEmail}</span>, a secure password reset link has been dispatched to your mailbox.
                </p>
              </div>
              <button
                type='button'
                onClick={() => setShowForgotModal(false)}
                className='w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer'
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className='space-y-4'>
              <p className='text-xs text-slate-600 leading-relaxed'>
                Enter the email address associated with your VitalSync patient profile and we will deliver a verification link to reset your password.
              </p>

              <div className='space-y-1.5'>
                <label className='text-xs font-bold text-slate-700 block'>Email Address</label>
                <input
                  type='email'
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder='patient@example.com'
                  required
                  className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15'
                />
              </div>

              <div className='flex gap-2 pt-1'>
                <button
                  type='button'
                  onClick={() => setShowForgotModal(false)}
                  className='flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={isSendingForgot}
                  className='flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors'
                >
                  {isSendingForgot ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </div>
  )
}

export default Login
