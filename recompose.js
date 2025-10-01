/**
     * Normalizes a name by handling apostrophes and compound name separators.
     * @param {string} name The name to process.
     * @param {RegExp} separatorsRegex Regex for separators like ' ', '-', '--'.
     * @returns {{normalized: string, parts: string[]}}
     */
const normalizeAndSplit = (name, separatorsRegex) => {
    const cleanedName = name.toLowerCase()
        .normalize('NFD') // Decompose accents (e.g., 'é' -> 'e' + '´')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
        .replace(/'/g, ''); // Handle O'neil -> oneil
    const normalized = cleanedName.replace(separatorsRegex, '-');
    const parts = normalized.split('-');
    return { normalized, parts };
};

const generateInitialVariations = ({ parts }) => {
    const variations = new Set();
    const initialsArray = parts.map(p => p.charAt(0));
    variations.add(initialsArray.join('')); // j, jc
    if (initialsArray.length > 1) {
        variations.add(initialsArray.join('-')); // j-c
        variations.add(initialsArray.join('.')); // j.c
    }
    variations.add(initialsArray[0]); // Always add the very first initial
    return variations;
};

/**
 * Generates different variations from name parts (full, initials, etc.).
 * @param {{normalized: string, parts: string[]}} nameInfo
 * @returns {Set<string>} A set of name variations.
 */
const generateNameVariations = ({ parts }) => {
    const variations = new Set();
    variations.add(parts.join('')); // e.g., dupont, jeanchristophe
    if (parts.length > 1) {
        variations.add(parts.join('-')); // e.g., jean-christophe
    }
    return variations;
};


/**
 * Generates a scored and sorted list of possible email addresses.
 * @param {string} prenom The first name.
 * @param {string} nom The last name.
 * @param {string} domaine The domain (e.g., 'example.com').
 * @returns {string[]} An array of possible email addresses.
 * @throws {Error} If the domain format is invalid.
 */
function recompose(prenom, nom, domaine) {
    // 1. Verify that the domain is in the form domain.tld
    if (!/.\..+$/.test(domaine)) {
        throw new Error("Le format du domaine est invalide. Il doit être de la forme 'domaine.tld'.");
    }

    // --- Data Preparation ---
    const prenomInfo = normalizeAndSplit(prenom, /-/g);
    const nomInfo = normalizeAndSplit(nom, /--| |-/g);

    const prenomInitial = prenomInfo.parts[0].charAt(0);
    const nomInitial = nomInfo.parts[0].charAt(0);

    const prenomInitialVariations = generateInitialVariations(prenomInfo);
    const nomInitialVariations = generateInitialVariations(nomInfo);

    const prenomVariations = generateNameVariations(prenomInfo); // e.g., { 'jeanpierre', 'jean-pierre' }
    const nomVariations = generateNameVariations(nomInfo);


    // --- Combination and Scoring ---
    const combinations = new Map();
    const separatorScores = { '.': 0, '': 0, '-': 1, '_': 2 };

    const addCombinations = (part1, part2, baseScore, isReversedOrder = false) => {
        const orderPenalty = isReversedOrder ? 1 : 0;
        for (const sep in separatorScores) {
            const separatorScore = separatorScores[sep];
            const finalScore = baseScore + orderPenalty + separatorScore;

            const combo = `${part1}${sep}${part2}`;

            // If the combo doesn't exist or the new score is better, add/update it
            if (!combinations.has(combo) || finalScore < combinations.get(combo)) {
                combinations.set(combo, finalScore);
            }
        }
    };

    // --- Define Scoring Rules ---
    const scoringRules = [
        // Base Score 0: Most common
        { p: prenomVariations, n: nomVariations, score: 0 }, // prenom.nom
        { p: new Set([prenomInitial]), n: nomVariations, score: 0 }, // p.nom
        // Base Score 1: Plausible
        { p: new Set([...prenomInitialVariations].filter(v => !v.includes('.') && !v.includes('-') && v !== prenomInitial)), n: nomVariations, score: 1 }, // jp.nom
        // Base Score 2: Less common
        { p: prenomVariations, n: nomInitialVariations, score: 2 }, // prenom.d, prenom.dg
        { p: prenomInitialVariations, n: nomInitialVariations, score: 2 }, // p.d, jp.d, p.dg, jp.dg
        // Base Score 4: Implausible
        { p: new Set([...prenomInitialVariations].filter(v => v.includes('.') || v.includes('-'))), n: nomVariations, score: 4 }, // j-c.nom
    ];

    // --- Apply Scoring Rules ---
    for (const rule of scoringRules) {
        rule.p.forEach(pVar => rule.n.forEach(nVar => {
            addCombinations(pVar, nVar, rule.score, false); // direct order
            addCombinations(nVar, pVar, rule.score, true);  // reversed order
        }));
    }

    return Array.from(combinations.entries())
        .map(([combo, score]) => ({ email: `${combo}@${domaine}`, score }))
        .sort((a, b) => a.score - b.score);
}

export default recompose;