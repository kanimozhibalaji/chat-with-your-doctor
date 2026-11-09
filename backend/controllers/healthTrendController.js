import biomarkerModel from '../models/biomarkerModel.js';

/**
 * Longitudinal Health Trend Analytics Controller
 * ==============================================
 * Implements Ordinary Least Squares (OLS) Linear Regression with:
 *   1. Exact Slope (beta_1) & Intercept (beta_0)
 *   2. Coefficient of Determination (R^2 = 1 - SS_res / SS_tot)
 *   3. Residual Standard Error (SE) & 95% Confidence Interval Bounds
 *   4. Homeostatic Physiological Damping & Viability Clamping (prevents non-biological 0-value extrapolation)
 */

// Physiological survival floor & ceiling bounds so linear trends never extrapolate to impossible human values
const PHYSIOLOGICAL_VIABILITY_BOUNDS = {
    glucose: { floor: 50, ceiling: 450 },
    hba1c: { floor: 4.0, ceiling: 15.0 },
    cholesterol: { floor: 90, ceiling: 400 },
    ldl: { floor: 30, ceiling: 300 },
    hdl: { floor: 20, ceiling: 110 },
    triglycerides: { floor: 35, ceiling: 800 },
    creatinine: { floor: 0.35, ceiling: 10.0 },
    hemoglobin: { floor: 5.5, ceiling: 21.0 },
    systolic_bp: { floor: 75, ceiling: 230 },
    heart_rate: { floor: 40, ceiling: 185 }
};

const evaluateStatus = (value, min, max) => {
    if (value < min) return 'LOW';
    if (value > max * 1.3) return 'CRITICAL';
    if (value > max) return 'HIGH';
    return 'NORMAL';
};

/**
 * Ordinary Least Squares (OLS) Regression + Homeostatic Damped 30-Day Projection
 */
const calculateProjection = (readings, biomarkerKey = '') => {
    if (!readings || readings.length < 2) return null;

    const n = readings.length;
    const startTime = new Date(readings[0].testDate).getTime();

    const points = readings.map(r => ({
        x: (new Date(r.testDate).getTime() - startTime) / (1000 * 60 * 60 * 24),
        y: Number(r.value)
    }));

    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;

    let ssXX = 0;
    let ssXY = 0;
    let ssTot = 0;

    for (const p of points) {
        const dx = p.x - meanX;
        const dy = p.y - meanY;
        ssXX += dx * dx;
        ssXY += dx * dy;
        ssTot += dy * dy;
    }

    const slope = ssXX > 1e-6 ? ssXY / ssXX : 0;
    const intercept = meanY - slope * meanX;

    // Goodness-of-fit R^2 and Residual Standard Error
    let ssRes = 0;
    for (const p of points) {
        const yHat = intercept + slope * p.x;
        ssRes += (p.y - yHat) ** 2;
    }

    const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, Number((1 - ssRes / ssTot).toFixed(3)))) : 1.0;
    const dof = Math.max(1, n - 2);
    const residualSE = Math.sqrt(ssRes / dof);

    const latestPoint = points[points.length - 1];
    const targetX = latestPoint.x + 30;

    // Raw linear 30-day extrapolation
    const rawLinear30Day = intercept + slope * targetX;

    // Homeostatic exponentially damped horizon (tau = 21 days) models biological stabilization under therapy
    const tau = 21;
    const dampedHorizonDays = tau * (1 - Math.exp(-30 / tau));
    let dampedProjection = latestPoint.y + slope * dampedHorizonDays;

    // Clamp within human physiological survival limits
    const bounds = PHYSIOLOGICAL_VIABILITY_BOUNDS[biomarkerKey] || { floor: 0.1, ceiling: 10000 };
    const projected30DayValue = Number(Math.max(bounds.floor, Math.min(bounds.ceiling, dampedProjection)).toFixed(1));

    // 95% Prediction Confidence Interval (±1.96 * SE adjusted for leverage)
    const leverage = ssXX > 1e-6 ? 1 + 1 / n + ((targetX - meanX) ** 2) / ssXX : 1.2;
    const margin95 = 1.96 * residualSE * Math.sqrt(Math.min(leverage, 4));
    const ci95Lower = Number(Math.max(bounds.floor, projected30DayValue - margin95).toFixed(1));
    const ci95Upper = Number(Math.min(bounds.ceiling, projected30DayValue + margin95).toFixed(1));

    return {
        dailyRateOfChange: Number(slope.toFixed(3)),
        rawLinear30Day: Number(rawLinear30Day.toFixed(1)),
        projected30DayValue,
        rSquared,
        ci95Lower,
        ci95Upper,
        modelType: 'OLS Linear Regression + Homeostatic Damping',
        slopeDirection: slope > 0.05 ? 'RISING' : slope < -0.05 ? 'FALLING' : 'STABLE'
    };
};

// GET /api/health/trends (Patient or Doctor)
export const getPatientTrends = async (req, res) => {
    try {
        const userId = req.body.userId || req.query.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const readings = await biomarkerModel.find({ userId }).sort({ testDate: 1 });

        const groups = {};
        readings.forEach(r => {
            if (!groups[r.key]) {
                groups[r.key] = {
                    key: r.key,
                    name: r.name,
                    unit: r.unit,
                    category: r.category,
                    referenceMin: r.referenceMin,
                    referenceMax: r.referenceMax,
                    readings: []
                };
            }
            groups[r.key].readings.push({
                id: r._id,
                value: r.value,
                status: r.status,
                testDate: r.testDate,
                notes: r.notes
            });
        });

        const trends = Object.values(groups).map(group => {
            const history = group.readings;
            const values = history.map(h => h.value);
            const baseline = values[0];
            const latest = values[values.length - 1];
            const delta = Number((latest - baseline).toFixed(1));
            const deltaPercent = baseline !== 0 ? Number(((delta / baseline) * 100).toFixed(1)) : 0;

            const projection = calculateProjection(history, group.key);

            let trajectory = 'STABLE';
            if (['glucose', 'hba1c', 'cholesterol', 'ldl', 'triglycerides', 'creatinine'].includes(group.key)) {
                if (latest < baseline && latest <= group.referenceMax) trajectory = 'IMPROVING';
                else if (latest > group.referenceMax && delta > 0) trajectory = 'DETERIORATING';
                else if (latest <= group.referenceMax) trajectory = 'OPTIMAL';
                else trajectory = 'NEEDS_ATTENTION';
            } else if (group.key === 'hemoglobin') {
                if (latest >= group.referenceMin && baseline < group.referenceMin) trajectory = 'IMPROVING';
                else if (latest < group.referenceMin) trajectory = 'LOW';
                else trajectory = 'OPTIMAL';
            }

            return {
                ...group,
                metrics: {
                    baseline,
                    latest,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    average: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)),
                    delta,
                    deltaPercent,
                    readingCount: values.length,
                    latestStatus: history[history.length - 1].status,
                    trajectory,
                    projection
                }
            };
        });

        let score = 100;
        trends.forEach(t => {
            if (t.metrics.latestStatus === 'CRITICAL') score -= 25;
            else if (t.metrics.latestStatus === 'HIGH') score -= 12;
            else if (t.metrics.latestStatus === 'LOW') score -= 8;
        });
        score = Math.max(10, Math.min(100, score));

        return res.json({
            success: true,
            trends,
            totalBiomarkersTracked: trends.length,
            totalReadingsLogged: readings.length,
            cardiometabolicScore: score,
            algorithm: 'Ordinary Least Squares (OLS) + Homeostatic Damped Projection (95% CI)',
            patientId: userId
        });

    } catch (error) {
        console.error('Trend analytics error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/health/add-reading
export const addBiomarkerReading = async (req, res) => {
    try {
        const { userId, name, key, value, unit, referenceMin, referenceMax, category, testDate, notes } = req.body;

        if (!userId || !name || value === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required reading fields' });
        }

        const normalizedKey = key || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const min = referenceMin !== undefined ? Number(referenceMin) : 0;
        const max = referenceMax !== undefined ? Number(referenceMax) : 100;
        const numValue = Number(value);
        const status = evaluateStatus(numValue, min, max);

        const newReading = new biomarkerModel({
            userId,
            name,
            key: normalizedKey,
            value: numValue,
            unit: unit || 'mg/dL',
            referenceMin: min,
            referenceMax: max,
            status,
            category: category || 'General',
            testDate: testDate ? new Date(testDate) : new Date(),
            notes: notes || ''
        });

        await newReading.save();

        return res.json({
            success: true,
            message: 'Biomarker logged successfully',
            reading: newReading
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/health/seed-sample-trends
export const seedSampleTrends = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        const count = await biomarkerModel.countDocuments({ userId });
        if (count > 0) {
            await biomarkerModel.deleteMany({ userId });
        }

        const now = new Date();
        const monthMs = 30 * 24 * 60 * 60 * 1000;

        const sampleDataset = [
            { name: 'Fasting Blood Glucose', key: 'glucose', value: 142, unit: 'mg/dL', referenceMin: 70, referenceMax: 99, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 5 * monthMs), notes: 'Baseline lab visit' },
            { name: 'Fasting Blood Glucose', key: 'glucose', value: 128, unit: 'mg/dL', referenceMin: 70, referenceMax: 99, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 3 * monthMs), notes: 'Started Metformin 500mg' },
            { name: 'Fasting Blood Glucose', key: 'glucose', value: 114, unit: 'mg/dL', referenceMin: 70, referenceMax: 99, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 1 * monthMs), notes: 'Dietary modifications' },
            { name: 'Fasting Blood Glucose', key: 'glucose', value: 96,  unit: 'mg/dL', referenceMin: 70, referenceMax: 99, status: 'NORMAL', category: 'Glycemic', testDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), notes: 'Follow-up lab: Target reached' },

            { name: 'Glycated Hemoglobin (HbA1c)', key: 'hba1c', value: 7.9, unit: '%', referenceMin: 4.0, referenceMax: 5.6, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 5 * monthMs), notes: 'Diabetic range' },
            { name: 'Glycated Hemoglobin (HbA1c)', key: 'hba1c', value: 7.2, unit: '%', referenceMin: 4.0, referenceMax: 5.6, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 3 * monthMs), notes: 'Trending down' },
            { name: 'Glycated Hemoglobin (HbA1c)', key: 'hba1c', value: 6.4, unit: '%', referenceMin: 4.0, referenceMax: 5.6, status: 'HIGH', category: 'Glycemic', testDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), notes: 'Near pre-diabetic target' },

            { name: 'Total Cholesterol', key: 'cholesterol', value: 235, unit: 'mg/dL', referenceMin: 125, referenceMax: 200, status: 'HIGH', category: 'Lipid', testDate: new Date(now.getTime() - 5 * monthMs), notes: 'Elevated lipid panel' },
            { name: 'Total Cholesterol', key: 'cholesterol', value: 218, unit: 'mg/dL', referenceMin: 125, referenceMax: 200, status: 'HIGH', category: 'Lipid', testDate: new Date(now.getTime() - 3 * monthMs), notes: 'Statins prescribed' },
            { name: 'Total Cholesterol', key: 'cholesterol', value: 188, unit: 'mg/dL', referenceMin: 125, referenceMax: 200, status: 'NORMAL', category: 'Lipid', testDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), notes: 'Normal range restored' },

            { name: 'Serum Creatinine', key: 'creatinine', value: 0.9, unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2, status: 'NORMAL', category: 'Renal', testDate: new Date(now.getTime() - 5 * monthMs), notes: 'Normal renal clearance' },
            { name: 'Serum Creatinine', key: 'creatinine', value: 0.95, unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2, status: 'NORMAL', category: 'Renal', testDate: new Date(now.getTime() - 2 * monthMs), notes: 'Stable kidney function' },
            { name: 'Serum Creatinine', key: 'creatinine', value: 0.92, unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2, status: 'NORMAL', category: 'Renal', testDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), notes: 'Consistent GFR' },

            { name: 'Hemoglobin (Hb)', key: 'hemoglobin', value: 11.8, unit: 'g/dL', referenceMin: 13.0, referenceMax: 17.5, status: 'LOW', category: 'Hematology', testDate: new Date(now.getTime() - 5 * monthMs), notes: 'Mild iron-deficiency anemia' },
            { name: 'Hemoglobin (Hb)', key: 'hemoglobin', value: 12.6, unit: 'g/dL', referenceMin: 13.0, referenceMax: 17.5, status: 'LOW', category: 'Hematology', testDate: new Date(now.getTime() - 3 * monthMs), notes: 'Iron supplements ongoing' },
            { name: 'Hemoglobin (Hb)', key: 'hemoglobin', value: 14.1, unit: 'g/dL', referenceMin: 13.0, referenceMax: 17.5, status: 'NORMAL', category: 'Hematology', testDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), notes: 'Anemia resolved' }
        ];

        const inserted = await biomarkerModel.insertMany(sampleDataset.map(d => ({ ...d, userId })));

        return res.json({
            success: true,
            message: '6-Month longitudinal clinical dataset loaded successfully',
            insertedCount: inserted.length
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/health/reading/:id
export const deleteBiomarkerReading = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.body.userId;
        const reading = await biomarkerModel.findById(id);

        if (!reading) return res.status(404).json({ success: false, message: 'Reading not found' });
        if (reading.userId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

        await biomarkerModel.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Reading deleted' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
