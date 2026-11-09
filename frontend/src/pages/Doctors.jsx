import React, { useContext, useEffect, useState, useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Filter,
  ArrowRight,
  Stethoscope,
  Search,
  X,
  SlidersHorizontal
} from 'lucide-react'

const BASE_SPECIALITIES = [
  { name: 'General physician', desc: 'Fever, cold & routine health' },
  { name: 'Gynecologist', desc: "Women's health & pregnancy" },
  { name: 'Dermatologist', desc: 'Skin, acne & dermatology' },
  { name: 'Pediatricians', desc: 'Child health & pediatrics' },
  { name: 'Neurologist', desc: 'Headaches, nerves & neurology' },
  { name: 'Gastroenterologist', desc: 'Digestive & stomach care' },
  { name: 'Cardiologist', desc: 'Heart & cardiovascular care' },
  { name: 'Orthopedic', desc: 'Bones, joints & muscle pain' },
  { name: 'Psychiatrist', desc: 'Mental wellness & therapy' },
  { name: 'Ophthalmologist', desc: 'Vision & eye care' },
  { name: 'ENT Specialist', desc: 'Ear, nose & throat' },
  { name: 'Dentist', desc: 'Dental care & oral health' }
]

const Doctors = () => {
  const { speciality } = useParams()
  const navigate = useNavigate()
  const { doctors, currencySymbol } = useContext(AppContext)

  const [filterDoc, setFilterDoc] = useState([])
  const [showFilterSidebar, setShowFilterSidebar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [sortBy, setSortBy] = useState('recommended') // 'recommended' | 'exp' | 'fee-asc' | 'fee-desc'

  // Dynamic list of specialties combining base with any custom DB categories
  const specialitiesList = useMemo(() => {
    const knownNames = new Set(BASE_SPECIALITIES.map((s) => s.name.toLowerCase()))
    const dynamicOnes = []
    doctors.forEach((doc) => {
      if (doc.speciality && !knownNames.has(doc.speciality.toLowerCase())) {
        knownNames.add(doc.speciality.toLowerCase())
        dynamicOnes.push({ name: doc.speciality, desc: 'Specialized medical care' })
      }
    })
    return [...BASE_SPECIALITIES, ...dynamicOnes]
  }, [doctors])

  // Filter & Sort Logic
  const applyFilterAndSort = () => {
    let list = [...doctors]

    // Specialty filter
    if (speciality) {
      list = list.filter((doc) => doc.speciality?.toLowerCase() === speciality.toLowerCase())
    }

    // Availability filter
    if (onlyAvailable) {
      list = list.filter((doc) => doc.available)
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (doc) =>
          doc.name?.toLowerCase().includes(q) ||
          doc.speciality?.toLowerCase().includes(q) ||
          (doc.degree && doc.degree.toLowerCase().includes(q)) ||
          (doc.about && doc.about.toLowerCase().includes(q))
      )
    }

    // Sort order
    if (sortBy === 'exp') {
      list.sort((a, b) => {
        const expA = parseInt(a.experience, 10) || 0
        const expB = parseInt(b.experience, 10) || 0
        return expB - expA
      })
    } else if (sortBy === 'fee-asc') {
      list.sort((a, b) => (a.fees || 0) - (b.fees || 0))
    } else if (sortBy === 'fee-desc') {
      list.sort((a, b) => (b.fees || 0) - (a.fees || 0))
    }

    setFilterDoc(list)
  }

  useEffect(() => {
    applyFilterAndSort()
  }, [doctors, speciality, searchQuery, onlyAvailable, sortBy])

  const handleSelectSpeciality = (itemSpeciality) => {
    if (!itemSpeciality || speciality?.toLowerCase() === itemSpeciality.toLowerCase()) {
      navigate('/doctors')
    } else {
      navigate(`/doctors/${encodeURIComponent(itemSpeciality)}`)
    }
  }

  return (
    <div className='py-6 space-y-6 max-w-7xl mx-auto'>
      {/* Page Header */}
      <div className='bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6'>
        <div className='flex flex-col md:flex-row md:items-end justify-between gap-5'>
          <div className='space-y-2 max-w-2xl'>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-xs font-semibold text-primary'>
              <Stethoscope className='w-3.5 h-3.5' />
              <span>Certified Specialist Network</span>
            </div>
            <h1 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
              {speciality ? `${speciality} Specialists` : 'Find Verified Medical Doctors'}
            </h1>
            <p className='text-sm text-slate-500 leading-relaxed'>
              Schedule online video consultations or in-person visits with board-certified physicians across {specialitiesList.length} specialties.
            </p>
          </div>

          {/* Quick Search Field */}
          <div className='w-full md:w-80 relative'>
            <Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by doctor, specialty, degree...'
              className='w-full pl-9 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all'
            />
            {searchQuery && (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                className='absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5'
                aria-label='Clear search'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Quick-Filter Bar for Specialties */}
        <div className='pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none'>
          <button
            onClick={() => handleSelectSpeciality(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              !speciality
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            All Specialties ({doctors.length})
          </button>
          {specialitiesList.map((item) => {
            const count = doctors.filter(
              (d) => d.speciality?.toLowerCase() === item.name.toLowerCase()
            ).length
            const isSelected = speciality?.toLowerCase() === item.name.toLowerCase()

            return (
              <button
                key={item.name}
                onClick={() => handleSelectSpeciality(item.name)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <span>{item.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500 font-mono'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className='flex flex-col lg:flex-row items-start gap-8'>
        {/* Left Filter Sidebar */}
        <aside className={`w-full lg:w-64 shrink-0 space-y-4 ${showFilterSidebar ? 'block' : 'hidden lg:block'}`}>
          <div className='bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4'>
            <div className='flex items-center justify-between pb-3 border-b border-slate-100'>
              <span className='text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5'>
                <SlidersHorizontal className='w-3.5 h-3.5 text-primary' />
                <span>Filter & Refine</span>
              </span>
              {(speciality || onlyAvailable || searchQuery) && (
                <button
                  onClick={() => {
                    navigate('/doctors')
                    setSearchQuery('')
                    setOnlyAvailable(false)
                  }}
                  className='text-xs text-primary hover:underline font-semibold cursor-pointer'
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Quick Toggle: Available Doctors Only */}
            <label className='flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/70 transition-colors'>
              <span className='text-xs font-medium text-slate-700 flex items-center gap-2'>
                <span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
                Available Now
              </span>
              <input
                type='checkbox'
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className='w-4 h-4 accent-primary rounded cursor-pointer'
              />
            </label>

            {/* Specialty List Navigation */}
            <div>
              <p className='text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2'>
                Specialty Directory
              </p>
              <div className='flex flex-col gap-1 max-h-[380px] overflow-y-auto pr-1'>
                <button
                  onClick={() => handleSelectSpeciality(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                    !speciality
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>All Doctors</span>
                  <span className={`text-[11px] font-mono ${!speciality ? 'text-slate-300' : 'text-slate-400'}`}>
                    {doctors.length}
                  </span>
                </button>

                {specialitiesList.map((item) => {
                  const count = doctors.filter(
                    (d) => d.speciality?.toLowerCase() === item.name.toLowerCase()
                  ).length
                  const isSelected = speciality?.toLowerCase() === item.name.toLowerCase()

                  return (
                    <button
                      key={item.name}
                      onClick={() => handleSelectSpeciality(item.name)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className='truncate'>{item.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'text-slate-400'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Doctor Cards Area */}
        <main className='flex-1 w-full space-y-4'>
          {/* Controls Bar: Count & Sort */}
          <div className='bg-white rounded-2xl border border-slate-200/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs'>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setShowFilterSidebar(!showFilterSidebar)}
                className='lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer'
              >
                <Filter className='w-3.5 h-3.5 text-primary' />
                <span>{showFilterSidebar ? 'Hide Filters' : 'Filters'}</span>
              </button>
              <span className='text-xs text-slate-600'>
                Showing <strong className='text-slate-900 font-mono'>{filterDoc.length}</strong> verified {filterDoc.length === 1 ? 'specialist' : 'specialists'}
              </span>
            </div>

            {/* Sort selector */}
            <div className='flex items-center gap-2 text-xs'>
              <span className='text-slate-500 font-medium hidden sm:inline'>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className='border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-800 font-semibold outline-none focus:border-primary text-xs cursor-pointer'
              >
                <option value='recommended'>Recommended</option>
                <option value='exp'>Most Experienced</option>
                <option value='fee-asc'>Fee: Low to High</option>
                <option value='fee-desc'>Fee: High to Low</option>
              </select>
            </div>
          </div>

          {/* Grid of Doctor Cards */}
          {filterDoc.length === 0 ? (
            <div className='text-center py-16 bg-white rounded-2xl border border-slate-200/90 p-8 space-y-4 shadow-xs'>
              <div className='w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400'>
                <Stethoscope className='w-6 h-6' />
              </div>
              <div>
                <h3 className='font-bold text-slate-900 text-base'>No Doctors Match Your Search</h3>
                <p className='text-xs text-slate-500 max-w-sm mx-auto mt-1'>
                  We could not find any doctors with the current filters. Try changing your specialty, clearing your search, or allowing unavailable doctors.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setOnlyAvailable(false)
                  navigate('/doctors')
                }}
                className='px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-sky-600 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs'
              >
                Show All Doctors
              </button>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5'>
              {filterDoc.map((item) => (
                <div
                  key={item._id}
                  onClick={() => {
                    navigate(`/appointment/${item._id}`)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className='group bg-white rounded-2xl border border-slate-200/90 hover:border-primary hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer overflow-hidden'
                >
                  {/* Doctor Image with Overlay Badge */}
                  <div className='relative bg-slate-50 aspect-[4/3] overflow-hidden border-b border-slate-100'>
                    <img
                      className='w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300'
                      src={item.image}
                      alt={item.name}
                    />

                    {/* Availability chip */}
                    <div className='absolute top-3 left-3'>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-2xs ${
                          item.available
                            ? 'bg-emerald-50/95 text-emerald-800 border border-emerald-200/90'
                            : 'bg-slate-100/95 text-slate-600 border border-slate-200/90'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span>{item.available ? 'Available' : 'Booked'}</span>
                      </span>
                    </div>

                    {/* Experience chip */}
                    <div className='absolute top-3 right-3'>
                      <span className='inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/90 text-slate-700 border border-slate-200/80 backdrop-blur-sm'>
                        {item.experience || '5+ Years'}
                      </span>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className='p-5 space-y-3 flex-1 flex flex-col justify-between'>
                    <div className='space-y-1.5'>
                      <span className='inline-block px-2.5 py-0.5 text-[11px] font-semibold text-primary bg-sky-50 border border-sky-100 rounded-md'>
                        {item.speciality}
                      </span>
                      <h3 className='font-bold text-slate-900 text-base group-hover:text-primary transition-colors truncate'>
                        {item.name}
                      </h3>
                      <p className='text-xs text-slate-500 truncate'>
                        {item.degree || 'MBBS'} &bull; {item.address?.line1 || 'Online Teleconsultation'}
                      </p>
                    </div>

                    {/* Fee & Action CTA */}
                    <div className='pt-3 border-t border-slate-100 flex items-center justify-between'>
                      <div>
                        <span className='text-[10px] text-slate-400 uppercase font-semibold tracking-wider block'>Consultation Fee</span>
                        <span className='font-extrabold text-slate-900 text-base font-mono tabular-nums'>
                          {currencySymbol}{item.fees}
                        </span>
                      </div>
                      <span className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 group-hover:bg-primary text-xs font-semibold text-slate-800 group-hover:text-white transition-colors shadow-2xs'>
                        <span>Book Visit</span>
                        <ArrowRight className='w-3.5 h-3.5' />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Doctors