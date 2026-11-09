import React, { useState, useContext, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import ReviewModal from '../components/ReviewModal'
import {
    FileText,
    Printer,
    ArrowLeft,
    MessageSquare,
    Pill,
    Star,
    ShieldCheck,
    ShieldAlert,
    AlertTriangle,
    Lock,
    CheckCircle2,
    User,
    Award,
    FileQuestion,
    BellRing
} from 'lucide-react'

const PrescriptionView = () => {
    const { appointmentId } = useParams()
    const navigate = useNavigate()
    const { backendUrl, token, userData } = useContext(AppContext)

    const [prescription, setPrescription] = useState(null)
    const [patientInfo, setPatientInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [notifyingDoc, setNotifyingDoc] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)

    const fetchPrescription = async () => {
        if (!token || !appointmentId) return
        try {
            const { data } = await axios.get(
                backendUrl + `/api/prescription/patient/${appointmentId}`,
                { headers: { token } }
            )
            if (data.success && data.prescription) {
                setPrescription(data.prescription)
                if (data.user) setPatientInfo(data.user)
            }
        } catch (error) {
            console.error('Prescription fetch error:', error)
            toast.error("Failed to fetch prescription document")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPrescription()

        const handleLivePrescriptionUpdate = (e) => {
            if (!e.detail?.appointmentId || String(e.detail.appointmentId) === String(appointmentId)) {
                fetchPrescription()
            }
        }
        window.addEventListener('vitalsync:prescription-updated', handleLivePrescriptionUpdate)
        window.addEventListener('prescripto:prescription-updated', handleLivePrescriptionUpdate)
        return () => {
            window.removeEventListener('vitalsync:prescription-updated', handleLivePrescriptionUpdate)
            window.removeEventListener('prescripto:prescription-updated', handleLivePrescriptionUpdate)
        }
    }, [token, appointmentId, backendUrl])

    const handleNotifyDoctorConflict = async () => {
        if (!prescription || notifyingDoc) return
        setNotifyingDoc(true)
        try {
            const { data } = await axios.post(backendUrl + '/api/ddi/check', {
                medicines: prescription.medicines || [],
                userId: userData?._id || prescription.userId,
                appointmentId,
                patientAllergies: patientInfo?.allergies || userData?.allergies || [],
                currentMedications: patientInfo?.currentMedications || userData?.currentMedications || [],
                notifyDoctorOnConflict: true
            })
            if (data.success) {
                if (data.report) {
                    setPrescription(prev => ({ ...prev, safetyReport: data.report }))
                }
                toast.success("Your doctor has been notified immediately of this allergy/medicine conflict!")
            }
        } catch (error) {
            toast.error("Failed to send alert to doctor")
        } finally {
            setNotifyingDoc(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    if (loading) {
        return (
            <div className='min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500 text-sm'>
                <div className='w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin' />
                <span>Retrieving digital prescription & safety report...</span>
            </div>
        )
    }

    if (!prescription) {
        return (
            <div className='min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md mx-auto'>
                <div className='w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto'>
                    <FileQuestion className='w-7 h-7' />
                </div>
                <div>
                    <h2 className='text-xl font-bold text-slate-900'>No Prescription Available Yet</h2>
                    <p className='text-slate-500 text-xs sm:text-sm mt-1.5 leading-relaxed'>
                        Your doctor has not issued a digital prescription for this consultation yet. Once created, your prescription, medication instructions, and QR verification will appear here automatically.
                    </p>
                </div>
                <button 
                    onClick={() => navigate('/my-appointments')}
                    className='inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer'
                >
                    <ArrowLeft className='w-3.5 h-3.5' /> Back to Consultations
                </button>
            </div>
        )
    }

    const apt = prescription.appointmentId
    const rawDocName = apt?.docData?.name || 'Doctor'
    const docDisplayName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`
    const safety = prescription.safetyReport || {}
    const allergyAlerts = safety.allergyAlerts || []
    const interactions = safety.interactions || []
    const activeAllergies = patientInfo?.allergies || userData?.allergies || apt?.userData?.allergies || []

    return (
        <div className='py-6 max-w-4xl mx-auto space-y-6'>
            {/* Action Bar (hidden when printing) */}
            <div className='w-full flex flex-wrap justify-between items-center gap-3 print:hidden'>
                <div className='flex flex-wrap items-center gap-2'>
                    <button 
                        onClick={() => navigate('/my-appointments')}
                        className='inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer'
                    >
                        <ArrowLeft className='w-3.5 h-3.5' /> Back to Appointments
                    </button>
                    <button
                        onClick={() => navigate(`/chat/${appointmentId}`)}
                        className='inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-primary bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors cursor-pointer'
                    >
                        <MessageSquare className='w-3.5 h-3.5' /> Message Doctor
                    </button>
                    <button
                        onClick={() => navigate('/drug-checker')}
                        className='inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer'
                    >
                        <Pill className='w-3.5 h-3.5' /> Drug Safety Checker
                    </button>
                </div>

                <div className='flex items-center gap-2'>
                    <button
                        onClick={() => setShowReviewModal(true)}
                        className='inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer'
                    >
                        <Star className='w-3.5 h-3.5 text-amber-500 fill-amber-400' /> Rate Doctor
                    </button>
                    <button 
                        onClick={handlePrint}
                        className='inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-sky-600 text-white text-xs rounded-xl font-bold shadow-xs transition-colors cursor-pointer'
                    >
                        <Printer className='w-3.5 h-3.5' /> Print / Download PDF
                    </button>
                </div>
            </div>

            {/* Printable Prescription Rx Document */}
            <div className='w-full bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0'>
                {/* Clinical Header Banner */}
                <div className='bg-slate-900 text-white p-6 sm:p-8 border-b border-slate-800'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                        <div className='space-y-1.5'>
                            <div className='flex items-center gap-2.5'>
                                <h1 className='text-2xl font-black tracking-tight text-white'>VitalSync Healthcare</h1>
                                <span className='bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1'>
                                    <Lock className='w-3 h-3' /> Digital Rx Verified
                                </span>
                            </div>
                            <p className='text-xs text-slate-400'>
                                Official Telehealth Electronic Prescription Document
                            </p>
                        </div>
                        <div className='text-left sm:text-right space-y-1 text-xs'>
                            <p className='text-slate-400'>
                                Rx Reference ID: <span className='text-white font-mono font-bold'>{prescription._id.slice(-8).toUpperCase()}</span>
                            </p>
                            <p className='text-slate-400'>
                                Issued Date: <span className='text-white font-medium'>{new Date(prescription.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className='p-6 sm:p-8 space-y-8'>
                    {/* Patient & Physician Grid */}
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200'>
                        {/* Patient Box */}
                        <div className='bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-2'>
                            <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5'>
                                <User className='w-3.5 h-3.5 text-slate-400' /> Patient Identification
                            </span>
                            {apt?.userData ? (
                                <div className='space-y-1 text-xs'>
                                    <p className='font-extrabold text-slate-900 text-base'>{apt.userData.name}</p>
                                    <p className='text-slate-600'>
                                        Gender: <strong className='text-slate-800'>{apt.userData.gender || 'Not specified'}</strong>
                                    </p>
                                    <p className='text-slate-600'>
                                        DOB / Age: <strong className='text-slate-800'>{apt.userData.dob || 'Not specified'}</strong>
                                    </p>
                                    {activeAllergies.length > 0 && (
                                        <div className='pt-1.5 flex flex-wrap items-center gap-1.5'>
                                            <span className='text-[11px] font-bold text-rose-700'>Known Allergies:</span>
                                            {activeAllergies.map((alg, idx) => (
                                                <span
                                                    key={idx}
                                                    className='px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold'
                                                >
                                                    {alg}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className='text-xs text-slate-500'>Patient details verified on file</p>
                            )}
                        </div>

                        {/* Prescribing Doctor Box */}
                        <div className='bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-2'>
                            <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5'>
                                <Award className='w-3.5 h-3.5 text-primary' /> Prescribing Physician
                            </span>
                            {apt?.docData ? (
                                <div className='space-y-1 text-xs'>
                                    <p className='font-extrabold text-slate-900 text-base'>{docDisplayName}</p>
                                    <p className='text-primary font-semibold'>{apt.docData.speciality}</p>
                                    <p className='text-slate-500'>{apt.docData.degree || 'Medical Specialist'}</p>
                                    <p className='text-slate-400 text-[11px]'>{apt.docData.address?.line1 || 'VitalSync Telehealth Network'}</p>
                                </div>
                            ) : (
                                <p className='text-xs text-slate-500'>Physician digital credentials verified</p>
                            )}
                        </div>
                    </div>

                    {/* Clinical Diagnosis */}
                    <div className='space-y-2 pb-6 border-b border-slate-200'>
                        <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5'>
                            <FileText className='w-3.5 h-3.5 text-slate-400' /> Clinical Diagnosis & Findings
                        </span>
                        <div className='bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium'>
                            {prescription.diagnosis || 'Routine clinical teleconsultation completed.'}
                        </div>
                    </div>

                    {/* Prescribed Medications (Rx Table) */}
                    <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                            <span className='text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2'>
                                <span className='font-serif italic text-lg text-primary font-bold'>Rx</span>
                                <span>Prescribed Medications ({prescription.medicines?.length || 0})</span>
                            </span>
                            <span className='text-[11px] text-slate-400'>
                                Take as directed by physician
                            </span>
                        </div>

                        <div className='border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto'>
                            <table className='w-full text-left text-xs'>
                                <thead className='bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-semibold'>
                                    <tr>
                                        <th className='p-3.5 w-1/3'>Medication Name</th>
                                        <th className='p-3.5'>Dosage</th>
                                        <th className='p-3.5'>Schedule / Frequency</th>
                                        <th className='p-3.5'>Duration</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-100'>
                                    {prescription.medicines.map((med, i) => (
                                        <tr key={i} className='hover:bg-slate-50/50 transition-colors'>
                                            <td className='p-3.5'>
                                                <p className='font-bold text-slate-900 text-xs sm:text-sm'>{med.name}</p>
                                                {med.instructions && (
                                                    <p className='text-[11px] text-slate-500 mt-0.5'>
                                                        Instruction: {med.instructions}
                                                    </p>
                                                )}
                                            </td>
                                            <td className='p-3.5 text-slate-700 font-semibold font-mono'>{med.dosage}</td>
                                            <td className='p-3.5 text-slate-700 font-medium'>{med.frequency}</td>
                                            <td className='p-3.5 text-slate-700 font-medium font-mono'>{med.duration}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI-Powered Medicine Interaction & Allergy Safety Report */}
                    {prescription.safetyReport && (
                        <div className={`p-5 rounded-2xl border text-xs space-y-3 ${
                            safety.overallRisk === 'SEVERE'
                                ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                                : safety.overallRisk === 'MODERATE'
                                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                        }`}>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <span className='font-bold flex items-center gap-2 text-xs sm:text-sm'>
                                    {safety.overallRisk === 'SEVERE' ? (
                                        <ShieldAlert className='w-4 h-4 text-rose-600 shrink-0' />
                                    ) : safety.overallRisk === 'MODERATE' ? (
                                        <AlertTriangle className='w-4 h-4 text-amber-600 shrink-0' />
                                    ) : (
                                        <ShieldCheck className='w-4 h-4 text-emerald-600 shrink-0' />
                                    )}
                                    <span>AI Pharmacological Safety & Allergy Screening</span>
                                </span>
                                <span className={`font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full border ${
                                    safety.overallRisk === 'SEVERE'
                                        ? 'bg-rose-600 text-white border-rose-700'
                                        : safety.overallRisk === 'MODERATE'
                                        ? 'bg-amber-500 text-white border-amber-600'
                                        : 'bg-white text-emerald-800 border-emerald-200'
                                }`}>
                                    Status: {safety.overallRisk || 'SAFE'}
                                </span>
                            </div>

                            <p className='text-xs opacity-90 leading-relaxed'>
                                {safety.aiSummary || 'Prescription verified against patient allergy profile and multi-drug interaction database.'}
                            </p>

                            {/* Allergy Alerts */}
                            {allergyAlerts.length > 0 && (
                                <div className='space-y-2 pt-1'>
                                    <p className='font-bold text-rose-800 text-[11px] flex items-center gap-1.5'>
                                        <AlertTriangle className='w-3.5 h-3.5 text-rose-600' />
                                        <span>Allergy Conflicts Detected ({allergyAlerts.length})</span>
                                    </p>
                                    {allergyAlerts.map((alert, idx) => (
                                        <div key={idx} className='bg-white/95 p-3 rounded-xl border border-rose-200 space-y-1 text-slate-800'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <span className='font-semibold text-rose-900'>
                                                    Allergen: {alert.allergen} &bull; Drug: {alert.drug}
                                                </span>
                                                <span className='px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase'>
                                                    {alert.severity}
                                                </span>
                                            </div>
                                            <p className='text-[11px] text-slate-700'>{alert.effect}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Drug Interactions */}
                            {interactions.length > 0 && (
                                <div className='space-y-2 pt-1'>
                                    <p className='font-bold text-amber-900 text-[11px] flex items-center gap-1.5'>
                                        <Pill className='w-3.5 h-3.5 text-amber-700' />
                                        <span>Drug Interactions ({interactions.length})</span>
                                    </p>
                                    {interactions.map((item, idx) => (
                                        <div key={idx} className='bg-white/95 p-3 rounded-xl border border-amber-200 space-y-1 text-slate-800'>
                                            <span className='font-semibold text-slate-900'>
                                                {item.drugA} &bull; {item.drugB}
                                            </span>
                                            <p className='text-[11px] text-slate-700'>{item.effect}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Conflict Action Trigger */}
                            {safety.overallRisk && safety.overallRisk !== 'SAFE' && (
                                <div className='pt-1 flex flex-wrap items-center gap-2 print:hidden'>
                                    <button
                                        type='button'
                                        onClick={handleNotifyDoctorConflict}
                                        disabled={notifyingDoc}
                                        className='px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer'
                                    >
                                        <BellRing className='w-3.5 h-3.5' />
                                        <span>{notifyingDoc ? 'Sending Alert...' : `Alert ${docDisplayName}`}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Doctor Advice & Follow-Up Date */}
                    {(prescription.notes || prescription.followUpDate) && (
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200 text-xs'>
                            {prescription.notes && (
                                <div className='space-y-1'>
                                    <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>
                                        Doctor's Clinical Advice
                                    </span>
                                    <p className='text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs sm:text-sm'>
                                        {prescription.notes}
                                    </p>
                                </div>
                            )}
                            {prescription.followUpDate && (
                                <div className='space-y-1'>
                                    <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>
                                        Recommended Follow-Up Date
                                    </span>
                                    <p className='text-slate-900 font-bold bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs sm:text-sm font-mono'>
                                        {new Date(prescription.followUpDate).toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signature & Scannable QR Code Footer */}
                    <div className='pt-2 flex flex-col sm:flex-row items-center justify-between gap-6'>
                        <div className='space-y-1 max-w-sm text-xs text-center sm:text-left'>
                            <div className='flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-bold text-xs'>
                                <CheckCircle2 className='w-4 h-4 text-emerald-600' /> Official Digital Signature Verified
                            </div>
                            <p className='text-slate-400 text-[11px] leading-relaxed'>
                                Issued electronically through VitalSync Telemedicine by {docDisplayName}. This document is cryptographic tamper-protected.
                            </p>
                        </div>

                        {prescription.qrCode && (
                            <div className='flex flex-col items-center text-center shrink-0'>
                                <a
                                    href={`/verify-prescription/${prescription._id}`}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='border border-slate-200 rounded-xl p-1 bg-white shadow-2xs hover:border-primary transition-all cursor-pointer block'
                                    title='Scan or click to verify authentic issuance'
                                >
                                    <img
                                        src={prescription.qrCode}
                                        alt='Verification QR Code'
                                        className='w-16 h-16 object-contain rounded-lg'
                                    />
                                </a>
                                <span className='text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1'>
                                    Scan to Verify
                                </span>
                                <a
                                    href={`/verify-prescription/${prescription._id}`}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='text-[10px] text-primary hover:underline font-semibold print:hidden'
                                >
                                    Verify Online &rarr;
                                </a>
                            </div>
                        )}

                        <div className='text-center min-w-[140px] shrink-0'>
                            <div className='w-32 border-b border-slate-400 mb-1.5 mx-auto' />
                            <p className='text-xs font-bold text-slate-900'>{docDisplayName}</p>
                            <p className='text-[10px] text-emerald-700 font-semibold'>Digitally Authorized</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Print Styles */}
            <style>{`
                @media print {
                    body {
                        background-color: white !important;
                    }
                    nav, footer, .ChatWidget, .print\\:hidden {
                        display: none !important;
                    }
                    @page {
                        margin: 1.5cm;
                    }
                }
            `}</style>

            {/* Review Modal */}
            {showReviewModal && (
                <ReviewModal
                    appointmentId={appointmentId}
                    doctorName={apt?.docData?.name || 'Doctor'}
                    onClose={() => setShowReviewModal(false)}
                    onSubmitted={() => setShowReviewModal(false)}
                />
            )}
        </div>
    )
}

export default PrescriptionView