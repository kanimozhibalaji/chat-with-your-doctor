/**
 * Deterministic Clinical Vitals & Royal College of Physicians NEWS2 Calculator
 * ============================================================================
 * Scores multi-parameter physiological vitals using the NHS / RCP National Early
 * Warning Score 2 (NEWS2, Scale 1) standard plus AHA blood-pressure staging.
 */

const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export function computeNEWS2({
    heartRate,
    systolicBp,
    diastolicBp,
    spo2,
    temperatureF,
    respiratoryRate,
    bloodGlucose
} = {}) {
    const hr = toNum(heartRate);
    const sbp = toNum(systolicBp);
    const dbp = toNum(diastolicBp);
    const ox = toNum(spo2);
    const tempF = toNum(temperatureF);
    const rr = toNum(respiratoryRate);
    const glu = toNum(bloodGlucose);

    let score = 0;
    let hasSingleThree = false;
    const flags = [];
    const breakdown = {};

    const addPoints = (key, pts) => {
        breakdown[key] = pts;
        score += pts;
        if (pts >= 3) hasSingleThree = true;
    };

    // 1. Respiratory Rate (breaths/min) — RCP NEWS2
    if (rr !== null && rr >= 4 && rr <= 60) {
        if (rr <= 8) {
            addPoints('respiratoryRate', 3);
            flags.push(`Bradypnea (${rr}/min)`);
        } else if (rr <= 11) {
            addPoints('respiratoryRate', 1);
        } else if (rr <= 20) {
            addPoints('respiratoryRate', 0);
        } else if (rr <= 24) {
            addPoints('respiratoryRate', 2);
            flags.push(`Tachypnea (${rr}/min)`);
        } else {
            addPoints('respiratoryRate', 3);
            flags.push(`Marked Tachypnea (${rr}/min)`);
        }
    }

    // 2. SpO2 Scale 1 (%) — RCP NEWS2
    if (ox !== null && ox >= 50 && ox <= 100) {
        if (ox <= 91) {
            addPoints('spo2', 3);
            flags.push(`Critical Hypoxemia (SpO₂ ${ox}%)`);
        } else if (ox <= 93) {
            addPoints('spo2', 2);
            flags.push(`Hypoxemia (SpO₂ ${ox}%)`);
        } else if (ox <= 95) {
            addPoints('spo2', 1);
            flags.push(`Borderline SpO₂ (${ox}%)`);
        } else {
            addPoints('spo2', 0);
        }
    }

    // 3. Systolic & Diastolic Blood Pressure (mmHg) — RCP NEWS2 + AHA Staging
    if (sbp !== null && sbp >= 40 && sbp <= 300) {
        if (sbp <= 90) {
            addPoints('systolicBp', 3);
            flags.push(`Hypotension (${sbp}${dbp ? `/${dbp}` : ''} mmHg)`);
        } else if (sbp <= 100) {
            addPoints('systolicBp', 2);
            flags.push(`Low Systolic BP (${sbp}${dbp ? `/${dbp}` : ''} mmHg)`);
        } else if (sbp <= 110) {
            addPoints('systolicBp', 1);
        } else if (sbp <= 219) {
            addPoints('systolicBp', 0);
        } else {
            addPoints('systolicBp', 3);
        }

        if (sbp >= 180 || (dbp !== null && dbp >= 120)) {
            hasSingleThree = true;
            score = Math.max(score, 7);
            flags.push(`Hypertensive Crisis (${sbp}/${dbp ?? '--'} mmHg)`);
        } else if (sbp >= 140 || (dbp !== null && dbp >= 90)) {
            flags.push(`Stage 2 Hypertension (${sbp}/${dbp ?? '--'} mmHg)`);
        } else if (sbp >= 130 || (dbp !== null && dbp >= 85)) {
            flags.push(`Stage 1 Elevated BP (${sbp}/${dbp ?? '--'} mmHg)`);
        }
    }

    // 4. Heart Rate / Pulse (BPM) — RCP NEWS2
    if (hr !== null && hr >= 25 && hr <= 240) {
        if (hr <= 40) {
            addPoints('heartRate', 3);
            flags.push(`Severe Bradycardia (${hr} BPM)`);
        } else if (hr <= 50) {
            addPoints('heartRate', 1);
            flags.push(`Mild Bradycardia (${hr} BPM)`);
        } else if (hr <= 90) {
            addPoints('heartRate', 0);
        } else if (hr <= 110) {
            addPoints('heartRate', 1);
            flags.push(`Mild Tachycardia (${hr} BPM)`);
        } else if (hr <= 130) {
            addPoints('heartRate', 2);
            flags.push(`Moderate Tachycardia (${hr} BPM)`);
        } else {
            addPoints('heartRate', 3);
            flags.push(`Marked Tachycardia (${hr} BPM)`);
        }
    }

    // 5. Temperature (°F -> °C) — RCP NEWS2
    if (tempF !== null && tempF >= 90 && tempF <= 110) {
        const tempC = ((tempF - 32) * 5) / 9;
        if (tempC <= 35.0) {
            addPoints('temperature', 3);
            flags.push(`Hypothermia (${tempF.toFixed(1)}°F)`);
        } else if (tempC <= 36.0) {
            addPoints('temperature', 1);
        } else if (tempC <= 38.0) {
            addPoints('temperature', 0);
        } else if (tempC <= 39.0) {
            addPoints('temperature', 1);
            flags.push(`Fever / Pyrexia (${tempF.toFixed(1)}°F)`);
        } else {
            addPoints('temperature', 2);
            flags.push(`High Fever (${tempF.toFixed(1)}°F)`);
        }
    }

    // 6. Optional Capillary Blood Glucose (mg/dL) — ADA Glycemic Safety Alert
    if (glu !== null && glu >= 20 && glu <= 700) {
        if (glu < 70) {
            hasSingleThree = true;
            flags.push(`Hypoglycemia (${glu} mg/dL)`);
        } else if (glu >= 250) {
            flags.push(`Marked Hyperglycemia (${glu} mg/dL)`);
        }
    }

    let risk = 'LOW';
    let label = 'Normal / Low Risk';
    if (score >= 7) {
        risk = 'HIGH';
        label = 'High Clinical Risk (Emergency Escalation)';
    } else if (score >= 5) {
        risk = 'MEDIUM';
        label = 'Medium Risk (Urgent Review)';
    } else if (hasSingleThree) {
        risk = 'LOW_MEDIUM';
        label = 'Red-Score Parameter (Clinician Review)';
    }

    return {
        news2Score: score,
        news2Risk: risk,
        riskLabel: label,
        clinicalFlags: flags,
        breakdown
    };
}
