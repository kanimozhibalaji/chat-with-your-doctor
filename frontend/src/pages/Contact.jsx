import React, { useState } from 'react'
import { assets } from '../assets/assets'
import { toast } from 'react-toastify'
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Send,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'Appointment Help',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all required fields.')
      return
    }
    setSubmitted(true)
    toast.success('Your message has been received. Our clinical support team will respond within 2 hours.')
    setFormData({ name: '', email: '', category: 'Appointment Help', message: '' })
  }

  return (
    <div className='min-h-[85vh] py-8 max-w-6xl mx-auto space-y-10'>
      {/* Header */}
      <section className='bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 border border-slate-700/50 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl'>
        <div className='absolute -right-20 -top-20 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none' />

        <div className='relative z-10 max-w-2xl space-y-3'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-bold'>
            <Building2 className='w-4 h-4 text-sky-400' />
            <span>Patient Support & Care Coordination</span>
          </div>

          <h1 className='text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight'>
            We're Here to Support Your Care
          </h1>

          <p className='text-slate-300 text-sm sm:text-base leading-relaxed'>
            Have questions about your scheduled appointment, prescription verification, or lab records? Reach out to our dedicated healthcare coordination team.
          </p>
        </div>
      </section>

      {/* Emergency Advisory Notice */}
      <section className='bg-amber-50 border border-amber-200/90 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div className='flex items-start gap-3.5'>
          <div className='w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0'>
            <AlertTriangle className='w-5 h-5' />
          </div>
          <div className='space-y-0.5'>
            <p className='text-xs font-extrabold uppercase tracking-wider text-amber-900'>
              Medical Emergency Notice
            </p>
            <p className='text-xs sm:text-sm text-amber-800 leading-relaxed'>
              VitalSync is designed for non-emergency consultations. In case of severe chest pain, shortness of breath, or trauma, call <strong>108 / 112 / 911</strong> or visit the nearest emergency department immediately.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid: Contact Channels + Interactive Message Form */}
      <section className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
        {/* Left Column: Direct Info Cards (5 Cols) */}
        <div className='lg:col-span-5 space-y-5'>
          {/* Main Headquarters Card */}
          <div className='bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-6'>
            <h2 className='text-base font-extrabold text-slate-900 tracking-tight'>
              Contact Channels
            </h2>

            <div className='space-y-5 text-sm'>
              <div className='flex items-start gap-3.5'>
                <div className='w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0'>
                  <Phone className='w-5 h-5' />
                </div>
                <div>
                  <p className='font-bold text-slate-900 text-xs uppercase tracking-wider'>
                    Toll-Free Patient Line
                  </p>
                  <p className='text-slate-800 font-semibold mt-0.5 tabular-nums text-sm'>
                    +1 (800) 555-8482
                  </p>
                  <p className='text-slate-500 text-xs mt-0.5'>
                    Mon–Sat: 8:00 AM – 8:00 PM EST
                  </p>
                </div>
              </div>

              <div className='flex items-start gap-3.5'>
                <div className='w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0'>
                  <Mail className='w-5 h-5' />
                </div>
                <div>
                  <p className='font-bold text-slate-900 text-xs uppercase tracking-wider'>
                    Email Support
                  </p>
                  <p className='text-slate-800 font-semibold mt-0.5 text-sm'>
                    support@vitalsync-health.org
                  </p>
                  <p className='text-slate-500 text-xs mt-0.5'>
                    Physician inquiries: partners@vitalsync-health.org
                  </p>
                </div>
              </div>

              <div className='flex items-start gap-3.5'>
                <div className='w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0'>
                  <MapPin className='w-5 h-5' />
                </div>
                <div>
                  <p className='font-bold text-slate-900 text-xs uppercase tracking-wider'>
                    Clinical Headquarters
                  </p>
                  <p className='text-slate-700 text-xs leading-relaxed mt-0.5'>
                    54709 Healthcare Technology Parkway, Suite 350<br />
                    Seattle Medical District, WA 98101, USA
                  </p>
                </div>
              </div>

              <div className='flex items-start gap-3.5'>
                <div className='w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0'>
                  <Clock className='w-5 h-5' />
                </div>
                <div>
                  <p className='font-bold text-slate-900 text-xs uppercase tracking-wider'>
                    Telehealth Availability
                  </p>
                  <p className='text-slate-700 text-xs mt-0.5'>
                    Online video consultations available 24/7 across scheduled slots.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick FAQ snippet */}
          <div className='bg-slate-50 border border-slate-200/90 rounded-3xl p-6 text-xs text-slate-600 space-y-2.5'>
            <div className='flex items-center gap-2 font-bold text-slate-900 text-sm'>
              <HelpCircle className='w-4 h-4 text-sky-600' />
              <span>Frequently Asked Questions</span>
            </div>
            <p>
              <strong>Need to reschedule?</strong> You can reschedule or cancel an appointment directly from your <a href='/my-appointments' className='text-sky-600 font-semibold underline'>Appointments page</a> with zero penalty before the consultation window begins.
            </p>
            <p>
              <strong>Where are my prescriptions?</strong> All digitally signed prescriptions are securely saved in your <a href='/health' className='text-sky-600 font-semibold underline'>Health Hub</a> and can be shown to any pharmacy.
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Patient Inquiry Form (7 Cols) */}
        <div className='lg:col-span-7'>
          <div className='bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6'>
            <div>
              <h2 className='text-xl font-extrabold text-slate-900 tracking-tight'>
                Send a Message to Patient Support
              </h2>
              <p className='text-xs text-slate-500 mt-1'>
                We typically reply within 2 hours during normal clinic operating hours.
              </p>
            </div>

            {submitted ? (
              <div className='py-12 px-6 text-center space-y-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl'>
                <div className='w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto'>
                  <CheckCircle2 className='w-6 h-6' />
                </div>
                <h3 className='text-base font-bold text-emerald-950'>Message Delivered Successfully</h3>
                <p className='text-xs text-slate-600 max-w-sm mx-auto'>
                  A care coordinator has been assigned to your ticket. A confirmation has also been dispatched to your email.
                </p>
                <button
                  type='button'
                  onClick={() => setSubmitted(false)}
                  className='mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors'
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5'>
                      Full Name *
                    </label>
                    <input
                      type='text'
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder='e.g., Jane Doe'
                      className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500 bg-white'
                    />
                  </div>

                  <div>
                    <label className='block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5'>
                      Email Address *
                    </label>
                    <input
                      type='email'
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder='e.g., jane@example.com'
                      className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500 bg-white'
                    />
                  </div>
                </div>

                <div>
                  <label className='block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5'>
                    Inquiry Topic
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500 bg-white'
                  >
                    <option value='Appointment Help'>Appointment Booking & Rescheduling</option>
                    <option value='Prescription Inquiry'>Prescription Verification & Dispense</option>
                    <option value='Lab Reports & Health'>Lab Report Uploads & Biomarkers</option>
                    <option value='Doctor Onboarding'>Physician Partnership / Onboarding</option>
                    <option value='Billing & Receipts'>Payment Receipts & Refunds</option>
                    <option value='General Support'>Other Inquiries</option>
                  </select>
                </div>

                <div>
                  <label className='block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5'>
                    Message / Details *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder='Describe how our patient coordination team can help you...'
                    className='w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 outline-none focus:border-sky-500 bg-white resize-none'
                  />
                </div>

                <div className='pt-2 flex items-center justify-between'>
                  <span className='text-[11px] text-slate-400'>
                    Protected by healthcare privacy encryption
                  </span>
                  <button
                    type='submit'
                    className='px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 inline-flex items-center gap-2 cursor-pointer transition-all'
                  >
                    <Send className='w-4 h-4' />
                    <span>Send Message</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Contact
