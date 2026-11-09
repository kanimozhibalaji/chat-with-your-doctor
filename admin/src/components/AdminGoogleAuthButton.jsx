import React, { useState, useEffect, useContext } from 'react'
import { GoogleOAuthProvider, GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import { toast } from 'react-toastify'
import { DoctorContext } from '../context/DoctorContext'
import { AdminContext } from '../context/AdminContext'
import { Sparkles, Info, ExternalLink, Copy, Check, X, ShieldCheck, Stethoscope } from 'lucide-react'

// Official Google Logo SVG
export const GoogleLogoIcon = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
            fill="#4285F4"
        />
        <path
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
            fill="#34A853"
        />
        <path
            d="M5.28 14.27a7.19 7.19 0 0 1 0-4.54V6.6H1.24a11.96 11.96 0 0 0 0 10.8l4.04-3.13z"
            fill="#FBBC05"
        />
        <path
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.6l4.04 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
            fill="#EA4335"
        />
    </svg>
)

const AdminGoogleLoginInner = ({ role, onSuccessAuth, setIsAuthenticating }) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsAuthenticating(true)
        try {
            const endpoint = role === 'Admin' ? '/api/admin/google-auth' : '/api/doctor/google-auth'
            const { data } = await axios.post(`${backendUrl}${endpoint}`, {
                credential: credentialResponse.credential
            })

            if (data.success) {
                onSuccessAuth(data)
            } else {
                toast.error(data.message || 'Google verification failed')
            }
        } catch (error) {
            console.error('Admin Google Auth Error:', error)
            toast.error(error.response?.data?.message || 'Google authentication failed.')
        } finally {
            setIsAuthenticating(false)
        }
    }

    const handleGoogleError = () => {
        toast.error('Google Sign-In prompt was dismissed.')
    }

    const customPopupLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsAuthenticating(true)
            try {
                const endpoint = role === 'Admin' ? '/api/admin/google-auth' : '/api/doctor/google-auth'
                const { data } = await axios.post(`${backendUrl}${endpoint}`, {
                    accessToken: tokenResponse.access_token
                })

                if (data.success) {
                    onSuccessAuth(data)
                } else {
                    toast.error(data.message)
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Google Sign-in error')
            } finally {
                setIsAuthenticating(false)
            }
        },
        onError: () => toast.error('Google sign-in popup cancelled')
    })

    return (
        <div className="w-full space-y-2">
            <div className="w-full flex justify-center [&>div]:w-full [&>div>iframe]:w-full overflow-hidden rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs">
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                    width="100%"
                />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Clinical SSO</span>
                <button
                    type="button"
                    onClick={() => customPopupLogin()}
                    className="hover:text-sky-600 underline cursor-pointer"
                >
                    Open Google Popup
                </button>
            </div>
        </div>
    )
}

