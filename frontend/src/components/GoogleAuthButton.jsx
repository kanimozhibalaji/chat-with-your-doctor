import React, { useState, useEffect, useContext } from 'react'
import { GoogleOAuthProvider, GoogleLogin, useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'
import { ShieldCheck, Info, ExternalLink, Copy, Check, Sparkles, X, User } from 'lucide-react'

// Official Google G Logo SVG
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

// Inner Google Login button implementation when wrapped in GoogleOAuthProvider
const GoogleLoginInner = ({ onSuccessAuth, isAuthenticating, setIsAuthenticating, buttonText, onOpenDevModal }) => {
    const { backendUrl } = useContext(AppContext)

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsAuthenticating(true)
        try {
            const { data } = await axios.post(`${backendUrl}/api/user/google-auth`, {
                credential: credentialResponse.credential
            })

            if (data.success) {
                onSuccessAuth(data)
            } else {
                toast.error(data.message || 'Google verification failed')
            }
        } catch (error) {
            console.error('Google Auth Error:', error)
            toast.error(error.response?.data?.message || 'Google Sign-in failed. Please try again.')
        } finally {
            setIsAuthenticating(false)
        }
    }

    const handleGoogleError = () => {
        toast.error('Google Sign-In prompt was dismissed or failed to load.')
    }

    // Custom OAuth popup flow trigger as a fallback
    const customPopupLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsAuthenticating(true)
            try {
                const { data } = await axios.post(`${backendUrl}/api/user/google-auth`, {
                    accessToken: tokenResponse.access_token
                })

                if (data.success) {
                    onSuccessAuth(data)
                } else {
                    toast.error(data.message || 'Google access verification failed')
                }
            } catch (error) {
                console.error('Custom Google Auth Error:', error)
                toast.error(error.response?.data?.message || 'Google Sign-in error')
            } finally {
                setIsAuthenticating(false)
            }
        },
        onError: (err) => {
            console.error('Google Popup Error:', err)
            toast.error('Google sign-in popup closed or denied.')
        }
    })

    return (
        <div className="w-full space-y-2">
            {/* Native GIS Google Button container */}
            <div className="w-full flex justify-center [&>div]:w-full [&>div>iframe]:w-full overflow-hidden rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs">
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap={true}
                    theme="outline"
                    size="large"
                    text={buttonText === 'Sign Up' ? 'signup_with' : 'signin_with'}
                    shape="rectangular"
                    width="100%"
                />
            </div>

            {/* Custom Google Trigger Button in case GIS button is blocked or for alternate popup flow */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>FedCM & One-Tap Enabled</span>
                <button
                    type="button"
                    onClick={() => customPopupLogin()}
                    className="hover:text-primary underline cursor-pointer"
                >
                    Open Google Popup
                </button>
            </div>
        </div>
    )
}

