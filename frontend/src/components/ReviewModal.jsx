import React, { useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { Star, X, CheckCircle2 } from 'lucide-react'

const ReviewModal = ({ appointmentId, doctorName, onClose, onSubmitted }) => {
    const { backendUrl, token } = useContext(AppContext)
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
    const [comment, setComment] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (rating === 0) {
            return toast.error("Please select a star rating")
        }

        setSubmitting(true)
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/review/submit`,
                { appointmentId, rating, comment },
                { headers: { token } }
            )

            if (data.success) {
                toast.success("Thank you! Your feedback has been verified and recorded.")
                onSubmitted?.()
                onClose()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error(error)
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const ratingDescriptions = {
        1: 'Poor — Did not meet expectations',
        2: 'Fair — Could have been better',
        3: 'Good — Helpful visit',
        4: 'Very Good — Friendly & thorough doctor',
        5: 'Excellent — Great care & clear advice'
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
            <div className='w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden'>
                
                {/* Modal Header */}
                <div className='px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800'>
                    <div>
                        <div className='flex items-center gap-1.5 text-xs text-sky-400 font-semibold'>
                            <Star className='w-3.5 h-3.5 fill-sky-400' />
                            <span>Patient Review</span>
                        </div>
                        <h3 className='text-base font-bold text-white mt-0.5'>Rate Your Visit</h3>
                        <p className='text-slate-400 text-xs mt-0.5 truncate'>Dr. {doctorName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className='p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer'
                    >
                        <X className='w-4 h-4' />
                    </button>
                </div>

                <div className='p-6 space-y-6'>
                    {/* Star Rating Interactive Selector */}
                    <div className='text-center space-y-2'>
                        <div className='flex justify-center gap-2'>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type='button'
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className='p-1 transition-transform hover:scale-110 focus:outline-none cursor-pointer'
                                >
                                    <Star
                                        className={`w-8 h-8 transition-colors ${
                                            (hoverRating || rating) >= star
                                                ? 'text-amber-400 fill-amber-400'
                                                : 'text-slate-200 fill-slate-100'
                                        }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <p className='text-xs font-medium text-slate-500 h-4'>
                            {(hoverRating || rating) ? ratingDescriptions[hoverRating || rating] : 'Tap a star to rate from 1 to 5'}
                        </p>
                    </div>

                    {/* Commentary */}
                    <div className='space-y-1.5'>
                        <label className='block text-xs font-semibold text-slate-700'>
                            Your Review (Optional)
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Share how your visit went, whether the doctor explained things clearly, etc..."
                            className='w-full border border-slate-200 rounded-2xl p-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 min-h-[110px] resize-none'
                        />
                    </div>

                    {/* Actions */}
                    <div className='flex gap-3 pt-2'>
                        <button
                            type='button'
                            onClick={onClose}
                            className='flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors text-xs font-semibold cursor-pointer'
                        >
                            Cancel
                        </button>
                        <button
                            type='button'
                            onClick={handleSubmit}
                            disabled={submitting || rating === 0}
                            className='flex-1 py-3 bg-primary hover:bg-sky-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer'
                        >
                            <span>{submitting ? 'Submitting...' : 'Submit Review'}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default ReviewModal
