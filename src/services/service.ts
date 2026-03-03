import { jsonrepair } from "jsonrepair";
import { ScorecardData, Citation } from "../types";
import { buildSystemPrompt, JSON_SCHEMA } from "./prompt";
import { enforceStandardScorecard } from "./scorecardUtils";

const OPENROUTER_KEY = (import.meta as any).env?.VITE_OPENROUTER_KEY || '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';
const FIRECRAWL_KEY = (import.meta as any).env?.VITE_FIRECRAWL_KEY;
const MODEL = "arcee-ai/trinity-large-preview:free:online";
const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

interface ChatResult {
  content: string;
  citations: Citation[];
}

async function chat(prompt: string, system?: string): Promise<ChatResult> {
  if (!OPENROUTER_KEY) {
    throw new Error("OpenRouter key missing.");
  }

  try {
    const messages: { role: string; content: string }[] = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${OPENROUTER_KEY}`,
        'http-referer': window.location.origin,
        'x-title': 'AI Vetting Scorecard',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 8192,
        plugins: [{ id: 'web', max_results: 10 }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('openrouter error', res.status, text);
      throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message;
    const raw = message?.content || '';
    if (!raw) {
      console.error('openrouter empty response', data);
      throw new Error('Provider returned an empty response');
    }

    // Extract citations from OpenRouter web search annotations
    const citations: Citation[] = [];
    if (Array.isArray(message?.annotations)) {
      for (const ann of message.annotations) {
        if (ann?.type === 'url_citation' && ann?.url_citation?.url) {
          citations.push({
            id: citations.length + 1,
            url: ann.url_citation.url,
            title: ann.url_citation.title || ann.url_citation.url,
          });
        }
      }
      console.log('openrouter web citations:', citations.length);
    }

    console.log('openrouter raw response preview', raw.slice(0, 1600));
    return { content: extractJson(raw), citations };
  } catch (err: any) {
    const detail = err?.message || '';
    throw new Error(`Provider error: ${detail}`);
  }
}

async function chatSimple(prompt: string, system?: string): Promise<string> {
  const result = await chat(prompt, system);
  return result.content;
}

function extractJson(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    return match[1].trim();
  }

  const brace = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (brace !== -1) {
    if (last !== -1 && last >= brace) {
      return raw.slice(brace, last + 1);
    }
    // return partial JSON so repairJson can close braces later
    return raw.slice(brace);
  }

  console.error('Unable to locate JSON in response:', raw);
  const preview = raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
  throw new Error(`Provider returned unstructured output. Raw preview: ${preview}`);
}

function parsejson<T>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`primary json parse failed for ${context}. attempting repair.`);
    const repaired = repairJson(raw);
    if (repaired !== raw) {
      try {
        return JSON.parse(repaired) as T;
      } catch (err2) {
        console.error(`json parse still failing for ${context}:`, err2, '\nRaw:', repaired);
      }
    }

    try {
      const healed = jsonrepair(raw);
      return JSON.parse(healed) as T;
    } catch (libErr) {
      console.error(`jsonrepair could not heal ${context}:`, libErr);
    }

    console.error(`json parse failed for ${context}:`, err, '\nRaw:', raw);
    const preview = raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
    throw new Error(
      `Provider returned malformed JSON during ${context}. Raw preview: ${preview}`
    );
  }
}

function repairJson(raw: string): string {
  let text = raw.trim();
  if (!text) return raw;

  const normalizedQuotes = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const sanitizedUnicode = normalizedQuotes.replace(/\u2026|…/g, '');

  const strippedTrailingCommas = sanitizedUnicode.replace(/,\s*([}\]])/g, '$1');

  // remove leading text before first brace if extractjson missed it
  const firstBrace = strippedTrailingCommas.indexOf('{');
  const lastBrace = strippedTrailingCommas.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    text = strippedTrailingCommas.slice(firstBrace, lastBrace + 1);
  } else {
    text = strippedTrailingCommas;
  }

  // collapse repeated whitespace that can confuse parsers when inserted mid-number
  text = text.replace(/\s+/g, ' ');

  const braceGap = (text.match(/{/g)?.length || 0) - (text.match(/}/g)?.length || 0);
  if (braceGap > 0) {
    text = `${text}${'}'.repeat(braceGap)}`;
  }

  const bracketGap = (text.match(/\[/g)?.length || 0) - (text.match(/\]/g)?.length || 0);
  if (bracketGap > 0) {
    text = `${text}${']'.repeat(bracketGap)}`;
  }

  text = text.replace(/,\s*(?=[}\]]+\s*$)/, '');
  text = text.replace(/,\s*$/, '');

  // drop dangling key fragments such as "weight": 4,"analysis":
  text = text.replace(/"(signal|analysis|score|weight|weightedScore|title|description)"\s*:\s*$/, '');

  text = fillMissingSchema(text);

  text = balanceQuotes(text);

  return text;
}

function balanceQuotes(text: string): string {
  const trimmed = text.trimEnd();
  const quoteCount = (trimmed.match(/"/g) || []).length;
  if (quoteCount % 2 === 0) return text;

  const closingMatch = trimmed.match(/(}\s*)+$/);
  const closing = closingMatch?.[0] || '';
  const body = closing ? trimmed.slice(0, -closing.length) : trimmed;
  return `${body}"${closing}`;
}

function fillMissingSchema(text: string): string {
  const defaults = [
    { key: '"categories"', value: ',"categories":[]' },
    { key: '"totalScore"', value: ',"totalScore":0' },
    { key: '"maxScore"', value: ',"maxScore":100' },
    { key: '"analysisSections"', value: ',"analysisSections":[]' },
    { key: '"concludingSummary"', value: ',"concludingSummary":""' },
  ];

  const closingMatch = text.match(/(}\s*)+$/);
  const trailing = closingMatch?.[0] || '';
  const body = trailing ? text.slice(0, -trailing.length) : text;

  const missing = defaults
    .filter((item) => !body.includes(item.key))
    .map((item) => item.value)
    .join('');

  if (!missing) {
    return text;
  }

  const closing = trailing || '}';
  return `${body}${missing}${closing}`;
}