const GoogleAuthButton = ({ state = 'Login', onAuthSuccess }) => {
    const { backendUrl, setToken, loadUserProfileData } = useContext(AppContext)
    const [googleClientId, setGoogleClientId] = useState(
        import.meta.env.VITE_GOOGLE_CLIENT_ID ||
        localStorage.getItem('vitalsync_google_client_id') ||
        localStorage.getItem('prescripto_google_client_id') ||
        ''
    )
    const [isLoadingConfig, setIsLoadingConfig] = useState(true)
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [showSetupModal, setShowSetupModal] = useState(false)
    const [copiedUrl, setCopiedUrl] = useState(false)
    const [manualClientId, setManualClientId] = useState('')

    // Sandbox Test Account Options
    const [sandboxAccount, setSandboxAccount] = useState({
        name: 'Rahul Sharma',
        email: 'rahul.patient@gmail.com',
        picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80'
    })

    // Fetch auth config from backend if not defined locally
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
                console.log('Auth config lookup:', err.message)
            } finally {
                if (isMounted) setIsLoadingConfig(false)
            }
        }
        fetchAuthConfig()
        return () => {
            isMounted = false
        }
    }, [backendUrl, googleClientId])

    const handleSuccessfulAuth = async (data) => {
        if (data.token) {
            localStorage.setItem('token', data.token)
            setToken(data.token)
            if (loadUserProfileData) {
                await loadUserProfileData()
            }
            toast.success(data.message || `Welcome, ${data.userData?.name || 'Patient'}!`)
            if (onAuthSuccess) {
                onAuthSuccess(data)
            }
        }
    }

    // Instant Sandbox / Mock Login for immediate local testing without Google Cloud setup
    const handleSandboxLogin = async (customUser = null) => {
        setIsAuthenticating(true)
        try {
            const userToAuth = customUser || sandboxAccount
            const mockPayload = {
                sub: `mock-google-${btoa(userToAuth.email).replace(/=/g, '')}`,
                name: userToAuth.name,
                email: userToAuth.email,
                picture: userToAuth.picture,
                given_name: userToAuth.name.split(' ')[0],
                family_name: userToAuth.name.split(' ').slice(1).join(' ') || 'User'
            }

            const mockToken = `mock_google_token:${btoa(JSON.stringify(mockPayload))}`
            const { data } = await axios.post(`${backendUrl}/api/user/google-auth`, {
                credential: mockToken
            })

            if (data.success) {
                handleSuccessfulAuth(data)
                setShowSetupModal(false)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Sandbox Auth Error:', error)
            toast.error(error.response?.data?.message || 'Sandbox authentication failed')
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
        toast.success('Google Client ID connected! Initializing Google Identity Services...')
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
                    <GoogleLoginInner
                        onSuccessAuth={handleSuccessfulAuth}
                        isAuthenticating={isAuthenticating}
                        setIsAuthenticating={setIsAuthenticating}
                        buttonText={state}
                        onOpenDevModal={() => setShowSetupModal(true)}
                    />
                </GoogleOAuthProvider>
            ) : (
                /* Sleek Branded Google Button */
                <button
                    type="button"
                    onClick={() => setShowSetupModal(true)}
                    disabled={isAuthenticating}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer group"
                >
                    <GoogleLogoIcon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                    <span>{state === 'Sign Up' ? 'Sign up with Google' : 'Sign in with Google'}</span>
                </button>
            )}

            {/* Google Authentication Setup & Sandbox Modal */}
            {showSetupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-sky-50 border border-sky-100">
                                    <GoogleLogoIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">Google Authentication</h3>
                                    <p className="text-xs text-slate-500">
                                        Google Identity Services (GIS) & Sandbox Tester
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

                        {/* Sandbox One-Click Test Section */}
                        <div className="bg-gradient-to-br from-sky-50/70 to-indigo-50/70 border border-sky-100 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800">
                                    <Sparkles className="w-3.5 h-3.5 text-sky-600" /> One-Click Google Sandbox
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">Dev Sandbox</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Test the entire Google OAuth lifecycle immediately (account provisioning, profile picture sync, JWT session issuance, and clinical dashboard navigation):
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSandboxLogin({
                                            name: 'Rahul Sharma',
                                            email: 'rahul.sharma@vitalsync.health',
                                            picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80'
                                        })
                                    }
                                    disabled={isAuthenticating}
                                    className="p-2.5 text-left rounded-lg bg-white border border-sky-200/80 hover:border-sky-400 hover:shadow-xs transition-all text-xs font-medium text-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                    <img
                                        src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80"
                                        alt="Avatar"
                                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold truncate">Rahul Sharma</div>
                                        <div className="text-[10px] text-slate-400 truncate">rahul@vitalsync.health</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        handleSandboxLogin({
                                            name: 'Priya Patel',
                                            email: 'priya.patel@vitalsync.health',
                                            picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80'
                                        })
                                    }
                                    disabled={isAuthenticating}
                                    className="p-2.5 text-left rounded-lg bg-white border border-sky-200/80 hover:border-sky-400 hover:shadow-xs transition-all text-xs font-medium text-slate-800 flex items-center gap-2 cursor-pointer"
                                >
                                    <img
                                        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80"
                                        alt="Avatar"
                                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold truncate">Priya Patel</div>
                                        <div className="text-[10px] text-slate-400 truncate">priya@vitalsync.health</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Live Google Cloud Credentials Input */}
                        <div className="space-y-3 pt-2">
                            <label className="text-xs font-semibold text-slate-700 block">
                                Connect Real Google Cloud Client ID (Optional)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
                                    value={manualClientId}
                                    onChange={(e) => setManualClientId(e.target.value)}
                                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-mono text-slate-800"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyManualClientId}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
                                >
                                    Connect
                                </button>
                            </div>
                        </div>

                        {/* 3-Step Setup Instructions */}
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 bg-slate-50/50">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-sky-600" />
                                <span>How to get your Google Client ID:</span>
                            </div>
                            <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed pl-1 text-slate-600">
                                <li>
                                    Open the{' '}
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
                                    >
                                        Google Cloud Credentials Console <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </li>
                                <li>
                                    Click <strong>Create Credentials &gt; OAuth client ID</strong> &gt; Application type: <strong>Web application</strong>.
                                </li>
                                <li>
                                    Add this app's origin under <strong>Authorized JavaScript origins</strong>:
                                    <div className="mt-1 flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[10px]">
                                        <span className="truncate flex-1">{window.location.origin}</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyOrigin}
                                            className="text-primary hover:text-sky-700 cursor-pointer flex items-center gap-0.5 shrink-0"
                                        >
                                            {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                            <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                </li>
                                <li>
                                    Save your <strong>Client ID</strong> and paste it into <code className="bg-white px-1 py-0.5 rounded border border-slate-200">backend/.env</code> as <code className="text-primary">GOOGLE_CLIENT_ID</code>.
                                </li>
                            </ol>
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

export default GoogleAuthButton
