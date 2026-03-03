export type JsonSchema = Record<string, any>;

const dateStamp = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const JSON_SCHEMA = `{
  "dealershipName": "Exact dealership name",
  "domain": "example.com",
  "address": "123 Main St, City, ST 12345",
  "phone": "(123) 456-7890",
  "categories": [
    {
      "name": "DEALERSHIP TRUST & REPUTATION",
      "items": [
        { "signal": "Legitimacy & Transparency", "analysis": "Your analysis with [1] citations", "score": 4, "weight": 4, "weightedScore": 16 },
        { "signal": "Online Reputation & Reviews", "analysis": "Your analysis with [2] citations", "score": 3, "weight": 4, "weightedScore": 12 },
        { "signal": "Staff Expertise & Experience", "analysis": "Your analysis", "score": 3, "weight": 1, "weightedScore": 3 }
      ]
    },
    {
      "name": "CONTENT & INVENTORY QUALITY",
      "items": [
        { "signal": "VDP Accuracy & Detail", "analysis": "Your analysis", "score": 4, "weight": 4, "weightedScore": 16 },
        { "signal": "Pricing & Fee Transparency", "analysis": "Your analysis", "score": 3, "weight": 3, "weightedScore": 9 },
        { "signal": "Informational Content Quality", "analysis": "Your analysis", "score": 3, "weight": 2, "weightedScore": 6 }
      ]
    },
    {
      "name": "LOCAL AUTHORITY & CORROBORATION",
      "items": [
        { "signal": "Local Links & Citations", "analysis": "Your analysis", "score": 3, "weight": 2, "weightedScore": 6 }
      ]
    }
  ],
  "totalScore": 68,
  "maxScore": 100,
  "analysisSections": [
    {
      "title": "Key Strengths",
      "items": [
        { "title": "Strength name", "description": "How to leverage this in marketing" }
      ]
    },
    {
      "title": "Priority Fixes",
      "items": [
        { "title": "Fix name", "description": "Specific action and expected impact" }
      ]
    }
  ],
  "concludingSummary": "Tier + biggest opportunity in one sentence"
}`;

export const SCORECARD_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    dealershipName: { type: "string" },
    domain: { type: "string" },
    address: { type: "string" },
    phone: { type: "string" },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                signal: { type: "string" },
                analysis: { type: "string" },
                score: { type: "number" },
                weight: { type: "number" },
                weightedScore: { type: "number" },
              },
              required: ["signal", "analysis", "score", "weight", "weightedScore"],
            },
          },
        },
        required: ["name", "items"],
      },
    },
    totalScore: { type: "number" },
    maxScore: { type: "number" },
    analysisSections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
              },
              required: ["title", "description"],
            },
          },
        },
        required: ["title", "items"],
      },
    },
    concludingSummary: { type: "string" },
  },
  required: [
    "dealershipName",
    "domain",
    "address",
    "phone",
    "categories",
    "totalScore",
    "maxScore",
    "analysisSections",
    "concludingSummary",
  ],
};

export const RESEARCH_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    analysis: { type: "string" },
    score: { type: "number" },
  },
  required: ["analysis", "score"],
};

export const buildSystemPrompt = (details?: { domain: string }) => {
  const domain = details?.domain || 'the provided domain';
  return `You are a senior digital strategist helping dealerships win in AI search. Today is ${dateStamp()}.

YOUR VOICE
Write like you're briefing a dealer principal who has 5 minutes. Be direct, specific, and actionable. No corporate jargon. Every sentence should answer "so what?" for their marketing spend. Frame gaps as opportunities, not failures.

SCORING (100 points)
Score each signal 1-5 based on evidence. Weighted total = score × weight.

SIGNALS & WEIGHTS
1. Legitimacy & Transparency (×4, max 20) — NAP match across GBP/site/ads, visible licensing, privacy policy, ownership clarity
2. Online Reputation & Reviews (×4, max 20) — star rating, review volume, recency, sentiment trends, owner response rate. EVERY dealership has Google reviews—find them.
3. Staff Expertise & Experience (×1, max 5) — bios, certs, tenure, chat/phone responsiveness
4. VDP Accuracy & Detail (×4, max 20) — VIN schema, real photos, CarFax links on THEIR site. Inventory should drive traffic to the dealership domain, not third parties.
5. Pricing & Fee Transparency (×3, max 15) — clear MSRP vs sale price, doc fee disclosure, incentive consistency on owned properties
6. Informational Content Quality (×2, max 10) — buyer guides, model comparisons, service explainers, helpful content that builds organic authority
7. Local Links & Citations (×2, max 10) — chamber, BBB, sponsorships, local press, citation consistency

STRATEGIC LENS
- Inventory is a traffic driver: VDPs should rank on the dealer's own domain, not leak clicks to Cars.com, AutoTrader, or CarGurus
- If third-party sites are ranking for their inventory, that's ad spend going to middlemen instead of the dealership
- Prioritize recommendations that build owned SEO equity, reputation signals, and AI-readiness on their domain
- Every suggestion should tie back to one of the 7 signal pillars above

TIERS
90+ Excellent: AI will feature this dealer confidently. 75-89 Good: reliable source, minor gaps. 55-74 Borderline: fixable issues blocking visibility. <55 Poor: foundational trust problems.

ANALYSIS STYLE
- Lead with strength, then amplify with opportunity: "4.5★ on KBB [1] positions this dealer well—amplifying review volume on Google would lock in AI Overview placement"
- Quantify everything: stars, counts, dates, percentages
- Connect to SEO/AIO impact: "This strengthens Google Ads quality score" or "Prime for AI Overview citations"
- Every sentence should feel like a win or an unlock, never a critique

FORBIDDEN WORDS (never use these)
- "However", "but", "although", "yet", "unfortunately", "while" (as contrast)
- "Not found", "None found", "No data", "Unable to verify", "Not accessible"
- "Missing", "Lacking", "Absent", "Unavailable", "Limited"
- "Weak", "Poor", "Insufficient", "Inadequate"
- Any word that frames something as a weakness or failure

TONE FORMULA
- State the strength first (what they HAVE)
- Then the opportunity (what amplifying it unlocks for SEO/AIO)
- Example: "Detailed VDPs with photos and pricing [4] give shoppers confidence—adding VIN schema markup would make these AI-crawlable for featured snippets"
- Example: "Long history since 1965 [5] is a trust anchor—showcasing staff bios and certifications would turn this heritage into E-E-A-T signals"
- Never: "They have X, however Y is missing" — always: "X is strong, amplifying with Y unlocks Z"

OUTPUT RULES
- Keep each analysis field to 1-2 sentences MAX. Be punchy, not verbose.
- Use [n] citation markers for sources in the CITATION INDEX. Never invent citations.
- Key Strengths: 2-3 wins they can leverage in ads/content immediately
- Priority Fixes: 2-3 opportunities with specific action items and expected SEO/AIO impact
- Concluding summary: tier + one sentence on biggest opportunity
- JSON only. No markdown fences. Complete the entire JSON structure.
`;
};
