import React, { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import BiomarkerChart from '../components/BiomarkerChart'
import {
    Activity,
    LineChart,
    TrendingUp,
    Plus,
    Sparkles,
    FileText,
    AlertCircle,
    X,
    Filter,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Target
} from 'lucide-react'

/**
 * Clinical Range Gauge
 * Visualizes where the user's latest value sits along the reference physiological spectrum.
 */
export const ClinicalRangeBar = ({ value, min, max, unit, status }) => {
    const numVal = parseFloat(value) || 0
    const numMin = parseFloat(min) || 0
    const numMax = parseFloat(max) || 100

    // Establish display window: 25% below min, 25% above max
    const displayLow = Math.max(0, numMin - (numMax - numMin) * 0.4)
    const displayHigh = numMax + (numMax - numMin) * 0.4
    const totalSpan = displayHigh - displayLow || 1

    const clamp = (val, minLimit, maxLimit) => Math.min(Math.max(val, minLimit), maxLimit)
    const markerPos = clamp(((numVal - displayLow) / totalSpan) * 100, 3, 97)
    const minPos = clamp(((numMin - displayLow) / totalSpan) * 100, 10, 85)
    const maxPos = clamp(((numMax - displayLow) / totalSpan) * 100, 15, 90)

    const isOptimal = numVal >= numMin && numVal <= numMax
    const isHigh = numVal > numMax

    return (
        <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    Low (&lt;{numMin})
                </span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Target: {numMin} – {numMax} {unit}
                </span>
                <span className="flex items-center gap-1">
                    High (&gt;{numMax})
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </span>
            </div>

            {/* Spectrum Bar */}
            <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                {/* Normal Envelope */}
                <div
                    className="absolute top-0 bottom-0 bg-emerald-100/90 border-x border-emerald-300/80"
                    style={{
                        left: `${minPos}%`,
                        width: `${Math.max(4, maxPos - minPos)}%`
                    }}
                />

                {/* Marker Pip */}
                <div
                    className={`absolute top-0 bottom-0 w-3 rounded-full -ml-1.5 transition-all duration-300 shadow-xs ${
                        isOptimal
                            ? 'bg-emerald-600 ring-2 ring-emerald-200'
                            : isHigh
                            ? 'bg-rose-600 ring-2 ring-rose-200'
                            : 'bg-amber-500 ring-2 ring-amber-200'
                    }`}
                    style={{ left: `${markerPos}%` }}
                    title={`Current value: ${numVal} ${unit}`}
                />
            </div>
        </div>
    )
}

const HealthDashboard = ({
    initialTrends = null,
    initialScore = null,
    onRefresh = null,
    showHeader = true
}) => {
    const navigate = useNavigate()
    const { token, backendUrl } = useContext(AppContext)

    const [trends, setTrends] = useState(initialTrends || [])
    const [score, setScore] = useState(initialScore !== null ? initialScore : 100)
    const [loading, setLoading] = useState(!initialTrends)
    const [selectedCategory, setSelectedCategory] = useState('ALL')
    const [submitting, setSubmitting] = useState(false)

    // Native HTML <dialog> ref
    const dialogRef = useRef(null)

    // Form state for adding reading
    const [readingForm, setReadingForm] = useState({
        name: 'Fasting Blood Glucose',
        key: 'glucose',
        value: '',
        unit: 'mg/dL',
        referenceMin: 70,
        referenceMax: 99,
        category: 'Glycemic',
        testDate: new Date().toISOString().split('T')[0],
        notes: ''
    })

    const commonBiomarkers = [
        { name: 'Fasting Blood Glucose', key: 'glucose', unit: 'mg/dL', referenceMin: 70, referenceMax: 99, category: 'Glycemic' },
        { name: 'Glycated Hemoglobin (HbA1c)', key: 'hba1c', unit: '%', referenceMin: 4.0, referenceMax: 5.6, category: 'Glycemic' },
        { name: 'Total Cholesterol', key: 'cholesterol', unit: 'mg/dL', referenceMin: 125, referenceMax: 200, category: 'Lipid' },
        { name: 'Serum Creatinine', key: 'creatinine', unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2, category: 'Renal' },
        { name: 'Hemoglobin (Hb)', key: 'hemoglobin', unit: 'g/dL', referenceMin: 13.0, referenceMax: 17.5, category: 'Hematology' }
    ]

    const fetchTrends = async () => {
        if (!token) return
        setLoading(true)
        try {
            const { data } = await axios.get(`${backendUrl}/api/health/trends`, {
                headers: { token }
            })
            if (data.success) {
                setTrends(data.trends || [])
                setScore(data.cardiometabolicScore || 100)
                if (onRefresh) onRefresh(data)
            }
        } catch (error) {
            console.error('Fetch trends error:', error)
            toast.error('Failed to load health analytics')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (initialTrends) {
            setTrends(initialTrends)
            if (initialScore !== null) setScore(initialScore)
            setLoading(false)
        } else {
            fetchTrends()
        }
    }, [initialTrends, initialScore, token])

    const openAddModal = () => {
        if (dialogRef.current) {
            dialogRef.current.showModal()
        }
    }

    const closeAddModal = () => {
        if (dialogRef.current) {
            dialogRef.current.close()
        }
    }

    const handleSelectTemplate = (e) => {
        const selected = commonBiomarkers.find(b => b.name === e.target.value)
        if (selected) {
            setReadingForm(prev => ({
                ...prev,
                name: selected.name,
                key: selected.key,
                unit: selected.unit,
                referenceMin: selected.referenceMin,
                referenceMax: selected.referenceMax,
                category: selected.category
            }))
        } else {
            setReadingForm(prev => ({
                ...prev,
                name: e.target.value,
                key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
            }))
        }
    }

    const handleAddReading = async (e) => {
        e.preventDefault()
        if (!readingForm.value) {
            toast.error("Please enter a numerical value")
            return
        }
        setSubmitting(true)

        try {
            const { data } = await axios.post(
                `${backendUrl}/api/health/add-reading`,
                readingForm,
                { headers: { token } }
            )
            if (data.success) {
                toast.success("Laboratory result logged successfully")
                closeAddModal()
                fetchTrends()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleSeedSample = async () => {
        try {
            setLoading(true)
            const { data } = await axios.post(
                `${backendUrl}/api/health/seed-sample-trends`,
                {},
                { headers: { token } }
            )
            if (data.success) {
                toast.success("6-Month longitudinal clinical demo panel generated!")
                fetchTrends()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredTrends = selectedCategory === 'ALL'
        ? trends
        : trends.filter(t => t.category.toUpperCase() === selectedCategory.toUpperCase())

    const getScoreBadge = (sc) => {
        if (sc >= 85) return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Optimal Health Profile' }
        if (sc >= 70) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate — Monitor Trends' }
        return { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Doctor Review Recommended' }
    }

    const categoryLabels = {
        ALL: 'All Panels',
        Glycemic: 'Blood Sugar',
        Lipid: 'Cholesterol & Lipids',
        Renal: 'Kidney Function',
        Hematology: 'Complete Blood Count'
    }

    const categoryBadgeColors = {
        Glycemic: 'bg-sky-50 text-sky-700 border-sky-200',
        Lipid: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        Renal: 'bg-teal-50 text-teal-700 border-teal-200',
        Hematology: 'bg-purple-50 text-purple-700 border-purple-200'
    }

    const scoreBadge = getScoreBadge(score)

    return (
        <div className="space-y-6">
            {/* Header & Score Banner */}
            {showHeader && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-primary bg-sky-50 border border-sky-200">
                            <TrendingUp className="w-3.5 h-3.5" /> Longitudinal Health Trends
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                            Biomarker Analytics & Outlook
                        </h2>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            Monitor blood sugar, lipid profiles, renal markers, and complete blood counts with physiological reference envelopes and estimated 30-day outlooks.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                        {/* Health Score Summary */}
                        <div className={`${scoreBadge.bg} ${scoreBadge.border} border p-4 rounded-xl text-center min-w-[190px] shadow-xs`}>
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Cardiometabolic Score
                            </div>
                            <div className={`text-3xl font-black ${scoreBadge.color} mt-1 tracking-tight font-mono`}>
                                {score}<span className="text-xs font-semibold text-slate-400 font-sans">/100</span>
                            </div>
                            <div className={`text-xs font-semibold ${scoreBadge.color} mt-0.5`}>
                                {scoreBadge.label}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <button
                                onClick={openAddModal}
                                className="px-4 py-2.5 bg-primary hover:bg-sky-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" /> Add Lab Result
                            </button>
                            <button
                                onClick={handleSeedSample}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Load 6 months of demo lab results to explore charts"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Load Sample Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Navigation & Count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                        <Filter className="w-3.5 h-3.5" /> Category:
                    </span>
                    {['ALL', 'Glycemic', 'Lipid', 'Renal', 'Hematology'].map(cat => {
                        const isActive = selectedCategory.toUpperCase() === cat.toUpperCase()
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-xs font-semibold'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {categoryLabels[cat] || cat}
                            </button>
                        )
                    })}
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-xs text-slate-500">
                        Tracking <span className="font-semibold text-slate-800">{filteredTrends.length}</span> clinical panels
                    </div>
                    {!showHeader && (
                        <button
                            onClick={openAddModal}
                            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-sky-600 transition-colors flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Result
                        </button>
                    )}
                </div>
            </div>

            {/* Loading / Empty States */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span>Loading your longitudinal clinical trends...</span>
                </div>
            ) : filteredTrends.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-4 shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto">
                        <BarChart3 className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">No Laboratory Results Logged Yet</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
                            Upload a medical report to auto-extract laboratory markers, manually log a reading, or populate the 6-month demo panel.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                            onClick={openAddModal}
                            className="px-4 py-2.5 bg-sky-50 text-primary border border-sky-200 rounded-xl text-xs font-semibold hover:bg-sky-100 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" /> Add Manual Result
                        </button>
                        <button
                            onClick={handleSeedSample}
                            className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-semibold shadow-xs hover:bg-sky-600 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            <Sparkles className="w-4 h-4" /> Load 6-Month Sample Data
                        </button>
                    </div>
                </div>
            ) : (
                /* Grid of Biomarker Analytics Cards */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredTrends.map(trend => {
                        const m = trend.metrics
                        const isImproving = m.trajectory === 'IMPROVING' || m.trajectory === 'OPTIMAL'
                        const isWarning = m.trajectory === 'DETERIORATING' || m.latestStatus === 'HIGH' || m.latestStatus === 'CRITICAL'
                        const badgeStyle = categoryBadgeColors[trend.category] || 'bg-slate-100 text-slate-700 border-slate-200'

                        return (
                            <div key={trend.key} className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                                <div className="space-y-4">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-slate-900 text-base">{trend.name}</h3>
                                                <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold border ${badgeStyle}`}>
                                                    {categoryLabels[trend.category] || trend.category}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Clinical target: <span className="text-emerald-700 font-semibold">{trend.referenceMin} – {trend.referenceMax} {trend.unit}</span>
                                            </p>
                                        </div>
                                        <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                                            m.latestStatus === 'CRITICAL' ? 'bg-rose-600 text-white' :
                                            m.latestStatus === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                            m.latestStatus === 'LOW' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}>
                                            {m.latestStatus}
                                        </span>
                                    </div>

                                    {/* Physiological Spectrum Meter */}
                                    <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                        <ClinicalRangeBar
                                            value={m.latest}
                                            min={trend.referenceMin}
                                            max={trend.referenceMax}
                                            unit={trend.unit}
                                            status={m.latestStatus}
                                        />
                                    </div>

                                    {/* Metrics Summary Strip */}
                                    <div className="grid grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-xs">
                                        <div>
                                            <span className="text-slate-500 block text-[11px] font-medium">Latest Result</span>
                                            <span className="text-xl font-bold text-slate-900 font-mono">{m.latest}</span>
                                            <span className="text-xs text-slate-500 ml-1">{trend.unit}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-[11px] font-medium">First Recorded</span>
                                            <span className="text-sm font-semibold text-slate-700 mt-1 block font-mono">{m.baseline} {trend.unit}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-[11px] font-medium">Change</span>
                                            <span className={`font-bold text-xs flex items-center gap-0.5 mt-1 font-mono ${
                                                isImproving ? 'text-emerald-600' : isWarning ? 'text-rose-600' : 'text-slate-700'
                                            }`}>
                                                {m.delta > 0 ? (
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ArrowDownRight className="w-3.5 h-3.5" />
                                                )}
                                                {m.delta > 0 ? `+${m.delta}` : m.delta} ({m.deltaPercent > 0 ? `+${m.deltaPercent}%` : `${m.deltaPercent}%`})
                                            </span>
                                        </div>
                                    </div>

                                    {/* SVG Chart */}
                                    <div className="pt-2">
                                        <BiomarkerChart trend={trend} />
                                    </div>
                                </div>

                                {/* Predictive Projection Footer */}
                                {m.projection && (
                                    <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5 flex items-center justify-between text-xs mt-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                                                <Target className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="font-semibold text-slate-900 block text-xs">
                                                    Estimated in 30 Days
                                                </span>
                                                <span className="text-[11px] text-slate-600">
                                                    Linear projection based on historical readings
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-sky-800 font-mono">
                                                ~{m.projection.projected30DayValue} {trend.unit}
                                            </span>
                                            <span className="block text-[11px] text-slate-500 font-medium">
                                                30-Day Outlook
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Native HTML <dialog> for Adding Lab Result */}
            <dialog
                ref={dialogRef}
                aria-labelledby="add-reading-dialog-title"
                className="rounded-2xl p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs max-w-lg w-full shadow-2xl border border-slate-200/90 text-slate-900 m-auto"
                onClick={(e) => {
                    if (e.target === dialogRef.current) closeAddModal()
                }}
            >
                <div className="p-6 space-y-5">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <div>
                            <h3 id="add-reading-dialog-title" className="text-base font-bold text-slate-900">
                                Log Laboratory Result
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Record a blood test or clinical measurement to update your health score.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={closeAddModal}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
                            aria-label="Close dialog"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleAddReading} className="space-y-4 text-xs">
                        <div>
                            <label htmlFor="test-name-select" className="block text-slate-700 font-semibold mb-1">
                                Clinical Panel
                            </label>
                            <select
                                id="test-name-select"
                                value={readingForm.name}
                                onChange={handleSelectTemplate}
                                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary bg-white text-slate-800 font-medium text-sm"
                            >
                                {commonBiomarkers.map((b, i) => (
                                    <option key={i} value={b.name}>{b.name} ({b.unit})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="reading-value-input" className="block text-slate-700 font-semibold mb-0.5">
                                    Your Result *
                                </label>
                                <span className="text-[11px] text-slate-500 block mb-1">Numerical reading</span>
                                <input
                                    id="reading-value-input"
                                    type="number"
                                    step="any"
                                    required
                                    value={readingForm.value}
                                    onChange={(e) => setReadingForm(prev => ({ ...prev, value: e.target.value }))}
                                    placeholder="e.g. 95"
                                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm font-semibold font-mono"
                                />
                            </div>
                            <div>
                                <label htmlFor="reading-unit-input" className="block text-slate-700 font-semibold mb-0.5">
                                    Unit of Measure
                                </label>
                                <span className="text-[11px] text-slate-500 block mb-1">Standard clinical unit</span>
                                <input
                                    id="reading-unit-input"
                                    type="text"
                                    required
                                    value={readingForm.unit}
                                    onChange={(e) => setReadingForm(prev => ({ ...prev, unit: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="reference-min-input" className="block text-slate-700 font-semibold mb-0.5">
                                    Normal Min
                                </label>
                                <span className="text-[11px] text-slate-500 block mb-1">Lower normal bound</span>
                                <input
                                    id="reference-min-input"
                                    type="number"
                                    step="any"
                                    value={readingForm.referenceMin}
                                    onChange={(e) => setReadingForm(prev => ({ ...prev, referenceMin: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm font-mono"
                                />
                            </div>
                            <div>
                                <label htmlFor="reference-max-input" className="block text-slate-700 font-semibold mb-0.5">
                                    Normal Max
                                </label>
                                <span className="text-[11px] text-slate-500 block mb-1">Upper normal bound</span>
                                <input
                                    id="reference-max-input"
                                    type="number"
                                    step="any"
                                    value={readingForm.referenceMax}
                                    onChange={(e) => setReadingForm(prev => ({ ...prev, referenceMax: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm font-mono"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="reading-test-date" className="block text-slate-700 font-semibold mb-0.5">
                                Date of Test
                            </label>
                            <span className="text-[11px] text-slate-500 block mb-1">When laboratory sample was collected</span>
                            <input
                                id="reading-test-date"
                                type="date"
                                required
                                value={readingForm.testDate}
                                onChange={(e) => setReadingForm(prev => ({ ...prev, testDate: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm"
                            >
                            </input>
                        </div>

                        <div>
                            <label htmlFor="reading-notes-input" className="block text-slate-700 font-semibold mb-0.5">
                                Clinical Notes (Optional)
                            </label>
                            <span className="text-[11px] text-slate-500 block mb-1">e.g. Fasting 10 hours, morning sample</span>
                            <input
                                id="reading-notes-input"
                                type="text"
                                placeholder="e.g. 12-hour fasting sample"
                                value={readingForm.notes}
                                onChange={(e) => setReadingForm(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl p-2.5 outline-none focus:border-primary text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={closeAddModal}
                                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors font-medium cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2.5 bg-primary hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {submitting ? 'Saving...' : 'Save Result'}
                            </button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
    )
}

export default HealthDashboard