import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { ArrowRight, Stethoscope } from 'lucide-react'

const RelatedDoctors = ({ speciality, docId }) => {
    const navigate = useNavigate()
    const { doctors, currencySymbol } = useContext(AppContext)
    const [relDoc, setRelDoc] = useState([])

    useEffect(() => {
        if (doctors.length > 0 && speciality) {
            const doctorsData = doctors.filter((doc) => doc.speciality === speciality && doc._id !== docId)
            setRelDoc(doctorsData)
        }
    }, [doctors, speciality, docId])

    if (relDoc.length === 0) return null

    return (
        <section className='pt-12 border-t border-slate-200/80 space-y-8'>
            <div className='flex items-center justify-between'>
                <div>
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-[10px] font-semibold text-primary mb-1'>
                        <Stethoscope className='w-3 h-3' />
                        <span>Department Directory</span>
                    </div>
                    <h2 className='text-xl font-bold text-slate-900 tracking-tight'>
                        Other {speciality} Specialists
                    </h2>
                </div>

                <button
                    onClick={() => { navigate(`/doctors/${speciality}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className='text-xs font-semibold text-primary hover:underline flex items-center gap-1'
                >
                    <span>View all</span>
                    <ArrowRight className='w-3.5 h-3.5' />
                </button>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
                {relDoc.slice(0, 4).map((item, index) => (
                    <div
                        key={index}
                        onClick={() => { navigate(`/appointment/${item._id}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className='group bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:border-primary hover:shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer'
                    >
                        <div className='relative bg-slate-100 aspect-[4/3] overflow-hidden'>
                            <img
                                className='w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300'
                                src={item.image}
                                alt={item.name}
                            />
                            <div className='absolute top-3 left-3'>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold backdrop-blur-md ${
                                    item.available
                                        ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80'
                                        : 'bg-slate-100/90 text-slate-600 border border-slate-200/80'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${item.available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                    <span>{item.available ? 'Available' : 'Offline'}</span>
                                </span>
                            </div>
                        </div>

                        <div className='p-4 space-y-2 flex-1 flex flex-col justify-between'>
                            <div>
                                <span className='inline-block px-2 py-0.5 text-[10px] font-semibold text-primary bg-sky-50 border border-sky-100 rounded-md'>
                                    {item.speciality}
                                </span>
                                <h3 className='font-bold text-slate-900 text-sm group-hover:text-primary transition-colors truncate mt-1'>
                                    {item.name}
                                </h3>
                                <p className='text-[11px] text-slate-500'>
                                    {item.degree || 'MBBS'} • {item.experience}
                                </p>
                            </div>

                            <div className='pt-2 border-t border-slate-100 flex items-center justify-between'>
                                <span className='font-mono font-bold text-slate-900 text-xs'>
                                    {currencySymbol}{item.fees}
                                </span>
                                <span className='text-xs font-semibold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform'>
                                    <span>Consult</span>
                                    <ArrowRight className='w-3 h-3' />
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}

export default RelatedDoctors