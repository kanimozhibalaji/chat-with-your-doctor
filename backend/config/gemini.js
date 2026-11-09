import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Deterministic low-temperature configuration for clinical triage, pharmacology & RAG
const CLINICAL_GENERATION_CONFIG = {
    temperature: 0.1,
    topP: 0.85,
    topK: 20
};

// Text-only model for symptom analysis, DDI pharmacology, chatbot, etc.
const getTextModel = () => {
    return genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: CLINICAL_GENERATION_CONFIG
    });
};

// Vision model for medical report OCR & biomarker extraction
const getVisionModel = () => {
    return genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: CLINICAL_GENERATION_CONFIG
    });
};

export { getTextModel, getVisionModel, CLINICAL_GENERATION_CONFIG };
