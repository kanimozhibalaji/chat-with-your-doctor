import React, { useState, useEffect, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { Star, ShieldCheck, MessageSquare } from 'lucide-react'

const ReviewSection = ({ docId }) => {
    const { backendUrl } = useContext(AppContext)
    const [reviews, setReviews] = useState([])
    const [avgRating, setAvgRating] = useState(0)
    const [totalReviews, setTotalReviews] = useState(0)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/review/doctor/${docId}`)
                if (data.success) {
                    setReviews(data.reviews)
                    setAvgRating(data.avgRating)
                    setTotalReviews(data.totalReviews)
                }
            } catch (e) {
                console.error(e)
            }
        }
        if (docId) fetchReviews()
    }, [docId, backendUrl])

    const renderStars = (rating) => {
        return (
            <div className='flex items-center gap-0.5'>
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                            star <= rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-200 fill-slate-100'
                        }`}
                    />
                ))}
            </div>
        )
    }

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000)
        if (seconds < 60) return 'just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days < 30) return `${days}d ago`
        const months = Math.floor(days / 30)
        return `${months}mo ago`
    }

    if (totalReviews === 0) return null

    const displayedReviews = showAll ? reviews : reviews.slice(0, 3)

    return (
        <section className='pt-10 border-t border-slate-200/80 space-y-6'>
            {/* Header / Summary */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
                <div className='space-y-1'>
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700'>
                        <MessageSquare className='w-3 h-3 text-primary' />
                        <span>Verified Consultations</span>
                    </div>
                    <h2 className='text-xl font-bold text-slate-900 tracking-tight'>
                        Patient Feedback & Ratings
                    </h2>
                </div>

                <div className='flex items-center gap-3 bg-white border border-slate-200/90 px-4 py-2.5 rounded-2xl shadow-sm'>
                    <div className='flex items-center gap-1.5'>
                        <Star className='w-4 h-4 text-amber-500 fill-amber-500' />
                        <span className='font-mono font-bold text-slate-900 text-base'>
                            {Number(avgRating).toFixed(1)}
                        </span>
                    </div>
                    <span className='text-slate-300'>|</span>
                    <span className='text-xs text-slate-500'>
                        {totalReviews} verified {totalReviews === 1 ? 'review' : 'reviews'}
                    </span>
                </div>
            </div>

            {/* Review Cards Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {displayedReviews.map((review, i) => (
                    <div
                        key={i}
                        className='bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between'
                    >
                        <div className='space-y-2'>
                            <div className='flex items-start justify-between gap-2'>
                                <div className='flex items-center gap-2.5'>
                                    <div className='w-8 h-8 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-primary font-bold text-xs'>
                                        {review.userName?.charAt(0)?.toUpperCase() || 'P'}
                                    </div>
                                    <div>
                                        <p className='font-semibold text-slate-900 text-xs'>{review.userName}</p>
                                        <div className='flex items-center gap-1 text-[10px] text-emerald-700 font-medium'>
                                            <ShieldCheck className='w-3 h-3 text-emerald-600' />
                                            <span>Verified Patient</span>
                                        </div>
                                    </div>
                                </div>
                                <span className='text-[10px] text-slate-400 font-mono'>
                                    {timeAgo(review.createdAt)}
                                </span>
                            </div>

                            {renderStars(review.rating)}

                            {review.comment && (
                                <p className='text-xs text-slate-600 leading-relaxed font-normal pt-1'>
                                    "{review.comment}"
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {reviews.length > 3 && (
                <div className='text-center pt-2'>
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className='text-xs font-semibold text-primary hover:underline'
                    >
                        {showAll ? 'Show fewer reviews' : `View all ${totalReviews} patient reviews →`}
                    </button>
                </div>
            )}
        </section>
    )
}

export default ReviewSection
