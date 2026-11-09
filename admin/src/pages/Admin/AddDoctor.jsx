import React, { useContext, useState } from 'react'
import { toast } from 'react-toastify'
import axios from 'axios'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus,
  Camera,
  Stethoscope,
  GraduationCap,
  MapPin,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react'

const SPECIALTIES = [
  'General physician',
  'Gynecologist',
  'Dermatologist',
  'Pediatricians',
  'Neurologist',
  'Gastroenterologist',
  'Cardiologist',
  'Orthopedic',
  'Psychiatrist',
  'Ophthalmologist',
  'ENT Specialist',
  'Dentist'
]

const DEGREE_SUGGESTIONS = {
  'General physician': 'MBBS, MD (Internal Medicine)',
  'Gynecologist': 'MBBS, MS (Obstetrics & Gynecology)',
  'Dermatologist': 'MBBS, MD (Dermatology)',
  'Pediatricians': 'MBBS, MD (Pediatrics)',
  'Neurologist': 'MBBS, DM (Neurology)',
  'Gastroenterologist': 'MBBS, DM (Gastroenterology)',
  'Cardiologist': 'MBBS, DM (Cardiology)',
  'Orthopedic': 'MBBS, MS (Orthopedics)',
  'Psychiatrist': 'MBBS, MD (Psychiatry)',
  'Ophthalmologist': 'MBBS, MS (Ophthalmology)',
  'ENT Specialist': 'MBBS, MS (Otorhinolaryngology)',
  'Dentist': 'BDS, MDS (Dental Surgery)'
}

