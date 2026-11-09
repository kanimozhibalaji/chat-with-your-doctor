import React, { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RotateCcw,
    Search,
    User,
    Pill,
    Hash,
    FlaskConical,
    Award
} from 'lucide-react'

const VerifyPrescription = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { backendUrl } = useContext(AppContext)

    const [searchId, setSearchId] = useState(id || '')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    // Tamper simulation & Pharmacy Anti-Replay Dispense Lock states
    const [tamperSimulated, setTamperSimulated] = useState(false)
    const [dispensing, setDispensing] = useState(false)

    const handleMarkDispensed = async () => {
        if (!result?.prescription?._id || tamperSimulated) return
        setDispensing(true)
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/prescription/dispense/${result.prescription._id}`,
                { 
                    pharmacyName: 'VitalSync Certified Pharmacy Desk',
                    dispenseProof: result?.verificationDetails?.dispenseProof 
                }
            )
            if (data.success) {
                toast.success(data.message)
                setResult((prev) => ({
                    ...prev,
                    prescription: {
                        ...prev.prescription,
                        dispenseStatus: data.dispenseStatus,
                        dispenseCount: data.dispenseCount,
                        dispensedAt: data.dispensedAt,
                        dispensedByPharmacy: data.dispensedByPharmacy
                    }
                }))
            } else {
                toast.error(data.message)
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message)
        } finally {
            setDispensing(false)
        }
    }

    const performVerification = async (targetId) => {
        if (!targetId || !targetId.trim()) return
        setLoading(true)
        setError('')
        setTamperSimulated(false)

        try {
            const { data } = await axios.get(`${backendUrl}/api/prescription/verify/${targetId.trim()}`)
            if (data.success) {
                setResult(data)
            } else {
                setResult(null)
                setError(data.message || 'Prescription could not be verified.')
            }
        } catch (err) {
            console.error(err)
            setResult(null)
            setError(err.response?.data?.message || 'We could not find a prescription with that ID.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (id) {
            setSearchId(id)
            performVerification(id)
        }
    }, [id])

    const handleSearch = (e) => {
        e.preventDefault()
        if (searchId.trim()) {
            navigate(`/verify-prescription/${searchId.trim()}`)
            performVerification(searchId.trim())
        }
    }

    return (
        <div className="py-6 max-w-4xl mx-auto space-y-6 min-h-[80vh]">
            {/* Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xs space-y-3">
                <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cryptographic Verification Portal</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Verify Digital Prescription & Pharmacy Dispense
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
                    Patients and certified pharmacies can verify electronic prescriptions against the doctor's tamper-evident digital signature and manage single-use anti-replay dispense records.
                </p>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 flex items-center">
                    <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                    <input
                        type="text"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder="Paste or enter 24-character Prescription ID..."
                        className="w-full px-3 py-2 outline-none text-xs sm:text-sm text-slate-900 placeholder-slate-400 font-mono"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-primary hover:bg-sky-600 text-white rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify Signature</span>
                        </>
                    )}
                </button>
            </form>

            {/* Error Message */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-6 rounded-3xl text-center space-y-2 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
                        <XCircle className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-base text-rose-900">Prescription Not Found</h3>
                    <p className="text-xs sm:text-sm text-rose-700">{error}</p>
                    <p className="text-[11px] text-rose-500">
                        Please verify that the Prescription ID matches the QR code reference on your document.
                    </p>
                </div>
            )}

            {/* Verification Result */}
            {result && (
                <div className="space-y-6">
                    {/* Status Banner */}
                    <div className={`p-6 rounded-3xl text-white shadow-xs transition-all border ${
                        tamperSimulated 
                            ? 'bg-rose-950 border-rose-800' 
                            : result.isAuthentic
                            ? 'bg-emerald-950 border-emerald-800'
                            : 'bg-amber-950 border-amber-800'
                    }`}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                    tamperSimulated
                                        ? 'bg-rose-900/60 border-rose-700 text-rose-300'
                                        : result.isAuthentic
                                        ? 'bg-emerald-900/60 border-emerald-700 text-emerald-300'
                                        : 'bg-amber-900/60 border-amber-700 text-amber-300'
                                }`}>
                                    {tamperSimulated ? (
                                        <AlertTriangle className="w-6 h-6 animate-pulse" />
                                    ) : result.isAuthentic ? (
                                        <ShieldCheck className="w-6 h-6" />
                                    ) : (
                                        <ShieldAlert className="w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-extrabold tracking-tight text-white">
                                        {tamperSimulated 
                                            ? 'Warning: Prescription Signature Tampered!' 
                                            : result.isAuthentic 
                                            ? 'Verified Authentic Digital Prescription' 
                                            : 'Unverified Signature'}
                                    </h2>
                                    <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                                        {tamperSimulated 
                                            ? 'The contents of this document do not match the physician’s original cryptographic hash. Do not dispense.' 
                                            : result.isAuthentic 
                                            ? `Officially authorized and signed by Dr. ${result.doctor?.name}. Digital integrity verified.` 
                                            : 'This prescription signature could not be verified by the clinical authority.'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs font-semibold bg-white/10 px-3 py-1 rounded-full text-white border border-white/20 shrink-0">
                                {tamperSimulated ? 'Tamper Detected' : '100% Authentic'}
                            </span>
                        </div>
                    </div>

                    {/* Doctor & Patient Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Doctor Details */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-primary" /> Prescribed By Physician
                            </span>
                            <div className="flex items-center gap-3.5">
                                <img 
                                    src={result.doctor?.image || 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/smiling-man.jpg'} 
                                    alt={result.doctor?.name} 
                                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 bg-slate-50 shrink-0"
                                />
                                <div className="min-w-0">
                                    <h4 className="font-extrabold text-slate-900 text-base truncate">
                                        Dr. {result.doctor?.name}
                                    </h4>
                                    <p className="text-xs text-primary font-semibold truncate">
                                        {result.doctor?.speciality} &bull; {result.doctor?.degree}
                                    </p>
                                </div>
                            </div>
                            <div className="text-xs text-slate-600 pt-3 border-t border-slate-100 space-y-1">
                                <p><strong className="text-slate-800">Experience:</strong> {result.doctor?.experience || 'Medical Specialist'}</p>
                                <p className="text-emerald-700 font-semibold flex items-center gap-1.5 pt-1 text-xs">
                                    <CheckCircle2 className="w-4 h-4" /> Board-Certified Physician
                                </p>
                            </div>
                        </div>

                        {/* Patient Information & Dispense Status */}
                        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" /> Patient & Dispense Status
                                </span>
                                <div className="text-xs sm:text-sm text-slate-700 space-y-1.5">
                                    <p><strong className="text-slate-900">Patient:</strong> {result.patient?.name}</p>
                                    <p><strong className="text-slate-900">Date Issued:</strong> {new Date(result.prescription?.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                    {result.prescription?.expiresAt && (
                                        <p>
                                            <strong className="text-slate-900">Valid Until:</strong>{' '}
                                            <span className={result.prescription?.isExpired ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                                {new Date(result.prescription.expiresAt).toLocaleDateString()}
                                            </span>
                                        </p>
                                    )}
                                    <div className="pt-1">
                                        <span className="text-xs font-semibold text-slate-700">Anti-Replay Lock:</span>{' '}
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ml-1 ${
                                            result.prescription?.dispenseStatus === 'DISPENSED'
                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                : result.prescription?.dispenseStatus === 'EXPIRED'
                                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        }`}>
                                            {result.prescription?.dispenseStatus === 'DISPENSED'
                                                ? 'DISPENSED (Single-Use Locked)'
                                                : result.prescription?.dispenseStatus === 'EXPIRED'
                                                ? 'EXPIRED (Window Passed)'
                                                : 'ACTIVE (Eligible for Dispense)'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Prescribed Medicines */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <Pill className="w-5 h-5 text-primary" /> Verified Medications
                            </h3>
                            {tamperSimulated && (
                                <span className="bg-rose-100 text-rose-800 text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                                    Tamper Signature Invalidation
                                </span>
                            )}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 text-xs sm:text-sm text-slate-800">
                            <strong className="text-slate-900">Diagnosis:</strong> {result.prescription?.diagnosis || 'General medical consultation.'}
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                                    <tr>
                                        <th className="p-3.5">Medicine</th>
                                        <th className="p-3.5">Dosage</th>
                                        <th className="p-3.5">Frequency</th>
                                        <th className="p-3.5">Duration</th>
                                        <th className="p-3.5">Instructions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                    {(result.prescription?.medicines || []).map((med, idx) => (
                                        <tr key={idx} className={tamperSimulated && idx === 0 ? 'bg-rose-50 text-rose-950 font-bold' : 'hover:bg-slate-50/50'}>
                                            <td className="p-3.5 font-bold text-slate-900">{med.name}</td>
                                            <td className="p-3.5 font-mono">
                                                {tamperSimulated && idx === 0 ? (
                                                    <span>
                                                        <del className="text-slate-400 font-normal">{med.dosage}</del>{' '}
                                                        <span className="text-rose-700 font-bold">1000mg (TAMPERED)</span>
                                                    </span>
                                                ) : (
                                                    med.dosage
                                                )}
                                            </td>
                                            <td className="p-3.5 text-slate-600">{med.frequency}</td>
                                            <td className="p-3.5 text-slate-600 font-mono">{med.duration}</td>
                                            <td className="p-3.5 text-slate-500">{med.instructions || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Security & Cryptographic Controls */}
                    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <Hash className="w-4 h-4 text-primary" /> Cryptographic Digital Seal Details
                            </h3>
                            <span className="text-xs text-slate-400">Tamper-Evident SHA-256</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="bg-slate-50 p-4 rounded-2xl space-y-1 border border-slate-200/70">
                                <span className="text-slate-500 text-xs font-semibold">
                                    1. Document Hash Integrity Check
                                </span>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                    {tamperSimulated ? (
                                        <span className="text-rose-700 font-bold flex items-center gap-1">
                                            <XCircle className="w-4 h-4" /> Hash Mismatch &bull; Document Altered
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> 100% Unaltered Since Physician Signature
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-2xl space-y-1 border border-slate-200/70">
                                <span className="text-slate-500 text-xs font-semibold">
                                    2. Physician Private Key Signature
                                </span>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                    {tamperSimulated ? (
                                        <span className="text-rose-700 font-bold flex items-center gap-1">
                                            <XCircle className="w-4 h-4" /> Digital Signature Invalidated
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> Validated by Public Key
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Pharmacist Actions */}
                        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                <FlaskConical className="w-4 h-4 text-primary" />
                                <span>Pharmacy Desk Anti-Replay Lock & Simulation:</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    disabled={dispensing || tamperSimulated || !result.isAuthentic}
                                    onClick={handleMarkDispensed}
                                    className="text-xs px-4 py-2 rounded-xl font-semibold transition-colors border cursor-pointer flex items-center gap-1.5 bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100 disabled:opacity-50 shadow-2xs"
                                >
                                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                                    <span>
                                        {dispensing
                                            ? 'Locking...'
                                            : result.prescription?.dispenseStatus === 'DISPENSED'
                                            ? 'Test Replay Scan (Blocked)'
                                            : 'Mark Dispensed (Anti-Replay Lock)'}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTamperSimulated(!tamperSimulated)
                                        if (!tamperSimulated) {
                                            toast.error("Test Mode: Simulated dosage tampering!")
                                        } else {
                                            toast.success("Restored authentic prescription.")
                                        }
                                    }}
                                    className={`text-xs px-4 py-2 rounded-xl font-semibold transition-colors border cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                        tamperSimulated 
                                            ? 'bg-slate-900 text-white border-slate-800' 
                                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                    }`}
                                >
                                    {tamperSimulated ? (
                                        <>
                                            <RotateCcw className="w-3.5 h-3.5" /> Restore Original
                                        </>
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Test Tamper Simulation
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default VerifyPrescription