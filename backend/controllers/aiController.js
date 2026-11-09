import { getTextModel, getVisionModel } from "../config/gemini.js";
import doctorModel from "../models/doctorModel.js";

// Canonical Outpatient Specialities available in VitalSync Hospital Registry (12 Empanelled Doctors across 6 Departments)
const AVAILABLE_SPECIALITIES = [
    "General physician",
    "Gynecologist",
    "Dermatologist",
    "Pediatricians",
    "Neurologist",
    "Gastroenterologist"
];

// 1. SNOOP-4 Neurological Red Flags indicating genuine tertiary neurology / stroke ER need
const SNOOP_NEURO_RED_FLAGS = [
    "thunderclap", "worst headache of my life", "sudden explosive",
    "facial droop", "face drooping", "slurred speech", "speech difficulty",
    "arm weakness", "leg weakness", "one-sided weakness", "hemiparesis",
    "paralysis", "numbness on one side", "loss of vision", "double vision",
    "diplopia", "seizure", "convulsion", "fits", "unconscious",
    "passed out", "stiff neck with fever", "meningitis", "confusion",
    "hallucination", "memory loss sudden", "stroke", "paralyzed"
];

// 2. Acute Cardiac / Thoracic / Systemic Red Flags (MoHFW Emergency ER Bypass Protocol)
const CARDIAC_EMERGENCY_RED_FLAGS = [
    "chest pressure", "chest tightness", "crushing chest", "radiating to arm",
    "radiating to left arm", "radiating to jaw", "radiating to shoulder",
    "sweating with chest pain", "diaphoresis", "shortness of breath with chest",
    "heart attack", "angina", "cannot breathe", "difficulty breathing severe",
    "throat closing", "anaphylaxis", "severe bleeding"
];

// 3. Gastrointestinal Red Flags (Direct escalation to Gastroenterologist / ER)
const GI_RED_FLAGS = [
    "vomiting blood", "blood in vomit", "hematemesis", "black stool", "blood in stool",
    "melena", "rectal bleeding", "jaundice", "yellow eyes", "cannot swallow",
    "dysphagia", "severe continuous abdominal pain", "rebound tenderness",
    "unexplained weight loss", "persistent vomiting", "chronic liver", "cirrhosis", "ulcer"
];

// 4. Dermatological Specialist Indicators (Direct to Dermatologist)
const DERM_SPECIALIST_FLAGS = [
    "rash", "urticarial", "urticaria", "hives", "eczema", "psoriasis",
    "cystic acne", "severe acne", "blister", "changing mole", "lesion",
    "pigmentation", "alopecia", "fungal infection", "ringworm", "erythematous"
];

// 5. Pediatric & Gynecological Domain Markers
const PEDIATRIC_MARKERS = [
    "my child", "my baby", "my kid", "infant", "toddler", "newborn",
    "year old boy", "year old girl", "years old child", "pediatric", "vaccination for baby"
];

const GYNEC_MARKERS = [
    "pregnant", "pregnancy", "prenatal", "period", "menstrual", "pcos", "pcod",
    "irregular cycle", "pelvic pain", "vaginal", "postpartum", "maternity", "menopause"
];

// 6. Common Primary Care Non-Specific Symptoms (Gatekept to General Physician unless Red Flags exist)
const PRIMARY_CARE_SYMPTOMS = [
    "headache", "head ache", "migraine", "dizzy", "dizziness", "lightheaded",
    "fever", "body pain", "fatigue", "tiredness", "weakness",
    "cold", "cough", "runny nose", "sore throat", "nausea",
    "malaise", "chills", "mild ache", "dehydration",
    "stomach ache", "stomach pain", "stomach hurts", "indigestion", "gas", "acidity",
    "bloating", "loose motion", "diarrhea", "constipation",
    "back pain", "neck pain", "joint pain", "muscle pain", "anxious", "trouble sleeping"
];

/**
 * Tier 1 & Tier 2 Deterministic Rule Engine:
 * Evaluates free-text symptoms against SNOOP-4, Cardiac/GI Red Flags, MoHFW Emergency Bypass,
 * and WHO Stepped-Care Primary Care Gatekeeping rules in O(K) bounded time.
 */
