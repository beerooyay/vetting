import { ScorecardData } from "../types";

const KEY = import.meta.env.VITE_OPENROUTER_KEY;
const BASE = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-3n-e4b-it:free";
const SEARCH = "google/gemma-3n-e4b-it:free:online";
const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

async function chat(model: string, prompt: string): Promise<string> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `openrouter ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const brace = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (brace !== -1 && last !== -1) return raw.slice(brace, last + 1);
  return raw;
}

export async function parseScorecard(
  text: string,
  details: { name: string; domain: string; address: string; phone: string }
): Promise<ScorecardData> {
  const prompt = `Today is ${today()}. Parse the following AI Vetting Scorecard text into structured JSON.

Dealership details:
- Name: ${details.name}
- Domain: ${details.domain}
- Address: ${details.address}
- Phone: ${details.phone}

Instructions:
1. Extract the scorecard categories, items, analysis sections (Key Strengths, Areas for Improvement, etc.), and the concluding summary.
2. Do NOT infer, fabricate, or fill in missing information. If data is missing, use empty string or 0.
3. Return ONLY valid JSON matching this exact schema:

{
  "dealershipName": "string",
  "domain": "string",
  "address": "string",
  "phone": "string",
  "categories": [
    {
      "name": "string (e.g. I. Dealership Trust & Reputation)",
      "items": [
        {
          "signal": "string (e.g. 1. Legitimacy & Transparency)",
          "analysis": "string",
          "score": number,
          "weight": number,
          "weightedScore": number
        }
      ]
    }
  ],
  "totalScore": number,
  "maxScore": number,
  "analysisSections": [
    {
      "title": "string (e.g. Key Strengths)",
      "items": [
        { "title": "string", "description": "string" }
      ]
    }
  ],
  "concludingSummary": "string"
}

Text to parse:
${text}`;

  const raw = await chat(MODEL, prompt);
  return JSON.parse(raw) as ScorecardData;
}

export async function researchCell(
  signal: string,
  domain: string,
  dealership: string
): Promise<{ analysis: string; score: number }> {
  const prompt = `Today is ${today()}. You are analyzing a car dealership website for an AI vetting scorecard.

Dealership: ${dealership}
Domain: ${domain}
Signal to research: ${signal}

Search for the most current information about this dealership related to "${signal}". Check their website, Google Business Profile, review sites, BBB, and any relevant sources.

Return ONLY valid JSON: { "analysis": "2-4 sentence paragraph", "score": number 1-5 }
Do NOT fabricate information. Only report what you can verify.`;

  const raw = await chat(SEARCH, prompt);
  return JSON.parse(raw) as { analysis: string; score: number };
}
