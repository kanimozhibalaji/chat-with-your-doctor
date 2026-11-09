const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function computeNEWS2({
  heartRate,
  systolicBp,
  diastolicBp,
  spo2,
  temperatureF,
  respiratoryRate,
  bloodGlucose
} = {}) {
  const hr = toNum(heartRate)
  const sbp = toNum(systolicBp)
  const dbp = toNum(diastolicBp)
  const ox = toNum(spo2)
  const tempF = toNum(temperatureF)
  const rr = toNum(respiratoryRate)
  const glu = toNum(bloodGlucose)

  let score = 0
  let hasSingleThree = false
  const flags = []

  const addPoints = (pts) => {
    score += pts
    if (pts >= 3) hasSingleThree = true
  }

  if (rr !== null && rr >= 4 && rr <= 60) {
    if (rr <= 8) {
      addPoints(3)
      flags.push(`Bradypnea (${rr}/min)`)
    } else if (rr <= 11) addPoints(1)
    else if (rr <= 20) addPoints(0)
    else if (rr <= 24) {
      addPoints(2)
      flags.push(`Tachypnea (${rr}/min)`)
    } else {
      addPoints(3)
      flags.push(`Marked Tachypnea (${rr}/min)`)
    }
  }

  if (ox !== null && ox >= 50 && ox <= 100) {
    if (ox <= 91) {
      addPoints(3)
      flags.push(`Critical Hypoxemia (SpO₂ ${ox}%)`)
    } else if (ox <= 93) {
      addPoints(2)
      flags.push(`Hypoxemia (SpO₂ ${ox}%)`)
    } else if (ox <= 95) {
      addPoints(1)
      flags.push(`Borderline SpO₂ (${ox}%)`)
    }
  }

  if (sbp !== null && sbp >= 40 && sbp <= 300) {
    if (sbp <= 90) {
      addPoints(3)
      flags.push(`Hypotension (${sbp}${dbp ? `/${dbp}` : ''} mmHg)`)
    } else if (sbp <= 100) {
      addPoints(2)
      flags.push(`Low Systolic BP (${sbp}${dbp ? `/${dbp}` : ''} mmHg)`)
    } else if (sbp <= 110) addPoints(1)
    else if (sbp > 219) addPoints(3)

    if (sbp >= 180 || (dbp !== null && dbp >= 120)) {
      hasSingleThree = true
      score = Math.max(score, 7)
      flags.push(`Hypertensive Crisis (${sbp}/${dbp ?? '--'} mmHg)`)
    } else if (sbp >= 140 || (dbp !== null && dbp >= 90)) {
      flags.push(`Stage 2 Hypertension (${sbp}/${dbp ?? '--'} mmHg)`)
    } else if (sbp >= 130 || (dbp !== null && dbp >= 85)) {
      flags.push(`Stage 1 Elevated BP (${sbp}/${dbp ?? '--'} mmHg)`)
    }
  }

  if (hr !== null && hr >= 25 && hr <= 240) {
    if (hr <= 40) {
      addPoints(3)
      flags.push(`Severe Bradycardia (${hr} BPM)`)
    } else if (hr <= 50) {
      addPoints(1)
      flags.push(`Mild Bradycardia (${hr} BPM)`)
    } else if (hr > 90 && hr <= 110) {
      addPoints(1)
      flags.push(`Mild Tachycardia (${hr} BPM)`)
    } else if (hr > 110 && hr <= 130) {
      addPoints(2)
      flags.push(`Moderate Tachycardia (${hr} BPM)`)
    } else if (hr > 130) {
      addPoints(3)
      flags.push(`Marked Tachycardia (${hr} BPM)`)
    }
  }

  if (tempF !== null && tempF >= 90 && tempF <= 110) {
    const tempC = ((tempF - 32) * 5) / 9
    if (tempC <= 35.0) {
      addPoints(3)
      flags.push(`Hypothermia (${tempF.toFixed(1)}°F)`)
    } else if (tempC <= 36.0) addPoints(1)
    else if (tempC > 38.0 && tempC <= 39.0) {
      addPoints(1)
      flags.push(`Fever / Pyrexia (${tempF.toFixed(1)}°F)`)
    } else if (tempC > 39.0) {
      addPoints(2)
      flags.push(`High Fever (${tempF.toFixed(1)}°F)`)
    }
  }

  if (glu !== null && glu >= 20 && glu <= 700) {
    if (glu < 70) {
      hasSingleThree = true
      flags.push(`Hypoglycemia (${glu} mg/dL)`)
    } else if (glu >= 250) {
      flags.push(`Marked Hyperglycemia (${glu} mg/dL)`)
    }
  }

  let risk = 'LOW'
  let label = 'Normal / Low Risk'
  if (score >= 7) {
    risk = 'HIGH'
    label = 'High Clinical Risk (Emergency Escalation)'
  } else if (score >= 5) {
    risk = 'MEDIUM'
    label = 'Medium Risk (Urgent Review)'
  } else if (hasSingleThree) {
    risk = 'LOW_MEDIUM'
    label = 'Red-Score Parameter (Clinician Review)'
  }

  return { news2Score: score, news2Risk: risk, riskLabel: label, clinicalFlags: flags }
}