const evaluateClinicalRules = (symptomText = "") => {
    const text = String(symptomText).toLowerCase();

    const hasNeuroRedFlag = SNOOP_NEURO_RED_FLAGS.some(flag => text.includes(flag));
    const hasCardiacRedFlag = CARDIAC_EMERGENCY_RED_FLAGS.some(flag => text.includes(flag));
    const hasGiRedFlag = GI_RED_FLAGS.some(flag => text.includes(flag));
    const hasDermSpecialistFlag = DERM_SPECIALIST_FLAGS.some(flag => text.includes(flag));
    const isPediatric = PEDIATRIC_MARKERS.some(flag => text.includes(flag));
    const isGynec = GYNEC_MARKERS.some(flag => text.includes(flag));
    const hasPrimaryCareComplaint = PRIMARY_CARE_SYMPTOMS.some(s => text.includes(s));

    // Life-threatening acute emergency requiring physical ER / 108 / 112 per MoHFW India Telemedicine Guidelines
    const isLifeThreateningEmergency =
        hasCardiacRedFlag ||
        text.includes("thunderclap") ||
        text.includes("facial droop") ||
        text.includes("face drooping") ||
        text.includes("slurred speech") ||
        text.includes("paralysis") ||
        text.includes("hemiparesis") ||
        text.includes("stroke") ||
        text.includes("seizure") ||
        text.includes("unconscious") ||
        text.includes("vomiting blood") ||
        text.includes("hematemesis");

    const isBenignNeuroComplaint =
        (text.includes("headache") || text.includes("head ache") || text.includes("migraine") || text.includes("dizzy") || text.includes("dizziness")) &&
        !hasNeuroRedFlag;

    const isBenignGiComplaint =
        (text.includes("stomach") || text.includes("indigestion") || text.includes("gas") || text.includes("acidity") || text.includes("bloating") || text.includes("nauseous") || text.includes("nausea")) &&
        !hasGiRedFlag;

    const isBenignDermComplaint =
        (text.includes("dry skin") || text.includes("mosquito bite") || text.includes("mild itch")) &&
        !hasDermSpecialistFlag;

    const isBenignPrimarySymptom =
        !isPediatric &&
        !isGynec &&
        !hasCardiacRedFlag &&
        (isBenignNeuroComplaint || isBenignGiComplaint || isBenignDermComplaint || (hasPrimaryCareComplaint && !hasNeuroRedFlag && !hasGiRedFlag && !hasDermSpecialistFlag));

    // Deterministic target specialty resolution (used for offline fallback & chatbot alignment)
    let deterministicSpeciality = "General physician";
    if (isPediatric) deterministicSpeciality = "Pediatricians";
    else if (isGynec) deterministicSpeciality = "Gynecologist";
    else if (hasNeuroRedFlag) deterministicSpeciality = "Neurologist";
    else if (hasGiRedFlag) deterministicSpeciality = "Gastroenterologist";
    else if (hasDermSpecialistFlag) deterministicSpeciality = "Dermatologist";
    else deterministicSpeciality = "General physician";

    return {
        hasNeuroRedFlag,
        hasCardiacRedFlag,
        hasGiRedFlag,
        hasDermSpecialistFlag,
        isPediatric,
        isGynec,
        hasPrimaryCareComplaint,
        isLifeThreateningEmergency,
        isBenignNeuroComplaint,
        isBenignGiComplaint,
        isBenignPrimarySymptom,
        deterministicSpeciality
    };
};

// API to analyze symptoms and recommend a specialist using HSCTA
const analyzeSymptoms = async (req, res) => {
    try {
        const { symptoms } = req.body;

        if (!symptoms || symptoms.trim().length === 0) {
            return res.json({ success: false, message: "Please describe your symptoms" });
        }

        const startTime = performance.now();

        // TIER 1 & TIER 2: Deterministic SNOOP-4, Red-Flag & Stepped-Care Pre-Evaluation
        const ruleVerdict = evaluateClinicalRules(symptoms);

        const model = getTextModel();

        // TIER 3: Constrained Semantic Extraction (Low-Temperature T=0.1, Closed Clinical Ontology)
        const systemPrompt = `You are the Clinical Triage Engine for VitalSync implementing the Hierarchical Stepped-Care Triage Algorithm (HSCTA), WHO Stepped-Care Primary Care Protocol, SNOOP-4 Neurological Red-Flag Criteria, and MoHFW India Telemedicine Practice Guidelines (2020).

AVAILABLE OUTPATIENT SPECIALITIES ON THIS PLATFORM (STRICT CLOSED TAXONOMY):
${AVAILABLE_SPECIALITIES.map((s, i) => `${i + 1}. ${s}`).join("\n")}

MANDATORY STEPPED-CARE & CLINICAL ROUTING RULES:
1. UNIVERSAL PRIMARY CARE EVALUATION: Routine ambulatory complaints—including 1-3 day headaches, mild dizziness, tension/migraine without focal neurological deficits, mild stomach pain after meals, acidity, gas, bloating, fever, cold, cough, fatigue, back/muscle ache, or mild anxiety/sleep difficulty—SHOULD BE ROUTED TO "General physician". General Physicians (holding MD Internal Medicine credentials) perform a comprehensive baseline evaluation, vitals check, and initial management, ensuring patient-centered care.
2. STRICT SPECIALIST ESCALATION CRITERIA:
   - "Neurologist": ONLY if SNOOP-4 neurological red flags are present (sudden thunderclap onset, facial droop, slurred speech, limb weakness/hemiparesis, seizures, sudden vision loss, altered consciousness).
   - "Gastroenterologist": ONLY if GI red flags or severe chronic pathology exist (vomiting blood, black/bloody stools, jaundice, dysphagia, persistent intractable vomiting, diagnosed IBD/cirrhosis).
   - "Dermatologist": Acute drug eruptions, spreading erythematous rashes, urticaria/hives, eczema, psoriasis, severe cystic acne, or suspicious skin lesions.
   - "Pediatricians": Any patient explicitly identified as an infant, baby, toddler, or child.
   - "Gynecologist": Pregnancy, prenatal care, menstrual cycle disorders, PCOS, or female pelvic complaints.
   - "General physician": Default primary care physician for all routine, systemic, cardiovascular-screening, and non-red-flag presentations.
3. ACUTE EMERGENCY PROTOCOL: If symptoms suggest Acute Coronary Syndrome (crushing/radiating chest pain, diaphoresis), acute stroke, anaphylaxis, or severe dyspnea, set urgencyLevel to "high" and instruct immediate physical Emergency Room (108/112) evaluation first.

RESPOND IN RAW JSON FORMAT ONLY (no markdown, no code fences):
{
    "urgencyLevel": "low" or "medium" or "high",
    "recommendedSpeciality": "exact match from AVAILABLE OUTPATIENT SPECIALITIES",
    "triageProtocol": "Primary Care Assessment" or "Specialist Clinical Evaluation" or "Emergency Protocol",
    "possibleConcernArea": "brief non-diagnostic clinical concern category",
    "reasoning": "1-2 warm, reassuring, patient-friendly sentences explaining why this specialist or General Physician is the best person to evaluate their symptoms and help them feel better. Write with warmth and clarity without robotic or bureaucratic jargon.",
    "immediateAdvice": "actionable immediate self-care advice (or 108/112 ER instruction if life-threatening)",
    "disclaimer": "Automated clinical triage under WHO Stepped-Care & MoHFW Telemedicine Guidelines. Not a substitute for in-person medical diagnosis."
}`;

        let aiResponse;

        try {
            const result = await model.generateContent([
                { text: systemPrompt },
                { text: `Patient clinical symptoms: ${symptoms}` }
            ]);

            const responseText = result.response.text();
            const cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            aiResponse = JSON.parse(cleanedResponse);
        } catch (apiError) {
            console.log("Gemini API unavailable/parse error — executing Tier 4 Deterministic Clinical Decision Tree:", apiError.message);

            // TIER 4: Deterministic Offline Clinical Decision Tree (100% Zero-API Resilience)
            if (ruleVerdict.hasCardiacRedFlag) {
                aiResponse = {
                    urgencyLevel: "high",
                    recommendedSpeciality: "General physician",
                    triageProtocol: "MoHFW Emergency ER Bypass Protocol",
                    possibleConcernArea: "Suspected acute cardiopulmonary emergency (Requires Physical ER)",
                    reasoning: "Substernal or radiating chest symptoms with autonomic signs require immediate physical Emergency Department (ECG/Troponin) evaluation per MoHFW Telemedicine Guidelines; MD Internal Medicine listed strictly for post-ER follow-up.",
                    immediateAdvice: "STOP: Call 108 / 112 or proceed to the nearest Hospital Emergency Room immediately. Do not drive yourself and do not wait for an online video slot.",
                    disclaimer: "CRITICAL EMERGENCY ALERT: Telemedicine cannot replace emergency hospital care."
                };
            } else if (ruleVerdict.hasNeuroRedFlag) {
                aiResponse = {
                    urgencyLevel: "high",
                    recommendedSpeciality: "Neurologist",
                    triageProtocol: "SNOOP-4 Neurological Red-Flag Escalation",
                    possibleConcernArea: "Acute focal neurological deficit / SNOOP-4 positive presentation",
                    reasoning: "Presence of SNOOP-4 neurological red flags justifies immediate escalation beyond primary care to Neurology / Stroke Emergency care.",
                    immediateAdvice: "Seek immediate emergency medical evaluation (Call 108 / 112) to rule out acute cerebrovascular pathology.",
                    disclaimer: "Automated emergency neurological red-flag triage."
                };
            } else if (ruleVerdict.hasGiRedFlag) {
                aiResponse = {
                    urgencyLevel: "high",
                    recommendedSpeciality: "Gastroenterologist",
                    triageProtocol: "GI Red-Flag Specialist Escalation",
                    possibleConcernArea: "Acute or complicated gastrointestinal presentation",
                    reasoning: "Gastrointestinal alarm symptoms (bleeding, jaundice, dysphagia, or intractable symptoms) warrant direct specialist Gastroenterologist evaluation.",
                    immediateAdvice: "Avoid NSAIDs and spicy/solid food; seek prompt medical evaluation.",
                    disclaimer: "Automated stepped-care specialist escalation."
                };
            } else {
                aiResponse = {
                    urgencyLevel: "medium",
                    recommendedSpeciality: ruleVerdict.deterministicSpeciality,
                    triageProtocol: ruleVerdict.deterministicSpeciality === "General physician"
                        ? "Comprehensive Primary Care Review"
                        : "Specialist Clinical Evaluation",
                    possibleConcernArea: "Outpatient clinical evaluation",
                    reasoning: ruleVerdict.deterministicSpeciality === "General physician"
                        ? "A General Physician is the best first step for these symptoms. They can perform an overall health check, evaluate your vitals, and coordinate further care or specialist referral if needed."
                        : `Your symptoms align closely with ${ruleVerdict.deterministicSpeciality} care for targeted evaluation.`,
                    immediateAdvice: "Stay well hydrated, rest in a comfortable position, and book a consultation below.",
                    disclaimer: "Automated clinical triage recommendation. Not a substitute for in-person medical diagnosis."
                };
            }
        }

        // TIER 5: DETERMINISTIC POST-VALIDATION & CLINICAL SAFETY CHECK
        if (ruleVerdict.isBenignPrimarySymptom) {
            if (aiResponse.recommendedSpeciality === "Neurologist" && !ruleVerdict.hasNeuroRedFlag) {
                aiResponse.recommendedSpeciality = "General physician";
                aiResponse.urgencyLevel = aiResponse.urgencyLevel === "high" ? "medium" : aiResponse.urgencyLevel;
                aiResponse.triageProtocol = "Primary Care Assessment";
                aiResponse.reasoning = "Headaches or mild dizziness are best evaluated first by a General Physician. They can check your blood pressure, hydration, and vitals to determine the root cause.";
            } else if (aiResponse.recommendedSpeciality === "Gastroenterologist" && !ruleVerdict.hasGiRedFlag) {
                aiResponse.recommendedSpeciality = "General physician";
                aiResponse.urgencyLevel = aiResponse.urgencyLevel === "high" ? "medium" : aiResponse.urgencyLevel;
                aiResponse.triageProtocol = "Primary Care Assessment";
                aiResponse.reasoning = "Digestive discomfort, mild nausea, or acidity is most effectively treated initially by a General Physician who can advise on dietary triggers and targeted relief.";
            }
        }

        // Enforce MoHFW Telemedicine Emergency Bypass Flag on life-threatening presentations
        const isEmergencyBypass = Boolean(ruleVerdict.isLifeThreateningEmergency);
        if (isEmergencyBypass) {
            aiResponse.urgencyLevel = "high";
            aiResponse.isEmergencyBypass = true;
            aiResponse.triageProtocol = "MoHFW Emergency ER Bypass (108/112)";
            aiResponse.emergencyBanner =
                "ACUTE MEDICAL EMERGENCY DETECTED: Per MoHFW India Telemedicine Practice Guidelines (2020), suspected cardiac, stroke, or life-threatening emergencies require immediate physical Emergency Room (ER) care. Call 108 / 112 immediately — DO NOT wait for a scheduled video call. Doctors listed below are for post-stabilization follow-up only.";
        } else {
            aiResponse.isEmergencyBypass = false;
        }

        // Validate against closed hospital specialty taxonomy
        const matchedSpeciality = AVAILABLE_SPECIALITIES.find((s) => {
            const aiSpec = (aiResponse.recommendedSpeciality || "").toLowerCase().trim();
            const sysSpec = s.toLowerCase();
            return (
                sysSpec === aiSpec ||
                sysSpec.includes(aiSpec) ||
                aiSpec.includes(sysSpec) ||
                (sysSpec === "pediatricians" && aiSpec === "pediatrician")
            );
        });

        aiResponse.recommendedSpeciality = matchedSpeciality || ruleVerdict.deterministicSpeciality || "General physician";

        // Query available doctors for the matched speciality (excluding privateKey & password)
        const availableDoctors = await doctorModel.find({
            speciality: aiResponse.recommendedSpeciality,
            available: true
        }).select("-password -email -privateKey");

        const latencyMs = Math.round(performance.now() - startTime);

        res.json({
            success: true,
            analysis: aiResponse,
            algorithm: {
                name: "Clinical Triage Protocol",
                protocol: aiResponse.triageProtocol || "Primary Care Assessment",
                redFlagScreening: isEmergencyBypass
                    ? "Emergency Protocol Activated"
                    : "Non-Emergency Guidance",
                costOptimization: "Comprehensive Assessment",
                latencyMs
            },
            availableDoctors,
            totalDoctorsFound: availableDoctors.length
        });

    } catch (error) {
        console.log("AI Analysis Global Error:", error.message);

        const fallbackDoctors = await doctorModel.find({
            speciality: "General physician",
            available: true
        }).select("-password -email -privateKey");

        res.json({
            success: true,
            analysis: {
                urgencyLevel: "medium",
                recommendedSpeciality: "General physician",
                isEmergencyBypass: false,
                triageProtocol: "Stepped-Care Primary Care Gatekeeping",
                possibleConcernArea: "General medical consultation",
                reasoning: "Based on primary care stepped-care protocols, an initial consultation with a General physician provides comprehensive vital assessment and cost-effective care.",
                immediateAdvice: "Stay comfortable, drink plenty of water, and consult the physician below.",
                disclaimer: "Automated stepped-care recommendation."
            },
            algorithm: {
                name: "Hierarchical Stepped-Care Triage Algorithm (HSCTA)",
                protocol: "Deterministic Rule-Based Fallback",
                costOptimization: "Primary Care First (Cost-Protected)"
            },
            availableDoctors: fallbackDoctors,
            totalDoctorsFound: fallbackDoctors.length
        });
    }
};

// API to summarize a medical report (image/text)
const summarizeReport = async (req, res) => {
    try {
        const { imageUrl, reportText } = req.body;

        if (!imageUrl && !reportText) {
            return res.json({ success: false, message: "Please provide a report image URL or text" });
        }

        const model = getVisionModel();

        const systemPrompt = `You are a medical report analysis AI for a telemedicine platform. Analyze the provided medical report and extract key information.

RESPOND IN THE FOLLOWING JSON FORMAT ONLY (no markdown, no code blocks, just raw JSON):
{
    "reportType": "type of report (e.g., Blood Test, X-Ray, Prescription, etc.)",
    "keyFindings": ["finding 1", "finding 2", "finding 3"],
    "vitalMetrics": {
        "metric_name": "value with unit"
    },
    "medications": ["medication 1", "medication 2"],
    "summary": "2-3 sentence plain language summary of the report for a non-medical person",
    "flaggedValues": ["any abnormal or concerning values"],
    "recommendedFollowUp": "brief follow-up recommendation if applicable"
}

IMPORTANT: If the image is not a medical report, respond with:
{
    "reportType": "Not a medical report",
    "summary": "The uploaded file does not appear to be a medical report. Please upload a valid medical document.",
    "keyFindings": [],
    "vitalMetrics": {},
    "medications": [],
    "flaggedValues": [],
    "recommendedFollowUp": ""
}`;

        let result;

        if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

            result = await model.generateContent([
                { text: systemPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Image
                    }
                }
            ]);
        } else {
            result = await model.generateContent([
                { text: systemPrompt },
                { text: `Medical report text:\n${reportText}` }
            ]);
        }

        const responseText = result.response.text();

        let aiSummary;
        try {
            const cleanedResponse = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            aiSummary = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.log("Report parsing error:", parseError);
            aiSummary = {
                reportType: "Unknown",
                summary: "Unable to fully parse the report. Please consult your doctor for detailed analysis.",
                keyFindings: [],
                vitalMetrics: {},
                medications: [],
                flaggedValues: [],
                recommendedFollowUp: "Please consult your doctor."
            };
        }

        res.json({
            success: true,
            summary: aiSummary
        });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: "Report analysis failed. Please try again." });
    }
};

export { analyzeSymptoms, summarizeReport, evaluateClinicalRules, AVAILABLE_SPECIALITIES };
