import { ping, SmtpPingStatus } from 'smtp-ping';
import recompose from './recompose.js';

const CONFIG = {
    catchAllTimeout: 5000,
    pingTimeout: 3000,
    randomStringLength: 12,
};

const generateRandomString = (length) => {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

/**
 * Finds a valid email address for a person by testing combinations against an SMTP server.
 * Includes a check to detect catch-all domains.
 * @param {string} prenom The first name.
 * @param {string} nom The last name.
 * @param {string} domaine The domain.
 * @returns {Promise<string|null>} A promise that resolves to the valid email, "Catch-all", or null if not found.
 */
async function findEmail(prenom, nom, domaine) {
    console.log(`\n--- Searching for ${prenom} ${nom} at ${domaine} ---`);

    // 1. Check for catch-all domain
    try {
        const randomEmail = `${generateRandomString(CONFIG.randomStringLength)}@${domaine}`;
        console.log(`Checking for catch-all with: ${randomEmail}...`);
        const catchAllResult = await ping(randomEmail, { timeout: CONFIG.catchAllTimeout });

        if (catchAllResult.status === SmtpPingStatus.EXISTS) {
            console.log(`\x1b[33m  \u26A0 WARNING! Domain ${domaine} appears to be a catch-all. Aborting.\x1b[0m`);
            return "Catch-all";
        }
        if (catchAllResult.status === SmtpPingStatus.INVALID) {
            console.log("Domain is not a catch-all. Proceeding with search...");
        } else {
            console.log(`\x1b[31m  \u2717 FAILED! Could not determine if domain is a catch-all (status: ${catchAllResult.status}). Aborting.\x1b[0m`);
            return null;
        }
    } catch (error) {
        console.error(`\x1b[31m  \u2717 FAILED! Error during catch-all check: ${error.message}. Aborting.\x1b[0m`);
        return null;
    }

    // 2. If not a catch-all, search for the email
    const potentialEmails = recompose(prenom, nom, domaine);
    console.log(`Generated ${potentialEmails.length} potential emails. Testing from most to least plausible...`);

    for (const { email, score } of potentialEmails) {
        try {
            console.log(`[Score: ${score}] Testing ${email}...`);
            const result = await ping(email, { timeout: CONFIG.pingTimeout });
            if (result.status === SmtpPingStatus.EXISTS) {
                console.log(`\x1b[32m  \u2713 SUCCESS! Found valid email: ${email}\x1b[0m`);
                return email; // Found it! Return immediately.
            }
        } catch (error) {
            // Ignore individual ping errors and continue.
        }
    }

    console.log(`\x1b[31m  \u2717 FAILED! Could not find a valid email.\x1b[0m`);
    return null;
}

// --- Example Usage ---
(async () => {
    const email = await findEmail("Bill", "Gates", "microsoft.com");
    console.log("\n--- All Done! ---");
    console.log("Final result:", email);
})();