export async function parseScorecard(
  text: string,
  details: { name: string; domain: string; address: string; phone: string }
): Promise<ScorecardData> {
  const system = buildSystemPrompt(details);
  const prompt = `Task: Parse the AI Vetting Scorecard text into JSON.
Dealership: ${details.name} | ${details.domain} | ${details.address} | ${details.phone}
Instructions: Extract categories, items, analysis sections, summary. No fabrication. Return ONLY valid JSON matching this schema:
${JSON_SCHEMA}

Text to parse:
${text}`;

  const { content } = await chat(prompt, system);
  const parsed = parsejson<ScorecardData>(content, 'scorecard parsing');
  console.log('scorecard parsed output', parsed);
  return enforceStandardScorecard(parsed);
}

export async function generateFromNap(
  details: { name: string; domain: string; address: string; phone: string }
): Promise<ScorecardData> {
  const { text, citations } = await gatherDealershipContext(details);

  const citationIndex = citations.length
    ? `\nCITATION INDEX — use [n] markers in analysis fields when citing evidence:\n${citations.map(c => `[${c.id}] ${c.title} — ${c.url}`).join('\n')}`
    : '';

  const system = buildSystemPrompt(details) + citationIndex;

  const prompt = `REALTIME RESEARCH:
${text || 'No Firecrawl context available. Score conservatively from NAP inputs only.'}

Task: Generate a complete AI Vetting Scorecard for this dealership based on the research above.
Dealership: ${details.name} | ${details.domain} | ${details.address} | ${details.phone}

Analyze each of the 7 signals using the research data. Score each 1-5 based on evidence found. Use [n] citation markers when referencing sources.

Return ONLY valid JSON matching this schema:
${JSON_SCHEMA}`;

  const { content, citations: webCitations } = await chat(prompt, system);
  const parsed = parsejson<ScorecardData>(content, 'nap generation');
  console.log('nap generation parsed output', parsed);
  
  // Merge Firecrawl citations with OpenRouter web citations
  const allCitations = [...citations];
  for (const wc of webCitations) {
    if (!allCitations.some(c => c.url === wc.url)) {
      allCitations.push({ ...wc, id: allCitations.length + 1 });
    }
  }
  
  return enforceStandardScorecard({ ...parsed, citations: allCitations });
}

export async function researchCell(
  signal: string,
  domain: string,
  dealership: string
): Promise<{ analysis: string; score: number; citations?: Citation[] }> {
  const docs = await searchWithCitations(
    `"${dealership}" ${signal} ${domain} review rating evidence`
  );

  const citationIndex = docs.length
    ? docs.map((d, i) => `[${i + 1}] ${d.title} — ${d.url}`).join('\n')
    : '';

  const context = docs.length
    ? docs.map((d, i) => `[${i + 1}] ${d.title}\n${d.url}\n${d.content}`).join('\n\n')
    : 'No live context available.';

  const system = `You are an AI dealership vetting analyst. Today is ${today()}. Analyze the "${signal}" signal for ${dealership} (${domain}).`;

  const prompt = `${citationIndex ? `CITATION INDEX:\n${citationIndex}\n\n` : ''}RESEARCH CONTEXT:\n${context}

Analyze this signal and provide a score 1-5 based on the evidence. Use [n] markers when citing sources.

Return ONLY valid JSON: { "analysis": "2 sentences max, verdict + cited evidence", "score": 1-5 }`;

  const { content, citations: webCitations } = await chat(prompt, system);
  const result = parsejson<{ analysis: string; score: number }>(content, 'signal research');
  const citations: Citation[] = docs.map((d, i) => ({ id: i + 1, url: d.url, title: d.title }));
  return { ...result, citations };
}

