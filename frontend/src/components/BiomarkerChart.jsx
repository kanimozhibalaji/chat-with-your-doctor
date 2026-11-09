import React, { useState } from 'react'

/**
 * Reusable SVG Longitudinal Biomarker Chart
 * Swiss Clinical Precision: Renders physiological reference band, historical trendline, data nodes, and 30-day linear projection.
 */
const BiomarkerChart = ({ trend }) => {
    const [hoveredPoint, setHoveredPoint] = useState(null)

    if (!trend || !trend.readings || trend.readings.length === 0) {
        return (
            <div className="text-xs text-slate-400 py-8 text-center italic font-mono bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No longitudinal laboratory data recorded for this panel
            </div>
        )
    }

    const { readings, referenceMin = 0, referenceMax = 100, unit, metrics } = trend

    const width = 480
    const height = 180
    const padding = { top: 24, right: 36, bottom: 32, left: 52 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    // Calculate Y domain
    const allValues = readings.map(r => r.value)
    if (metrics?.projection?.projected30DayValue) {
        allValues.push(metrics.projection.projected30DayValue)
    }
    const minY = Math.min(referenceMin * 0.85, Math.min(...allValues) * 0.9)
    const maxY = Math.max(referenceMax * 1.15, Math.max(...allValues) * 1.1)
    const yRange = maxY - minY || 1

    const scaleY = (val) => padding.top + plotHeight - ((val - minY) / yRange) * plotHeight

    // Calculate X domain
    const startTime = new Date(readings[0].testDate).getTime()
    const latestTime = new Date(readings[readings.length - 1].testDate).getTime()
    const totalTimeSpan = Math.max(1, (latestTime - startTime) + (metrics?.projection ? 30 * 24 * 60 * 60 * 1000 : 0))

    const scaleX = (dateStr) => {
        const t = new Date(dateStr).getTime()
        const frac = (t - startTime) / totalTimeSpan
        return padding.left + frac * plotWidth
    }

    // Reference band coordinates
    const refBandTop = Math.max(padding.top, scaleY(referenceMax))
    const refBandBottom = Math.min(padding.top + plotHeight, scaleY(referenceMin))
    const refBandHeight = Math.max(4, refBandBottom - refBandTop)

    // Build path for historical line
    const points = readings.map(r => ({
        x: scaleX(r.testDate),
        y: scaleY(r.value),
        reading: r
    }))

    const linePath = points.reduce((acc, curr, idx) => {
        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`
    }, '')

    const areaPath = points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${padding.top + plotHeight} L ${points[0].x} ${padding.top + plotHeight} Z`
        : ''

    // Projection dashed line
    let projectionLine = null
    let projectionPoint = null
    if (metrics?.projection && readings.length >= 2) {
        const lastPoint = points[points.length - 1]
        const projectedX = padding.left + plotWidth
        const projectedY = scaleY(metrics.projection.projected30DayValue)
        projectionLine = `M ${lastPoint.x} ${lastPoint.y} L ${projectedX} ${projectedY}`
        projectionPoint = { x: projectedX, y: projectedY, val: metrics.projection.projected30DayValue }
    }

    const gradientId = `trend-grad-${trend.key || 'chart'}`

    return (
        <div className="relative select-none">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible font-mono">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {/* Reference Normal Range Shaded Band */}
                <rect
                    x={padding.left}
                    y={refBandTop}
                    width={plotWidth}
                    height={refBandHeight}
                    fill="#059669"
                    fillOpacity="0.08"
                    rx="3"
                />
                <line
                    x1={padding.left}
                    y1={refBandTop}
                    x2={padding.left + plotWidth}
                    y2={refBandTop}
                    stroke="#059669"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity="0.7"
                />
                <line
                    x1={padding.left}
                    y1={refBandBottom}
                    x2={padding.left + plotWidth}
                    y2={refBandBottom}
                    stroke="#059669"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity="0.7"
                />

                {/* Y-axis Labels */}
                <text x={padding.left - 8} y={refBandTop + 3} textAnchor="end" className="text-[9px] fill-emerald-700 font-mono font-semibold">
                    {referenceMax}
                </text>
                <text x={padding.left - 8} y={refBandBottom + 3} textAnchor="end" className="text-[9px] fill-emerald-700 font-mono font-semibold">
                    {referenceMin}
                </text>

                {/* Grid Baseline */}
                <line
                    x1={padding.left}
                    y1={padding.top + plotHeight}
                    x2={padding.left + plotWidth}
                    y2={padding.top + plotHeight}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                />

                {/* Area under historical curve */}
                {areaPath && (
                    <path
                        d={areaPath}
                        fill={`url(#${gradientId})`}
                    />
                )}

                {/* Projection Line */}
                {projectionLine && (
                    <path
                        d={projectionLine}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.8"
                    />
                )}

                {/* Historical Trend Line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data Points */}
                {points.map((p, idx) => {
                    const isHigh = p.reading.status === 'HIGH' || p.reading.status === 'CRITICAL'
                    const isLow = p.reading.status === 'LOW'
                    const fillColor = isHigh ? '#e11d48' : isLow ? '#d97706' : '#059669'

                    return (
                        <g key={idx}>
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={hoveredPoint?.idx === idx ? 5.5 : 4}
                                fill={fillColor}
                                stroke="#ffffff"
                                strokeWidth="2"
                                className="cursor-pointer transition-all duration-150"
                                onMouseEnter={() => setHoveredPoint({ ...p, idx })}
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                            {/* X-axis date stamp below point */}
                            <text
                                x={p.x}
                                y={padding.top + plotHeight + 16}
                                textAnchor="middle"
                                className="text-[9px] fill-slate-400 font-sans font-medium"
                            >
                                {new Date(p.reading.testDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </text>
                        </g>
                    )
                })}

                {/* Projected 30-day target point */}
                {projectionPoint && (
                    <g>
                        <circle
                            cx={projectionPoint.x}
                            cy={projectionPoint.y}
                            r="4"
                            fill="#0284c7"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                        />
                        <text
                            x={projectionPoint.x}
                            y={padding.top + plotHeight + 16}
                            textAnchor="middle"
                            className="text-[9px] fill-sky-600 font-sans font-semibold"
                        >
                            +30d Target
                        </text>
                    </g>
                )}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
                <div
                    className="absolute z-20 bg-slate-900 text-white text-[11px] px-3 py-2 rounded-lg shadow-xl pointer-events-none -translate-x-1/2 -translate-y-full border border-slate-700"
                    style={{
                        left: `${(hoveredPoint.x / width) * 100}%`,
                        top: `${(hoveredPoint.y / height) * 100 - 10}%`
                    }}
                >
                    <div className="font-bold flex items-center gap-1.5 font-mono">
                        <span>{hoveredPoint.reading.value} {unit}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                            hoveredPoint.reading.status === 'HIGH' || hoveredPoint.reading.status === 'CRITICAL' ? 'bg-rose-500 text-white' :
                            hoveredPoint.reading.status === 'LOW' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                        }`}>
                            {hoveredPoint.reading.status}
                        </span>
                    </div>
                    <div className="text-slate-300 text-[10px] mt-0.5">
                        {new Date(hoveredPoint.reading.testDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </div>
                    {hoveredPoint.reading.notes && (
                        <div className="text-slate-400 text-[9px] italic mt-1 max-w-[160px] truncate border-t border-slate-800 pt-0.5">
                            {hoveredPoint.reading.notes}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default BiomarkerChart
