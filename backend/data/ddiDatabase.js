/**
 * Drug-Drug Interaction (DDI) Database
 * =====================================
 * A curated clinical knowledge base of known drug-drug interactions,
 * sourced from pharmacological references (WHO Essential Medicines List,
 * British National Formulary, NIH DailyMed).
 * 
 * Severity Levels:
 *   - SEVERE:    Contraindicated; combination should be avoided
 *   - MODERATE:  Use with caution; monitoring required
 *   - MILD:      Minor interaction; usually clinically insignificant
 * 
 * Evidence Levels:
 *   - ESTABLISHED:  Well-documented in clinical trials
 *   - PROBABLE:     Supported by case reports and pharmacological reasoning
 *   - THEORETICAL:  Based on mechanism of action
 */

import { getTextModel } from '../config/gemini.js';

// Common brand names, synonyms, and frequent clinical misspellings -> canonical generic name
const brandAndSynonymMap = {
    // Aspirin & Salicylates
    'aspirine': 'aspirin',
    'asprin': 'aspirin',
    'disprin': 'aspirin',
    'ecosprin': 'aspirin',
    'acetylsalicylic acid': 'aspirin',
    'asa': 'aspirin',
    // Paracetamol / Acetaminophen
    'paracetomol': 'paracetamol',
    'paracetemol': 'paracetamol',
    'acetaminophen': 'paracetamol',
    'tylenol': 'paracetamol',
    'dolo': 'paracetamol',
    'dolo 650': 'paracetamol',
    'calpol': 'paracetamol',
    'crocin': 'paracetamol',
    'panadol': 'paracetamol',
    // Ibuprofen & NSAIDs
    'ibuprophen': 'ibuprofen',
    'brufen': 'ibuprofen',
    'advil': 'ibuprofen',
    'motrin': 'ibuprofen',
    'combiflam': 'ibuprofen',
    'voveran': 'diclofenac',
    'voltaren': 'diclofenac',
    'aleve': 'naproxen',
    'naprosyn': 'naproxen',
    'meftal': 'mefenamic acid',
    'ponstan': 'mefenamic acid',
    'zerodol': 'aceclofenac',
    'celebrex': 'celecoxib',
    'toradol': 'ketorolac',
    // Antibiotics
    'amoxycillin': 'amoxicillin',
    'amoxicilin': 'amoxicillin',
    'amoxil': 'amoxicillin',
    'augmentin': 'amoxicillin',
    'mox': 'amoxicillin',
    'clavulanate': 'amoxicillin',
    'penicilin': 'penicillin',
    'azithromicin': 'azithromycin',
    'zithromax': 'azithromycin',
    'azee': 'azithromycin',
    'azithral': 'azithromycin',
    'cipro': 'ciprofloxacin',
    'cifran': 'ciprofloxacin',
    'ciplox': 'ciprofloxacin',
    'levaquin': 'levofloxacin',
    'flagyl': 'metronidazole',
    'metrogyl': 'metronidazole',
    'bactrim': 'cotrimoxazole',
    'septran': 'cotrimoxazole',
    'septrin': 'cotrimoxazole',
    'sulpha': 'sulfa',
    'sulfonamide': 'sulfa',
    // Cardiovascular & Anticoagulants
    'coumadin': 'warfarin',
    'warfarine': 'warfarin',
    'plavix': 'clopidogrel',
    'eliquis': 'apixaban',
    'xarelto': 'rivaroxaban',
    'pradaxa': 'dabigatran',
    'lipitor': 'atorvastatin',
    'atorva': 'atorvastatin',
    'crestor': 'rosuvastatin',
    'zocor': 'simvastatin',
    'norvasc': 'amlodipine',
    'amlong': 'amlodipine',
    'stamlo': 'amlodipine',
    'tenormin': 'atenolol',
    'betaloc': 'metoprolol',
    'lopressor': 'metoprolol',
    'inderal': 'propranolol',
    'lasix': 'furosemide',
    'aldactone': 'spironolactone',
    'lanoxin': 'digoxin',
    // Diabetes
    'glucophage': 'metformin',
    'glycomet': 'metformin',
    'amaryl': 'glimepiride',
    'januvia': 'sitagliptin',
    // GI / PPIs
    'omez': 'omeprazole',
    'prilosec': 'omeprazole',
    'pan': 'pantoprazole',
    'pan 40': 'pantoprazole',
    'pantocid': 'pantoprazole',
    'protonix': 'pantoprazole',
    'nexium': 'esomeprazole',
    'razo': 'rabeprazole',
    // Allergy / Antihistamines
    'zyrtec': 'cetirizine',
    'cetzine': 'cetirizine',
    'cetrizine': 'cetirizine',
    'allegra': 'fexofenadine',
    'claritin': 'loratadine',
    'benadryl': 'diphenhydramine',
    'atarax': 'hydroxyzine',
    // CNS / Pain
    'ultram': 'tramadol',
    'ultracet': 'tramadol',
    'prozac': 'fluoxetine',
    'zoloft': 'sertraline',
    'lexapro': 'escitalopram',
    'epigard': 'levetiracetam',
    'keppra': 'levetiracetam',
    'tegrital': 'carbamazepine',
    'tegretol': 'carbamazepine',
    'eptoin': 'phenytoin',
    'dilantin': 'phenytoin',
    'wysolone': 'prednisolone',
    'medrol': 'methylprednisolone',
    'decadron': 'dexamethasone',
    'viagra': 'sildenafil',
    'cialis': 'tadalafil'
};

// Levenshtein edit distance for catching typos like "aspirine" <-> "aspirin" or "paracetomol" <-> "paracetamol"
const levenshteinDistance = (a = '', b = '') => {
    const s = a.toLowerCase().trim();
    const t = b.toLowerCase().trim();
    if (s === t) return 0;
    if (!s.length) return t.length;
    if (!t.length) return s.length;

    const matrix = Array.from({ length: s.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= t.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= t.length; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[s.length][t.length];
};

const isFuzzyDrugMatch = (inputA, inputB) => {
    if (!inputA || !inputB) return false;
    const a = inputA.toLowerCase().trim();
    const b = inputB.toLowerCase().trim();
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
    const maxLen = Math.max(a.length, b.length);
    const minLen = Math.min(a.length, b.length);
    if (minLen < 5) return false;
    const dist = levenshteinDistance(a, b);
    return maxLen >= 8 ? dist <= 2 : dist <= 1;
};

// Normalize drug name for matching (including brand/synonym & typo resolution)
const normalizeDrug = (name) => {
    if (!name || typeof name !== 'string') return '';
    const cleaned = name
        .toLowerCase()
        .trim()
        .replace(/\s*\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)/gi, '')   // Remove dosage (e.g., "500mg")
        .replace(/\s*tablet[s]?/gi, '')
        .replace(/\s*capsule[s]?/gi, '')
        .replace(/\s*syrup/gi, '')
        .replace(/\s*injection/gi, '')
        .replace(/\s*drops/gi, '')
        .replace(/[^a-z0-9\s-]/gi, '')
        .trim();

    if (brandAndSynonymMap[cleaned]) {
        return brandAndSynonymMap[cleaned];
    }

    // Check if any known brand or generic drug is a close typo match
    const allKnownKeys = [
        ...Object.keys(brandAndSynonymMap),
        ...Object.keys(drugClassMap || {}),
        ...Object.keys(allergyCrossReactivity || {})
    ];
    for (const key of allKnownKeys) {
        if (isFuzzyDrugMatch(cleaned, key)) {
            return brandAndSynonymMap[key] || key;
        }
    }

    return cleaned;
};

// Drug class mapping (drug → class)
const drugClassMap = {
    // Analgesics / Antipyretics
    'paracetamol': 'ANALGESIC_ANTIPYRETIC',
    // NSAIDs
    'aspirin': 'NSAID',
    'ibuprofen': 'NSAID',
    'diclofenac': 'NSAID',
    'naproxen': 'NSAID',
    'piroxicam': 'NSAID',
    'indomethacin': 'NSAID',
    'mefenamic acid': 'NSAID',
    'celecoxib': 'NSAID',
    'ketorolac': 'NSAID',
    'aceclofenac': 'NSAID',

    // Anticoagulants / Antiplatelets
    'warfarin': 'ANTICOAGULANT',
    'heparin': 'ANTICOAGULANT',
    'enoxaparin': 'ANTICOAGULANT',
    'rivaroxaban': 'ANTICOAGULANT',
    'apixaban': 'ANTICOAGULANT',
    'dabigatran': 'ANTICOAGULANT',
    'clopidogrel': 'ANTIPLATELET',

    // ACE Inhibitors
    'enalapril': 'ACE_INHIBITOR',
    'ramipril': 'ACE_INHIBITOR',
    'lisinopril': 'ACE_INHIBITOR',
    'captopril': 'ACE_INHIBITOR',
    'perindopril': 'ACE_INHIBITOR',

    // ARBs
    'losartan': 'ARB',
    'telmisartan': 'ARB',
    'valsartan': 'ARB',
    'olmesartan': 'ARB',
    'irbesartan': 'ARB',

    // Beta Blockers
    'atenolol': 'BETA_BLOCKER',
    'metoprolol': 'BETA_BLOCKER',
    'propranolol': 'BETA_BLOCKER',
    'carvedilol': 'BETA_BLOCKER',
    'bisoprolol': 'BETA_BLOCKER',
    'nebivolol': 'BETA_BLOCKER',

    // Calcium Channel Blockers
    'amlodipine': 'CCB',
    'nifedipine': 'CCB',
    'diltiazem': 'CCB',
    'verapamil': 'CCB',

    // Statins
    'atorvastatin': 'STATIN',
    'rosuvastatin': 'STATIN',
    'simvastatin': 'STATIN',
    'pravastatin': 'STATIN',
    'lovastatin': 'STATIN',

    // Antibiotics
    'amoxicillin': 'PENICILLIN',
    'ampicillin': 'PENICILLIN',
    'penicillin': 'PENICILLIN',
    'piperacillin': 'PENICILLIN',
    'azithromycin': 'MACROLIDE',
    'erythromycin': 'MACROLIDE',
    'clarithromycin': 'MACROLIDE',
    'ciprofloxacin': 'FLUOROQUINOLONE',
    'levofloxacin': 'FLUOROQUINOLONE',
    'ofloxacin': 'FLUOROQUINOLONE',
    'moxifloxacin': 'FLUOROQUINOLONE',
    'metronidazole': 'NITROIMIDAZOLE',
    'doxycycline': 'TETRACYCLINE',
    'tetracycline': 'TETRACYCLINE',
    'gentamicin': 'AMINOGLYCOSIDE',
    'amikacin': 'AMINOGLYCOSIDE',
    'cotrimoxazole': 'SULFONAMIDE',
    'sulfamethoxazole': 'SULFONAMIDE',
    'trimethoprim': 'SULFONAMIDE',

    // Antidiabetics
    'metformin': 'BIGUANIDE',
    'glimepiride': 'SULFONYLUREA',
    'glipizide': 'SULFONYLUREA',
    'gliclazide': 'SULFONYLUREA',
    'glibenclamide': 'SULFONYLUREA',
    'sitagliptin': 'DPP4_INHIBITOR',
    'insulin': 'INSULIN',
    'pioglitazone': 'THIAZOLIDINEDIONE',

    // Antidepressants / Psychiatric
    'fluoxetine': 'SSRI',
    'sertraline': 'SSRI',
    'paroxetine': 'SSRI',
    'escitalopram': 'SSRI',
    'citalopram': 'SSRI',
    'amitriptyline': 'TCA',
    'imipramine': 'TCA',
    'nortriptyline': 'TCA',
    'venlafaxine': 'SNRI',
    'duloxetine': 'SNRI',

    // MAOIs
    'phenelzine': 'MAOI',
    'tranylcypromine': 'MAOI',
    'selegiline': 'MAOI',
    'isocarboxazid': 'MAOI',

    // Antiepileptics
    'phenytoin': 'ANTIEPILEPTIC',
    'carbamazepine': 'ANTIEPILEPTIC',
    'valproic acid': 'ANTIEPILEPTIC',
    'sodium valproate': 'ANTIEPILEPTIC',
    'lamotrigine': 'ANTIEPILEPTIC',
    'levetiracetam': 'ANTIEPILEPTIC',

    // Diuretics
    'furosemide': 'LOOP_DIURETIC',
    'hydrochlorothiazide': 'THIAZIDE_DIURETIC',
    'spironolactone': 'K_SPARING_DIURETIC',
    'chlorthalidone': 'THIAZIDE_DIURETIC',

    // Corticosteroids
    'prednisolone': 'CORTICOSTEROID',
    'prednisone': 'CORTICOSTEROID',
    'dexamethasone': 'CORTICOSTEROID',
    'hydrocortisone': 'CORTICOSTEROID',
    'methylprednisolone': 'CORTICOSTEROID',

    // Opioids
    'tramadol': 'OPIOID',
    'morphine': 'OPIOID',
    'codeine': 'OPIOID',
    'fentanyl': 'OPIOID',
    'oxycodone': 'OPIOID',

    // Proton Pump Inhibitors
    'omeprazole': 'PPI',
    'pantoprazole': 'PPI',
    'esomeprazole': 'PPI',
    'rabeprazole': 'PPI',
    'lansoprazole': 'PPI',

    // Antifungals
    'fluconazole': 'AZOLE_ANTIFUNGAL',
    'itraconazole': 'AZOLE_ANTIFUNGAL',
    'ketoconazole': 'AZOLE_ANTIFUNGAL',
    'voriconazole': 'AZOLE_ANTIFUNGAL',

    // Antihistamines
    'cetirizine': 'ANTIHISTAMINE',
    'loratadine': 'ANTIHISTAMINE',
    'fexofenadine': 'ANTIHISTAMINE',
    'chlorpheniramine': 'SEDATING_ANTIHISTAMINE',
    'diphenhydramine': 'SEDATING_ANTIHISTAMINE',
    'hydroxyzine': 'SEDATING_ANTIHISTAMINE',

    // Others
    'digoxin': 'CARDIAC_GLYCOSIDE',
    'lithium': 'MOOD_STABILIZER',
    'theophylline': 'METHYLXANTHINE',
    'cyclosporine': 'IMMUNOSUPPRESSANT',
    'tacrolimus': 'IMMUNOSUPPRESSANT',
    'methotrexate': 'ANTIMETABOLITE',
    'allopurinol': 'XANTHINE_OXIDASE_INHIBITOR',
    'sildenafil': 'PDE5_INHIBITOR',
    'tadalafil': 'PDE5_INHIBITOR',
    'potassium chloride': 'POTASSIUM_SUPPLEMENT',
};

// Drug-Drug Interaction Pairs
// Key: "drugA|drugB" (alphabetically sorted), Value: interaction details
const ddiPairs = [
    // ========== SEVERE INTERACTIONS ==========

    // NSAID + Anticoagulant — Bleeding risk
    {
        drugs: ['NSAID', 'ANTICOAGULANT'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs inhibit platelet aggregation and cause GI mucosal damage. Combined with anticoagulants, this dramatically increases the risk of gastrointestinal and intracranial hemorrhage.',
        effect: 'Significantly increased risk of major bleeding events (GI hemorrhage, intracranial bleeding)',
        recommendation: 'AVOID combination. If pain relief is needed, consider Acetaminophen (Paracetamol) instead. If unavoidable, use lowest dose NSAID for shortest duration with PPI cover.',
        references: ['BMJ 2015;350:h1843', 'CHEST Guidelines 2012']
    },

    // Warfarin + Aspirin
    {
        drugs: ['warfarin', 'aspirin'],
        type: 'specific',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Aspirin irreversibly inhibits COX-1 in platelets. Combined with warfarin\'s inhibition of vitamin K-dependent clotting factors, the anticoagulant effect is synergistically amplified.',
        effect: 'High risk of major hemorrhagic events. INR may become dangerously elevated.',
        recommendation: 'Contraindicated unless specifically indicated (e.g., mechanical heart valve). Requires close INR monitoring if used together.',
        references: ['AHA/ACC Guidelines', 'FDA MedWatch Alert']
    },

    // MAOI + SSRI — Serotonin Syndrome
    {
        drugs: ['MAOI', 'SSRI'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'MAOIs prevent serotonin breakdown while SSRIs block serotonin reuptake. The dual mechanism causes dangerous accumulation of serotonin in synaptic clefts.',
        effect: 'SEROTONIN SYNDROME — potentially fatal. Symptoms include hyperthermia, rigidity, myoclonus, autonomic instability, altered mental status.',
        recommendation: 'ABSOLUTELY CONTRAINDICATED. Minimum 14-day washout period required between stopping MAOI and starting SSRI (5 weeks for fluoxetine due to long half-life).',
        references: ['FDA Black Box Warning', 'Lancet 2005;365:1193']
    },

    // MAOI + TCA
    {
        drugs: ['MAOI', 'TCA'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'TCAs inhibit norepinephrine and serotonin reuptake. Combined with MAO inhibition, this leads to excessive catecholamine and serotonin accumulation.',
        effect: 'Hypertensive crisis, serotonin syndrome, seizures, hyperthermia. Can be fatal.',
        recommendation: 'CONTRAINDICATED. Allow adequate washout period (minimum 14 days) between agents.',
        references: ['Goodman & Gilman\'s Pharmacology']
    },

    // MAOI + OPIOID (Tramadol, Meperidine)
    {
        drugs: ['MAOI', 'OPIOID'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Tramadol and meperidine inhibit serotonin reuptake. Combined with MAOIs, serotonin toxicity develops rapidly.',
        effect: 'Serotonin syndrome, seizures, respiratory depression, coma.',
        recommendation: 'CONTRAINDICATED. Use alternative analgesics that do not affect serotonin.',
        references: ['FDA Drug Safety Communication']
    },

    // SSRI + Tramadol — Serotonin Syndrome
    {
        drugs: ['SSRI', 'tramadol'],
        type: 'mixed',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Both tramadol and SSRIs increase serotonin levels through different mechanisms (reuptake inhibition). Combined effect can precipitate serotonin toxicity.',
        effect: 'Risk of serotonin syndrome: agitation, tremor, diarrhea, tachycardia, hyperthermia.',
        recommendation: 'Avoid if possible. If necessary, use lowest effective doses and monitor closely for serotonin syndrome symptoms. Educate patient on warning signs.',
        references: ['Ann Pharmacother. 2006;40:2066-2069']
    },

    // ACE Inhibitor + K-sparing Diuretic — Hyperkalemia
    {
        drugs: ['ACE_INHIBITOR', 'K_SPARING_DIURETIC'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'ACE inhibitors reduce aldosterone secretion, decreasing potassium excretion. K-sparing diuretics directly retain potassium. Dual mechanism causes dangerous hyperkalemia.',
        effect: 'Life-threatening hyperkalemia — cardiac arrhythmias, cardiac arrest.',
        recommendation: 'If combination is necessary, monitor serum potassium frequently (within 1 week, then monthly). Avoid potassium supplements. Consider alternative diuretic.',
        references: ['NICE Guidelines CG127', 'NEJM 2004;351:543']
    },

    // ACE Inhibitor + ARB — Dual RAAS blockade
    {
        drugs: ['ACE_INHIBITOR', 'ARB'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Dual blockade of the renin-angiotensin-aldosterone system provides no additional benefit but significantly increases risk of hyperkalemia, hypotension, and renal failure.',
        effect: 'Hyperkalemia, acute kidney injury, symptomatic hypotension.',
        recommendation: 'CONTRAINDICATED (ONTARGET trial). Use one agent only. Switch classes if needed, do not combine.',
        references: ['ONTARGET Trial, NEJM 2008;358:1547']
    },

    // Methotrexate + NSAIDs
    {
        drugs: ['methotrexate', 'NSAID'],
        type: 'mixed',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs reduce renal clearance of methotrexate by inhibiting renal prostaglandins. This leads to methotrexate accumulation and toxicity.',
        effect: 'Methotrexate toxicity: pancytopenia, mucositis, hepatotoxicity, potentially fatal bone marrow suppression.',
        recommendation: 'Avoid NSAIDs in patients on high-dose methotrexate. Low-dose methotrexate + NSAID may be acceptable with close monitoring of blood counts and renal function.',
        references: ['Arthritis Rheum. 2002;46:1441']
    },

    // Simvastatin/Lovastatin + Azole Antifungals
    {
        drugs: ['STATIN', 'AZOLE_ANTIFUNGAL'],
        type: 'class',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Azole antifungals are potent CYP3A4 inhibitors. Simvastatin/Lovastatin are extensively metabolized by CYP3A4. Inhibition leads to dramatically elevated statin plasma levels.',
        effect: 'Rhabdomyolysis — severe muscle breakdown, acute kidney injury from myoglobin release.',
        recommendation: 'CONTRAINDICATED with simvastatin/lovastatin. Use pravastatin or rosuvastatin (not CYP3A4 dependent) if statin is essential during antifungal therapy.',
        references: ['FDA Drug Safety Communication 2012']
    },

    // Sildenafil + Nitrates
    {
        drugs: ['PDE5_INHIBITOR', 'nitrate'],
        type: 'mixed',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Both PDE5 inhibitors and nitrates increase cyclic GMP levels in vascular smooth muscle. Combined effect causes profound vasodilation.',
        effect: 'Severe, potentially fatal hypotension. Cardiovascular collapse.',
        recommendation: 'ABSOLUTELY CONTRAINDICATED. Do not administer within 24-48 hours of each other.',
        references: ['ACC/AHA Guidelines', 'FDA Black Box Warning']
    },

    // Digoxin + Amiodarone
    {
        drugs: ['digoxin', 'amiodarone'],
        type: 'specific',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'Amiodarone inhibits P-glycoprotein and renal clearance of digoxin, approximately doubling serum digoxin concentrations.',
        effect: 'Digoxin toxicity: nausea, vomiting, visual disturbances, fatal cardiac arrhythmias.',
        recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor digoxin levels closely.',
        references: ['Circulation 1988;78:1199']
    },

    // Lithium + NSAIDs
    {
        drugs: ['lithium', 'NSAID'],
        type: 'mixed',
        severity: 'SEVERE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs reduce renal prostaglandin synthesis, decreasing renal blood flow and lithium clearance. Serum lithium levels can rise by 15-53%.',
        effect: 'Lithium toxicity: tremor, ataxia, renal failure, seizures, coma.',
        recommendation: 'Avoid NSAIDs if possible. If necessary, use sulindac (least effect) and monitor lithium levels within 5 days of starting NSAID.',
        references: ['J Clin Psychiatry 2004;65:1468']
    },

    // ========== MODERATE INTERACTIONS ==========

    // NSAID + ACE Inhibitor — Reduced antihypertensive effect
    {
        drugs: ['NSAID', 'ACE_INHIBITOR'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs inhibit prostaglandin synthesis, which reduces the vasodilatory and natriuretic effects of ACE inhibitors. Also increases risk of acute kidney injury.',
        effect: 'Reduced antihypertensive efficacy (BP increase ~5-8 mmHg). Increased risk of acute kidney injury, especially in dehydrated patients.',
        recommendation: 'Monitor blood pressure and renal function. Use lowest NSAID dose for shortest duration. Consider paracetamol as alternative analgesic.',
        references: ['Hypertension 2005;46:498']
    },

    // NSAID + Beta Blocker
    {
        drugs: ['NSAID', 'BETA_BLOCKER'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs inhibit renal prostaglandin synthesis, counteracting the antihypertensive mechanism of beta-blockers.',
        effect: 'Reduced antihypertensive effect. Blood pressure may increase.',
        recommendation: 'Monitor blood pressure. Use paracetamol for pain relief when possible.',
        references: ['BMJ 1994;308:227']
    },

    // Macrolide + Statin — CYP3A4 inhibition
    {
        drugs: ['MACROLIDE', 'STATIN'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Erythromycin and clarithromycin inhibit CYP3A4, increasing plasma levels of CYP3A4-metabolized statins (simvastatin, atorvastatin, lovastatin).',
        effect: 'Increased risk of myopathy and rhabdomyolysis.',
        recommendation: 'Temporarily withhold statin during short-course macrolide therapy. Or use azithromycin (minimal CYP3A4 inhibition) instead.',
        references: ['Clin Pharmacol Ther 2011;90:160']
    },

    // Fluoroquinolone + Corticosteroid — Tendon rupture
    {
        drugs: ['FLUOROQUINOLONE', 'CORTICOSTEROID'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Both fluoroquinolones and corticosteroids independently weaken tendon structure. The combination has a synergistic effect on collagen degradation.',
        effect: 'Significantly increased risk of tendon rupture, particularly Achilles tendon. Risk highest in patients >60 years.',
        recommendation: 'Avoid combination if possible, especially in elderly patients. If unavoidable, counsel patient about tendon pain and advise immediate cessation if symptoms develop.',
        references: ['FDA Black Box Warning 2016', 'BMJ 2002;324:1306']
    },

    // Metformin + Contrast Dye (conceptual — for report analysis)
    {
        drugs: ['metformin', 'iodinated contrast'],
        type: 'specific',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Contrast media may cause transient renal impairment, leading to metformin accumulation and subsequent lactic acidosis.',
        effect: 'Risk of lactic acidosis in patients with renal insufficiency.',
        recommendation: 'Withhold metformin for 48 hours after contrast administration. Check renal function before restarting.',
        references: ['ACR Manual on Contrast Media 2021']
    },

    // Warfarin + Macrolide antibiotics
    {
        drugs: ['warfarin', 'MACROLIDE'],
        type: 'mixed',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Macrolides inhibit CYP3A4 and reduce vitamin K-producing gut flora, both of which enhance warfarin\'s anticoagulant effect.',
        effect: 'Elevated INR with increased bleeding risk.',
        recommendation: 'Monitor INR within 3-5 days of starting macrolide. Consider azithromycin (lower interaction risk). May need to reduce warfarin dose.',
        references: ['Ann Pharmacother 2000;34:1164']
    },

    // Warfarin + Fluoroquinolones
    {
        drugs: ['warfarin', 'FLUOROQUINOLONE'],
        type: 'mixed',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Fluoroquinolones displace warfarin from protein binding and inhibit CYP1A2-mediated metabolism of R-warfarin.',
        effect: 'Elevated INR and increased bleeding risk.',
        recommendation: 'Monitor INR closely. Consider dose adjustment of warfarin during fluoroquinolone course.',
        references: ['Antimicrob Agents Chemother 1996;40:1384']
    },

    // SSRI + NSAID — GI Bleeding
    {
        drugs: ['SSRI', 'NSAID'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'SSRIs deplete platelet serotonin stores, impairing platelet aggregation. NSAIDs damage GI mucosa and inhibit COX-1-mediated thromboxane synthesis.',
        effect: 'Approximately 6-fold increase in upper GI bleeding risk compared to either agent alone.',
        recommendation: 'Prescribe PPI prophylaxis if combination is necessary. Consider alternative analgesic (paracetamol).',
        references: ['BMJ 2015;351:h3517']
    },

    // Digoxin + Loop Diuretic — Hypokalemia
    {
        drugs: ['digoxin', 'LOOP_DIURETIC'],
        type: 'mixed',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Loop diuretics cause potassium and magnesium depletion. Hypokalemia increases myocardial sensitivity to digoxin, predisposing to arrhythmias.',
        effect: 'Digoxin toxicity even at therapeutic serum levels. Cardiac arrhythmias.',
        recommendation: 'Monitor serum potassium and magnesium. Supplement potassium if K+ < 4.0 mEq/L. Consider adding potassium-sparing diuretic.',
        references: ['Heart 2003;89:905']
    },

    // Sulfonylurea + Fluoroquinolone — Hypoglycemia
    {
        drugs: ['SULFONYLUREA', 'FLUOROQUINOLONE'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Fluoroquinolones (especially gatifloxacin) stimulate insulin secretion from pancreatic beta cells, potentiating the hypoglycemic effect of sulfonylureas.',
        effect: 'Severe hypoglycemia — confusion, seizures, loss of consciousness.',
        recommendation: 'Monitor blood glucose closely during fluoroquinolone therapy. May need to reduce sulfonylurea dose.',
        references: ['Diabetes Care 2005;28:194']
    },

    // Carbamazepine + Oral Contraceptives
    {
        drugs: ['carbamazepine', 'oral contraceptive'],
        type: 'specific',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Carbamazepine is a potent CYP3A4 inducer, increasing metabolism of ethinyl estradiol and progestins, reducing contraceptive efficacy.',
        effect: 'Contraceptive failure — unintended pregnancy.',
        recommendation: 'Use non-hormonal contraception or IUD. If OCP is preferred, use preparation with ≥50 mcg ethinyl estradiol.',
        references: ['WHO Medical Eligibility Criteria']
    },

    // Phenytoin + Valproic Acid
    {
        drugs: ['phenytoin', 'valproic acid'],
        type: 'specific',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Valproic acid displaces phenytoin from albumin binding and inhibits its metabolism. Phenytoin induces valproate metabolism, reducing its levels.',
        effect: 'Unpredictable changes in both drug levels. Risk of phenytoin toxicity or valproate treatment failure.',
        recommendation: 'Monitor free phenytoin levels (not total). Monitor valproate levels. Adjust doses based on clinical response and levels.',
        references: ['Epilepsia 2002;43:365']
    },

    // Cyclosporine + NSAIDs
    {
        drugs: ['IMMUNOSUPPRESSANT', 'NSAID'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'NSAIDs reduce renal prostaglandin synthesis, exacerbating cyclosporine-induced renal vasoconstriction. Both agents are nephrotoxic.',
        effect: 'Increased nephrotoxicity. Elevated serum creatinine. Risk of acute kidney injury.',
        recommendation: 'Avoid NSAIDs if possible. Use paracetamol for analgesia. If NSAID is essential, monitor renal function closely.',
        references: ['Transplant Proc 1994;26:2598']
    },

    // Theophylline + Fluoroquinolones
    {
        drugs: ['theophylline', 'FLUOROQUINOLONE'],
        type: 'mixed',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Ciprofloxacin inhibits CYP1A2, the primary enzyme metabolizing theophylline. This can increase theophylline levels by 15-50%.',
        effect: 'Theophylline toxicity: tachycardia, seizures, nausea, arrhythmias.',
        recommendation: 'Monitor theophylline levels. Reduce theophylline dose by 25-50% when starting ciprofloxacin. Levofloxacin has less interaction.',
        references: ['Clin Pharmacokinet 1999;37:377']
    },

    // PPI + Clopidogrel
    {
        drugs: ['PPI', 'clopidogrel'],
        type: 'mixed',
        severity: 'MODERATE',
        evidence: 'PROBABLE',
        mechanism: 'Omeprazole and esomeprazole inhibit CYP2C19, reducing conversion of clopidogrel prodrug to its active metabolite.',
        effect: 'Reduced antiplatelet effect of clopidogrel. Potential increase in cardiovascular events.',
        recommendation: 'Use pantoprazole (minimal CYP2C19 interaction) if PPI is needed with clopidogrel. Avoid omeprazole and esomeprazole.',
        references: ['FDA Drug Safety Communication 2010', 'COGENT Trial']
    },

    // ========== MILD INTERACTIONS ==========

    // PPI + Iron supplements
    {
        drugs: ['PPI', 'iron'],
        type: 'mixed',
        severity: 'MILD',
        evidence: 'ESTABLISHED',
        mechanism: 'PPIs increase gastric pH, reducing the absorption of non-heme iron which requires acidic environment for optimal absorption.',
        effect: 'Reduced iron absorption. May worsen iron deficiency anemia over long-term use.',
        recommendation: 'Take iron supplement 2 hours before PPI. Consider IV iron if oral supplementation is inadequate.',
        references: ['Aliment Pharmacol Ther 2014;39:1309']
    },

    // Calcium + Fluoroquinolone — Chelation
    {
        drugs: ['calcium', 'FLUOROQUINOLONE'],
        type: 'mixed',
        severity: 'MILD',
        evidence: 'ESTABLISHED',
        mechanism: 'Calcium forms insoluble chelation complexes with fluoroquinolones in the GI tract, dramatically reducing antibiotic absorption.',
        effect: 'Reduced fluoroquinolone bioavailability (up to 90% reduction). Treatment failure.',
        recommendation: 'Separate administration by at least 2-4 hours. Take fluoroquinolone 2 hours before or 6 hours after calcium.',
        references: ['Antimicrob Agents Chemother 1992;36:489']
    },

    // Tetracycline + Antacids/Calcium/Iron
    {
        drugs: ['TETRACYCLINE', 'calcium'],
        type: 'mixed',
        severity: 'MILD',
        evidence: 'ESTABLISHED',
        mechanism: 'Divalent and trivalent cations (Ca2+, Mg2+, Al3+, Fe2+) form insoluble chelation complexes with tetracyclines.',
        effect: 'Dramatically reduced tetracycline absorption. Antibiotic treatment failure.',
        recommendation: 'Separate doses by at least 2-3 hours. Take tetracycline on empty stomach.',
        references: ['J Antimicrob Chemother 1975;1:407']
    },

    // Antacid + Multiple Drugs
    {
        drugs: ['antacid', 'FLUOROQUINOLONE'],
        type: 'mixed',
        severity: 'MILD',
        evidence: 'ESTABLISHED',
        mechanism: 'Aluminum and magnesium hydroxide antacids chelate fluoroquinolones and alter gastric pH, reducing absorption.',
        effect: 'Reduced antibiotic absorption and efficacy.',
        recommendation: 'Take fluoroquinolone at least 2 hours before or 6 hours after antacid.',
        references: ['Clin Pharmacokinet 1993;24:91']
    },

    // Grapefruit + Statins (conceptual for patient education)
    {
        drugs: ['grapefruit', 'STATIN'],
        type: 'mixed',
        severity: 'MILD',
        evidence: 'ESTABLISHED',
        mechanism: 'Grapefruit juice contains furanocoumarins that irreversibly inhibit intestinal CYP3A4, increasing bioavailability of CYP3A4-metabolized statins.',
        effect: 'Increased statin levels. Mild increased risk of myopathy with regular large consumption.',
        recommendation: 'Avoid large quantities of grapefruit juice with simvastatin/lovastatin/atorvastatin. Pravastatin and rosuvastatin are not affected.',
        references: ['Am J Med 2016;129:26']
    },

    // Beta Blocker + Insulin/Sulfonylurea
    {
        drugs: ['BETA_BLOCKER', 'INSULIN'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Beta-blockers mask the tachycardia and tremor of hypoglycemia (sympathetic warning signs). Non-selective beta-blockers may also impair glycogenolysis.',
        effect: 'Masked hypoglycemic symptoms. Prolonged hypoglycemic episodes.',
        recommendation: 'Use cardioselective beta-blockers (atenolol, metoprolol, bisoprolol) in diabetic patients. Educate patient to recognize non-adrenergic hypoglycemic symptoms (sweating persists).',
        references: ['Diabetes Care 2006;29:2662']
    },

    // Beta Blocker + Sulfonylurea
    {
        drugs: ['BETA_BLOCKER', 'SULFONYLUREA'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Non-selective beta-blockers mask hypoglycemic symptoms and may impair glucose counter-regulation.',
        effect: 'Masked hypoglycemia. Prolonged and potentially severe hypoglycemic episodes.',
        recommendation: 'Prefer cardioselective beta-blockers. Monitor blood glucose more frequently.',
        references: ['Diabetes Care 2006;29:2662']
    },

    // Corticosteroid + NSAID — GI Ulceration
    {
        drugs: ['CORTICOSTEROID', 'NSAID'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Both agents independently damage gastric mucosal defense. Corticosteroids impair mucosal healing while NSAIDs inhibit protective prostaglandin synthesis.',
        effect: '4-15 fold increased risk of GI ulceration and bleeding.',
        recommendation: 'Co-prescribe PPI (e.g., pantoprazole) for gastroprotection. Use lowest effective doses. Monitor for GI symptoms.',
        references: ['Gut 2003;52:600']
    },

    // Potassium Supplement + ACE Inhibitor
    {
        drugs: ['POTASSIUM_SUPPLEMENT', 'ACE_INHIBITOR'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'ACE inhibitors reduce aldosterone, decreasing renal potassium excretion. Additional potassium supplementation can cause dangerous hyperkalemia.',
        effect: 'Hyperkalemia — cardiac arrhythmias, muscle weakness, cardiac arrest.',
        recommendation: 'Avoid routine potassium supplements with ACE inhibitors. Monitor serum potassium. Only supplement if documented hypokalemia.',
        references: ['NICE CG127']
    },

    // Aminoglycoside + Loop Diuretic — Ototoxicity
    {
        drugs: ['AMINOGLYCOSIDE', 'LOOP_DIURETIC'],
        type: 'class',
        severity: 'MODERATE',
        evidence: 'ESTABLISHED',
        mechanism: 'Both aminoglycosides and loop diuretics are independently ototoxic. Combined use has synergistic ototoxic and nephrotoxic effects.',
        effect: 'Irreversible hearing loss. Increased nephrotoxicity.',
        recommendation: 'Avoid combination when possible. Monitor hearing and renal function. Use alternative diuretic or antibiotic if feasible.',
        references: ['Drug Saf 1995;12:245']
    },
];

// Allergy cross-reactivity database
const allergyCrossReactivity = {
    'penicillin': {
        crossReactsWith: ['amoxicillin', 'ampicillin', 'piperacillin', 'penicillin', 'flucloxacillin', 'co-amoxiclav'],
        crossReactivityRate: '5-10%',
        severity: 'SEVERE',
        effect: 'Anaphylaxis, urticaria, angioedema, serum sickness. Cross-reactivity due to shared beta-lactam ring structure.',
        recommendation: 'AVOID all penicillin-class antibiotics. Consider azithromycin, fluoroquinolones, or doxycycline as alternatives. Cephalosporins carry 1-2% cross-reactivity risk — use with caution.',
        relatedClass: 'PENICILLIN'
    },
    'cephalosporin': {
        crossReactsWith: ['cephalexin', 'cefuroxime', 'ceftriaxone', 'cefixime', 'cefpodoxime'],
        crossReactivityRate: '1-3%',
        severity: 'SEVERE',
        effect: 'Anaphylactic reactions possible. Lower cross-reactivity with penicillins than historically believed.',
        recommendation: 'Avoid cephalosporins in patients with severe penicillin allergy (anaphylaxis). Third-generation cephalosporins have lower cross-reactivity.',
        relatedClass: 'CEPHALOSPORIN'
    },
    'sulfa': {
        crossReactsWith: ['sulfamethoxazole', 'cotrimoxazole', 'trimethoprim-sulfamethoxazole', 'sulfasalazine', 'sulfadiazine'],
        crossReactivityRate: '2-5%',
        severity: 'MODERATE',
        effect: 'Rash, Stevens-Johnson syndrome (rare), drug fever. Cross-reactivity between sulfonamide antibiotics is well established.',
        recommendation: 'Avoid all sulfonamide antibiotics. Note: Non-antibiotic sulfonamides (furosemide, thiazides, celecoxib) have very low cross-reactivity risk.',
        relatedClass: 'SULFONAMIDE'
    },
    'aspirin': {
        crossReactsWith: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'piroxicam', 'ketorolac', 'mefenamic acid', 'indomethacin', 'aceclofenac'],
        crossReactivityRate: '20-40% (100% for direct aspirin/salicylate exposure)',
        severity: 'SEVERE',
        effect: 'Severe hypersensitivity, bronchospasm (AERD), angioedema, urticaria, or anaphylaxis upon exposure to aspirin or cross-reacting COX-1 NSAIDs.',
        recommendation: 'CONTRAINDICATED: Do NOT administer aspirin or COX-1 inhibiting NSAIDs. Paracetamol in standard doses is generally safe unless also listed as an allergen.',
        relatedClass: 'NSAID'
    },
    'nsaid': {
        crossReactsWith: ['aspirin', 'ibuprofen', 'naproxen', 'diclofenac', 'piroxicam', 'ketorolac', 'mefenamic acid', 'indomethacin', 'aceclofenac', 'celecoxib'],
        crossReactivityRate: '25-40%',
        severity: 'SEVERE',
        effect: 'NSAID hypersensitivity reaction: bronchospasm, angioedema, urticaria, or anaphylaxis.',
        recommendation: 'Avoid all NSAIDs and aspirin. Consider Paracetamol (Acetaminophen) if tolerated.',
        relatedClass: 'NSAID'
    },
    'paracetamol': {
        crossReactsWith: ['paracetamol', 'acetaminophen'],
        crossReactivityRate: '100% (same active ingredient)',
        severity: 'SEVERE',
        effect: 'Hypersensitivity reaction: skin rash, angioedema, fixed drug eruption, or bronchospasm.',
        recommendation: 'CONTRAINDICATED: Avoid all paracetamol/acetaminophen-containing preparations (including cold/flu combination tablets).',
        relatedClass: 'ANALGESIC_ANTIPYRETIC'
    },
    'iodine': {
        crossReactsWith: ['iodinated contrast', 'povidone-iodine', 'amiodarone'],
        crossReactivityRate: 'Variable',
        severity: 'MODERATE',
        effect: 'Contrast reactions: urticaria, bronchospasm, anaphylactoid reaction. Note: "iodine allergy" is a misnomer — it is the contrast molecule, not iodine itself.',
        recommendation: 'Premedicate with corticosteroids and antihistamines before contrast. Use non-ionic low-osmolar contrast agents.',
        relatedClass: 'IODINE'
    },
    'latex': {
        crossReactsWith: ['banana', 'avocado', 'kiwi', 'chestnut'],
        crossReactivityRate: '30-50%',
        severity: 'MILD',
        effect: 'Latex-fruit syndrome: oral allergy syndrome, urticaria, rarely anaphylaxis.',
        recommendation: 'Document cross-reactivity. Use latex-free gloves in clinical settings.',
        relatedClass: 'LATEX'
    },
    'codeine': {
        crossReactsWith: ['morphine', 'codeine', 'tramadol', 'oxycodone', 'hydrocodone'],
        crossReactivityRate: '15-20%',
        severity: 'MODERATE',
        effect: 'Histamine release: pruritus, urticaria, nausea. True allergy is rare — most reactions are pseudoallergic.',
        recommendation: 'Document the specific reaction. Fentanyl and buprenorphine have lower histamine-releasing potential. Consider non-opioid alternatives.',
        relatedClass: 'OPIOID'
    }
};

// Pre-computed O(1) Pharmacological Interaction Hash Table (built once at module startup)
// Keys are canonical sorted pairs "tokenA|tokenB" where tokens are normalized generic names or UPPERCASE drug classes.
const ddiPairHashMap = new Map();
for (const ddi of ddiPairs) {
    if (Array.isArray(ddi.drugs) && ddi.drugs.length === 2) {
        const key = [...ddi.drugs].sort().join('|');
        const bucket = ddiPairHashMap.get(key) || [];
        bucket.push(ddi);
        ddiPairHashMap.set(key, bucket);
    }
}

/**
 * Main DDI Check Engine (O(1) Hash Lookup + Wagner-Fischer Levenshtein + Brand Alias Resolution)
 * @param {Array} prescribedMedicines - [{name, dosage, frequency, duration}]
 * @param {Array} currentMedications - [{name, dosage}] (patient's existing meds)
 * @param {Array} patientAllergies - ["penicillin", "sulfa", "aspirin", ...]
 * @returns {Object} { interactions: [], allergyAlerts: [], overallRisk: "SAFE|MILD|MODERATE|SEVERE", layer1LatencyMs }
 */
const checkDrugInteractions = (prescribedMedicines = [], currentMedications = [], patientAllergies = []) => {
    const startHr = performance.now();
    const interactions = [];
    const allergyAlerts = [];

    const validPrescribed = (prescribedMedicines || []).filter(m => m && m.name && String(m.name).trim());
    const validCurrent = (currentMedications || []).filter(m => m && (m.name || typeof m === 'string'));

    const normalizedCurrentList = validCurrent.map(m => {
        const rawName = typeof m === 'string' ? m : m.name;
        return { raw: rawName, norm: normalizeDrug(rawName) };
    });

    const normalizedPrescribedList = validPrescribed.map(m => ({
        raw: m.name,
        norm: normalizeDrug(m.name)
    }));

    // Combine all medicines (newly prescribed + current)
    const allDrugNames = [
        ...normalizedPrescribedList.map(m => m.norm),
        ...normalizedCurrentList.map(m => m.norm)
    ].filter(Boolean);

    const newDrugNames = normalizedPrescribedList.map(m => m.norm).filter(Boolean);

    // Get classes for all drugs
    const getDrugClass = (name) => drugClassMap[name] || null;

    // 1. Check Drug-Drug Interactions via O(1) Hash-Table Pair Lookup
    for (let i = 0; i < allDrugNames.length; i++) {
        for (let j = i + 1; j < allDrugNames.length; j++) {
            const drugA = allDrugNames[i];
            const drugB = allDrugNames[j];
            if (drugA === drugB) continue;

            const classA = getDrugClass(drugA);
            const classB = getDrugClass(drugB);

            const isRelevant = newDrugNames.includes(drugA) || newDrugNames.includes(drugB);
            if (!isRelevant) continue;

            // Candidate O(1) lookup keys: specific-specific, mixed (drug-class / class-drug), class-class
            const candidateKeys = new Set();
            candidateKeys.add([drugA, drugB].sort().join('|'));
            if (classB) candidateKeys.add([drugA, classB].sort().join('|'));
            if (classA) candidateKeys.add([classA, drugB].sort().join('|'));
            if (classA && classB && classA !== classB) {
                candidateKeys.add([classA, classB].sort().join('|'));
            }

            const matchedRules = [];
            for (const key of candidateKeys) {
                const hits = ddiPairHashMap.get(key);
                if (hits) matchedRules.push(...hits);
            }

            for (const ddi of matchedRules) {
                const pairKey = [drugA, drugB].sort().join('|');
                const existingIdx = interactions.findIndex(item => item.pairKey === pairKey);
                // Prefer specific rule over generic class rule if both match (e.g. warfarin+aspirin vs NSAID+ANTICOAGULANT)
                if (existingIdx === -1) {
                    interactions.push({
                        pairKey,
                        ruleType: ddi.type,
                        drugA: normalizedPrescribedList.find(m => m.norm === drugA)?.raw || drugA,
                        drugB: normalizedPrescribedList.find(m => m.norm === drugB)?.raw ||
                               normalizedCurrentList.find(m => m.norm === drugB)?.raw || drugB,
                        isNewVsExisting: !newDrugNames.includes(drugA) || !newDrugNames.includes(drugB),
                        severity: ddi.severity,
                        evidence: ddi.evidence,
                        mechanism: ddi.mechanism,
                        effect: ddi.effect,
                        recommendation: ddi.recommendation,
                        references: ddi.references
                    });
                } else if (ddi.type === 'specific' && interactions[existingIdx].ruleType !== 'specific') {
                    interactions[existingIdx] = {
                        ...interactions[existingIdx],
                        ruleType: ddi.type,
                        severity: ddi.severity,
                        evidence: ddi.evidence,
                        mechanism: ddi.mechanism,
                        effect: ddi.effect,
                        recommendation: ddi.recommendation,
                        references: ddi.references
                    };
                }
            }
        }
    }

    // 2. Check Direct Patient Allergies AND Cross-Reactivity
    for (const rawAllergy of (patientAllergies || [])) {
        if (!rawAllergy || !String(rawAllergy).trim()) continue;
        const allergyStr = String(rawAllergy).trim();
        const normalizedAllergy = normalizeDrug(allergyStr);
        const allergyClass = getDrugClass(normalizedAllergy);

        // Also check if the allergen maps to a cross-reactivity entry directly or via class
        let allergyData = allergyCrossReactivity[normalizedAllergy];
        if (!allergyData && allergyClass === 'PENICILLIN') allergyData = allergyCrossReactivity['penicillin'];
        if (!allergyData && allergyClass === 'NSAID') allergyData = allergyCrossReactivity['aspirin'];
        if (!allergyData && allergyClass === 'SULFONAMIDE') allergyData = allergyCrossReactivity['sulfa'];
        if (!allergyData && allergyClass === 'OPIOID') allergyData = allergyCrossReactivity['codeine'];

        for (const medItem of normalizedPrescribedList) {
            const drugName = medItem.norm;
            const rawDrugName = medItem.raw;
            const drugClass = getDrugClass(drugName);

            const isDirectMatch =
                drugName === normalizedAllergy ||
                isFuzzyDrugMatch(drugName, normalizedAllergy) ||
                isFuzzyDrugMatch(rawDrugName, allergyStr);

            if (isDirectMatch) {
                const alreadyAdded = allergyAlerts.some(
                    a => normalizeDrug(a.drug) === drugName && normalizeDrug(a.allergen) === normalizedAllergy
                );
                if (!alreadyAdded) {
                    allergyAlerts.push({
                        allergen: allergyStr,
                        drug: rawDrugName,
                        severity: 'SEVERE',
                        crossReactivityRate: '100% (Direct Allergen Match)',
                        effect: allergyData?.effect || `Direct patient allergy conflict! Patient has a documented allergy to "${allergyStr}" and was prescribed "${rawDrugName}". Risk of severe hypersensitivity or anaphylaxis.`,
                        recommendation: allergyData?.recommendation || `CONTRAINDICATED: Immediately discontinue or replace "${rawDrugName}" with a non-cross-reactive alternative.`
                    });
                }
                continue;
            }

            // Check class or cross-reactivity match
            if (allergyData) {
                const isCrossReactive =
                    allergyData.crossReactsWith.includes(drugName) ||
                    allergyData.crossReactsWith.some(cr => isFuzzyDrugMatch(drugName, cr)) ||
                    (allergyData.relatedClass && drugClass === allergyData.relatedClass);

                if (isCrossReactive) {
                    const alreadyAdded = allergyAlerts.some(
                        a => normalizeDrug(a.drug) === drugName && normalizeDrug(a.allergen) === normalizedAllergy
                    );
                    if (!alreadyAdded) {
                        allergyAlerts.push({
                            allergen: allergyStr,
                            drug: rawDrugName,
                            severity: allergyData.severity || 'SEVERE',
                            crossReactivityRate: allergyData.crossReactivityRate,
                            effect: allergyData.effect,
                            recommendation: allergyData.recommendation
                        });
                    }
                }
            }
        }
    }

    // 3. Check same-class duplication (e.g., 2 NSAIDs)
    const classCount = {};
    for (const medItem of normalizedPrescribedList) {
        const cls = getDrugClass(medItem.norm);
        if (cls) {
            if (!classCount[cls]) classCount[cls] = [];
            classCount[cls].push(medItem.raw);
        }
    }
    for (const [cls, drugs] of Object.entries(classCount)) {
        if (drugs.length > 1) {
            const pairKey = drugs.map(normalizeDrug).sort().join('|');
            if (!interactions.find(i => i.pairKey === pairKey)) {
                interactions.push({
                    pairKey,
                    drugA: drugs[0],
                    drugB: drugs[1],
                    isNewVsExisting: false,
                    severity: 'MODERATE',
                    evidence: 'ESTABLISHED',
                    mechanism: `Multiple drugs from the same pharmacological class (${cls}) are prescribed simultaneously. This provides no additional therapeutic benefit and increases the risk of dose-dependent adverse effects.`,
                    effect: `Increased risk of class-specific side effects due to therapeutic duplication.`,
                    recommendation: `Review if both ${drugs.join(' and ')} are necessary. Consider using a single agent at an appropriate dose.`,
                    references: ['WHO Prescribing Guidelines']
                });
            }
        }
    }

    // 4. Determine overall risk level
    let overallRisk = 'SAFE';
    if (interactions.some(i => i.severity === 'MILD') || allergyAlerts.some(a => a.severity === 'MILD')) {
        overallRisk = 'MILD';
    }
    if (interactions.some(i => i.severity === 'MODERATE') || allergyAlerts.some(a => a.severity === 'MODERATE')) {
        overallRisk = 'MODERATE';
    }
    if (interactions.some(i => i.severity === 'SEVERE') || allergyAlerts.some(a => a.severity === 'SEVERE')) {
        overallRisk = 'SEVERE';
    }

    const layer1LatencyMs = Number((performance.now() - startHr).toFixed(3));

    return {
        interactions: interactions.sort((a, b) => {
            const order = { SEVERE: 0, MODERATE: 1, MILD: 2 };
            return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
        }),
        allergyAlerts: allergyAlerts.sort((a, b) => {
            const order = { SEVERE: 0, MODERATE: 1, MILD: 2 };
            return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
        }),
        overallRisk,
        totalInteractions: interactions.length,
        totalAllergyAlerts: allergyAlerts.length,
        layer1LatencyMs,
        timestamp: new Date().toISOString(),
        engine: 'VitalSync Dual-Layer O(1) Hash + Levenshtein + Gemini 2.5 CDSS v2.5',
        disclaimer: 'This AI-assisted clinical safety check is for clinical decision support. Always verify interactions and allergies with clinical judgment.'
    };
};

/**
 * Hybrid AI + Deterministic Safety Analysis
 * Combines instant deterministic + fuzzy + brand-alias matching with Gemini AI pharmacological reasoning
 * so typos (e.g., "Aspirine", "Paracetomol"), brand names, combination drugs, and patient allergies are always caught.
 */
const evaluateSafetyWithAI = async (prescribedMedicines = [], currentMedications = [], patientAllergies = []) => {
    const baseReport = checkDrugInteractions(prescribedMedicines, currentMedications, patientAllergies);

    const validPrescribed = (prescribedMedicines || []).filter(m => m && m.name && String(m.name).trim());
    if (validPrescribed.length === 0) {
        return baseReport;
    }

    try {
        const model = getTextModel();
        const prescribedListStr = validPrescribed
            .map(m => `${m.name}${m.dosage ? ` (Dose: ${m.dosage})` : ''}${m.frequency ? ` [${m.frequency}]` : ''}`)
            .join(', ');
        const currentMedsStr = (currentMedications || [])
            .map(m => (typeof m === 'string' ? m : `${m.name || ''} ${m.dosage || ''}`.trim()))
            .filter(Boolean)
            .join(', ') || 'None reported';
        const allergiesStr = (patientAllergies || []).filter(Boolean).join(', ') || 'None reported';

        const prompt = `You are a clinical pharmacology AI assistant for a medical prescribing system.
Analyze the following prescription against the patient's known allergies and regular medications.
Pay special attention to:
1. Spelling variations or typos in medicine names (e.g., "Aspirine" = Aspirin, "Paracetomol" = Paracetamol/Acetaminophen, "Amoxycillin" = Amoxicillin).
2. Brand names vs Generic names (e.g., Disprin/Ecosprin = Aspirin, Dolo/Calpol/Crocin/Tylenol = Paracetamol, Brufen/Advil = Ibuprofen, Augmentin = Amoxicillin/Clavulanate).
3. Direct allergy matches AND pharmacological class cross-reactivity (e.g., Aspirin allergy cross-reacting with NSAIDs, Penicillin allergy cross-reacting with Amoxicillin/Beta-lactams).
4. Drug-drug interactions between prescribed medicines or with the patient's regular medications.

PATIENT CLINICAL PROFILE:
- Known Allergies: ${allergiesStr}
- Regular Medications: ${currentMedsStr}
- Prescribed / Checked Medicines: ${prescribedListStr}

Respond ONLY in valid JSON (no markdown blocks) with this exact structure:
{
  "aiSummary": "1-2 sentence clinical summary of safety findings, explicitly calling out any allergy conflict or drug interaction.",
  "allergyAlerts": [
    {
      "allergen": "patient's listed allergen",
      "drug": "prescribed medicine name",
      "severity": "SEVERE" | "MODERATE" | "MILD",
      "crossReactivityRate": "Direct Match or % cross-reactivity",
      "effect": "clear clinical explanation of the allergic risk",
      "recommendation": "actionable recommendation for the doctor and patient"
    }
  ],
  "interactions": [
    {
      "drugA": "Medicine 1",
      "drugB": "Medicine 2",
      "severity": "SEVERE" | "MODERATE" | "MILD",
      "evidence": "ESTABLISHED" | "PROBABLE",
      "mechanism": "pharmacological mechanism",
      "effect": "clinical effect",
      "recommendation": "clinical recommendation"
    }
  ]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const aiData = JSON.parse(text);

        if (aiData.aiSummary) {
            baseReport.aiSummary = aiData.aiSummary;
        }

        // Merge AI allergy alerts without duplicating existing ones
        if (Array.isArray(aiData.allergyAlerts)) {
            for (const aiAlert of aiData.allergyAlerts) {
                if (!aiAlert?.drug || !aiAlert?.allergen) continue;
                const normDrug = normalizeDrug(aiAlert.drug);
                const normAllergen = normalizeDrug(aiAlert.allergen);
                const exists = baseReport.allergyAlerts.some(
                    existing =>
                        isFuzzyDrugMatch(normalizeDrug(existing.drug), normDrug) &&
                        isFuzzyDrugMatch(normalizeDrug(existing.allergen), normAllergen)
                );
                if (!exists) {
                    baseReport.allergyAlerts.push({
                        allergen: aiAlert.allergen,
                        drug: aiAlert.drug,
                        severity: ['SEVERE', 'MODERATE', 'MILD'].includes(aiAlert.severity) ? aiAlert.severity : 'SEVERE',
                        crossReactivityRate: aiAlert.crossReactivityRate || 'AI Identified Conflict',
                        effect: aiAlert.effect || 'Potential allergic reaction or cross-reactivity identified by AI.',
                        recommendation: aiAlert.recommendation || 'Avoid prescribing this medication and substitute with a safe alternative.'
                    });
                }
            }
        }

        // Merge AI drug interactions without duplicating existing ones
        if (Array.isArray(aiData.interactions)) {
            for (const aiInt of aiData.interactions) {
                if (!aiInt?.drugA || !aiInt?.drugB) continue;
                const pairKey = [normalizeDrug(aiInt.drugA), normalizeDrug(aiInt.drugB)].sort().join('|');
                const exists = baseReport.interactions.some(existing => existing.pairKey === pairKey);
                if (!exists) {
                    baseReport.interactions.push({
                        pairKey,
                        drugA: aiInt.drugA,
                        drugB: aiInt.drugB,
                        severity: ['SEVERE', 'MODERATE', 'MILD'].includes(aiInt.severity) ? aiInt.severity : 'MODERATE',
                        evidence: aiInt.evidence || 'PROBABLE',
                        mechanism: aiInt.mechanism || 'Pharmacological interaction identified by AI clinical engine.',
                        effect: aiInt.effect || 'Potential adverse interaction.',
                        recommendation: aiInt.recommendation || 'Monitor patient closely or adjust regimen.'
                    });
                }
            }
        }

        // Recompute totals and overallRisk
        baseReport.totalAllergyAlerts = baseReport.allergyAlerts.length;
        baseReport.totalInteractions = baseReport.interactions.length;

        let overallRisk = 'SAFE';
        if (baseReport.interactions.some(i => i.severity === 'MILD') || baseReport.allergyAlerts.some(a => a.severity === 'MILD')) {
            overallRisk = 'MILD';
        }
        if (baseReport.interactions.some(i => i.severity === 'MODERATE') || baseReport.allergyAlerts.some(a => a.severity === 'MODERATE')) {
            overallRisk = 'MODERATE';
        }
        if (baseReport.interactions.some(i => i.severity === 'SEVERE') || baseReport.allergyAlerts.some(a => a.severity === 'SEVERE')) {
            overallRisk = 'SEVERE';
        }
        baseReport.overallRisk = overallRisk;
        baseReport.aiAnalyzed = true;
    } catch (aiErr) {
        // Fallback summary if AI quota/network error occurs
        console.log('AI DDI augmentation fallback used:', aiErr.message);
        if (baseReport.allergyAlerts.length > 0 || baseReport.interactions.length > 0) {
            const parts = [];
            if (baseReport.allergyAlerts.length > 0) {
                parts.push(
                    `Allergy conflict detected for ${baseReport.allergyAlerts.map(a => `${a.drug} (allergen: ${a.allergen})`).join(', ')}`
                );
            }
            if (baseReport.interactions.length > 0) {
                parts.push(
                    `Drug interaction detected between ${baseReport.interactions.map(i => `${i.drugA} & ${i.drugB}`).join(', ')}`
                );
            }
            baseReport.aiSummary = parts.join('. ') + '. Immediate clinical review is recommended.';
        } else {
            baseReport.aiSummary = 'No known allergy conflicts or drug-drug interactions were found against the patient profile.';
        }
    }

    return baseReport;
};

export { checkDrugInteractions, evaluateSafetyWithAI, normalizeDrug, drugClassMap, allergyCrossReactivity };
