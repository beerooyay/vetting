# ai vetting scorecard

generates branded pdf/png reports scoring dealerships on trust, reputation, inventory quality, and local authority for ai search readiness.

## stack

- **react + vite + typescript**
- **openrouter** — arcee trinity with :online web search
- **firecrawl** — sitemap mapping and serp research (optional)
- **jspdf + html2canvas** — pdf/png export at 3x scale

## setup

1. `npm install`
2. create `.env.local`:
   ```
   VITE_OPENROUTER_KEY=sk-or-v1-...
   VITE_FIRECRAWL_KEY=fc-... (optional)
   ```
3. `npm run dev`

## usage

1. enter dealership nap (name, address, phone, domain)
2. click "generate from nap" — ai researches and scores
3. edit any field inline
4. export as pdf, png, or csv

## scoring

7 signals across 3 pillars, weighted to 100 points:

- **trust & reputation** — legitimacy, reviews, staff expertise
- **content & inventory** — vdp accuracy, pricing transparency, content quality
- **local authority** — citations, chamber, bbb, local press

## colors

- `#1645df` — bright blue (accents)
- `#190074` — dark blue (headings)
- black + white only
