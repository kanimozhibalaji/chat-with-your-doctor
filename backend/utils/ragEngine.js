import knowledgeBase from "../data/knowledgeBase.json" with { type: "json" };

/**
 * Okapi BM25 Information Retrieval Engine (Robertson & Zaragoza, 2009)
 * ====================================================================
 * Replaces naive substring matching with formal probabilistic Okapi BM25 ranking:
 *   score(D, Q) = sum_{q in Q} IDF(q) * [ (f(q, D) * (k1 + 1)) / (f(q, D) + k1 * (1 - b + b * |D| / avgdl)) ]
 * Hyperparameters: k1 = 1.5 (term saturation), b = 0.75 (document length normalization).
 */

const BM25_K1 = 1.5;
const BM25_B = 0.75;

const STOP_WORDS = new Set([
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
    "they", "them", "is", "am", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "shall", "should", "can", "could", "may", "might", "must",
    "a", "an", "the", "and", "but", "or", "nor", "not", "so",
    "if", "then", "than", "too", "very", "just", "also",
    "of", "in", "on", "at", "to", "for", "with", "from", "by",
    "about", "into", "through", "during", "before", "after",
    "this", "that", "these", "those", "here", "there", "where",
    "when", "how", "what", "which", "who", "whom", "why",
    "all", "each", "every", "some", "any", "no", "own",
    "up", "down", "out", "off", "over", "under", "again",
    "get", "got", "go", "going", "want", "need", "please", "help",
    "tell", "know", "think", "feel", "like", "much", "many"
]);

/**
 * Normalize & stem-lite tokenize text into alphanumeric terms
 */
function tokenize(text = "") {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
        .map((w) => (w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

// Precompute document token frequencies, lengths, avgdl, and Robertson-Sparck Jones IDF weights at startup
const N = knowledgeBase.length;
const docIndex = knowledgeBase.map((entry) => {
    // Field-boosted corpus representation: question (2x), keywords (3x), content (1x)
    const tokens = [
        ...tokenize(entry.question),
        ...tokenize(entry.question),
        ...entry.keywords.flatMap((k) => tokenize(k)),
        ...entry.keywords.flatMap((k) => tokenize(k)),
        ...entry.keywords.flatMap((k) => tokenize(k)),
        ...tokenize(entry.content)
    ];

    const termFreq = {};
    for (const t of tokens) {
        termFreq[t] = (termFreq[t] || 0) + 1;
    }

    return {
        entry,
        tokens,
        docLen: tokens.length,
        termFreq
    };
});

const avgDocLen = docIndex.reduce((sum, d) => sum + d.docLen, 0) / (N || 1);
const docFreq = {};

for (const doc of docIndex) {
    for (const term of Object.keys(doc.termFreq)) {
        docFreq[term] = (docFreq[term] || 0) + 1;
    }
}

const computeIDF = (term) => {
    const df = docFreq[term] || 0;
    return Math.log(1 + (N - df + 0.5) / (df + 0.5));
};

/**
 * Retrieve the top-K most relevant knowledge base entries using Okapi BM25 ranking.
 * @param {string} query - User's natural language question
 * @param {number} topK - Number of passages to return (default 3)
 * @returns {Array} Ranked KB entries with BM25 relevance scores
 */
function retrieveContext(query, topK = 3) {
    const queryTokens = tokenize(query);
    const queryLower = String(query || "").toLowerCase();

    if (queryTokens.length === 0) {
        return [];
    }

    const uniqueQueryTerms = Array.from(new Set(queryTokens));

    const scored = docIndex.map(({ entry, docLen, termFreq }) => {
        let bm25Score = 0;

        for (const qTerm of uniqueQueryTerms) {
            // Exact stemmed term frequency + prefix match credit
            let tf = termFreq[qTerm] || 0;
            if (tf === 0) {
                for (const [dTerm, count] of Object.entries(termFreq)) {
                    if (dTerm.length >= 4 && qTerm.length >= 4 && (dTerm.startsWith(qTerm) || qTerm.startsWith(dTerm))) {
                        tf += count * 0.5;
                    }
                }
            }

            if (tf > 0) {
                const idf = computeIDF(qTerm);
                const numerator = tf * (BM25_K1 + 1);
                const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLen));
                bm25Score += idf * (numerator / denominator);
            }
        }

        // Exact phrase bonus
        if (
            queryLower.length >= 5 &&
            (entry.question.toLowerCase().includes(queryLower) || entry.content.toLowerCase().includes(queryLower))
        ) {
            bm25Score += 2.5;
        }

        return { ...entry, score: bm25Score };
    });

    return scored
        .filter((e) => e.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

export { retrieveContext, tokenize };