const AddDoctor = () => {
  const [docImg, setDocImg] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [experience, setExperience] = useState('5 Years')
  const [fees, setFees] = useState('600')
  const [about, setAbout] = useState('')
  const [speciality, setSpeciality] = useState('General physician')
  const [degree, setDegree] = useState('MBBS, MD (Internal Medicine)')
  const [address1, setAddress1] = useState('VitalSync Main Medical Center')
  const [address2, setAddress2] = useState('Health District, Suite 200')
  const [submitting, setSubmitting] = useState(false)

  const { backendUrl, currency } = useContext(AppContext)
  const { aToken, getAllDoctors, getDashData } = useContext(AdminContext)
  const navigate = useNavigate()

  const handleSpecialityChange = (newSpec) => {
    setSpeciality(newSpec)
    if (!degree || Object.values(DEGREE_SUGGESTIONS).includes(degree)) {
      setDegree(DEGREE_SUGGESTIONS[newSpec] || 'MBBS, MD')
    }
  }

  const generateSmartBio = () => {
    const cleanName = name.trim()
      ? name.trim().startsWith('Dr.')
        ? name.trim()
        : `Dr. ${name.trim()}`
      : 'This specialist'
    const bio = `${cleanName} is a board-certified ${speciality} holding ${
      degree || 'advanced medical credentials'
    } with ${experience} of clinical experience. Dedicated to evidence-based diagnosis, preventive care, and personalized treatment plans, ${cleanName} provides thorough 100% online video teleconsultations and verified digital prescriptions.`
    setAbout(bio)
    toast.info('Generated professional clinical biography')
  }

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
    let pwd = 'Doc@'
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(pwd)
    setShowPassword(true)
    toast.info('Generated strong login password')
  }

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      if (docImg) {
        formData.append('image', docImg)
      }
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('experience', experience)
      formData.append('fees', Number(fees))
      formData.append('about', about)
      formData.append('speciality', speciality)
      formData.append('degree', degree)
      formData.append('address', JSON.stringify({ line1: address1, line2: address2 }))

      const { data } = await axios.post(backendUrl + '/api/admin/add-doctor', formData, {
        headers: { aToken }
      })
      if (data.success) {
        toast.success(data.message)
        getAllDoctors()
        getDashData()
        setDocImg(false)
        setName('')
        setPassword('')
        setEmail('')
        setAbout('')
        navigate('/doctor-list')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
      console.log(error)
    } finally {
      setSubmitting(false)
    }
  }

  const previewName = name.trim()
    ? name.trim().startsWith('Dr.')
      ? name.trim()
      : `Dr. ${name.trim()}`
    : 'Dr. Specialist Name'

  const previewImgUrl = docImg
    ? URL.createObjectURL(docImg)
    : 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&auto=format&fit=crop&q=80'

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
            Onboard New Medical Specialist
          </h1>
          <p className='text-xs sm:text-sm text-slate-500 mt-0.5'>
            Register a new doctor into the clinic directory with instant booking & video consultation access.
          </p>
        </div>

        <button
          type='button'
          onClick={() => navigate('/doctor-list')}
          className='px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto'
        >
          <ArrowLeft className='w-3.5 h-3.5' />
          <span>Back to Doctors Directory</span>
        </button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
        {/* Left: Onboarding Form (8 cols) */}
        <form
          onSubmit={onSubmitHandler}
          className='lg:col-span-8 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6'
        >
          {/* Portrait Upload Section */}
          <div className='flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80'>
            <div className='flex items-center gap-4'>
              <label htmlFor='doc-img' className='relative cursor-pointer group shrink-0'>
                <img
                  className='w-20 h-20 rounded-2xl object-cover object-top border-2 border-white shadow-sm bg-sky-50'
                  src={previewImgUrl}
                  alt='Doctor preview'
                />
                <div className='absolute inset-0 rounded-2xl bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white'>
                  <Camera className='w-5 h-5' />
                </div>
              </label>
              <input
                onChange={(e) => e.target.files?.[0] && setDocImg(e.target.files[0])}
                type='file'
                id='doc-img'
                accept='image/*'
                hidden
              />
              <div>
                <p className='text-sm font-extrabold text-slate-900'>Doctor Profile Portrait</p>
                <p className='text-xs text-slate-500 mt-0.5'>
                  Click the avatar to upload a custom photo (JPG/PNG), or use the default clinical portrait.
                </p>
                <label
                  htmlFor='doc-img'
                  className='inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 mt-1.5 cursor-pointer'
                >
                  <Camera className='w-3.5 h-3.5' />
                  <span>{docImg ? 'Change Selected Photo' : 'Upload Custom Photo'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Form Grid */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>Doctor Full Name *</label>
              <input
                onChange={(e) => setName(e.target.value)}
                value={name}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900 font-medium'
                type='text'
                placeholder='e.g. Dr. Aarav Mehta'
                required
              />
            </div>

            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>Medical Specialty *</label>
              <select
                onChange={(e) => handleSpecialityChange(e.target.value)}
                value={speciality}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 bg-white text-slate-900 font-semibold cursor-pointer'
              >
                {SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>Work / Login Email *</label>
              <input
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900'
                type='email'
                placeholder='doctor@vitalsync.com'
                required
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1.5'>
                <label className='font-bold text-slate-700'>Doctor Portal Password *</label>
                <button
                  type='button'
                  onClick={generateStrongPassword}
                  className='text-[11px] font-bold text-sky-600 hover:underline inline-flex items-center gap-1 cursor-pointer'
                >
                  <KeyRound className='w-3 h-3' />
                  <span>Auto-Generate</span>
                </button>
              </div>
              <div className='relative flex items-center'>
                <input
                  onChange={(e) => setPassword(e.target.value)}
                  value={password}
                  className='w-full border border-slate-200 rounded-xl pl-3.5 pr-12 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900 bg-white'
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Minimum 8 characters'
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

            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>Medical Degree & Qualifications *</label>
              <input
                onChange={(e) => setDegree(e.target.value)}
                value={degree}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900'
                type='text'
                placeholder='e.g. MBBS, MD'
                required
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='font-bold text-slate-700 block mb-1.5'>Experience *</label>
                <select
                  onChange={(e) => setExperience(e.target.value)}
                  value={experience}
                  className='w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-sky-500 bg-white text-slate-900 cursor-pointer'
                >
                  <option value='1 Year'>1 Year</option>
                  <option value='2 Years'>2 Years</option>
                  <option value='3 Years'>3 Years</option>
                  <option value='4 Years'>4 Years</option>
                  <option value='5 Years'>5 Years</option>
                  <option value='6 Years'>6 Years</option>
                  <option value='7 Years'>7 Years</option>
                  <option value='8 Years'>8 Years</option>
                  <option value='9 Years'>9 Years</option>
                  <option value='10+ Years'>10+ Years</option>
                  <option value='12 Years'>12 Years</option>
                  <option value='15+ Years'>15+ Years</option>
                </select>
              </div>

              <div>
                <label className='font-bold text-slate-700 block mb-1.5'>
                  Consultation Fee ({currency}) *
                </label>
                <input
                  onChange={(e) => setFees(e.target.value)}
                  value={fees}
                  className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900 font-bold'
                  type='number'
                  min='0'
                  placeholder='600'
                  required
                />
              </div>
            </div>

            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>Clinic Building / Street *</label>
              <input
                onChange={(e) => setAddress1(e.target.value)}
                value={address1}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900'
                type='text'
                placeholder='Clinic wing or street address'
                required
              />
            </div>

            <div>
              <label className='font-bold text-slate-700 block mb-1.5'>City / Floor / Suite *</label>
              <input
                onChange={(e) => setAddress2(e.target.value)}
                value={address2}
                className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-sky-500 text-slate-900'
                type='text'
                placeholder='Suite, City, State'
                required
              />
            </div>
          </div>

          {/* About / Clinical Bio */}
          <div>
            <div className='flex items-center justify-between mb-1.5'>
              <label className='text-xs font-bold text-slate-700'>
                Doctor Biography & Clinical Focus *
              </label>
              <button
                type='button'
                onClick={generateSmartBio}
                className='text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 cursor-pointer'
              >
                <Sparkles className='w-3.5 h-3.5' />
                <span>Auto-Write Professional Bio</span>
              </button>
            </div>
            <textarea
              onChange={(e) => setAbout(e.target.value)}
              value={about}
              className='w-full p-3.5 border border-slate-200 rounded-2xl text-sm outline-none focus:border-sky-500 text-slate-800 leading-relaxed'
              rows={4}
              placeholder='Describe the doctor’s clinical expertise, patient care philosophy, and specializations...'
              required
            />
          </div>

          <div className='pt-2 flex items-center justify-end gap-3 border-t border-slate-100'>
            <button
              type='submit'
              disabled={submitting}
              className='px-7 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50'
            >
              <UserPlus className='w-4 h-4' />
              <span>{submitting ? 'Onboarding Specialist...' : 'Add Doctor to Clinic Directory'}</span>
            </button>
          </div>
        </form>

        {/* Right: Live Patient Portal Card Preview (4 cols) */}
        <div className='lg:col-span-4 space-y-4 sticky top-22'>
          <div className='bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-extrabold uppercase tracking-wider text-slate-400'>
                Live Patient Card Preview
              </span>
              <span className='px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold'>
                Instant Sync
              </span>
            </div>

            {/* Preview Card */}
            <div className='border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs'>
              <div className='relative aspect-4/3 bg-sky-50/70 overflow-hidden'>
                <img
                  src={previewImgUrl}
                  alt={previewName}
                  className='w-full h-full object-cover object-top'
                />
                <span className='absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50/95 text-emerald-700 border border-emerald-200'>
                  <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                  Available
                </span>
              </div>

              <div className='p-4 space-y-2.5'>
                <div>
                  <span className='inline-block text-[11px] font-bold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100 mb-1'>
                    {speciality}
                  </span>
                  <h3 className='text-base font-extrabold text-slate-900 truncate'>{previewName}</h3>
                  <p className='text-xs text-slate-500 flex items-center gap-1.5 mt-0.5'>
                    <GraduationCap className='w-3.5 h-3.5 text-slate-400 shrink-0' />
                    <span className='truncate'>
                      {degree || 'MBBS, MD'} • {experience}
                    </span>
                  </p>
                </div>

                {about && (
                  <p className='text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100'>
                    {about}
                  </p>
                )}

                <div className='pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs'>
                  <div>
                    <span className='text-slate-400 block text-[10px]'>Consultation Fee</span>
                    <span className='font-extrabold text-slate-900 text-sm'>
                      {currency}{fees || '0'}
                    </span>
                  </div>
                  <span className='px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs'>
                    Book Visit →
                  </span>
                </div>
              </div>
            </div>

            <div className='bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-xs text-slate-600 space-y-1.5'>
              <p className='font-bold text-slate-800 flex items-center gap-1.5'>
                <CheckCircle2 className='w-4 h-4 text-emerald-600 shrink-0' />
                <span>Ready for Doctor Workspace</span>
              </p>
              <p className='text-[11px] text-slate-500 leading-relaxed'>
                Once added, the doctor can immediately sign in to the Doctor Workspace using their email and password to manage appointments, video calls, and prescriptions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddDoctor
