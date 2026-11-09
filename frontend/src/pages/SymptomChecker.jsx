import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
    Sparkles,
    Stethoscope,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    HeartHandshake,
    Info
} from 'lucide-react'

const SymptomChecker = () => {
    const { backendUrl, token, currencySymbol } = useContext(AppContext)
    const navigate = useNavigate()

    const [symptoms, setSymptoms] = useState('')
    const [loading, setLoading] = useState(false)
    const [analysis, setAnalysis] = useState(null)
    const [algoInfo, setAlgoInfo] = useState(null)
    const [doctors, setDoctors] = useState([])
    const [step, setStep] = useState(1) // 1: input, 2: results

    const formatSpeciality = (spec) => {
        if (!spec) return ''
        const s = String(spec).trim()
        if (s.toLowerCase() === 'general physician') return 'General Physician'
        if (s.toLowerCase() === 'pediatricians' || s.toLowerCase() === 'pediatrician') return 'Pediatrician'
        return s.charAt(0).toUpperCase() + s.slice(1)
    }

    const symptomSuggestions = [
        "I have had a severe headache for 2 days and feel slightly dizzy",
        "My stomach hurts after eating meals and I feel nauseous",
        "I noticed an itchy red rash on my arm yesterday",
        "My child has a fever and a dry cough since last night",
        "Feeling very anxious, trouble sleeping, and fast heartbeat",
        "Severe period cramps and irregular monthly cycle"
    ]

    const analyzeSymptoms = async () => {
        if (!token) {
            toast.warning('Please sign in to use the Symptom Checker')
            return navigate('/login')
        }

        if (!symptoms.trim()) {
            toast.error('Please describe how you are feeling first')
            return
        }

        setLoading(true)
        try {
            const { data } = await axios.post(
                backendUrl + '/api/ai/analyze-symptoms',
                { symptoms },
                { headers: { token } }
            )

            if (data.success) {
                setAnalysis(data.analysis)
                setAlgoInfo(data.algorithm)
                setDoctors(data.availableDoctors)
                setStep(2)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Symptom check error:', error)
            toast.error('Symptom Checker is temporarily unavailable. Please try again.')
        }
        setLoading(false)
    }

    const getUrgencyConfig = (level) => {
        switch (level?.toLowerCase()) {
            case 'high':
                return {
                    bg: 'bg-rose-50',
                    border: 'border-rose-200',
                    text: 'text-rose-800',
                    icon: AlertTriangle,
                    label: 'See a Doctor Promptly'
                }
            case 'medium':
                return {
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    text: 'text-amber-800',
                    icon: AlertTriangle,
                    label: 'Schedule a Visit Soon'
                }
            case 'low':
                return {
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200',
                    text: 'text-emerald-800',
                    icon: CheckCircle2,
                    label: 'Routine Checkup'
                }
            default:
                return {
                    bg: 'bg-sky-50',
                    border: 'border-sky-200',
                    text: 'text-sky-800',
                    icon: Info,
                    label: 'Doctor Visit Recommended'
                }
        }
    }

    return (
        <div className='min-h-[80vh] py-6 max-w-4xl mx-auto space-y-8'>
            {/* Friendly Header Banner */}
            <div className='bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 border border-slate-800 rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-lg'>
                <div className='relative z-10 space-y-3 max-w-2xl'>
                    <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-400/25'>
                        <Sparkles className='w-3.5 h-3.5 text-sky-400' />
                        <span>AI Symptom Helper</span>
                    </div>
                    <h1 className='text-2xl md:text-3xl font-extrabold tracking-tight text-white'>
                        Not Sure Which Doctor to See?
                    </h1>
                    <p className='text-slate-300 text-sm md:text-base leading-relaxed'>
                        Tell us how you're feeling in your own words. We'll help you understand your symptoms, give simple self-care tips, and connect you with the right specialist.
                    </p>
                </div>
            </div>

            {step === 1 && (
                <div className='space-y-6'>
                    {/* Symptom Input Card */}
                    <div className='bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-2xs space-y-5'>
                        <div className='flex items-center justify-between pb-3 border-b border-slate-100'>
                            <label className='text-base font-bold text-slate-900 flex items-center gap-2'>
                                <Stethoscope className='w-5 h-5 text-primary' />
                                <span>How are you feeling today?</span>
                            </label>
                            <span className='text-xs text-slate-400'>Write in plain, everyday words</span>
                        </div>

                        <textarea
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder="Describe your symptoms, when they started, and how they feel (for example: 'I have had a throbbing headache for 2 days, especially in bright light, and feel slightly nauseous')..."
                            className='w-full h-36 p-4 border border-slate-200 rounded-2xl resize-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 text-slate-800 text-sm leading-relaxed placeholder-slate-400'
                        />

                        <button
                            onClick={analyzeSymptoms}
                            disabled={loading || !symptoms.trim()}
                            className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer
                                ${loading || !symptoms.trim()
                                    ? 'bg-slate-300 cursor-not-allowed opacity-70'
                                    : 'bg-primary hover:bg-sky-600'
                                }`}
                        >
                            {loading ? (
                                <>
                                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                                    <span>Checking your symptoms...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className='w-4 h-4' />
                                    <span>Check Symptoms & Find the Right Doctor</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Quick Examples */}
                    <div className='space-y-3'>
                        <p className='text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5'>
                            <Sparkles className='w-3.5 h-3.5 text-primary' /> Or click an example below to try it out:
                        </p>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
                            {symptomSuggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSymptoms(suggestion)}
                                    className='p-3.5 bg-white border border-slate-200 hover:border-primary hover:bg-sky-50/40 rounded-2xl text-left text-xs sm:text-sm text-slate-700 hover:text-primary transition-all shadow-2xs cursor-pointer'
                                >
                                    "{suggestion}"
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && analysis && (
                <div className='space-y-6 animate-in fade-in duration-200'>
                    {/* Back Button */}
                    <button
                        onClick={() => { setStep(1); setAnalysis(null); setAlgoInfo(null); setDoctors([]); }}
                        className='inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-2xs'
                    >
                        <ArrowLeft className='w-4 h-4' /> Check Different Symptoms
                    </button>

                    {/* MoHFW Acute Emergency Room (108/112) Bypass Hard-Stop Banner */}
                    {analysis.isEmergencyBypass && (
                        <div className='bg-rose-950 border-2 border-rose-600 text-white rounded-3xl p-6 shadow-lg space-y-2.5'>
                            <div className='flex items-center gap-2.5 text-rose-300 font-extrabold text-xs uppercase tracking-wider'>
                                <AlertTriangle className='w-5 h-5 text-rose-400 animate-pulse shrink-0' />
                                <span>MoHFW Telemedicine Emergency Bypass Protocol (Call 108 / 112 Immediately)</span>
                            </div>
                            <h3 className='text-lg sm:text-xl font-extrabold text-white'>
                                Do NOT Wait for an Online Video Consultation
                            </h3>
                            <p className='text-sm text-rose-100 leading-relaxed'>
                                {analysis.emergencyBanner || 'Your symptoms include acute emergency red flags that require immediate in-person Hospital Emergency Room (ER) assessment. Specialists listed below are strictly for post-stabilization follow-up.'}
                            </p>
                        </div>
                    )}

                    {/* Guidance Summary Card */}
                    <div className='bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-2xs space-y-6'>
                        {(() => {
                            const urgency = getUrgencyConfig(analysis.urgencyLevel)
                            const UrgencyIcon = urgency.icon
                            return (
                                <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100'>
                                    <div>
                                        <span className='text-xs font-semibold text-slate-400'>
                                            Symptom Check Result
                                        </span>
                                        <h2 className='text-xl font-bold text-slate-900 mt-0.5'>
                                            Our Recommendation for You
                                        </h2>
                                    </div>
                                    <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border ${urgency.bg} ${urgency.border} ${urgency.text}`}>
                                        <UrgencyIcon className='w-4 h-4' />
                                        <span>{urgency.label}</span>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Recommended Specialist Card */}
                        <div className='bg-sky-50/70 border border-sky-200/90 rounded-2xl p-5 sm:p-6 space-y-3.5'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <p className='text-xs font-bold text-sky-800 uppercase tracking-wider flex items-center gap-1.5'>
                                    <Stethoscope className='w-4 h-4 text-primary' /> Recommended specialist
                                </p>
                                <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-sky-200 text-sky-700 text-[11px] font-semibold'>
                                    ✓ Verified clinical guidance
                                </span>
                            </div>

                            <div>
                                <h3 className='text-xl sm:text-2xl font-bold text-slate-900'>
                                    {formatSpeciality(analysis.recommendedSpeciality)}
                                </h3>
                                <p className='text-sm text-slate-700 leading-relaxed mt-2 pt-2 border-t border-sky-100'>
                                    {analysis.reasoning}
                                </p>
                            </div>

                            {/* Patient-Centric Health Badges */}
                            <div className='pt-1 flex flex-wrap items-center gap-2'>
                                <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-slate-700 border border-sky-200 shadow-2xs'>
                                    🩺 Comprehensive primary evaluation
                                </span>
                                <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200'>
                                    🛡️ Non-emergency guidance
                                </span>
                            </div>

                            {/* Direct Action Button to view doctors */}
                            <div className='pt-1'>
                                <button
                                    type='button'
                                    onClick={() => {
                                        document.getElementById('available-doctors')?.scrollIntoView({ behavior: 'smooth' })
                                    }}
                                    className='inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-sky-600 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer'
                                >
                                    <span>View available {formatSpeciality(analysis.recommendedSpeciality)} doctors</span>
                                    <ArrowRight className='w-3.5 h-3.5' />
                                </button>
                            </div>
                        </div>

                        {/* Possible Area of Concern */}
                        {analysis.possibleConcernArea && (
                            <div className='space-y-1.5'>
                                <p className='text-xs font-bold text-slate-500 uppercase tracking-wider'>
                                    What this might relate to
                                </p>
                                <p className='text-sm font-semibold text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-100'>
                                    {analysis.possibleConcernArea}
                                </p>
                            </div>
                        )}

                        {/* Helpful Self-Care Tips */}
                        {analysis.immediateAdvice && (
                            <div className='bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-1.5 text-sm'>
                                <p className='font-bold text-emerald-900 text-xs uppercase tracking-wider flex items-center gap-1.5'>
                                    <HeartHandshake className='w-4 h-4 text-emerald-600' /> Helpful tips while you wait
                                </p>
                                <p className='text-slate-700 leading-relaxed'>
                                    {analysis.immediateAdvice}
                                </p>
                            </div>
                        )}

                        {/* Friendly Disclaimer */}
                        <div className='pt-3 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed'>
                            <ShieldAlert className='w-4 h-4 text-slate-400 shrink-0 mt-0.5' />
                            <span>
                                {analysis.disclaimer || 'Note: This tool gives general guidance and is not a formal medical diagnosis. If you have severe chest pain, trouble breathing, or fainting, please call emergency services immediately.'}
                            </span>
                        </div>
                    </div>

                    {/* Matched Doctors List */}
                    <div id='available-doctors' className='bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-2xs space-y-5 scroll-mt-20'>
                        <div className='flex items-center justify-between pb-3 border-b border-slate-100'>
                            <div>
                                <h3 className='text-lg font-bold text-slate-900'>
                                    Available {formatSpeciality(analysis.recommendedSpeciality)} doctors
                                </h3>
                                <p className='text-xs sm:text-sm text-slate-500 mt-0.5'>
                                    Book an appointment directly with one of our verified practitioners below
                                </p>
                            </div>
                        </div>

                        {doctors.length > 0 ? (
                            <div className='grid grid-cols-1 gap-3.5'>
                                {doctors.map((doc) => (
                                    <div
                                        key={doc._id}
                                        className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 hover:border-primary rounded-2xl hover:bg-sky-50/30 transition-all cursor-pointer'
                                        onClick={() => navigate(`/appointment/${doc._id}`, { state: { prefilledSymptoms: symptoms } })}
                                    >
                                        <div className='flex items-center gap-4 min-w-0'>
                                            <img
                                                src={doc.image}
                                                alt={doc.name}
                                                className='w-16 h-16 rounded-2xl object-cover bg-sky-50 border border-slate-200 shrink-0'
                                            />
                                            <div className='min-w-0'>
                                                <p className='font-bold text-slate-900 text-base truncate'>{doc.name}</p>
                                                <p className='text-xs sm:text-sm text-primary font-semibold truncate'>{doc.degree} • {doc.experience} experience</p>
                                                <p className='text-xs text-slate-500 mt-0.5 line-clamp-1'>{doc.about}</p>
                                            </div>
                                        </div>
                                        <div className='flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100'>
                                            <div className='sm:text-right'>
                                                <span className='text-[11px] text-slate-400 block sm:hidden'>Consultation Fee</span>
                                                <p className='font-bold text-slate-900 text-base tabular-nums'>{currencySymbol}{doc.fees}</p>
                                            </div>
                                            <button className='px-4 py-2 bg-primary hover:bg-sky-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs'>
                                                Book appointment
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className='text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3'>
                                <p className='text-slate-600 text-sm font-medium'>No doctors are currently listed under this specialty</p>
                                <button
                                    onClick={() => navigate('/doctors')}
                                    className='px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer'
                                >
                                    View all doctors
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => navigate(`/doctors/${analysis.recommendedSpeciality}`)}
                            className='w-full py-3 border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer'
                        >
                            <span>See all {formatSpeciality(analysis.recommendedSpeciality)} doctors</span>
                            <ArrowRight className='w-4 h-4' />
                        </button>
                    </div>

                    {/* What You Described */}
                    <div className='bg-slate-100/80 border border-slate-200 rounded-2xl p-4 text-xs sm:text-sm text-slate-600 space-y-1'>
                        <span className='text-xs font-bold text-slate-500'>What you described:</span>
                        <p className='text-slate-800 italic'>"{symptoms}"</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SymptomChecker
