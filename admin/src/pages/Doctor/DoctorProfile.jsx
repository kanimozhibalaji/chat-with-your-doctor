import React, { useContext, useEffect, useState } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { toast } from 'react-toastify'
import axios from 'axios'
import {
  Stethoscope,
  Award,
  MapPin,
  Wallet,
  Edit3,
  Check,
  X,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  FileText,
  Building2,
  Clock,
  Sparkles
} from 'lucide-react'

const DoctorProfile = () => {
  const { dToken, profileData, setProfileData, getProfileData } = useContext(DoctorContext)
  const { currency, backendUrl } = useContext(AppContext)
  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)

  const updateProfile = async () => {
    setSaving(true)
    try {
      const updateData = {
        address: profileData.address,
        fees: Number(profileData.fees),
        about: profileData.about,
        available: profileData.available
      }

      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        updateData,
        { headers: { dToken } }
      )

      if (data.success) {
        toast.success('Doctor profile and clinic settings updated')
        setIsEdit(false)
        getProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
      console.log(error)
    } finally {
      setSaving(false)
    }
  }

  const quickToggleAvailability = async () => {
    if (isEdit) {
      setProfileData((prev) => ({ ...prev, available: !prev.available }))
      return
    }
    try {
      const nextAvailable = !profileData.available
      setProfileData((prev) => ({ ...prev, available: nextAvailable }))
      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        {
          address: profileData.address,
          fees: Number(profileData.fees),
          about: profileData.about,
          available: nextAvailable
        },
        { headers: { dToken } }
      )
      if (data.success) {
        toast.success(
          nextAvailable
            ? 'You are now marked as Available for new patient bookings'
            : 'New patient bookings are now paused'
        )
        getProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    if (dToken) {
      getProfileData()
    }
  }, [dToken, getProfileData])

  if (!profileData) {
    return (
      <div className='flex-1 p-6 sm:p-8 max-w-5xl mx-auto'>
        <div className='h-96 rounded-3xl bg-slate-200/80 animate-pulse' />
      </div>
    )
  }

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl min-w-0 mx-auto space-y-7'>
      {/* Top Header Card */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6'>
          <div className='flex flex-col sm:flex-row sm:items-center gap-5'>
            <img
              className='w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-slate-800 border-2 border-white/20 shadow-md shrink-0'
              src={profileData.image}
              alt={profileData.name}
            />
            <div className='space-y-1.5'>
              <div className='inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold'>
                <ShieldCheck className='w-3.5 h-3.5 text-emerald-400' />
                <span>Verified Clinical Specialist</span>
              </div>
              <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-white'>
                {profileData.name}
              </h1>
              <div className='flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-slate-300'>
                <span className='inline-flex items-center gap-1.5 font-semibold text-sky-200'>
                  <Stethoscope className='w-4 h-4 text-sky-400' />
                  {profileData.degree} • {profileData.speciality}
                </span>
                <span className='px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-white inline-flex items-center gap-1 tabular-nums'>
                  <Award className='w-3.5 h-3.5 text-amber-300' />
                  {profileData.experience} Experience
                </span>
              </div>
            </div>
          </div>

          <div className='shrink-0 flex items-center gap-2.5'>
            {isEdit ? (
              <>
                <button
                  type='button'
                  disabled={saving}
                  onClick={() => {
                    setIsEdit(false)
                    getProfileData()
                  }}
                  className='px-4 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  disabled={saving}
                  onClick={updateProfile}
                  className='px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer'
                >
                  <Check className='w-4 h-4 stroke-[2.5]' />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </>
            ) : (
              <button
                type='button'
                onClick={() => setIsEdit(true)}
                className='px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer'
              >
                <Edit3 className='w-4 h-4 text-sky-600' />
                <span>Edit Profile & Fee</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Settings Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Availability Control Card */}
        <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-0.5'>
              <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2'>
                <Clock className='w-4 h-4 text-sky-600' />
                <span>Booking Availability Switch</span>
              </h3>
              <p className='text-base font-extrabold text-slate-900 flex items-center gap-2 mt-1'>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    profileData.available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{profileData.available ? 'Accepting New Appointments' : 'Bookings Currently Paused'}</span>
              </p>
            </div>

            <button
              type='button'
              onClick={quickToggleAvailability}
              className='p-1 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer'
              title='Toggle Availability'
            >
              {profileData.available ? (
                <ToggleRight className='w-9 h-9 text-emerald-500' />
              ) : (
                <ToggleLeft className='w-9 h-9 text-amber-500' />
              )}
            </button>
          </div>

          <p className='text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100'>
            {profileData.available
              ? 'Patients can browse your calendar and book teleconsultations according to your slot schedule.'
              : 'Your profile is currently hidden from the patient discovery list. Existing bookings remain intact.'}
          </p>
        </div>

        {/* Consultation Fee Card */}
        <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-3'>
          <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2'>
            <Wallet className='w-4 h-4 text-emerald-600' />
            <span>Consultation Fee (Per Visit)</span>
          </h3>

          {isEdit ? (
            <div className='flex items-center gap-2 mt-2'>
              <span className='text-lg font-extrabold text-slate-700'>{currency}</span>
              <input
                type='number'
                min='0'
                onChange={(e) => setProfileData((prev) => ({ ...prev, fees: e.target.value }))}
                value={profileData.fees}
                className='w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-base font-bold text-slate-900 outline-none focus:border-sky-500'
              />
            </div>
          ) : (
            <p className='text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums'>
              {currency}{profileData.fees}
              <span className='text-xs font-medium text-slate-500 ml-1.5'>/ consultation</span>
            </p>
          )}

          <p className='text-xs text-slate-500 pt-2 border-t border-slate-100'>
            Applied automatically during patient booking checkout.
          </p>
        </div>
      </div>

      {/* Clinic Address & Bio */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Clinic Location */}
        <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4'>
          <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2'>
            <MapPin className='w-4 h-4 text-sky-600' />
            <span>Clinic & Hospital Location</span>
          </h3>

          {isEdit ? (
            <div className='space-y-3'>
              <input
                type='text'
                placeholder='Address Line 1 (Street / Clinic Name)'
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    address: { ...prev.address, line1: e.target.value }
                  }))
                }
                value={profileData.address?.line1 || ''}
                className='w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-sky-500'
              />
              <input
                type='text'
                placeholder='Address Line 2 (City / State / ZIP)'
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    address: { ...prev.address, line2: e.target.value }
                  }))
                }
                value={profileData.address?.line2 || ''}
                className='w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 outline-none focus:border-sky-500'
              />
            </div>
          ) : (
            <div className='text-sm font-semibold text-slate-800 space-y-1 p-4 bg-slate-50 rounded-2xl border border-slate-100'>
              <p>{profileData.address?.line1 || 'No address specified'}</p>
              <p className='text-slate-500 font-medium text-xs'>{profileData.address?.line2}</p>
            </div>
          )}
        </div>

        {/* Clinical Bio / About Doctor */}
        <div className='bg-white border border-slate-200 rounded-3xl p-6 shadow-2xs space-y-4'>
          <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2'>
            <FileText className='w-4 h-4 text-indigo-600' />
            <span>Professional Bio & Approach to Care</span>
          </h3>

          {isEdit ? (
            <textarea
              onChange={(e) => setProfileData((prev) => ({ ...prev, about: e.target.value }))}
              className='w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-800 leading-relaxed outline-none focus:border-sky-500'
              rows={4}
              value={profileData.about || ''}
              placeholder='Describe your clinical training, areas of focus, and patient communication philosophy...'
            />
          ) : (
            <p className='text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line p-4 bg-slate-50 rounded-2xl border border-slate-100'>
              {profileData.about || 'No biographical overview provided.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DoctorProfile
