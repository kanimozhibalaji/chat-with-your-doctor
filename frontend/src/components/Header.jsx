import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import {
    ShieldCheck,
    ArrowRight,
    Sparkles,
    Stethoscope,
    Pill,
    HeartPulse,
    CheckCircle2,
    Clock,
    FileCheck,
    Video
} from 'lucide-react'

const Header = () => {
    const navigate = useNavigate()

    const quickTools = [
        {
            title: 'Book a Doctor',
            desc: 'Browse trusted doctors by specialty & book an appointment',
            icon: Stethoscope,
            color: 'text-sky-600 bg-sky-50 border-sky-100',
            path: '/doctors'
        },
        {
            title: 'Check Symptoms',
            desc: 'Describe how you feel to find out which doctor to see',
            icon: Sparkles,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
            path: '/symptom-checker'
        },
        {
            title: 'Medicine Safety',
            desc: 'Check if your medicines are safe to take together',
            icon: Pill,
            color: 'text-amber-600 bg-amber-50 border-amber-100',
            path: '/drug-checker'
        },
        {
            title: 'My Health & Reports',
            desc: 'Track lab results, upload reports & check heart rate',
            icon: HeartPulse,
            color: 'text-rose-600 bg-rose-50 border-rose-100',
            path: '/health'
        }
    ]

    return (
        <div className='space-y-8 mb-14'>
            {/* Main Hero Card */}
            <div className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-800 text-white shadow-xl'>
                {/* Soft Decorative Glow */}
                <div className='absolute -top-24 -right-24 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none' />
                <div className='absolute -bottom-24 -left-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none' />

                <div className='relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-12 md:py-16 flex flex-col md:flex-row items-center justify-between gap-10'>
                    
                    {/* Left Content */}
                    <div className='flex-1 space-y-6 text-center md:text-left z-10'>
                        
                        {/* Friendly Trust Badge */}
                        <div className='inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/15 border border-sky-400/25 text-xs font-semibold text-sky-300'>
                            <ShieldCheck className='w-4 h-4 text-sky-400' />
                            <span>Trusted Doctors • 100% Online Telemedicine</span>
                        </div>

                        {/* Easy-to-understand Headline */}
                        <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]'>
                            Quality Healthcare from Licensed Specialists, Right from Home.
                        </h1>

                        {/* Plain-English Subtext */}
                        <p className='text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl mx-auto md:mx-0 font-normal'>
                            Book doctor appointments in seconds, consult from home via video call, check your symptoms, and keep all your prescriptions and lab reports in one safe place.
                        </p>

                        {/* Action Buttons */}
                        <div className='flex flex-wrap items-center justify-center md:justify-start gap-3.5 pt-1'>
                            <button
                                onClick={() => navigate('/doctors')}
                                className='inline-flex items-center gap-2 px-6 py-3.5 bg-primary hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-sky-600/30 transition-all hover:translate-x-0.5 cursor-pointer'
                            >
                                <span>Find a Doctor</span>
                                <ArrowRight className='w-4 h-4' />
                            </button>
                            <button
                                onClick={() => navigate('/symptom-checker')}
                                className='inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 text-sm font-semibold rounded-xl transition-all cursor-pointer'
                            >
                                <Sparkles className='w-4 h-4 text-sky-400' />
                                <span>Check My Symptoms</span>
                            </button>
                        </div>

                        {/* Simple Highlights */}
                        <div className='pt-6 border-t border-slate-800/90 grid grid-cols-3 gap-4 text-left max-w-lg mx-auto md:mx-0'>
                            <div>
                                <div className='text-lg sm:text-xl font-bold text-white flex items-center gap-1.5'>
                                    <CheckCircle2 className='w-4 h-4 text-emerald-400 shrink-0' />
                                    <span>100%</span>
                                </div>
                                <div className='text-xs text-slate-400 mt-0.5'>
                                    Verified Doctors
                                </div>
                            </div>
                            <div>
                                <div className='text-lg sm:text-xl font-bold text-white flex items-center gap-1.5'>
                                    <Clock className='w-4 h-4 text-sky-400 shrink-0' />
                                    <span>Instant</span>
                                </div>
                                <div className='text-xs text-slate-400 mt-0.5'>
                                    Online Booking
                                </div>
                            </div>
                            <div>
                                <div className='text-lg sm:text-xl font-bold text-white flex items-center gap-1.5'>
                                    <FileCheck className='w-4 h-4 text-teal-400 shrink-0' />
                                    <span>Digital</span>
                                </div>
                                <div className='text-xs text-slate-400 mt-0.5'>
                                    Safe Prescriptions
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Image */}
                    <div className='w-full md:w-5/12 relative flex items-center justify-center'>
                        <div className='relative w-full max-w-md'>
                            <img
                                className='w-full h-auto object-cover rounded-2xl border border-slate-700/60 shadow-2xl'
                                src={assets.header_img}
                                alt="Doctors at VitalSync"
                            />
                            {/* Friendly Floating Status Card */}
                            <div className='absolute -bottom-4 left-4 right-4 sm:right-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3'>
                                <span className='w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0' />
                                <div>
                                    <p className='text-xs font-bold text-white'>Doctors Available Today</p>
                                    <p className='text-[11px] text-slate-300'>100% Online Video • Skip Hospital Queues</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Quick Navigation Cards — "How can we help you today?" */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                {quickTools.map((tool, index) => {
                    const Icon = tool.icon
                    return (
                        <div
                            key={index}
                            onClick={() => navigate(tool.path)}
                            className='group bg-white rounded-2xl border border-slate-200/90 p-5 hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3'
                        >
                            <div className='flex items-start justify-between gap-3'>
                                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${tool.color}`}>
                                    <Icon className='w-5 h-5' />
                                </div>
                                <ArrowRight className='w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all' />
                            </div>
                            <div>
                                <h3 className='font-bold text-slate-900 text-base group-hover:text-primary transition-colors'>
                                    {tool.title}
                                </h3>
                                <p className='text-xs text-slate-500 mt-1 leading-relaxed'>
                                    {tool.desc}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Header
