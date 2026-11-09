import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Lock, HeartPulse, AlertTriangle } from 'lucide-react'
import { BrandLogo } from './Navbar'

const Footer = () => {
  return (
    <footer className='mt-20 border-t border-slate-200/90 bg-white text-slate-600 text-sm'>
      {/* Top Reassurance Bar */}
      <div className='border-b border-slate-100 bg-slate-50/70 py-4'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-700'>
            <div className='flex items-center gap-2.5'>
              <ShieldCheck className='w-4 h-4 text-emerald-600 shrink-0' />
              <span className='font-medium text-xs'>Verified Digital Prescriptions</span>
            </div>
            <div className='flex items-center gap-2.5'>
              <Lock className='w-4 h-4 text-primary shrink-0' />
              <span className='font-medium text-xs'>Private & Secure Video Consultations</span>
            </div>
            <div className='flex items-center gap-2.5'>
              <HeartPulse className='w-4 h-4 text-rose-500 shrink-0' />
              <span className='font-medium text-xs'>Easy Health & Lab Report Tracking</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-10'>
          
          {/* Brand & Mission */}
          <div className='md:col-span-5 space-y-4'>
            <Link to='/' className='inline-block'>
              <BrandLogo />
            </Link>
            <p className='text-slate-500 text-xs sm:text-sm leading-relaxed max-w-sm'>
              VitalSync makes everyday healthcare simple. Find trusted doctors, book appointments online, check your symptoms, and keep your prescriptions and health records safe in one place.
            </p>
            <div className='flex items-center gap-2 text-xs text-slate-500'>
              <span className='inline-block w-2 h-2 rounded-full bg-emerald-500' />
              <span>All Services Online & Available 24/7</span>
            </div>
          </div>

          {/* Patient Tools */}
          <div className='md:col-span-2 space-y-3'>
            <p className='font-bold text-slate-900 uppercase tracking-wider text-xs'>Quick Links</p>
            <ul className='space-y-2.5 text-xs sm:text-sm'>
              <li><Link to='/doctors' className='hover:text-primary transition-colors'>Find a Doctor</Link></li>
              <li><Link to='/symptom-checker' className='hover:text-primary transition-colors'>Symptom Checker</Link></li>
              <li><Link to='/drug-checker' className='hover:text-primary transition-colors'>Medicine Safety</Link></li>
              <li><Link to='/health' className='hover:text-primary transition-colors'>My Health & Reports</Link></li>
            </ul>
          </div>

          {/* Company & Support */}
          <div className='md:col-span-2 space-y-3'>
            <p className='font-bold text-slate-900 uppercase tracking-wider text-xs'>About & Help</p>
            <ul className='space-y-2.5 text-xs sm:text-sm'>
              <li><Link to='/about' className='hover:text-primary transition-colors'>About Us</Link></li>
              <li><Link to='/contact' className='hover:text-primary transition-colors'>Contact Support</Link></li>
              <li><Link to='/my-appointments' className='hover:text-primary transition-colors'>My Appointments</Link></li>
              <li><span className='text-slate-400'>Privacy Policy</span></li>
              <li><span className='text-slate-400'>Terms of Service</span></li>
            </ul>
          </div>

          {/* Emergency Advisory */}
          <div className='md:col-span-3 space-y-2.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 self-start'>
            <div className='flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wide'>
              <AlertTriangle className='w-4 h-4 text-amber-600 shrink-0' />
              <span>Medical Emergency?</span>
            </div>
            <p className='text-amber-900/90 text-xs leading-relaxed'>
              VitalSync is for routine care and non-emergency consultations. If you have a medical emergency, please call your local emergency number (such as <strong>108 / 112 / 911</strong>) or visit the nearest hospital immediately.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className='border-t border-slate-100 py-5 bg-slate-50/40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs'>
          <p>© {new Date().getFullYear()} VitalSync Healthcare. All rights reserved.</p>
          <div className='flex items-center gap-6'>
            <span>Safe & Private Patient Portal</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
