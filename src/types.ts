export interface ScorecardItem {
  signal: string;
  analysis: string;
  score: number;
  weight: number;
  weightedScore: number;
}

export interface ScorecardCategory {
  name: string;
  items: ScorecardItem[];
}

export interface PointOfInterest {
  title: string;
  description: string;
}

export interface AnalysisSection {
  title: string;
  items: PointOfInterest[];
}

export interface Citation {
  id: number;
  url: string;
  title: string;
}

export interface ScorecardData {
  dealershipName: string;
  domain: string;
  address: string;
  phone: string;
  categories: ScorecardCategory[];
  totalScore: number;
  maxScore: number;
  analysisSections: AnalysisSection[];
  concludingSummary: string;
  citations?: Citation[];
}
