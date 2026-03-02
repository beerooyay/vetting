import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { ScorecardData, ScorecardItem, PointOfInterest } from '../types';
import { researchCell } from '../services/geminiService';

interface ReportPreviewProps {
  data: ScorecardData;
  onUpdate: (data: ScorecardData) => void;
}

function Editable({ value, onBlur, tag = 'span', className = '' }: {
  value: string;
  onBlur: (val: string) => void;
  tag?: string;
  className?: string;
}) {
  const Tag = tag as any;
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      className={`editable-field ${className}`}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const text = e.currentTarget.innerText.trim();
        if (text !== value) onBlur(text);
      }}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

function EditableNum({ value, onBlur, className = '' }: {
  value: number;
  onBlur: (val: number) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={`editable-field ${className}`}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const num = parseFloat(e.currentTarget.innerText.trim()) || 0;
        if (num !== value) onBlur(num);
      }}
      dangerouslySetInnerHTML={{ __html: String(value) }}
    />
  );
}

export default function ReportPreview({ data, onUpdate }: ReportPreviewProps) {
  const [searching, setSearching] = useState<string | null>(null);

  const updateField = (field: keyof ScorecardData, val: any) => {
    onUpdate({ ...data, [field]: val });
  };

  const runSearch = async (catidx: number, itemidx: number) => {
    const key = `${catidx}-${itemidx}`;
    setSearching(key);
    try {
      const item = data.categories[catidx].items[itemidx];
      const result = await researchCell(item.signal, data.domain, data.dealershipName);
      const cats = data.categories.map((c, ci) => ci !== catidx ? c : {
        ...c,
        items: c.items.map((it, ii) => ii !== itemidx ? it : {
          ...it,
          analysis: result.analysis,
          score: result.score,
          weightedScore: result.score * it.weight
        })
      });
      onUpdate({ ...data, categories: cats });
    } catch (err) {
      console.error('search failed:', err);
    } finally {
      setSearching(null);
    }
  };

  const updateItem = (catidx: number, itemidx: number, field: keyof ScorecardItem, val: any) => {
    const cats = data.categories.map((c, ci) => ci !== catidx ? c : {
      ...c,
      items: c.items.map((item, ii) => ii !== itemidx ? item : { ...item, [field]: val })
    });
    onUpdate({ ...data, categories: cats });
  };

  const updateCategory = (catidx: number, name: string) => {
    const cats = data.categories.map((c, ci) => ci !== catidx ? c : { ...c, name });
    onUpdate({ ...data, categories: cats });
  };

  const updateAnalysisItem = (secidx: number, itemidx: number, field: keyof PointOfInterest, val: string) => {
    const sections = data.analysisSections.map((s, si) => si !== secidx ? s : {
      ...s,
      items: s.items.map((item, ii) => ii !== itemidx ? item : { ...item, [field]: val })
    });
    onUpdate({ ...data, analysisSections: sections });
  };

  const updateAnalysisTitle = (secidx: number, title: string) => {
    const sections = data.analysisSections.map((s, si) => si !== secidx ? s : { ...s, title });
    onUpdate({ ...data, analysisSections: sections });
  };

  return (
    <div id="report-content" className="report-container">
      {/* PAGE 1: Cover Sheet */}
      <div className="page cover-page">
        <div className="corner-tl">
          <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gradH1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1645DF" />
                <stop offset="100%" stopColor="#1645DF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradV1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1645DF" />
                <stop offset="100%" stopColor="#1645DF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 20 3 L 160 3" stroke="url(#gradH1)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 3 20 L 3 200" stroke="url(#gradV1)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 3 20 Q 3 3 20 3" stroke="#1645DF" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="corner-br">
          <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gradH2" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#1645DF" />
                <stop offset="100%" stopColor="#1645DF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradV2" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#1645DF" />
                <stop offset="100%" stopColor="#1645DF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M 0 197 L 140 197" stroke="url(#gradH2)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 157 0 L 157 180" stroke="url(#gradV2)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 140 197 Q 157 197 157 180" stroke="#1645DF" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="cover-header">
          <img src="https://i.postimg.cc/htg3r8FV/Click-Logo-Vertical.png" alt="Click Here Digital Logo" className="cover-logo" />
          <div className="cover-subtitle">AI Vetting Scorecard</div>
        </div>
        <div className="cover-details">
          <Editable tag="h1" value={data.dealershipName} onBlur={(v) => updateField('dealershipName', v)} />
          <p><strong>DOMAIN:</strong> <Editable value={data.domain} onBlur={(v) => updateField('domain', v)} /></p>
          <p><strong>ADDRESS:</strong> <Editable value={data.address} onBlur={(v) => updateField('address', v)} /></p>
          <p><strong>PHONE:</strong> <Editable value={data.phone} onBlur={(v) => updateField('phone', v)} /></p>
        </div>
      </div>

      {/* PAGE 2: The Scorecard */}
      <div className="page">
        <div className="header">
          <img src="https://i.postimg.cc/c4rmhK2N/2023-CHD-Click-Here-Logo-Horizontal-Cropped.png" alt="Click Here Digital Logo" />
          <h1>AI Vetting Scorecard</h1>
        </div>

        <table id="scorecard-table">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Signal & Category</th>
              <th style={{ width: '50%' }}>Analysis & Findings</th>
              <th className="score-col" style={{ width: '8%' }}>Score (1-5)</th>
              <th className="weight-col" style={{ width: '7%' }}>Weight</th>
              <th className="total-col" style={{ width: '10%' }}>Weighted Score</th>
            </tr>
          </thead>

          {data.categories?.map((category, catidx) => (
            <tbody className="scorecard-section" key={catidx}>
              <tr className="section-row">
                <td colSpan={5}>
                  <Editable value={category.name} onBlur={(v) => updateCategory(catidx, v)} />
                </td>
              </tr>
              {category.items?.map((item, itemidx) => (
                <tr key={itemidx}>
                  <td>
                    <Editable tag="strong" value={item.signal} onBlur={(v) => updateItem(catidx, itemidx, 'signal', v)} />
                    <button
                      className="research-btn no-print"
                      title="Re-analyze this signal with AI search"
                      onClick={() => runSearch(catidx, itemidx)}
                      disabled={searching === `${catidx}-${itemidx}`}
                    >
                      {searching === `${catidx}-${itemidx}` ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    </button>
                  </td>
                  <td><Editable value={item.analysis} onBlur={(v) => updateItem(catidx, itemidx, 'analysis', v)} /></td>
                  <td className="score-col"><EditableNum value={item.score} onBlur={(v) => updateItem(catidx, itemidx, 'score', v)} /></td>
                  <td className="weight-col">x<EditableNum value={item.weight} onBlur={(v) => updateItem(catidx, itemidx, 'weight', v)} /></td>
                  <td className="total-col"><EditableNum value={item.weightedScore} onBlur={(v) => updateItem(catidx, itemidx, 'weightedScore', v)} /></td>
                </tr>
              ))}
            </tbody>
          ))}

          <tbody>
            <tr className="total-row">
              <td colSpan={4}>Total Score:</td>
              <td className="final-score">
                <span className="score-num"><EditableNum value={data.totalScore} onBlur={(v) => updateField('totalScore', v)} /></span>
                {' / '}
                <EditableNum value={data.maxScore} onBlur={(v) => updateField('maxScore', v)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PAGE 3: The Analysis */}
      <div className="page">
        <div className="header">
          <img src="https://i.postimg.cc/c4rmhK2N/2023-CHD-Click-Here-Logo-Horizontal-Cropped.png" alt="Click Here Digital Logo" />
          <h1>Detailed Analysis Findings</h1>
        </div>

        {data.analysisSections?.map((section, secidx) => (
          <div className="analysis-section" key={secidx}>
            <Editable tag="h2" value={section.title} onBlur={(v) => updateAnalysisTitle(secidx, v)} />
            <ul>
              {section.items?.map((item, itemidx) => (
                <li key={itemidx}>
                  <Editable tag="strong" value={item.title + ':'} onBlur={(v) => updateAnalysisItem(secidx, itemidx, 'title', v.replace(/:$/, ''))} />
                  {' '}
                  <Editable value={item.description} onBlur={(v) => updateAnalysisItem(secidx, itemidx, 'description', v)} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="additional-text">
          <strong>Concluding Summary:</strong>{' '}
          <Editable value={data.concludingSummary} onBlur={(v) => updateField('concludingSummary', v)} />
        </div>
      </div>
    </div>
  );
}