const AdminGoogleAuthButton = ({ role = 'Doctor' }) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL
    const { setDToken } = useContext(DoctorContext)
    const { setAToken } = useContext(AdminContext)

    const [googleClientId, setGoogleClientId] = useState(
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        localStorage.getItem('vitalsync_google_client_id') ||
        localStorage.getItem('prescripto_google_client_id') ||
        ''
    )
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [showSetupModal, setShowSetupModal] = useState(false)
    const [copiedUrl, setCopiedUrl] = useState(false)
    const [manualClientId, setManualClientId] = useState('')

    useEffect(() => {
        let isMounted = true
        const fetchAuthConfig = async () => {
            try {
                if (!googleClientId) {
                    const { data } = await axios.get(`${backendUrl}/api/user/auth-config`)
                    if (isMounted && data.success && data.googleClientId) {
                        setGoogleClientId(data.googleClientId)
                    }
                }
            } catch (err) {
                console.log('Admin auth config lookup:', err.message)
            }
        }
        fetchAuthConfig()
        return () => {
            isMounted = false
        }
    }, [backendUrl, googleClientId])

    const handleSuccessfulAuth = (data) => {
        if (role === 'Admin') {
            setAToken(data.token)
            localStorage.setItem('aToken', data.token)
            toast.success('Clinic Administrator authenticated with Google!')
        } else {
            setDToken(data.token)
            localStorage.setItem('dToken', data.token)
            toast.success('Practitioner authenticated with Google!')
        }
    }

    const handleSandboxLogin = async (customEmail, customName) => {
        setIsAuthenticating(true)
        try {
            const mockPayload = {
                sub: `mock-google-admin-${btoa(customEmail).replace(/=/g, '')}`,
                name: customName,
                email: customEmail,
                picture: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=200&h=200&q=80'
            }

            const mockToken = `mock_google_token:${btoa(JSON.stringify(mockPayload))}`
            const endpoint = role === 'Admin' ? '/api/admin/google-auth' : '/api/doctor/google-auth'
            const { data } = await axios.post(`${backendUrl}${endpoint}`, {
                credential: mockToken
            })

            if (data.success) {
                handleSuccessfulAuth(data)
                setShowSetupModal(false)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Sandbox login failed')
        } finally {
            setIsAuthenticating(false)
        }
    }

    const handleApplyManualClientId = () => {
        if (!manualClientId.trim()) {
            toast.warning('Please enter a Google Client ID')
            return
        }
        localStorage.setItem('vitalsync_google_client_id', manualClientId.trim())
        localStorage.setItem('prescripto_google_client_id', manualClientId.trim())
        setGoogleClientId(manualClientId.trim())
        setShowSetupModal(false)
        toast.success('Connected Google Client ID to clinical portal!')
    }

    const handleCopyOrigin = () => {
        const origin = window.location.origin
        navigator.clipboard.writeText(origin)
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
        toast.info(`Copied ${origin} to clipboard`)
    }

    return (
        <div className="w-full">
            {googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                    <AdminGoogleLoginInner
                        role={role}
                        onSuccessAuth={handleSuccessfulAuth}
                        setIsAuthenticating={setIsAuthenticating}
                    />
                </GoogleOAuthProvider>
            ) : (
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => setShowSetupModal(true)}
                        disabled={isAuthenticating}
                        className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer group"
                    >
                        <GoogleLogoIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                        <span>Sign in with Google ({role})</span>
                    </button>
                </div>
            )}

            {showSetupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-sky-50 border border-sky-100">
                                    <GoogleLogoIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">Clinical Google Auth</h3>
                                    <p className="text-xs text-slate-500">
                                        Google SSO for {role === 'Admin' ? 'Clinic Administrators' : 'Doctors & Practitioners'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSetupModal(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Sandbox Test Options */}
                        <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800">
                                    <Sparkles className="w-3.5 h-3.5 text-sky-600" /> One-Click Clinical Sandbox
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">Dev Test</span>
                            </div>

                            <p className="text-xs text-slate-600">
                                {role === 'Admin'
                                    ? 'Authenticate instantly with configured Admin Google identity:'
                                    : 'Authenticate instantly with registered Clinic Doctor Google identity:'}
                            </p>

                            {role === 'Admin' ? (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSandboxLogin('bharathraj1614@gmail.com', 'Bharath Raj (Clinic Admin)')}
                                        disabled={isAuthenticating}
                                        className="w-full p-2.5 text-left rounded-lg bg-white border border-sky-200 hover:border-sky-400 hover:shadow-xs transition-all text-xs font-medium text-slate-800 flex items-center gap-2.5 cursor-pointer"
                                    >
                                        <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold">Bharath Raj (Clinic Admin)</div>
                                            <div className="text-[10px] text-slate-400 font-mono">bharathraj1614@gmail.com</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSandboxLogin('admin@example.com', 'Clinic Admin')}
                                        disabled={isAuthenticating}
                                        className="w-full p-2 text-left rounded-lg bg-white/70 border border-slate-200 hover:border-slate-300 transition-all text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer"
                                    >
                                        <div className="text-[10px] text-slate-500 font-mono">admin@example.com (Legacy Admin)</div>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSandboxLogin('bharathraj16142@gmail.com', 'Dr. Bharath Raj')}
                                        disabled={isAuthenticating}
                                        className="w-full p-2.5 text-left rounded-lg bg-white border border-sky-200 hover:border-sky-400 hover:shadow-xs transition-all text-xs font-medium text-slate-800 flex items-center gap-2.5 cursor-pointer"
                                    >
                                        <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
                                            <Stethoscope className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold">Dr. Bharath Raj</div>
                                            <div className="text-[10px] text-slate-400 font-mono">bharathraj16142@gmail.com</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSandboxLogin('richard@example.com', 'Dr. Richard James')}
                                        disabled={isAuthenticating}
                                        className="w-full p-2 text-left rounded-lg bg-white/70 border border-slate-200 hover:border-slate-300 transition-all text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer"
                                    >
                                        <div className="text-[10px] text-slate-500 font-mono">richard@example.com (Dr. Richard James)</div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Live Client ID Input */}
                        <div className="space-y-3 pt-2">
                            <label className="text-xs font-semibold text-slate-700 block">
                                Connect Real Google Cloud Client ID
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                                    value={manualClientId}
                                    onChange={(e) => setManualClientId(e.target.value)}
                                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-sky-500 font-mono text-slate-800"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyManualClientId}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                                >
                                    Connect
                                </button>
                            </div>
                        </div>

                        {/* Copy Origin */}
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 bg-slate-50/50">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-sky-600" />
                                <span>Authorized Origin for Google Cloud:</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-slate-200 font-mono text-[10px]">
                                <span className="truncate flex-1">{window.location.origin}</span>
                                <button
                                    type="button"
                                    onClick={handleCopyOrigin}
                                    className="text-sky-600 hover:text-sky-800 cursor-pointer flex items-center gap-0.5 shrink-0"
                                >
                                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={() => setShowSetupModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminGoogleAuthButton
