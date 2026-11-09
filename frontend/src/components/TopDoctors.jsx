import React, { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const TopDoctors = () => {
    const navigate = useNavigate()
    const { doctors, currencySymbol } = useContext(AppContext)

    return (
        <section className='py-10 md:py-14'>
            {/* Section Header */}
            <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10'>
                <div className='space-y-2'>
                    <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700'>
                        <CheckCircle2 className='w-3.5 h-3.5' />
                        <span>Top Rated Doctors</span>
                    </div>
                    <h2 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
                        Doctors Available to Book
                    </h2>
                    <p className='text-sm text-slate-500 max-w-xl'>
                        Book an online video teleconsultation with our trusted doctors in just a few clicks and skip long hospital queues.
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => { navigate('/doctors'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className='inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer'
                    >
                        <span>View All Doctors</span>
                        <ArrowRight className='w-4 h-4' />
                    </button>
                </div>
            </div>

            {/* Doctors Grid */}
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
                {doctors.slice(0, 8).map((item, index) => (
                    <div
                        key={index}
                        onClick={() => { navigate(`/appointment/${item._id}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className='group bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:border-primary hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer'
                    >
                        {/* Doctor Image Container */}
                        <div className='relative bg-sky-50/50 aspect-[4/3] overflow-hidden'>
                            <img
                                className='w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300'
                                src={item.image}
                                alt={item.name}
                            />
                            {/* Availability Badge */}
                            <div className='absolute top-3 left-3'>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${
                                    item.available
                                        ? 'bg-emerald-50/95 text-emerald-700 border border-emerald-200/80'
                                        : 'bg-slate-100/95 text-slate-600 border border-slate-200/80'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${item.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                    <span>{item.available ? 'Available' : 'Unavailable'}</span>
                                </span>
                            </div>
                        </div>

                        {/* Doctor Details */}
                        <div className='p-5 space-y-3 flex-1 flex flex-col justify-between'>
                            <div className='space-y-1.5'>
                                <span className='inline-block px-2.5 py-0.5 text-xs font-semibold text-primary bg-sky-50 border border-sky-100 rounded-md'>
                                    {item.speciality}
                                </span>
                                <h3 className='font-bold text-slate-900 text-base group-hover:text-primary transition-colors truncate'>
                                    {item.name}
                                </h3>
                                <p className='text-xs text-slate-500'>
                                    {item.degree || 'MBBS'} • {item.experience} experience
                                </p>
                            </div>

                            {/* Fee & Action */}
                            <div className='pt-3 border-t border-slate-100 flex items-center justify-between'>
                                <div>
                                    <span className='text-[11px] text-slate-400 block'>Consultation Fee</span>
                                    <span className='font-bold text-slate-900 text-base'>
                                        {currencySymbol}{item.fees}
                                    </span>
                                </div>
                                <span className='inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 group-hover:bg-primary text-xs font-semibold text-primary group-hover:text-white transition-colors'>
                                    <span>Book Now</span>
                                    <ArrowRight className='w-3.5 h-3.5' />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Button */}
            <div className='text-center mt-12'>
                <button
                    onClick={() => { navigate('/doctors'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className='px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer'
                >
                    Browse All {doctors.length} Doctors
                </button>
            </div>
        </section>
    )
}

export default TopDoctors
