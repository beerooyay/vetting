import { ScorecardData, ScorecardItem, AnalysisSection, ScorecardCategory, PointOfInterest } from "../types";

const MAX_SCORE = 100;
const defaultscore = 3;

const SCORE_TIERS = [
  {
    min: 90,
    label: 'Excellent',
    decision: 'Primary, high-trust source. The AI will feature this dealer confidently across SERP and assistant panels.',
  },
  {
    min: 75,
    label: 'Good',
    decision: 'Reliable, corroborating source. AI will cite the dealer but still cross-check against top-tier references.',
  },
  {
    min: 55,
    label: 'Borderline',
    decision: 'Use with caution. Tighten weak proof points before expecting steady visibility.',
  },
  {
    min: 0,
    label: 'Poor',
    decision: 'Untrustworthy, avoid. AI will suppress this dealer until foundational trust is rebuilt.',
  },
];

const STANDARD_STRUCTURE = [
  {
    name: "DEALERSHIP TRUST & REPUTATION",
    items: [
      { signal: "Legitimacy & Transparency", weight: 4 },
      { signal: "Online Reputation & Reviews", weight: 4 },
      { signal: "Staff Expertise & Experience", weight: 1 },
    ],
  },
  {
    name: "CONTENT & INVENTORY QUALITY",
    items: [
      { signal: "VDP Accuracy & Detail", weight: 4 },
      { signal: "Pricing & Fee Transparency", weight: 3 },
      { signal: "Informational Content Quality", weight: 2 },
    ],
  },
  {
    name: "LOCAL AUTHORITY & CORROBORATION",
    items: [
      { signal: "Local Links & Citations", weight: 2 },
    ],
  },
];

const DEFAULT_SECTIONS = ["Key Strengths", "Priority Fixes"];

