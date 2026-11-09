import React, { useContext, useEffect, useState, useMemo } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import {
  Users,
  Search,
  AlertTriangle,
  Pill,
  FileText,
  Calendar,
  Phone,
  Mail,
  MapPin,
  X,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'

const PatientsList = () => {
  const { aToken, patients, getAllPatients } = useContext(AdminContext)
  const { calculateAge, slotDateFormat, currency } = useContext(AppContext)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'allergies' | 'active'
  const [selectedPatient, setSelectedPatient] = useState(null)

  useEffect(() => {
    if (aToken) {
      getAllPatients()
    }
  }, [aToken, getAllPatients])

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (filterMode === 'allergies' && (!p.allergies || p.allergies.length === 0)) {
        return false
      }
      if (filterMode === 'active' && (p.totalAppointments || 0) === 0) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const emailMatch = (p.email || '').toLowerCase().includes(q)
        const phoneMatch = (p.phone || '').toLowerCase().includes(q)
        const allergyMatch = (p.allergies || []).some((a) => a.toLowerCase().includes(q))
        return nameMatch || emailMatch || phoneMatch || allergyMatch
      }
      return true
    })
  }, [patients, filterMode, searchQuery])

  const formatAge = (dob) => {
    const age = calculateAge(dob)
    return !isNaN(age) && age > 0 && age < 130 ? `${age} yrs` : '—'
  }

  const patientsWithAllergies = patients.filter((p) => p.allergies?.length > 0).length
  const patientsWithVisits = patients.filter((p) => (p.totalAppointments || 0) > 0).length

  return (
    <div className='flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl min-w-0 space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
            Registered Patients Directory
          </h1>
          <p className='text-xs sm:text-sm text-slate-500 mt-0.5'>
            View patient profiles, reported drug/food allergies, regular medications, and consultation history.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className='bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs'>
        <div className='inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100/80 border border-slate-200/60 rounded-xl'>
          {[
            { id: 'all', label: `All Patients (${patients.length})` },
            { id: 'active', label: `With Bookings (${patientsWithVisits})` },
            { id: 'allergies', label: `Has Allergies (${patientsWithAllergies})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/70'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className='relative w-full md:w-80'>
          <Search className='w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search name, email, phone, or allergy...'
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
      </div>

      {/* Patients Grid */}
      {filteredPatients.length === 0 ? (
        <div className='bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-2'>
          <Users className='w-10 h-10 text-slate-300 mx-auto' />
          <p className='text-sm font-bold text-slate-800'>No patients match your search</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
          {filteredPatients.map((patient) => (
            <div
              key={patient._id}
              onClick={() => setSelectedPatient(patient)}
              className='bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xs hover:shadow-md hover:border-sky-200 transition-all cursor-pointer flex flex-col justify-between space-y-4'
            >
              <div className='space-y-3.5'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <img
                      src={patient.image}
                      alt={patient.name}
                      className='w-12 h-12 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0'
                    />
                    <div className='min-w-0'>
                      <h3 className='font-extrabold text-slate-900 text-sm sm:text-base truncate'>
                        {patient.name}
                      </h3>
                      <p className='text-xs text-slate-500 truncate'>{patient.email}</p>
                      <p className='text-[11px] text-slate-400 mt-0.5'>
                        {patient.gender && patient.gender !== 'Not Selected' ? patient.gender : 'Patient'} • {formatAge(patient.dob)}
                      </p>
                    </div>
                  </div>

                  <span className='px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold shrink-0'>
                    {patient.totalAppointments || 0} visits
                  </span>
                </div>

                {/* Allergies & Regular Meds */}
                <div className='space-y-2 pt-2 border-t border-slate-100'>
                  <div className='flex flex-wrap items-center gap-1.5'>
                    <span className='text-[11px] font-bold text-slate-500'>Allergies:</span>
                    {patient.allergies?.length > 0 ? (
                      patient.allergies.map((alg, i) => (
                        <span
                          key={i}
                          className='px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold inline-flex items-center gap-1'
                        >
                          <AlertTriangle className='w-3 h-3 text-rose-600' />
                          {alg}
                        </span>
                      ))
                    ) : (
                      <span className='text-[11px] text-emerald-600 font-semibold'>None reported</span>
                    )}
                  </div>

                  {patient.currentMedications?.length > 0 && (
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <span className='text-[11px] font-bold text-slate-500'>Regular Meds:</span>
                      {patient.currentMedications.map((m, i) => (
                        <span
                          key={i}
                          className='px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-semibold'
                        >
                          💊 {typeof m === 'string' ? m : `${m.name} ${m.dosage || ''}`.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className='pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500'>
                <div className='flex items-center gap-3'>
                  <span className='inline-flex items-center gap-1'>
                    <FileText className='w-3.5 h-3.5 text-sky-600' />
                    {patient.prescriptionsCount || 0} Rx
                  </span>
                  <span>•</span>
                  <span>{patient.recordsCount || 0} Lab Reports</span>
                </div>
                <span className='font-bold text-sky-600'>View Dossier →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PATIENT CLINICAL DOSSIER MODAL */}
      {selectedPatient && (
        <div
          className='fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto'
          onClick={() => setSelectedPatient(null)}
        >
          <div
            className='bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-6 my-8'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-4 pb-4 border-b border-slate-200'>
              <div className='flex items-center gap-4'>
                <img
                  src={selectedPatient.image}
                  alt={selectedPatient.name}
                  className='w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100'
                />
                <div>
                  <h2 className='text-lg sm:text-xl font-extrabold text-slate-900'>
                    {selectedPatient.name}
                  </h2>
                  <p className='text-xs text-slate-500'>
                    {selectedPatient.gender || 'Patient'} • {formatAge(selectedPatient.dob)} • DOB: {selectedPatient.dob || 'Not specified'}
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setSelectedPatient(null)}
                className='p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer'
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            {/* Contact & Spend Summary */}
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs'>
              <div className='bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-1'>
                <p className='text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1'>
                  <Mail className='w-3 h-3' /> Email
                </p>
                <p className='font-semibold text-slate-800 truncate'>{selectedPatient.email}</p>
              </div>
              <div className='bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-1'>
                <p className='text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1'>
                  <Phone className='w-3 h-3' /> Phone
                </p>
                <p className='font-semibold text-slate-800'>{selectedPatient.phone || 'Not provided'}</p>
              </div>
              <div className='bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-1'>
                <p className='text-slate-400 font-bold uppercase text-[10px]'>Total Clinic Spend</p>
                <p className='font-extrabold text-emerald-600 text-sm'>
                  {currency}{selectedPatient.totalSpent || 0} ({selectedPatient.totalAppointments || 0} visits)
                </p>
              </div>
            </div>

            {/* Allergies & Regular Medications */}
            <div className='bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-3 text-xs'>
              <p className='font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5'>
                <AlertTriangle className='w-4 h-4 text-rose-600' />
                <span>Clinical Safety Profile (Allergies & Regular Medicines)</span>
              </p>

              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-semibold text-slate-700'>Known Allergies:</span>
                {selectedPatient.allergies?.length > 0 ? (
                  selectedPatient.allergies.map((alg, i) => (
                    <span
                      key={i}
                      className='px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-xs'
                    >
                      ⚠️ {alg}
                    </span>
                  ))
                ) : (
                  <span className='text-emerald-700 font-semibold'>No known allergies on file</span>
                )}
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-semibold text-slate-700'>Regular Medications:</span>
                {selectedPatient.currentMedications?.length > 0 ? (
                  selectedPatient.currentMedications.map((m, i) => (
                    <span
                      key={i}
                      className='px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 font-semibold text-xs'
                    >
                      💊 {typeof m === 'string' ? m : `${m.name} ${m.dosage || ''}`.trim()}
                    </span>
                  ))
                ) : (
                  <span className='text-slate-500'>None listed</span>
                )}
              </div>
            </div>

            {/* Recent Appointments */}
            <div className='space-y-2.5'>
              <h4 className='text-xs font-extrabold uppercase tracking-wider text-slate-500'>
                Recent Consultation History ({selectedPatient.recentAppointments?.length || 0})
              </h4>

              {selectedPatient.recentAppointments?.length > 0 ? (
                <div className='divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden text-xs'>
                  {selectedPatient.recentAppointments.map((apt) => (
                    <div key={apt._id} className='p-3.5 flex items-center justify-between gap-3 bg-white'>
                      <div>
                        <p className='font-bold text-slate-900'>{apt.docData?.name}</p>
                        <p className='text-slate-500'>
                          {apt.docData?.speciality} • {slotDateFormat(apt.slotDate)} at {apt.slotTime}
                        </p>
                      </div>
                      <div>
                        {apt.cancelled ? (
                          <span className='px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200'>
                            Cancelled
                          </span>
                        ) : apt.isCompleted ? (
                          <span className='px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'>
                            Completed
                          </span>
                        ) : (
                          <span className='px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-bold border border-sky-200'>
                            Upcoming
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-xs text-slate-400 italic'>No appointments booked yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatientsList
