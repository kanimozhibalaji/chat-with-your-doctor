import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import {
  ArrowRight,
  Stethoscope,
  HeartPulse,
  Baby,
  Brain,
  Sparkles,
  Activity,
  Bone,
  Smile,
  Eye,
  Ear,
  HeartHandshake
} from 'lucide-react'

const SPECIALITIES_GRID = [
  {
    speciality: 'General physician',
    desc: 'Fever, cold, cough, blood pressure, diabetes & everyday health checkups',
    icon: Stethoscope
  },
  {
    speciality: 'Gynecologist',
    desc: "Women's health, pregnancy care, period concerns & routine checkups",
    icon: HeartHandshake
  },
  {
    speciality: 'Dermatologist',
    desc: 'Skin problems, acne, rashes, allergies, eczema & hair fall treatment',
    icon: Sparkles
  },
  {
    speciality: 'Pediatricians',
    desc: 'Child health, vaccinations, growth checkups & childhood illnesses',
    icon: Baby
  },
  {
    speciality: 'Neurologist',
    desc: 'Headaches, migraines, dizziness, nerve pain & sleep troubles',
    icon: Brain
  },
  {
    speciality: 'Gastroenterologist',
    desc: 'Stomach pain, acidity, indigestion, gas & liver health',
    icon: Activity
  },
  {
    speciality: 'Cardiologist',
    desc: 'Heart health, chest discomfort, blood pressure & cholesterol care',
    icon: HeartPulse
  },
  {
    speciality: 'Orthopedic',
    desc: 'Back pain, knee & joint pain, fractures, arthritis & sports injuries',
    icon: Bone
  },
  {
    speciality: 'Psychiatrist',
    desc: 'Stress, anxiety, mood support, focus & better sleep care',
    icon: Brain
  },
  {
    speciality: 'Ophthalmologist',
    desc: 'Vision checkups, dry eyes, eye strain, cataracts & eye care',
    icon: Eye
  },
  {
    speciality: 'ENT Specialist',
    desc: 'Ear infections, sinus pain, sore throat, tonsils & hearing care',
    icon: Ear
  },
  {
    speciality: 'Dentist',
    desc: 'Toothache, root canals, gum care, wisdom teeth & oral hygiene',
    icon: Smile
  }
]

const SpecialityMenu = () => {
  const { doctors } = useContext(AppContext)

  return (
    <section id='speciality' className='py-10 md:py-14'>
      {/* Header */}
      <div className='text-center max-w-2xl mx-auto mb-10 space-y-2.5'>
        <div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-100 text-xs font-semibold text-primary'>
          <Stethoscope className='w-3.5 h-3.5' />
          <span>Browse by Specialty</span>
        </div>
        <h2 className='text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight'>
          Find Doctors by Health Concern
        </h2>
        <p className='text-sm text-slate-500 leading-relaxed'>
          Not sure where to start? Choose any of our 12 medical specializations below to see available specialists ready to help.
        </p>
      </div>

      {/* Speciality Grid */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
        {SPECIALITIES_GRID.map((item, index) => {
          const IconComponent = item.icon
          const count = Array.isArray(doctors)
            ? doctors.filter((d) => d.speciality === item.speciality).length
            : 0
          return (
            <Link
              key={index}
              to={`/doctors/${item.speciality}`}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className='group bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-primary hover:shadow-md transition-all duration-200 flex flex-col justify-between'
            >
              <div className='flex items-start gap-3.5'>
                <div className='w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors'>
                  <IconComponent className='w-6 h-6' />
                </div>
                <div className='space-y-1 min-w-0 flex-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <h3 className='font-bold text-slate-900 text-sm sm:text-base group-hover:text-primary transition-colors truncate'>
                      {item.speciality}
                    </h3>
                    {count > 0 && (
                      <span className='px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0'>
                        {count} {count === 1 ? 'Doc' : 'Docs'}
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-slate-500 leading-relaxed line-clamp-2'>
                    {item.desc}
                  </p>
                </div>
              </div>

              <div className='mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700 group-hover:text-primary transition-colors'>
                <span>View Specialists</span>
                <ArrowRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default SpecialityMenu
