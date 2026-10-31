// Checks the "Write with AI" setup: reads GEMINI_API_KEY from backend/.env and asks Gemini for
// one sample description. Run with: npm run check:gemini
const env = require("../src/config/env");
const { generateDescription } = require("../src/utils/gemini");

(async () => {
  if (!env.gemini.apiKey) {
    console.error("GEMINI_API_KEY is empty. Paste your key after GEMINI_API_KEY= in backend/.env and run this again.");
    process.exit(1);
  }
  const fallback = env.gemini.fallbackModels.length ? ` (fallbacks: ${env.gemini.fallbackModels.join(", ")})` : "";
  console.log(`Asking ${env.gemini.model}${fallback} for a sample description...`);
  try {
    const text = await generateDescription({
      listingType: "sale", category: "Residential", propertyType: "Apartment/Flat", bhk: "2", area: "950 Sq.Ft",
      city: "Pune", locality: "Baner", possession: "Ready to Move", floor: "5th Floor", totalFloors: "12",
      furnishing: "Semi-furnished", amenities: ["Lift", "Gymnasium", "Covered Parking", "24x7 Security"],
    });
    console.log(`\nWorking. Sample description:\n\n${text}\n`);
  } catch (e) {
    console.error(`\nNot working: ${e.message}`);
    console.error("The lines starting with \"Gemini\" above show what Google answered:");
    console.error("  400/403 - the key is wrong or not allowed: copy it again (no spaces or quotes).");
    console.error("  404     - GEMINI_MODEL names a model your key can't use: use gemini-3.8-flash or gemini-flash-latest.");
    console.error("  429/503 - Google is overloaded or the free quota is used up: wait a minute and run this again.");
    process.exit(1);
  }
})();
