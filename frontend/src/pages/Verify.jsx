import axios from 'axios'
import React, { useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import { ShieldCheck, Lock } from 'lucide-react'

const Verify = () => {
    const [searchParams] = useSearchParams()

    const success = searchParams.get("success")
    const appointmentId = searchParams.get("appointmentId")
    const sessionId = searchParams.get("session_id")

    const { backendUrl, token } = useContext(AppContext)
    const navigate = useNavigate()

    // Function to verify stripe payment
    const verifyStripe = async () => {
        try {
            const { data } = await axios.post(
                backendUrl + "/api/user/verifyStripe",
                { success, appointmentId, sessionId },
                { headers: { token } }
            )

            if (data.success) {
                toast.success(data.message)
            } else {
                toast.error(data.message)
            }

            navigate("/my-appointments")
        } catch (error) {
            toast.error(error.message)
            console.error('Stripe verification error:', error)
            navigate("/my-appointments")
        }
    }

    useEffect(() => {
        if (token && appointmentId && success) {
            verifyStripe()
        }
    }, [token, appointmentId, success])

    return (
        <div className='min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4'>
            <div className='relative'>
                <div className="w-14 h-14 border-3 border-slate-200 border-t-primary rounded-full animate-spin" />
                <div className='absolute inset-0 flex items-center justify-center text-primary'>
                    <Lock className='w-4 h-4' />
                </div>
            </div>
            <div>
                <h3 className='text-base font-bold text-slate-900'>Validating Payment Settlement</h3>
                <p className='text-xs text-slate-500 font-mono mt-1'>
                    Reconciling transaction token with Stripe secure payment gateway...
                </p>
            </div>
            <span className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200'>
                <ShieldCheck className='w-3 h-3' /> TLS 1.3 256-Bit Financial Encryption
            </span>
        </div>
    )
}

export default Verify