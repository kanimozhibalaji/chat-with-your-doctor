import React, { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Pill,
  Camera,
  Edit3,
  Save,
  Plus,
  X,
  KeyRound,
  CheckCircle2,
  Lock,
  HeartHandshake
} from 'lucide-react'
import GoogleAuthButton, { GoogleLogoIcon } from '../components/GoogleAuthButton'

const COMMON_ALLERGY_SUGGESTIONS = [
  'Penicillin',
  'Sulfa drugs',
  'Aspirin',
  'NSAIDs',
  'Codeine',
  'Amoxicillin'
]

const MyProfile = () => {
  const [isEdit, setIsEdit] = useState(false)
  const [image, setImage] = useState(false)
  const [newAllergy, setNewAllergy] = useState('')
  const [newMed, setNewMed] = useState({ name: '', dosage: '' })
  const [saving, setSaving] = useState(false)

  const { token, backendUrl, userData, setUserData, loadUserProfileData } = useContext(AppContext)

  const calculateAge = (dob) => {
    if (!dob) return null
    const birthDate = new Date(dob)
    const diffMs = Date.now() - birthDate.getTime()
    const ageDate = new Date(diffMs)
    const age = Math.abs(ageDate.getUTCFullYear() - 1970)
    return !isNaN(age) && age > 0 && age < 130 ? age : null
  }

  // Update user profile
  const updateUserProfileData = async () => {
    setSaving(true)
    try {
      // Auto-include any pending allergy or medicine typed in the input boxes
      const finalAllergies = [...(userData.allergies || [])]
      if (newAllergy.trim()) {
        const pendingAllergy = newAllergy.trim().toLowerCase()
        if (!finalAllergies.includes(pendingAllergy)) {
          finalAllergies.push(pendingAllergy)
        }
        setNewAllergy('')
      }

      const finalMeds = [...(userData.currentMedications || [])]
      if (newMed.name.trim()) {
        finalMeds.push({ name: newMed.name.trim(), dosage: newMed.dosage.trim() })
        setNewMed({ name: '', dosage: '' })
      }

      const formData = new FormData()
      formData.append('name', userData.name)
      formData.append('phone', userData.phone || '')
      formData.append('address', JSON.stringify(userData.address || {}))
      formData.append('gender', userData.gender || '')
      formData.append('dob', userData.dob || '')
      formData.append('allergies', JSON.stringify(finalAllergies))
      formData.append('currentMedications', JSON.stringify(finalMeds))

      if (image) formData.append('image', image)

      const { data } = await axios.post(
        `${backendUrl}/api/user/update-profile`,
        formData,
        { headers: { token } }
      )

      if (data.success) {
        toast.success('Patient profile updated successfully')
        await loadUserProfileData()
        setIsEdit(false)
        setImage(false)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const addAllergy = (allergyText) => {
    const clean = allergyText.trim().toLowerCase()
    if (!clean) return
    const current = userData.allergies || []
    if (current.includes(clean)) {
      toast.info('Allergy already added')
      return
    }
    setUserData((prev) => ({
      ...prev,
      allergies: [...(prev.allergies || []), clean]
    }))
    setNewAllergy('')
  }

  if (!userData) {
    return (
      <div className='min-h-[80vh] py-8 max-w-4xl mx-auto'>
        <div className='h-96 rounded-3xl bg-slate-200/80 animate-pulse' />
      </div>
    )
  }

  const patientAge = calculateAge(userData.dob)

  return (
    <div className='min-h-[85vh] py-8 max-w-5xl mx-auto space-y-7'>
      {/* Patient Dossier Header Banner */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6'>
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30'>
                <User className='w-3.5 h-3.5' />
                <span>Patient health dossier</span>
              </span>
              <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-slate-300 bg-white/10 border border-white/15'>
                <ShieldCheck className='w-3.5 h-3.5 text-emerald-400' />
                <span>Verified patient record</span>
              </span>
              {patientAge && (
                <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-slate-300 bg-white/10 border border-white/15 tabular-nums'>
                  {patientAge} yrs • {userData.gender || 'Patient'}
                </span>
              )}
            </div>

            <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-white'>
              {userData.name}
            </h1>

            <p className='text-slate-300 text-xs sm:text-sm leading-relaxed max-w-xl'>
              Keep your contact details, reported drug allergies, and current medications updated so your treating doctors can formulate safe prescriptions.
            </p>
          </div>

          <div className='shrink-0'>
            {isEdit ? (
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    setIsEdit(false)
                    setImage(false)
                    loadUserProfileData()
                  }}
                  className='px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  disabled={saving}
                  onClick={updateUserProfileData}
                  className='inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50'
                >
                  <Save className='w-4 h-4' />
                  <span>{saving ? 'Saving...' : 'Save changes'}</span>
                </button>
              </div>
            ) : (
              <button
                type='button'
                onClick={() => setIsEdit(true)}
                className='inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer'
              >
                <Edit3 className='w-4 h-4 text-sky-600' />
                <span>Edit profile</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Grid: Identity Card (Left) + Medical Safety & Contact Cards (Right) */}
      <div className='grid grid-cols-1 lg:grid-cols-12 gap-7'>
        {/* Left Column: Photo & Demographic (4 Cols) */}
        <div className='lg:col-span-4 space-y-6'>
          <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-5 text-center flex flex-col items-center'>
            <div className='relative'>
              {isEdit ? (
                <label htmlFor='profile-image-upload' className='cursor-pointer group block relative'>
                  <img
                    className='w-32 h-32 rounded-3xl object-cover border-2 border-slate-200 group-hover:opacity-75 transition-opacity bg-slate-100 shadow-sm'
                    src={image ? URL.createObjectURL(image) : userData.image}
                    alt={userData.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'Patient')}&background=0284c7&color=fff&bold=true`
                    }}
                  />
                  <div className='absolute inset-0 bg-slate-950/50 rounded-3xl flex flex-col items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity'>
                    <Camera className='w-5 h-5 mb-1' />
                    <span>Upload photo</span>
                  </div>
                  <input
                    onChange={(e) => setImage(e.target.files[0])}
                    type='file'
                    id='profile-image-upload'
                    hidden
                    accept='image/*'
                  />
                </label>
              ) : (
                <img
                  className='w-32 h-32 rounded-3xl object-cover border-2 border-slate-200 bg-slate-100 shadow-sm'
                  src={userData.image}
                  alt={userData.name}
                  onError={(e) => {
                    e.currentTarget.onerror = null
                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'Patient')}&background=0284c7&color=fff&bold=true`
                  }}
                />
              )}
            </div>

            <div className='w-full'>
              {isEdit ? (
                <div className='space-y-1'>
                  <label className='text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-left'>
                    Full name
                  </label>
                  <input
                    type='text'
                    value={userData.name}
                    onChange={(e) => setUserData((prev) => ({ ...prev, name: e.target.value }))}
                    className='w-full border border-slate-200 rounded-xl px-3 py-2 text-center font-bold text-slate-900 text-sm outline-none focus:border-sky-500 bg-slate-50/50 focus:bg-white transition-colors'
                  />
                </div>
              ) : (
                <h2 className='font-bold text-lg text-slate-900'>{userData.name}</h2>
              )}
              <p className='text-xs text-slate-500 mt-1 truncate flex items-center justify-center gap-1.5'>
                <Mail className='w-3.5 h-3.5 text-slate-400' />
                <span>{userData.email}</span>
              </p>
            </div>

            <div className='w-full pt-4 border-t border-slate-100 text-left space-y-3 text-xs'>
              <div className='flex items-center justify-between'>
                <span className='text-slate-500 font-medium'>Gender</span>
                {isEdit ? (
                  <select
                    className='border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-sky-500 bg-white font-medium text-slate-800'
                    onChange={(e) => setUserData((prev) => ({ ...prev, gender: e.target.value }))}
                    value={userData.gender || 'Not Selected'}
                  >
                    <option value='Not Selected'>Not selected</option>
                    <option value='Male'>Male</option>
                    <option value='Female'>Female</option>
                    <option value='Other'>Other</option>
                  </select>
                ) : (
                  <span className='font-bold text-slate-800'>{userData.gender || 'Not specified'}</span>
                )}
              </div>

              <div className='flex items-center justify-between'>
                <span className='text-slate-500 font-medium'>Date of birth</span>
                {isEdit ? (
                  <input
                    type='date'
                    className='border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-sky-500 text-slate-800'
                    onChange={(e) => setUserData((prev) => ({ ...prev, dob: e.target.value }))}
                    value={userData.dob || ''}
                  />
                ) : (
                  <span className='font-bold text-slate-800 tabular-nums'>
                    {userData.dob || 'Not specified'}
                    {patientAge && <span className='text-slate-400 font-normal ml-1'>({patientAge} yrs)</span>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Health Summary Card */}
          <div className='bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs space-y-3'>
            <h3 className='text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5'>
              <ShieldCheck className='w-4 h-4 text-sky-600' /> Health status summary
            </h3>
            <div className='space-y-2 text-xs'>
              <div className='p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between'>
                <span className='text-slate-600'>Reported allergies:</span>
                <span className={`font-bold tabular-nums ${userData.allergies?.length > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {userData.allergies?.length || 0} registered
                </span>
              </div>
              <div className='p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between'>
                <span className='text-slate-600'>Regular medications:</span>
                <span className='font-bold text-slate-700 tabular-nums'>
                  {userData.currentMedications?.length || 0} active
                </span>
              </div>
              <div className='p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between'>
                <span className='text-slate-600'>Account security:</span>
                <span className='font-bold text-emerald-600 flex items-center gap-1'>
                  <Lock className='w-3 h-3' /> Encrypted
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Contact & Medical Safety (8 Cols) */}
        <div className='lg:col-span-8 space-y-6'>
          {/* Contact Information Card */}
          <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4'>
            <h3 className='text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100'>
              <Phone className='w-4 h-4 text-sky-600' />
              <span>Contact information</span>
            </h3>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
              <div>
                <label className='text-slate-500 text-xs font-medium block mb-1.5'>
                  Phone number
                </label>
                {isEdit ? (
                  <input
                    type='tel'
                    inputMode='tel'
                    autoComplete='tel'
                    value={userData.phone || ''}
                    onChange={(e) => setUserData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder='+91 98765 43210'
                    className='w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 bg-slate-50/50 focus:bg-white transition-colors'
                  />
                ) : (
                  <div className='flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm'>
                    <Phone className='w-4 h-4 text-slate-400 shrink-0' />
                    <span className='font-semibold text-slate-800 tabular-nums'>
                      {userData.phone || 'No phone number provided'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className='text-slate-500 text-xs font-medium block mb-1.5'>
                  Home address
                </label>
                {isEdit ? (
                  <div className='space-y-2'>
                    <input
                      type='text'
                      placeholder='Street address'
                      value={userData.address?.line1 || ''}
                      onChange={(e) =>
                        setUserData((prev) => ({
                          ...prev,
                          address: { ...prev.address, line1: e.target.value }
                        }))
                      }
                      className='w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 bg-slate-50/50 focus:bg-white transition-colors'
                    />
                    <input
                      type='text'
                      placeholder='City, State, ZIP'
                      value={userData.address?.line2 || ''}
                      onChange={(e) =>
                        setUserData((prev) => ({
                          ...prev,
                          address: { ...prev.address, line2: e.target.value }
                        }))
                      }
                      className='w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 bg-slate-50/50 focus:bg-white transition-colors'
                    />
                  </div>
                ) : (
                  <div className='p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm leading-snug flex items-start gap-2'>
                    <MapPin className='w-4 h-4 text-slate-400 shrink-0 mt-0.5' />
                    <div>
                      <p className='font-semibold text-slate-800'>{userData.address?.line1 || 'No address added'}</p>
                      {userData.address?.line2 && (
                        <p className='text-slate-500 text-xs mt-0.5'>{userData.address.line2}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Allergies & Regular Medications Card */}
          <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-5'>
            <div className='flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100'>
              <h3 className='text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2'>
                <ShieldAlert className='w-4 h-4 text-rose-600' />
                <span>Allergies & regular medications</span>
              </h3>
              <span className='inline-flex items-center gap-1.5 text-[11px] bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-0.5 rounded-full font-bold'>
                <span className='w-1.5 h-1.5 rounded-full bg-sky-600' />
                Synced to doctor consultations
              </span>
            </div>

            {/* Allergies Section */}
            <div className='space-y-2.5'>
              <div className='flex items-center justify-between'>
                <label className='text-xs font-bold text-slate-800'>
                  Known medicine or food allergies:
                </label>
                {userData.allergies?.length > 0 && (
                  <span className='text-[11px] text-rose-600 font-semibold'>
                    Checked during e-prescriptions
                  </span>
                )}
              </div>

              <div className='flex flex-wrap gap-2 items-center'>
                {userData.allergies && userData.allergies.length > 0 ? (
                  userData.allergies.map((allergy, idx) => (
                    <span
                      key={idx}
                      className='bg-rose-50 text-rose-800 border border-rose-200 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-bold shadow-2xs'
                    >
                      <AlertTriangle className='w-3.5 h-3.5 text-rose-600' />
                      <span>{allergy}</span>
                      {isEdit && (
                        <button
                          type='button'
                          onClick={() =>
                            setUserData((prev) => ({
                              ...prev,
                              allergies: prev.allergies.filter((_, i) => i !== idx)
                            }))
                          }
                          className='text-rose-400 hover:text-rose-800 ml-1 cursor-pointer'
                          title='Remove allergy'
                        >
                          <X className='w-3.5 h-3.5' />
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <p className='text-xs text-slate-400 italic'>No known allergies reported.</p>
                )}
              </div>

              {isEdit && (
                <div className='space-y-2 pt-1'>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      placeholder='Add an allergy (e.g. Penicillin, Aspirin)...'
                      value={newAllergy}
                      onChange={(e) => setNewAllergy(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newAllergy.trim()) {
                          e.preventDefault()
                          addAllergy(newAllergy)
                        }
                      }}
                      className='border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-sky-500 flex-1 max-w-sm bg-slate-50/50 focus:bg-white'
                    />
                    <button
                      type='button'
                      onClick={() => addAllergy(newAllergy)}
                      className='bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3.5 py-2 rounded-xl border border-slate-200 font-bold cursor-pointer transition-colors'
                    >
                      <Plus className='w-3.5 h-3.5 inline mr-1' /> Add
                    </button>
                  </div>

                  {/* Suggestion Chips */}
                  <div className='flex flex-wrap items-center gap-1.5 pt-0.5'>
                    <span className='text-[10px] text-slate-400 font-semibold'>Quick add:</span>
                    {COMMON_ALLERGY_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type='button'
                        onClick={() => addAllergy(sug)}
                        className='px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[10px] font-semibold transition-colors cursor-pointer border border-slate-200/60'
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current Regular Medications */}
            <div className='space-y-2.5 pt-3 border-t border-slate-100'>
              <label className='text-xs font-bold text-slate-800 block'>
                Medicines taken regularly:
              </label>

              <div className='space-y-2'>
                {userData.currentMedications && userData.currentMedications.length > 0 ? (
                  userData.currentMedications.map((med, idx) => (
                    <div
                      key={idx}
                      className='bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs flex items-center justify-between'
                    >
                      <div className='flex items-center gap-2'>
                        <Pill className='w-4 h-4 text-sky-600' />
                        <span className='font-bold text-slate-900 text-sm'>{med.name}</span>
                        {med.dosage && (
                          <span className='text-slate-500 text-xs tabular-nums font-medium'>
                            ({med.dosage})
                          </span>
                        )}
                      </div>
                      {isEdit && (
                        <button
                          type='button'
                          onClick={() =>
                            setUserData((prev) => ({
                              ...prev,
                              currentMedications: prev.currentMedications.filter((_, i) => i !== idx)
                            }))
                          }
                          className='text-slate-400 hover:text-rose-600 cursor-pointer p-1'
                          title='Remove medication'
                        >
                          <X className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className='text-xs text-slate-400 italic'>No regular medicines added yet.</p>
                )}
              </div>

              {isEdit && (
                <div className='flex flex-wrap gap-2 pt-1'>
                  <input
                    type='text'
                    placeholder='Medicine name (e.g. Metformin)...'
                    value={newMed.name}
                    onChange={(e) => setNewMed((prev) => ({ ...prev, name: e.target.value }))}
                    className='border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-sky-500 flex-1 min-w-[160px] bg-slate-50/50 focus:bg-white'
                  />
                  <input
                    type='text'
                    placeholder='Dose (e.g. 500mg)...'
                    value={newMed.dosage}
                    onChange={(e) => setNewMed((prev) => ({ ...prev, dosage: e.target.value }))}
                    className='border border-slate-200 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-sky-500 w-32 bg-slate-50/50 focus:bg-white'
                  />
                  <button
                    type='button'
                    onClick={() => {
                      if (newMed.name.trim()) {
                        setUserData((prev) => ({
                          ...prev,
                          currentMedications: [
                            ...(prev.currentMedications || []),
                            { name: newMed.name.trim(), dosage: newMed.dosage.trim() }
                          ]
                        }))
                        setNewMed({ name: '', dosage: '' })
                      }
                    }}
                    className='bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3.5 py-2 rounded-xl border border-slate-200 font-bold cursor-pointer transition-colors'
                  >
                    <Plus className='w-3.5 h-3.5 inline mr-1' /> Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Connected Google Account & Security Card */}
          <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4'>
            <h3 className='text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 pb-3 border-b border-slate-100'>
              <KeyRound className='w-4 h-4 text-sky-600' />
              <span>Identity & connected accounts</span>
            </h3>

            <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70'>
              <div className='flex items-center gap-3.5'>
                <div className='p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0'>
                  <GoogleLogoIcon className='w-5 h-5' />
                </div>
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='font-bold text-xs text-slate-900'>Google Account</span>
                    {userData.isGoogleAuth || userData.authProvider === 'google' ? (
                      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200'>
                        <CheckCircle2 className='w-3 h-3 text-emerald-600' /> Connected
                      </span>
                    ) : (
                      <span className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600'>
                        Not linked
                      </span>
                    )}
                  </div>
                  <p className='text-[11px] text-slate-500 mt-0.5'>
                    {userData.isGoogleAuth || userData.authProvider === 'google'
                      ? `Linked to Google Identity (${userData.email}). Enables 1-Tap authentication.`
                      : 'Link your Google account for secure, 1-tap sign-in and verified identity.'}
                  </p>
                </div>
              </div>

              {!(userData.isGoogleAuth || userData.authProvider === 'google') && (
                <div className='shrink-0 w-full sm:w-auto'>
                  <GoogleAuthButton state='Link' onAuthSuccess={() => loadUserProfileData()} />
                </div>
              )}
            </div>

            {/* Medical Privacy Reassurance */}
            <div className='pt-2 flex items-center gap-2 text-[11px] text-slate-400'>
              <HeartHandshake className='w-4 h-4 text-slate-400 shrink-0' />
              <span>Your personal health dossier is encrypted and protected under healthcare privacy standards.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MyProfile
