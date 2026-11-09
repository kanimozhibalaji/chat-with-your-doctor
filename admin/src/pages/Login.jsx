import axios from 'axios'
import React, { useContext, useState } from 'react'
import { DoctorContext } from '../context/DoctorContext'
import { AdminContext } from '../context/AdminContext'
import { toast } from 'react-toastify'
import { Stethoscope, ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, ExternalLink, HeartPulse, ShieldAlert } from 'lucide-react'
import AdminGoogleAuthButton from '../components/AdminGoogleAuthButton'

const Login = () => {
  const [state, setState] = useState('Doctor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const backendUrl = import.meta.env.VITE_BACKEND_URL

  const { setDToken } = useContext(DoctorContext)
  const { setAToken } = useContext(AdminContext)

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (state === 'Admin') {
        const { data } = await axios.post(backendUrl + '/api/admin/login', { email, password })
        if (data.success) {
          setAToken(data.token)
          localStorage.setItem('aToken', data.token)
          toast.success('Authenticated to Clinic Administrator workspace')
        } else {
          toast.error(data.message)
        }
      } else {
        const { data } = await axios.post(backendUrl + '/api/doctor/login', { email, password })
        if (data.success) {
          setDToken(data.token)
          localStorage.setItem('dToken', data.token)
          toast.success('Authenticated to Practitioner workspace')
        } else {
          toast.error(data.message)
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden'>
      {/* Ambient background glows */}
      <div className='absolute top-10 left-10 w-96 h-96 bg-sky-100/50 rounded-full blur-3xl pointer-events-none' />
      <div className='absolute bottom-10 right-10 w-96 h-96 bg-teal-100/50 rounded-full blur-3xl pointer-events-none' />

      {/* Brand Header */}
      <div className='inline-flex items-center gap-3 mb-6 select-none relative z-10'>
        <div className='relative w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-teal-600 flex items-center justify-center shadow-md'>
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
        <div className='flex flex-col leading-none'>
          <span className='text-2xl font-extrabold tracking-tight text-slate-900'>
            Vital<span className='text-sky-600'>Sync</span>
          </span>
          <span className='text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase mt-1'>
            Clinical & Admin Portal
          </span>
        </div>
      </div>

      <form
        onSubmit={onSubmitHandler}
        className='w-full max-w-md bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 shadow-xl shadow-slate-200/50 space-y-5 relative z-10'
        noValidate
      >
        {/* Role Switcher Tabs */}
        <div className='grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60'>
          <button
            type='button'
            onClick={() => setState('Doctor')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              state === 'Doctor'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Stethoscope className='w-4 h-4' />
            <span>Doctor workspace</span>
          </button>
          <button
            type='button'
            onClick={() => setState('Admin')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              state === 'Admin'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className='w-4 h-4' />
            <span>Clinic admin</span>
          </button>
        </div>

        <div className='text-center pt-1'>
          <h1 className='text-xl font-bold text-slate-900'>
            {state === 'Doctor' ? 'Sign in to doctor workspace' : 'Sign in to clinic admin'}
          </h1>
          <p className='text-xs text-slate-500 mt-1 leading-relaxed'>
            {state === 'Doctor'
              ? 'Access consultations, video rooms, clinical records & prescriptions.'
              : 'Oversee clinic doctors, appointment schedules, and patient bookings.'}
          </p>
        </div>

        <div className='space-y-4'>
          {/* Google SSO Button */}
          <div className='space-y-3 pb-1'>
            <AdminGoogleAuthButton role={state} />
            <div className='relative flex items-center justify-center pt-1'>
              <div className='border-t border-slate-200 w-full' />
              <span className='bg-white px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider relative shrink-0'>
                Or sign in with email & password
              </span>
            </div>
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='admin-email' className='block text-xs font-bold text-slate-700'>
              Clinical email address
            </label>
            <div className='relative flex items-center'>
              <Mail className='w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none' />
              <input
                id='admin-email'
                name='email'
                type='email'
                inputMode='email'
                autoComplete='username'
                spellCheck='false'
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                className='border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-sky-500 rounded-xl w-full pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none transition-colors'
                placeholder={state === 'Doctor' ? 'doctor@vitalsync.com' : 'admin@vitalsync.com'}
                required
              />
            </div>
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='admin-password' className='block text-xs font-bold text-slate-700'>
              Password
            </label>
            <div className='relative flex items-center'>
              <Lock className='w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none' />
              <input
                id='admin-password'
                name='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='current-password'
                onChange={(e) => setPassword(e.target.value)}
                value={password}
                className='border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-sky-500 rounded-xl w-full pl-10 pr-12 py-2.5 text-sm text-slate-900 outline-none transition-colors'
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
          </div>
        </div>

        <button
          disabled={loading}
          type='submit'
          className='bg-sky-600 hover:bg-sky-500 text-white w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50'
        >
          {loading ? (
            <>
              <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Enter {state === 'Doctor' ? 'Doctor' : 'Admin'} workspace</span>
              <ArrowRight className='w-4 h-4' />
            </>
          )}
        </button>

        {/* Link to Patient App */}
        <div className='pt-2 border-t border-slate-100 text-center'>
          <a
            href='http://localhost:5173'
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-sky-700 transition-colors'
          >
            <HeartPulse className='w-3.5 h-3.5 text-slate-400' />
            <span>Looking for patient portal? Go to patient app</span>
            <ExternalLink className='w-2.5 h-2.5' />
          </a>
        </div>
      </form>

      {/* Security & Audit Footer */}
      <div className='flex items-center justify-center gap-4 text-[11px] text-slate-400 mt-4 select-none relative z-10 text-center'>
        <span className='flex items-center gap-1'>
          <Lock className='w-3 h-3 text-slate-400' /> Restricted clinical access
        </span>
        <span>•</span>
        <span className='flex items-center gap-1'>
          <ShieldAlert className='w-3 h-3 text-amber-500' /> Session audit logged
        </span>
        <span>•</span>
        <span className='flex items-center gap-1'>
          <ShieldCheck className='w-3 h-3 text-emerald-600' /> HIPAA compliant
        </span>
      </div>
    </div>
  )
}

export default Login
