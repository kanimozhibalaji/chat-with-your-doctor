import React, { useContext, useEffect, useState, useMemo } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import {
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  Search,
  Edit3,
  Trash2,
  UserPlus,
  MapPin,
  GraduationCap,
  Briefcase,
  LayoutGrid,
  List,
  X,
  Save,
  Camera,
  AlertTriangle,
  Eye,
  EyeOff
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

const EXPERIENCE_OPTIONS = [
  '1 Year',
  '2 Years',
  '3 Years',
  '4 Years',
  '5 Years',
  '6 Years',
  '7 Years',
  '8 Years',
  '9 Years',
  '10+ Years',
  '12 Years',
  '15+ Years'
]

const DoctorsList = () => {
  const {
    doctors,
    changeAvailability,
    updateDoctor,
    deleteDoctor,
    aToken,
    getAllDoctors
  } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSpeciality, setSelectedSpeciality] = useState('All')
  const [availabilityFilter, setAvailabilityFilter] = useState('all') // 'all' | 'available' | 'paused'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  // Edit Doctor Modal State
  const [editingDoc, setEditingDoc] = useState(null)
  const [editImage, setEditImage] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  // Delete Doctor Modal State
  const [deletingDoc, setDeletingDoc] = useState(null)
  const [deletingLoading, setDeletingLoading] = useState(false)

  useEffect(() => {
    if (aToken) {
      getAllDoctors()
    }
  }, [aToken, getAllDoctors])

  const specialitiesList = useMemo(() => {
    const dynamicSpecs = Array.from(new Set(doctors.map((d) => d.speciality).filter(Boolean)))
    const combined = Array.from(new Set([...SPECIALTIES, ...dynamicSpecs]))
    return ['All', ...combined]
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (selectedSpeciality !== 'All' && doc.speciality !== selectedSpeciality) {
        return false
      }
      if (availabilityFilter === 'available' && !doc.available) return false
      if (availabilityFilter === 'paused' && doc.available) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = (doc.name || '').toLowerCase().includes(q)
        const specMatch = (doc.speciality || '').toLowerCase().includes(q)
        const degMatch = (doc.degree || '').toLowerCase().includes(q)
        const emailMatch = (doc.email || '').toLowerCase().includes(q)
        return nameMatch || specMatch || degMatch || emailMatch
      }
      return true
    })
  }, [doctors, selectedSpeciality, availabilityFilter, searchQuery])

  const openEditModal = (doc) => {
    setEditImage(null)
    setEditingDoc({
      _id: doc._id,
      name: doc.name || '',
      email: doc.email || '',
      password: '',
      speciality: doc.speciality || 'General physician',
      degree: doc.degree || '',
      experience: doc.experience || '1 Year',
      fees: doc.fees || 500,
      about: doc.about || '',
      addressLine1: doc.address?.line1 || '',
      addressLine2: doc.address?.line2 || '',
      available: Boolean(doc.available),
      image: doc.image || ''
    })
  }

  const handleSaveDoctorEdit = async (e) => {
    e.preventDefault()
    if (!editingDoc) return
    setSavingEdit(true)
    try {
      const formData = new FormData()
      formData.append('docId', editingDoc._id)
      formData.append('name', editingDoc.name)
      formData.append('email', editingDoc.email)
      formData.append('speciality', editingDoc.speciality)
      formData.append('degree', editingDoc.degree)
      formData.append('experience', editingDoc.experience)
      formData.append('fees', Number(editingDoc.fees))
      formData.append('about', editingDoc.about)
      formData.append('available', editingDoc.available)
      formData.append(
        'address',
        JSON.stringify({
          line1: editingDoc.addressLine1,
          line2: editingDoc.addressLine2
        })
      )
      if (editingDoc.password && editingDoc.password.trim().length >= 8) {
        formData.append('password', editingDoc.password.trim())
      }
      if (editImage) {
        formData.append('image', editImage)
      }

      const ok = await updateDoctor(formData)
      if (ok) {
        setEditingDoc(null)
        setEditImage(null)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return
    setDeletingLoading(true)
    try {
      const ok = await deleteDoctor(deletingDoc._id)
      if (ok) {
        setDeletingDoc(null)
      }
    } finally {
      setDeletingLoading(false)
    }
  }

  const availableCount = doctors.filter((d) => d.available).length
  const pausedCount = doctors.length - availableCount

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 space-y-6'>
      {/* Header & Quick Stats */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
            Manage Clinic Doctors
          </h1>
          <p className='text-xs sm:text-sm text-slate-500 mt-0.5'>
            Search specialists, update consultation fees & credentials, or toggle booking availability in real time.
          </p>
        </div>

        <button
          onClick={() => navigate('/add-doctor')}
          className='px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer self-start sm:self-auto shrink-0'
        >
          <UserPlus className='w-4 h-4' />
          <span>Onboard New Doctor</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className='bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-3'>
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
          {/* Availability Tabs */}
          <div className='inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100/80 border border-slate-200/60 rounded-xl'>
            {[
              { id: 'all', label: 'All Doctors', count: doctors.length },
              { id: 'available', label: 'Accepting Patients', count: availableCount },
              { id: 'paused', label: 'Paused', count: pausedCount }
            ].map((tab) => {
              const active = availabilityFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setAvailabilityFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[11px] font-bold ${
                      active ? 'bg-sky-50 text-sky-700' : 'bg-slate-200/70 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search + Specialty Select + View Toggle */}
          <div className='flex flex-wrap items-center gap-2.5'>
            <div className='relative flex-1 sm:w-64'>
              <Search className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search name, specialty, degree...'
                className='w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-sky-500 text-slate-800'
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              )}
            </div>

            <select
              value={selectedSpeciality}
              onChange={(e) => setSelectedSpeciality(e.target.value)}
              className='px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:border-sky-500 cursor-pointer'
            >
              {specialitiesList.map((spec) => (
                <option key={spec} value={spec}>
                  {spec === 'All' ? 'All Specialties' : spec}
                </option>
              ))}
            </select>

            <div className='inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl'>
              <button
                type='button'
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-sky-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title='Grid View'
              >
                <LayoutGrid className='w-4 h-4' />
              </button>
              <button
                type='button'
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'table' ? 'bg-white text-sky-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title='Table View'
              >
                <List className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredDoctors.length === 0 ? (
        <div className='bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3'>
          <Stethoscope className='w-10 h-10 text-slate-300 mx-auto' />
          <p className='text-sm font-bold text-slate-800'>No matching doctors found</p>
          <p className='text-xs text-slate-500'>Try clearing your search or specialty filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
          {filteredDoctors.map((item, index) => (
            <div
              className='bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs hover:shadow-md hover:border-sky-200 transition-all group flex flex-col justify-between'
              key={item._id || index}
            >
              <div>
                <div className='relative bg-sky-50/70 group-hover:bg-sky-100/60 transition-colors overflow-hidden aspect-4/3'>
                  <img
                    className='w-full h-full object-cover object-top group-hover:scale-103 transition-transform duration-300'
                    src={item.image}
                    alt={item.name}
                  />
                  <span
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-xs ${
                      item.available
                        ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50/95 text-amber-700 border-amber-200'
                    }`}
                  >
                    {item.available ? 'Accepting Patients' : 'Paused'}
                  </span>
                  <span className='absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-xs font-extrabold backdrop-blur-xs'>
                    {currency}{item.fees} / visit
                  </span>
                </div>

                <div className='p-4 space-y-2'>
                  <div>
                    <p className='text-slate-900 text-base font-extrabold truncate'>{item.name}</p>
                    <p className='text-sky-600 text-xs font-semibold flex items-center gap-1 mt-0.5'>
                      <Stethoscope className='w-3.5 h-3.5 shrink-0' />
                      <span className='truncate'>{item.speciality}</span>
                    </p>
                  </div>

                  <div className='pt-1 space-y-1 text-xs text-slate-500'>
                    <p className='flex items-center gap-1.5 truncate'>
                      <GraduationCap className='w-3.5 h-3.5 text-slate-400 shrink-0' />
                      <span className='truncate'>{item.degree || 'MD'} • {item.experience || 'Verified'}</span>
                    </p>
                    {item.address?.line1 && (
                      <p className='flex items-center gap-1.5 truncate'>
                        <MapPin className='w-3.5 h-3.5 text-slate-400 shrink-0' />
                        <span className='truncate'>{item.address.line1}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className='p-4 pt-3 border-t border-slate-100 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-semibold text-slate-600'>
                    {item.available ? 'Bookings Open' : 'Bookings Paused'}
                  </span>
                  <button
                    type='button'
                    onClick={() => changeAvailability(item._id)}
                    className='text-slate-600 hover:text-sky-600 transition-colors cursor-pointer'
                    title='Toggle Doctor Availability'
                  >
                    {item.available ? (
                      <ToggleRight className='w-7 h-7 text-emerald-500' />
                    ) : (
                      <ToggleLeft className='w-7 h-7 text-slate-400' />
                    )}
                  </button>
                </div>

                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => openEditModal(item)}
                    className='flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200/80 hover:border-sky-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer'
                  >
                    <Edit3 className='w-3.5 h-3.5' />
                    <span>Edit Details</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => setDeletingDoc(item)}
                    className='p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 transition-colors cursor-pointer'
                    title='Remove Doctor'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className='bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-xs sm:text-sm'>
              <thead className='bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider'>
                <tr>
                  <th className='py-3.5 px-5'>Doctor</th>
                  <th className='py-3.5 px-4'>Specialty</th>
                  <th className='py-3.5 px-4'>Credentials</th>
                  <th className='py-3.5 px-4'>Fee</th>
                  <th className='py-3.5 px-4'>Status</th>
                  <th className='py-3.5 px-5 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-100'>
                {filteredDoctors.map((doc) => (
                  <tr key={doc._id} className='hover:bg-slate-50/70 transition-colors'>
                    <td className='py-3.5 px-5'>
                      <div className='flex items-center gap-3'>
                        <img
                          src={doc.image}
                          alt={doc.name}
                          className='w-10 h-10 rounded-xl object-cover bg-sky-50 border border-slate-200 shrink-0'
                        />
                        <div className='min-w-0'>
                          <p className='font-bold text-slate-900 truncate'>{doc.name}</p>
                          <p className='text-xs text-slate-400 truncate'>{doc.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className='py-3.5 px-4'>
                      <span className='px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold'>
                        {doc.speciality}
                      </span>
                    </td>
                    <td className='py-3.5 px-4 text-xs text-slate-600'>
                      <p className='font-semibold text-slate-800'>{doc.degree}</p>
                      <p className='text-slate-400'>{doc.experience} exp</p>
                    </td>
                    <td className='py-3.5 px-4 font-extrabold text-slate-900'>
                      {currency}{doc.fees}
                    </td>
                    <td className='py-3.5 px-4'>
                      <button
                        type='button'
                        onClick={() => changeAvailability(doc._id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border cursor-pointer ${
                          doc.available
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${doc.available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span>{doc.available ? 'Available' : 'Paused'}</span>
                      </button>
                    </td>
                    <td className='py-3.5 px-5 text-right'>
                      <div className='inline-flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => openEditModal(doc)}
                          className='px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer'
                        >
                          <Edit3 className='w-3.5 h-3.5' />
                          <span>Edit</span>
                        </button>
                        <button
                          type='button'
                          onClick={() => setDeletingDoc(doc)}
                          className='p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer'
                          title='Remove Doctor'
                        >
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT DOCTOR MODAL */}
      {editingDoc && (
        <div
          className='fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto'
          onClick={() => !savingEdit && setEditingDoc(null)}
        >
          <div
            className='bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between pb-4 border-b border-slate-200'>
              <div>
                <h2 className='text-lg sm:text-xl font-extrabold text-slate-900'>
                  Edit Specialist Profile
                </h2>
                <p className='text-xs text-slate-500 mt-0.5'>
                  Changes sync immediately across the patient booking portal and upcoming appointments.
                </p>
              </div>
              <button
                type='button'
                onClick={() => !savingEdit && setEditingDoc(null)}
                className='p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <form onSubmit={handleSaveDoctorEdit} className='space-y-4 text-xs'>
              {/* Avatar + Availability Row */}
              <div className='flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80'>
                <div className='flex items-center gap-4'>
                  <label htmlFor='edit-doc-image' className='relative cursor-pointer group'>
                    <img
                      src={editImage ? URL.createObjectURL(editImage) : editingDoc.image}
                      alt={editingDoc.name}
                      className='w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm bg-sky-50'
                    />
                    <div className='absolute inset-0 rounded-2xl bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity'>
                      <Camera className='w-4 h-4' />
                    </div>
                    <input
                      id='edit-doc-image'
                      type='file'
                      accept='image/*'
                      hidden
                      onChange={(e) => e.target.files?.[0] && setEditImage(e.target.files[0])}
                    />
                  </label>
                  <div>
                    <p className='font-bold text-slate-900 text-sm'>{editingDoc.name}</p>
                    <p className='text-slate-500 text-xs'>Click photo to upload a new portrait</p>
                  </div>
                </div>

                <label className='inline-flex items-center gap-2 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-slate-200'>
                  <input
                    type='checkbox'
                    checked={editingDoc.available}
                    onChange={(e) => setEditingDoc({ ...editingDoc, available: e.target.checked })}
                    className='w-4 h-4 accent-emerald-600 rounded'
                  />
                  <span className='font-bold text-slate-800'>Accepting Bookings</span>
                </label>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Doctor Full Name *</label>
                  <input
                    type='text'
                    required
                    value={editingDoc.name}
                    onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900 font-semibold'
                  />
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Login Email *</label>
                  <input
                    type='email'
                    required
                    value={editingDoc.email}
                    onChange={(e) => setEditingDoc({ ...editingDoc, email: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900'
                  />
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Specialty *</label>
                  <select
                    value={editingDoc.speciality}
                    onChange={(e) => setEditingDoc({ ...editingDoc, speciality: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 bg-white text-slate-900 font-semibold'
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Medical Degree *</label>
                  <input
                    type='text'
                    required
                    value={editingDoc.degree}
                    onChange={(e) => setEditingDoc({ ...editingDoc, degree: e.target.value })}
                    placeholder='e.g. MBBS, MD (Cardiology)'
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900'
                  />
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Experience *</label>
                  <select
                    value={editingDoc.experience}
                    onChange={(e) => setEditingDoc({ ...editingDoc, experience: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 bg-white text-slate-900'
                  >
                    {EXPERIENCE_OPTIONS.map((exp) => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Consultation Fee ({currency}) *</label>
                  <input
                    type='number'
                    required
                    min='0'
                    value={editingDoc.fees}
                    onChange={(e) => setEditingDoc({ ...editingDoc, fees: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900 font-bold'
                  />
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Clinic Address Line 1</label>
                  <input
                    type='text'
                    value={editingDoc.addressLine1}
                    onChange={(e) => setEditingDoc({ ...editingDoc, addressLine1: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900'
                  />
                </div>
                <div>
                  <label className='font-bold text-slate-700 block mb-1'>Clinic Address Line 2</label>
                  <input
                    type='text'
                    value={editingDoc.addressLine2}
                    onChange={(e) => setEditingDoc({ ...editingDoc, addressLine2: e.target.value })}
                    className='w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900'
                  />
                </div>
              </div>

              <div>
                <label className='font-bold text-slate-700 block mb-1'>
                  Reset Password (Optional — leave blank to keep current password)
                </label>
                <div className='relative flex items-center'>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editingDoc.password}
                    onChange={(e) => setEditingDoc({ ...editingDoc, password: e.target.value })}
                    placeholder='Enter new 8+ character password if resetting...'
                    className='w-full pl-3.5 pr-12 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900 bg-white'
                  />
                  <button
                    type='button'
                    tabIndex={-1}
                    aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                    title={showEditPassword ? 'Hide password' : 'Show password'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowEditPassword((prev) => !prev)
                    }}
                    className='absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors z-10 cursor-pointer'
                  >
                    {showEditPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                  </button>
                </div>
              </div>

              <div>
                <label className='font-bold text-slate-700 block mb-1'>Doctor Biography & Clinical Focus</label>
                <textarea
                  rows={3}
                  value={editingDoc.about}
                  onChange={(e) => setEditingDoc({ ...editingDoc, about: e.target.value })}
                  className='w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:border-sky-500 text-slate-900 leading-relaxed'
                />
              </div>

              <div className='flex items-center justify-end gap-3 pt-3 border-t border-slate-200'>
                <button
                  type='button'
                  onClick={() => setEditingDoc(null)}
                  disabled={savingEdit}
                  className='px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={savingEdit}
                  className='px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50'
                >
                  <Save className='w-4 h-4' />
                  <span>{savingEdit ? 'Saving Changes...' : 'Save Doctor Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DOCTOR CONFIRMATION MODAL */}
      {deletingDoc && (
        <div
          className='fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4'
          onClick={() => !deletingLoading && setDeletingDoc(null)}
        >
          <div
            className='bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start gap-3.5'>
              <div className='w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0'>
                <AlertTriangle className='w-5 h-5' />
              </div>
              <div>
                <h3 className='text-base font-extrabold text-slate-900'>
                  Remove {deletingDoc.name} from Clinic?
                </h3>
                <p className='text-xs text-slate-500 mt-1 leading-relaxed'>
                  This will permanently remove <strong>{deletingDoc.name}</strong> ({deletingDoc.speciality}) from the public doctor directory. If you only want to stop new bookings temporarily, toggle their status to <strong>Paused</strong> instead.
                </p>
              </div>
            </div>

            <div className='flex items-center justify-end gap-2.5 pt-2'>
              <button
                type='button'
                onClick={() => setDeletingDoc(null)}
                disabled={deletingLoading}
                className='px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer'
              >
                Keep Doctor
              </button>
              <button
                type='button'
                onClick={handleConfirmDelete}
                disabled={deletingLoading}
                className='px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50'
              >
                <Trash2 className='w-3.5 h-3.5' />
                <span>{deletingLoading ? 'Removing...' : 'Yes, Remove Doctor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorsList
