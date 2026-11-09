import { getTextModel } from "../config/gemini.js";
import { retrieveContext } from "../utils/ragEngine.js";
import doctorModel from "../models/doctorModel.js";
import { AVAILABLE_SPECIALITIES, evaluateClinicalRules } from "./aiController.js";

// In-memory conversation history (per user session)
const conversationHistory = new Map();
const MAX_HISTORY = 10;

// Explicit specialist request keywords (ONLY triggered when user explicitly asks for the specialist by title,
// OR when red-flag rules in evaluateClinicalRules escalate to a specialist!)
const EXPLICIT_SPECIALITY_ALIASES = {
    "General physician": ["general physician", "general doctor", "family doctor", "gp", "internal medicine"],
    "Gynecologist": ["gynecologist", "gynaecologist", "gynec", "obstetrician"],
    "Dermatologist": ["dermatologist", "skin specialist", "skin doctor"],
    "Pediatricians": ["pediatrician", "paediatrician", "child specialist"],
    "Neurologist": ["neurologist", "brain specialist", "nerve specialist"],
    "Gastroenterologist": ["gastroenterologist", "gastro specialist", "liver specialist"]
};

/**
 * Stepped-Care Aligned Intent & Specialty Detector:
 * Ensures the Chatbot obeys the exact same WHO Stepped-Care Primary Care Gatekeeping
 * and SNOOP-4 Red-Flag rules as the Symptom Checker (HSCTA).
 */
function detectDoctorQuery(message) {
    const lower = String(message || "").toLowerCase();

    const doctorIntentWords = [
        "doctor", "specialist", "available", "book", "appointment",
        "consult", "find", "recommend", "suggest", "which", "who", "list", "show"
    ];
    const hasDoctorIntent = doctorIntentWords.some(w => lower.includes(w));

    const ruleVerdict = evaluateClinicalRules(lower);
    const hasSymptomIntent =
        ruleVerdict.hasPrimaryCareComplaint ||
        ruleVerdict.hasNeuroRedFlag ||
        ruleVerdict.hasCardiacRedFlag ||
        ruleVerdict.hasGiRedFlag ||
        ruleVerdict.hasDermSpecialistFlag ||
        ruleVerdict.isPediatric ||
        ruleVerdict.isGynec ||
        lower.includes("i have") ||
        lower.includes("suffering") ||
        lower.includes("pain");

    if (!hasDoctorIntent && !hasSymptomIntent) {
        return { isDoctorQuery: false, speciality: null, ruleVerdict };
    }

    // 1. Check if the user explicitly named a specialist title (e.g., "show me dermatologists")
    for (const speciality of AVAILABLE_SPECIALITIES) {
        if (lower.includes(speciality.toLowerCase())) {
            return { isDoctorQuery: true, speciality, ruleVerdict };
        }
    }
    for (const [speciality, aliases] of Object.entries(EXPLICIT_SPECIALITY_ALIASES)) {
        if (aliases.some(alias => lower.includes(alias))) {
            return { isDoctorQuery: true, speciality, ruleVerdict };
        }
    }

    // 2. If describing symptoms, enforce HSCTA Stepped-Care Gatekeeping!
    // Routine headaches, dizziness, mild stomach ache, fever -> General physician!
    if (hasSymptomIntent) {
        return {
            isDoctorQuery: true,
            speciality: ruleVerdict.deterministicSpeciality,
            ruleVerdict
        };
    }

    // 3. Generic doctor query without specific speciality
    return { isDoctorQuery: true, speciality: null, ruleVerdict };
}

/**
 * Okapi BM25 RAG Chatbot endpoint — integrated with HSCTA Stepped-Care Gatekeeping & Live MongoDB Registry
 */
const chatWithBot = async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!message || message.trim().length === 0) {
            return res.json({ success: false, message: "Please enter a message" });
        }

        // 1. Retrieve top-K knowledge base passages via Okapi BM25 sparse vector scoring
        const relevantDocs = retrieveContext(message, 3);
        const contextBlock = relevantDocs.length > 0
            ? relevantDocs.map((doc) =>
                `[${doc.category.toUpperCase()} | BM25=${doc.score.toFixed(2)}] ${doc.question}\n${doc.content}`
            ).join("\n\n---\n\n")
            : "No specific knowledge base entry found for this query.";

        // 2. Stepped-care aligned doctor lookup
        const { isDoctorQuery, speciality, ruleVerdict } = detectDoctorQuery(message);
        let matchedDoctors = [];
        let doctorContextBlock = "";

        if (isDoctorQuery) {
            const query = { available: true };
            if (speciality) {
                query.speciality = speciality;
            }
            matchedDoctors = await doctorModel.find(query)
                .select("name speciality degree experience fees address image")
                .limit(5)
                .lean();

            if (matchedDoctors.length > 0) {
                doctorContextBlock = `\n\nLIVE STEPPED-CARE MATCHED DOCTORS FROM DATABASE (Recommended Department: ${speciality || 'All Available'}):\n` +
                    matchedDoctors.map((d, i) =>
                        `${i + 1}. ${d.name.startsWith('Dr.') ? d.name : 'Dr. ' + d.name} — ${d.speciality} | ${d.degree} | ${d.experience} experience | ₹${d.fees} consultation fee`
                    ).join("\n");
            } else {
                doctorContextBlock = `\n\nNo ${speciality || ''} doctors are currently available on the platform.`;
            }
        }

        // 3. Session conversation history (Isolated per session; never leaked across anonymous users)
        const sessionId = userId || req.headers?.['x-session-id'] || req.body?.sessionId;
        let history = [];
        if (sessionId) {
            if (!conversationHistory.has(sessionId)) {
                conversationHistory.set(sessionId, []);
            }
            history = conversationHistory.get(sessionId);
        }

        const historyBlock = history.length > 0
            ? history.map((h) => `${h.role}: ${h.text}`).join("\n")
            : "No previous conversation.";

        // 4. Build clinical stepped-care RAG prompt
        const systemPrompt = `You are VitalSync AI Assistant, a clinical triage & navigation chatbot implementing WHO Stepped-Care Primary Care Gatekeeping and MoHFW Telemedicine Guidelines.

MANDATORY CLINICAL ROUTING RULES:
- STEPPED-CARE GATEKEEPING: For routine headaches (1-3 days), mild dizziness, mild stomach ache, acidity, gas, fever, cough, cold, or fatigue WITHOUT acute red flags, ALWAYS recommend consulting a General Physician first (to check blood pressure/vitals and avoid unnecessary expensive specialist fees). NEVER tell a patient with an ordinary headache to go straight to a Neurologist unless SNOOP-4 red flags (thunderclap onset, slurred speech, facial droop, limb paralysis, seizures) are present.
- EMERGENCY PROTOCOL: If the user describes crushing chest pain, stroke signs, severe difficulty breathing, or vomiting blood (${ruleVerdict?.isLifeThreateningEmergency ? 'EMERGENCY DETECTED IN CURRENT QUERY!' : 'monitor carefully'}), instruct them immediately to call 108 / 112 or visit the nearest Hospital Emergency Room—do not wait for an online consultation.
- NEVER diagnose diseases or prescribe drugs.
- Keep responses concise (2-4 sentences), empathetic, and plain text (no markdown asterisks).
- When LIVE STEPPED-CARE MATCHED DOCTORS are provided below, mention the actual doctor names, credentials, and fees.

RETRIEVED KNOWLEDGE BASE CONTEXT (Okapi BM25):
${contextBlock}
${doctorContextBlock}

CONVERSATION HISTORY:
${historyBlock}

USER'S CURRENT MESSAGE: ${message}

Respond naturally in plain text as VitalSync AI Assistant:`;

        const model = getTextModel();
        const result = await model.generateContent(systemPrompt);
        const botResponse = result.response.text();

        if (sessionId) {
            history.push({ role: "User", text: message });
            history.push({ role: "Assistant", text: botResponse });

            while (history.length > MAX_HISTORY * 2) {
                history.shift();
            }
        }

        res.json({
            success: true,
            response: botResponse,
            doctors: matchedDoctors,
            retrievalAlgorithm: "Okapi BM25 Sparse Vector Retrieval + HSCTA Gatekeeper",
            sourcesUsed: relevantDocs.map((d) => ({
                id: d.id,
                question: d.question,
                category: d.category,
                relevanceScore: Math.round(d.score * 100) / 100
            }))
        });

    } catch (error) {
        console.log("Chatbot Error:", error.message);

        let fallbackDoctors = [];
        let fallbackSpec = "General physician";
        try {
            const { isDoctorQuery, speciality } = detectDoctorQuery(req.body.message || "");
            fallbackSpec = speciality || "General physician";
            if (isDoctorQuery) {
                const query = { available: true };
                if (speciality) query.speciality = speciality;
                fallbackDoctors = await doctorModel.find(query)
                    .select("name speciality degree experience fees address image")
                    .limit(5)
                    .lean();
            }
        } catch (e) { /* ignore */ }

        const fallbackText = fallbackDoctors.length > 0
            ? `Following our Stepped-Care Triage protocol, I found ${fallbackDoctors.length} available ${fallbackSpec} specialist(s) for you below.`
            : "Our AI service is briefly busy. You can use the AI Symptom Checker for stepped-care doctor routing, or browse All Doctors directly.";

        res.json({
            success: true,
            response: fallbackText,
            doctors: fallbackDoctors,
            sourcesUsed: []
        });
    }
};

/**
 * Clear conversation history for a user
 */
const clearChatHistory = async (req, res) => {
    try {
        const { userId } = req.body;
        const sessionId = userId || "anonymous";
        conversationHistory.delete(sessionId);

        res.json({ success: true, message: "Chat history cleared" });
    } catch (error) {
        res.json({ success: false, message: "Failed to clear history" });
    }
};

export { chatWithBot, clearChatHistory };
