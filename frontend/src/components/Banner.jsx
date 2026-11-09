import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Video, FileCheck, ArrowRight } from 'lucide-react'

const Banner = () => {
    const navigate = useNavigate()

    return (
        <section className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-800 text-white my-14 shadow-xl'>
            <div className='relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-10'>
                
                {/* Left Side Content */}
                <div className='flex-1 space-y-5 text-center md:text-left z-10'>
                    <div className='inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/25 text-xs font-semibold text-sky-300'>
                        <ShieldCheck className='w-4 h-4' />
                        <span>Get Started in Under a Minute</span>
                    </div>

                    <h2 className='text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight'>
                        Ready to Book Your <br className='hidden sm:inline' />
                        Next Doctor Visit?
                    </h2>

                    <p className='text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto md:mx-0'>
                        Create your free account to schedule appointments, chat with your doctor, and keep all your medical reports and prescriptions organized in one place.
                    </p>

                    {/* Feature Highlights */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto md:mx-0 text-xs sm:text-sm text-slate-200 text-left'>
                        <div className='flex items-center gap-2.5'>
                            <Video className='w-4 h-4 text-emerald-400 shrink-0' />
                            <span>Easy Video Calls with Doctors</span>
                        </div>
                        <div className='flex items-center gap-2.5'>
                            <FileCheck className='w-4 h-4 text-sky-400 shrink-0' />
                            <span>Digital Prescriptions & Lab Tracker</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className='pt-2'>
                        <button
                            onClick={() => { navigate('/login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className='inline-flex items-center gap-2 px-7 py-3.5 bg-primary hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-600/30 transition-all hover:translate-x-0.5 cursor-pointer'
                        >
                            <span>Create Free Account</span>
                            <ArrowRight className='w-4 h-4' />
                        </button>
                    </div>
                </div>

                {/* Right Side Visual */}
                <div className='hidden md:block w-72 lg:w-96 shrink-0 relative'>
                    <img
                        className='w-full h-auto object-cover rounded-2xl border border-slate-700/80 shadow-2xl'
                        src={assets.appointment_img}
                        alt="Book Doctor Appointment"
                    />
                </div>

            </div>
        </section>
    )
}

export default Banner