function getScoreTier(total: number) {
  return SCORE_TIERS.find((tier) => total >= tier.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

function buildConcludingSummary(
  totalScore: number,
  categories: ScorecardCategory[],
  provided?: string
): string {
  const tier = getScoreTier(totalScore);
  const base = `${tier.label} tier (${totalScore}/100). ${tier.decision}`;

  const weakest = [...(categories || [])]
    .flatMap((cat) => cat.items || [])
    .sort((a, b) => a.weightedScore - b.weightedScore)[0];

  const opportunity = weakest
    ? `${weakest.signal} is the fastest lift—${cleanSentence(weakest.analysis)} ${fixHook(weakest.signal)}`
    : 'Keep reinforcing the strongest proof points and syndicate them everywhere.';

  if (provided?.trim()) {
    const trimmed = provided.trim();
    return trimmed.includes(tier.label) ? trimmed : `${trimmed} ${base}`;
  }

  return `${base} ${opportunity}`.trim();
}

export function enforceStandardScorecard(source: ScorecardData): ScorecardData {
  const lookup = buildSignalMap(source.categories);

  const categories = STANDARD_STRUCTURE.map(({ name, items }) => ({
    name,
    items: items.map((template) => {
      const existing = lookup.get(template.signal.toLowerCase());
      const score = typeof existing?.score === 'number' ? clampScore(existing.score) : defaultscore;
      const analysis = existing?.analysis?.trim() || defaultAnalysis(template.signal);
      const weight = template.weight;
      const weightedScore = Number((score * weight).toFixed(2));
      return {
        signal: template.signal,
        analysis,
        score,
        weight,
        weightedScore,
      };
    }),
  }));

  const totalScore = Number(
    categories
      .flatMap((cat) => cat.items)
      .reduce((sum, item) => sum + item.weightedScore, 0)
      .toFixed(2)
  );

  const analysisSections = buildAnalysisSections(categories, source.analysisSections);
  const concludingSummary = buildConcludingSummary(totalScore, categories, source.concludingSummary);

  return {
    ...source,
    dealershipName: source.dealershipName?.trim() || "",
    domain: formatDomain(source.domain),
    phone: formatPhone(source.phone),
    address: formatAddress(source.address),
    categories,
    totalScore,
    maxScore: MAX_SCORE,
    analysisSections,
    concludingSummary,
    citations: source.citations ?? [],
  };
}

function buildSignalMap(categories?: ScorecardData["categories"]): Map<string, ScorecardItem> {
  const map = new Map<string, ScorecardItem>();
  categories?.forEach((category) => {
    category.items?.forEach((item) => {
      if (!item.signal) return;
      map.set(item.signal.trim().toLowerCase(), item);
    });
  });
  return map;
}

function clampScore(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
}

function defaultAnalysis(signal: string): string {
  const signaldefaults: Record<string, string> = {
    'legitimacy & transparency': 'entity proof is incomplete—no verified corporate records or policy hubs were cited. sync gbp, secretary of state filings, privacy policy, and google ads extensions so every ai surface repeats the same nap and disclosures.',
    'online reputation & reviews': 'reputation coverage is mixed because only select platforms surfaced, leaving google and cars.com signals unverified. capture fresh gbp, dealerrater, and yelp proof with owner responses so ai panels trust the sentiment.',
    'staff expertise & experience': 'advisor depth is unproven with no bios or certification callouts referenced. publish staff media on site and gbp plus chat or service coverage evidence so serp snippets feel high touch.',
    'vdp accuracy & detail': 'inventory quality is unverified—no live vdp urls with vin schema, photos, or rich media made it into the data. crawl primary vdp examples plus gbp vehicles, google ads landing pages, and third party listings so every surface echoes the same specs.',
    'pricing & fee transparency': 'pricing consistency is unproven because specials, gbp offers, and third party listings were not cited together. align website specials, gbp promos, google ads copy, and marketplace pricing so ai channels echo identical numbers.',
    'informational content quality': 'content depth remains thin with no comparison guides, buyer explainers, or outbound authority links referenced. layer oem program coverage, educational hubs, and citing sources so serp and ai summaries have richer context.',
    'local links & citations': 'citation health is unclear—no chamber, charity, or aggregator refresh surfaced in the research. update gbp, bing places, local press, and partner directories so every ai overview references the same nap.',
  };
  const key = signal?.trim().toLowerCase();
  return signaldefaults[key] || 'this signal is baseline today. tie serp, seo, gbp, google ads, and on-site proof together to unlock a higher tier.';
}

function buildAnalysisSections(
  categories: ScorecardCategory[],
  existing?: AnalysisSection[]
): AnalysisSection[] {
  const points = deriveSeoPoints(categories);
  const base = DEFAULT_SECTIONS.map((title) => {
    const match = existing?.find((sec) => sec.title?.toLowerCase() === title.toLowerCase());
    const sanitized = sanitizePoints(match?.items);
    const fallback = title === "Key Strengths" ? points.strengths : points.fixes;
    return { title, items: sanitized.length ? sanitized : fallback };
  });

  const extras = (existing ?? []).filter(
    (sec) => !DEFAULT_SECTIONS.some((title) => title.toLowerCase() === sec.title?.toLowerCase())
  ).map((sec) => ({ title: sec.title || "", items: sanitizePoints(sec.items) }));

  return [...base, ...extras];
}

function sanitizePoints(points?: PointOfInterest[]): PointOfInterest[] {
  if (!points?.length) return [];
  return points
    .filter((pt) => pt?.title && pt?.description)
    .map((pt) => ({
      title: pt.title.replace(/:\s*$/, '').trim(),
      description: pt.description.trim(),
    }));
}

function deriveSeoPoints(categories: ScorecardCategory[]) {
  const items = categories.flatMap((cat) => cat.items || []);
  if (!items.length) {
    const placeholder = {
      title: "Awaiting Research",
      description: "Add dealer inputs to surface strengths and fixes.",
    };
    return { strengths: [placeholder], fixes: [placeholder] };
  }

  const ranked = [...items].sort((a, b) => b.weightedScore - a.weightedScore);
  const weakest = [...items].sort((a, b) => a.weightedScore - b.weightedScore);

  const strengths = ranked.slice(0, 3).map((item) => ({
    title: `${item.signal} advantage`,
    description: `${cleanSentence(item.analysis)} ${strengthHook(item.signal)}`.trim(),
  }));

  const fixes = weakest.slice(0, 3).map((item) => ({
    title: `${item.signal} opportunity`,
    description: `${cleanSentence(item.analysis)} ${fixHook(item.signal)}`.trim(),
  }));

  return {
    strengths: strengths.length ? strengths : [{
      title: "Strength data pending",
      description: "Run Generate or add manual notes to highlight USPs.",
    }],
    fixes: fixes.length ? fixes : [{
      title: "Fix data pending",
      description: "Run Generate or add manual notes to surface SEO fixes.",
    }],
  };
}

function cleanSentence(text?: string): string {
  if (!text) return "No verified evidence yet.";
  return text.replace(/\s+/g, ' ').trim();
}

function strengthHook(signal: string): string {
  const key = signal?.toLowerCase();
  const hooks: Record<string, string> = {
    'legitimacy & transparency': "this keeps ai surfacing the store as a definitive local authority.",
    'online reputation & reviews': "high sentiment lifts gbp conversions and featured snippets.",
    'staff expertise & experience': "humanized experts fuel eeat signals across about and service pages.",
    'vdp accuracy & detail': "optimized inventory pages feed google vehicles and ai overviews with trustworthy data.",
    'pricing & fee transparency': "clear pricing helps ai summarize offers without compliance risk.",
    'informational content quality': "depth content anchors search architecture for future topics.",
    'local links & citations': "clean citations reinforce nap trust signals across the web.",
  };
  return hooks[key] || "this is a unique seo proof point supporting the dealership's usp.";
}

function fixHook(signal: string): string {
  const key = signal?.toLowerCase();
  const fixes: Record<string, string> = {
    'legitimacy & transparency': "tighten nap governance and policy ux so ai trusts the source.",
    'online reputation & reviews': "build response cadence and schema to boost review-rich results.",
    'staff expertise & experience': "expand advisor bios and media to reinforce eeat.",
    'vdp accuracy & detail': "deploy structured data, media, and crawl depth fixes for inventory pages.",
    'pricing & fee transparency': "publish transparent fees and incentives to stabilize serp summaries.",
    'informational content quality': "layer comparison pillars and internal links to strengthen topical authority.",
    'local links & citations': "update aggregators and local press links to clean up authority signals.",
  };
  return fixes[key] || "Focus SEO efforts on content, technical hygiene, and citation strength for this signal.";
}

function formatDomain(value?: string): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

function formatPhone(value?: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    const [, area, prefix, line] = digits.match(/(\d{3})(\d{3})(\d{4})/) || [];
    if (area && prefix && line) {
      return `(${area}) ${prefix}-${line}`;
    }
  }
  return value.trim();
}

function formatAddress(value?: string): string {
  if (!value) return "";
  const compact = value.replace(/\s+/g, ' ').trim();
  const match = compact.match(/^(.*?),\s*([A-Za-z\.\s]+?),\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)$/);
  if (match) {
    const [, street, city, state, zip] = match;
    return `${street.trim()}, ${titleCase(city)} , ${state.toUpperCase()} ${zip}`.replace(/\s+,/g, ',');
  }

  const parts = compact.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const maybeStateZip = parts[parts.length - 1].match(/([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)/);
    if (maybeStateZip) {
      const state = maybeStateZip[1].toUpperCase();
      const zip = maybeStateZip[2];
      const city = titleCase(parts[parts.length - 2]);
      const street = parts.slice(0, parts.length - 2).join(', ');
      return `${street}, ${city}, ${state} ${zip}`;
    }
  }

  return compact;
}

function titleCase(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