interface ResearchDoc {
  url: string;
  title: string;
  content: string;
}

interface ResearchContext {
  text: string;
  citations: Citation[];
}

async function mapSite(domain: string): Promise<string[]> {
  if (!FIRECRAWL_KEY) return [];
  try {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const res = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url: base, limit: 40 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.links) ? data.links : [];
  } catch {
    return [];
  }
}

async function scrapePage(url: string): Promise<ResearchDoc | null> {
  if (!FIRECRAWL_KEY || !url) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success || !data?.data) return null;
    return {
      url,
      title: data.data.metadata?.title || url,
      content: (data.data.markdown || '').replace(/\s+/g, ' ').trim().slice(0, 900),
    };
  } catch {
    return null;
  }
}

async function searchWithCitations(query: string, location?: string): Promise<ResearchDoc[]> {
  if (!FIRECRAWL_KEY || !query.trim()) return [];
  try {
    const payload: Record<string, any> = {
      query: query.trim(),
      limit: 10,
      tbs: 'qdr:y',
      scrapeOptions: { formats: ['markdown'] },
    };
    if (location) payload.location = location;

    const res = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${FIRECRAWL_KEY}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.log('firecrawl search failed:', res.status);
      return [];
    }
    const data = await res.json();
    console.log('firecrawl search response keys:', Object.keys(data || {}), 'data keys:', Object.keys(data?.data || {}));
    
    const results: ResearchDoc[] = [];
    const webResults = Array.isArray(data?.data?.web) ? data.data.web : (Array.isArray(data?.data) ? data.data : []);
    const newsResults = Array.isArray(data?.data?.news) ? data.data.news : [];
    
    for (const item of [...webResults, ...newsResults]) {
      if (!item?.url) continue;
      results.push({
        url: item.url,
        title: item.title || item.url,
        content: (item.markdown || item.content || item.description || item.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 700),
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function gatherDealershipContext(
  details: { name: string; domain: string; address: string; phone: string }
): Promise<ResearchContext> {
  if (!FIRECRAWL_KEY) return { text: '', citations: [] };

  const { name, domain, address } = details;
  const base = domain.startsWith('http') ? domain : `https://${domain}`;

  const city = address.split(',')[1]?.trim() || '';
  const state = address.split(',')[2]?.trim()?.split(' ')[0] || '';
  const location = city && state ? `${city},${state},United States` : undefined;
  
  const [sitemapUrls, ...searchResults] = await Promise.all([
    mapSite(domain),
    searchWithCitations(`"${name}" reviews rating stars`, location),
    searchWithCitations(`"${name}" google reviews customer feedback`, location),
    searchWithCitations(`"${name}" dealerrater cars.com reviews`),
    searchWithCitations(`"${name}" BBB rating chamber of commerce`, location),
    searchWithCitations(`"${name}" dealer inventory vehicles`),
    searchWithCitations(`"${name}" service department`),
    searchWithCitations(`site:dealerrater.com "${name}"`),
    searchWithCitations(`site:cars.com "${name}"`),
    searchWithCitations(`site:bbb.org "${name}"`),
  ]);
  const searchDocs = searchResults.flat();
  console.log(`firecrawl gathered ${searchDocs.length} search results`);

  const keyPatterns = [
    /\/(new[-_]?(inventory|vehicles|cars)|inventory\/new)/i,
    /\/(used[-_]?(inventory|vehicles|cars)|inventory\/used)/i,
    /\/(specials|offers|deals|incentives|rebates)/i,
    /\/(service|parts|repair|schedule)/i,
    /\/(about|team|staff|contact|meet)/i,
  ];
  const keyUrls: string[] = [base];
  for (const pattern of keyPatterns) {
    const match = sitemapUrls.find(u => pattern.test(u));
    if (match && !keyUrls.includes(match)) keyUrls.push(match);
  }

  const scrapeDocs = (await Promise.all(keyUrls.slice(0, 8).map(scrapePage))).filter(Boolean) as ResearchDoc[];

  const seen = new Set<string>();
  const citations: Citation[] = [];
  const numbered: string[] = [];

  const allDocs: ResearchDoc[] = [...scrapeDocs, ...searchDocs];
  for (const doc of allDocs) {
    if (!doc.url || seen.has(doc.url)) continue;
    seen.add(doc.url);
    const id = citations.length + 1;
    citations.push({ id, url: doc.url, title: doc.title });
    numbered.push(`[${id}] ${doc.title}\n${doc.url}\n${doc.content}`);
  }

  const mapSummary = sitemapUrls.length
    ? `SITE MAP — ${sitemapUrls.length} URLs found (key inventory/service paths detected):\n${sitemapUrls.slice(0, 25).join('\n')}`
    : '';

  const text = [mapSummary, ...numbered].filter(Boolean).join('\n\n---\n\n');
  return { text, citations };
}

