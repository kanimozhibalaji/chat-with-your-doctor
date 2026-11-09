import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  Award,
  Lock,
  HeartPulse,
  Stethoscope,
  Activity,
  FileCheck,
  CheckCircle2,
  Building2,
  ArrowRight,
  Sparkles,
  Users
} from 'lucide-react'

const About = () => {
  const navigate = useNavigate()

  const coreStandards = [
    {
      title: 'Board-Certified Specialists',
      desc: 'Every physician on VitalSync undergoes primary-source medical license verification and clinical credential audits across 12 specialties.',
      icon: Stethoscope,
      accent: 'text-sky-600 bg-sky-50 border-sky-100'
    },
    {
      title: 'Clinical Decision Support (CDSS)',
      desc: 'Our dual-layer safety engine screens every prescription against known drug-drug interactions and patient allergies before digital signature.',
      icon: ShieldCheck,
      accent: 'text-emerald-600 bg-emerald-50 border-emerald-100'
    },
    {
      title: 'Longitudinal Lab Trends',
      desc: 'Patients can upload diagnostic blood tests and lab reports to track cholesterol, glucose, and vitals over time with AI-assisted insights.',
      icon: HeartPulse,
      accent: 'text-rose-600 bg-rose-50 border-rose-100'
    },
    {
      title: 'Verifiable Cryptographic Rx',
      desc: 'Every digital prescription is cryptographically signed and verifiable via QR code by any licensed pharmacy, preventing tampering or re-dispense.',
      icon: FileCheck,
      accent: 'text-indigo-600 bg-indigo-50 border-indigo-100'
    }
  ]

  const governanceMetrics = [
    { label: 'Licensed Medical Specialties', value: '12+' },
    { label: 'Average Teleconsultation Wait', value: '< 15 mins' },
    { label: 'Patient Clinical Satisfaction', value: '98.4%' },
    { label: 'Digitally Verified Prescriptions', value: '10,000+' }
  ]

  return (
    <div className='min-h-[85vh] py-8 max-w-6xl mx-auto space-y-12'>
      {/* Hero Header */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 max-w-3xl space-y-4'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold'>
            <ShieldCheck className='w-4 h-4 text-sky-400' />
            <span>Clinical Mission & Healthcare Standards</span>
          </div>

          <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight'>
            Reimagining Patient Care with High Clinical Integrity
          </h1>

          <p className='text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl'>
            VitalSync bridges the gap between digital teleconsultations and hands-on medicine. We empower patients to consult top specialists from home, understand their lab results clearly, and receive safe, tamper-evident digital prescriptions.
          </p>
        </div>
      </section>

      {/* Narrative & Visual Section */}
      <section className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-center'>
        <div className='lg:col-span-5'>
          <div className='relative rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 aspect-[4/3]'>
            <img
              className='w-full h-full object-cover'
              src={assets.about_image}
              alt='VitalSync Clinical Specialists'
            />
            <div className='absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-xs text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-700/60 flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
              <span>Patient-Centric Telehealth</span>
            </div>
          </div>
        </div>

        <div className='lg:col-span-7 space-y-5 text-sm text-slate-600 leading-relaxed'>
          <h2 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
            Medicine Without the Waiting Room, Backed by Hospital Safety Nets
          </h2>

          <p>
            Traditional healthcare is frequently burdened by long transit times, crowded waiting rooms, and fragmented records scattered across multiple clinics. VitalSync unifies your entire medical journey into a cohesive personal health portal.
          </p>

          <p>
            When a case can be safely treated online, our doctors conduct thorough video visits and issue digitally signed prescriptions with automated drug interaction screening. When a condition requires hands-on palpation, imaging, or procedure work, our doctors immediately initiate a structured <strong>in-person hospital referral</strong> so you never fall through the cracks.
          </p>

          <div className='pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs'>
            <div className='bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1'>
              <p className='font-bold text-slate-900 text-sm flex items-center gap-1.5'>
                <Lock className='w-4 h-4 text-sky-600' />
                <span>Encrypted & Confidential</span>
              </p>
              <p className='text-slate-500 text-xs'>
                Teleconsultations, health dossiers, and medical chats are secured with TLS 1.3 transport encryption.
              </p>
            </div>

            <div className='bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1'>
              <p className='font-bold text-slate-900 text-sm flex items-center gap-1.5'>
                <Building2 className='w-4 h-4 text-indigo-600' />
                <span>Hospital Referral Safety Net</span>
              </p>
              <p className='text-slate-500 text-xs'>
                Structured referrals ensure timely transfers to physical emergency or specialty hospital facilities when needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Clinical Pillars */}
      <section className='space-y-5'>
        <div className='text-center max-w-xl mx-auto space-y-1.5'>
          <h2 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
            Our Core Clinical Standards
          </h2>
          <p className='text-xs sm:text-sm text-slate-500'>
            Engineered for medical precision, patient transparency, and preventative wellness.
          </p>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'>
          {coreStandards.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className='bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between gap-4'
              >
                <div className='space-y-3'>
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${item.accent}`}>
                    <Icon className='w-6 h-6' />
                  </div>
                  <h3 className='font-bold text-slate-900 text-base'>
                    {item.title}
                  </h3>
                  <p className='text-xs text-slate-500 leading-relaxed'>
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Clinical Governance Numbers Strip */}
      <section className='bg-slate-900 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-md'>
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-y lg:divide-y-0 lg:divide-x divide-slate-800'>
          {governanceMetrics.map((m, i) => (
            <div key={i} className={`pt-4 lg:pt-0 ${i !== 0 ? 'lg:pl-6' : ''}`}>
              <p className='text-2xl sm:text-3xl font-extrabold text-sky-400 tabular-nums'>
                {m.value}
              </p>
              <p className='text-xs sm:text-sm text-slate-300 font-medium mt-1'>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Rail */}
      <section className='bg-sky-50 border border-sky-200/80 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6'>
        <div className='space-y-1.5 text-center sm:text-left'>
          <h3 className='text-xl sm:text-2xl font-extrabold text-slate-900'>
            Ready to consult with a specialist?
          </h3>
          <p className='text-xs sm:text-sm text-slate-600 max-w-lg'>
            Browse verified doctors across 12 medical specialties and book your consultation in seconds.
          </p>
        </div>

        <button
          type='button'
          onClick={() => navigate('/doctors')}
          className='px-6 py-3.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-sky-600/25 transition-all inline-flex items-center gap-2 cursor-pointer shrink-0'
        >
          <span>Find a Doctor</span>
          <ArrowRight className='w-4 h-4' />
        </button>
      </section>
    </div>
  )
}

export default About
