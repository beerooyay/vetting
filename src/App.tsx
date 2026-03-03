import React, { useMemo, useState } from 'react';
import { FileText, Download, Image as ImageIcon, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ScorecardData, ScorecardCategory, AnalysisSection } from './types';
import { parseScorecard, generateFromNap } from './services/service';
import ReportPreview from './components/ReportPreview';

type Mode = 'both' | 'nap' | 'report';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ScorecardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingMode, setGeneratingMode] = useState<Mode | null>(null);
  const [progress, setProgress] = useState(0);

  const buttonStateClass = (mode: Mode) =>
    isGenerating && generatingMode && generatingMode !== mode
      ? 'opacity-25 pointer-events-none'
      : 'opacity-100';

  const buttonConfigs: { mode: Mode; label: string; tooltipTitle: string; tooltipCopy: string; disabled: boolean }[] = [
    {
      mode: 'nap',
      label: 'Generate from NAP',
      tooltipTitle: 'Generate from NAP',
      tooltipCopy: 'AI analyzes the dealership from scratch using the handbook methodology. Requires NAP only.',
      disabled: isGenerating || !name.trim() || !domain.trim() || !address.trim() || !phone.trim()
    },
    {
      mode: 'report',
      label: 'Parse Report Only',
      tooltipTitle: 'Parse Report Only',
      tooltipCopy: 'Just structure the pasted scorecard text into the report format. No NAP details needed.',
      disabled: isGenerating || !inputText.trim()
    },
    {
      mode: 'both',
      label: 'Generate Both',
      tooltipTitle: 'Generate Both',
      tooltipCopy: 'Use NAP details plus pasted report together for hybrid analysis.',
      disabled: isGenerating || !inputText.trim() || !name.trim() || !domain.trim() || !address.trim() || !phone.trim()
    }
  ];

  const handleGenerate = async (mode: Mode) => {
    setError(null);

    if (mode === 'both') {
      if (!inputText.trim()) {
        setError('Please paste the scorecard text first.');
        return;
      }
      if (!name.trim() || !domain.trim() || !address.trim() || !phone.trim()) {
        setError('Please fill out all dealership details (Name, Domain, Address, Phone).');
        return;
      }
    } else if (mode === 'nap') {
      if (!name.trim() || !domain.trim() || !address.trim() || !phone.trim()) {
        setError('Please fill out all dealership details (Name, Domain, Address, Phone).');
        return;
      }
    } else if (mode === 'report') {
      if (!inputText.trim()) {
        setError('Please paste the scorecard text first.');
        return;
      }
    }

    setIsGenerating(true);
    setGeneratingMode(mode);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev >= 90 ? 90 : prev + Math.random() * 15));
    }, 300);

    try {
      let data: ScorecardData;
      if (mode === 'both') {
        data = await parseScorecard(inputText, { name, domain, address, phone });
      } else if (mode === 'nap') {
        data = await generateFromNap({ name, domain, address, phone });
      } else {
        data = await parseScorecard(inputText, { name: '', domain: '', address: '', phone: '' });
      }
      setProgress(100);
      setTimeout(() => {
        setReportData(data);
        setGeneratingMode(null);
        setIsGenerating(false);
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Generation failed');
      setGeneratingMode(null);
      setIsGenerating(false);
      clearInterval(progressInterval);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const sanitizedName = useMemo(() => {
    const base = reportData?.dealershipName?.trim() || name.trim() || 'Dealership';
    return base.replace(/\s+/g, ' ').trim();
  }, [reportData?.dealershipName, name]);

  const filenamePrefix = sanitizedName ? `AI Vetting Scorecard - ${sanitizedName}` : 'AI Vetting Scorecard';

  const loadSample = () => {
    setName('Dave Smith Motors');
    setDomain('davesmith.com');
    setAddress('210 N Division St, Kellogg, ID 83837');
    setPhone('(800) 635-8000');
    setInputText('');
    setReportData(null);
    setError(null);
  };

  const exportPDF = async () => {
    const container = document.getElementById('report-content');
    if (!container) return;

    const pages = Array.from(container.querySelectorAll('.page')) as HTMLElement[];
    if (!pages.length) return;

    const pdfdoc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
    const pagew = pdfdoc.internal.pageSize.getWidth();
    const pageh = pdfdoc.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i += 1) {
      const node = pages[i];
      const canvas = await html2canvas(node, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const img = canvas.toDataURL('image/png');
      const imgw = canvas.width;
      const imgh = canvas.height;
      const fit = Math.min(pagew / imgw, pageh / imgh);
      const renderw = imgw * fit;
      const renderh = imgh * fit;
      const offsetx = (pagew - renderw) / 2;
      const offsety = (pageh - renderh) / 2;

      if (i > 0) pdfdoc.addPage();
      pdfdoc.addImage(img, 'PNG', offsetx, offsety, renderw, renderh);
    }

    pdfdoc.save(`${filenamePrefix}.pdf`);
  };

  const exportPNG = () => {
    const element = document.getElementById('report-content');
    if (!element) return;

    html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false }).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement('a');
      link.download = `${filenamePrefix}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const exportCSV = () => {
    if (!reportData) return;

    const rows: string[][] = [];

    const header = ['Category', 'Signal', 'Analysis', 'Score', 'Weight', 'Weighted Score'];
    rows.push(header);

    const pushRow = (values: (string | number)[]) => {
      rows.push(values.map((value) => String(value ?? '').replace(/\s+/g, ' ').trim()));
    };

    reportData.categories?.forEach((category: ScorecardCategory) => {
      pushRow([category.name, '', '', '', '', '']);
      category.items?.forEach((item) => {
        pushRow([
          '',
          item.signal,
          item.analysis,
          item.score,
          item.weight,
          item.weightedScore,
        ]);
      });
    });

    rows.push(['', '', '', 'Total', '', `${reportData.totalScore}/${reportData.maxScore ?? 100}`]);
    rows.push(['', '', '', 'Summary', '', reportData.concludingSummary || '']);

    if (reportData.analysisSections?.length) {
      rows.push(['', '', '', '', '', '']);
      rows.push(['Section', 'Title', 'Description', '', '', '']);
      reportData.analysisSections.forEach((section: AnalysisSection) => {
        rows.push([section.title, '', '', '', '', '']);
        section.items?.forEach((item) => {
          rows.push(['', item.title, item.description, '', '', '']);
        });
      });
    }

    const csvString = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const csvFile = new Blob([csvString], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = `${filenamePrefix}.csv`;
    downloadLink.href = URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white py-6 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <img src="https://i.postimg.cc/c4rmhK2N/2023-CHD-Click-Here-Logo-Horizontal-Cropped.png" alt="Click Here Digital" className="h-8" />
          <h1 className="text-2xl font-bold text-[#190074] uppercase border-b-2 border-[#1645DF] pb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
            AI Vetting Scorecard
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {!reportData ? (
          <div className="max-w-3xl mx-auto">
            <div className="py-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#190074] uppercase" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                  RUN AI SCORECARD REPORT
                </h2>
                <button
                  type="button"
                  onClick={loadSample}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase rounded-md border border-[#1645DF] text-[#1645DF] bg-white hover:bg-[#1645DF] hover:text-white transition-colors"
                  style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}
                >
                  Load Sample
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="sm:col-span-2">
                  <label htmlFor="name-input" className="block text-sm font-bold text-[#190074] uppercase mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                    Dealership Name
                  </label>
                  <input
                    id="name-input"
                    type="text"
                    className="w-full rounded-lg border border-[#190074]/20 focus:border-[#1645DF] focus:ring-[#1645DF] p-2.5 text-sm"
                    style={{ fontFamily: "'Google Sans', sans-serif" }}
                    placeholder="e.g. Lindsay Buick GMC Columbus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="domain-input" className="block text-sm font-bold text-[#190074] uppercase mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                    Domain
                  </label>
                  <input
                    id="domain-input"
                    type="text"
                    className="w-full rounded-lg border border-[#190074]/20 focus:border-[#1645DF] focus:ring-[#1645DF] p-2.5 text-sm"
                    style={{ fontFamily: "'Google Sans', sans-serif" }}
                    placeholder="e.g. lindsaybuickgmctruck.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="phone-input" className="block text-sm font-bold text-[#190074] uppercase mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                    Phone Number
                  </label>
                  <input
                    id="phone-input"
                    type="text"
                    className="w-full rounded-lg border border-[#190074]/20 focus:border-[#1645DF] focus:ring-[#1645DF] p-2.5 text-sm"
                    style={{ fontFamily: "'Google Sans', sans-serif" }}
                    placeholder="e.g. (614) 845-2571"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address-input" className="block text-sm font-bold text-[#190074] uppercase mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                    Address
                  </label>
                  <input
                    id="address-input"
                    type="text"
                    className="w-full rounded-lg border border-[#190074]/20 focus:border-[#1645DF] focus:ring-[#1645DF] p-2.5 text-sm"
                    style={{ fontFamily: "'Google Sans', sans-serif" }}
                    placeholder="e.g. 300 N Hamilton Rd, Columbus, OH 43213"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="mb-5">
                <label htmlFor="scorecard-input" className="block text-sm font-bold text-[#190074] uppercase mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                  Paste Scorecard Below (Optional)
                </label>
                <textarea
                  id="scorecard-input"
                  rows={4}
                  className="w-full rounded-lg border border-[#190074]/20 focus:border-[#1645DF] focus:ring-[#1645DF] p-2.5 text-sm"
                  style={{ fontFamily: "'Google Sans', sans-serif" }}
                  placeholder="Paste the raw AI Vetting Scorecard text here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              {error && (
                <div className="mb-5 p-3 bg-[#190074]/5 border-l-4 border-[#190074] text-[#190074] rounded-r-md text-sm" style={{ fontFamily: "'Google Sans', sans-serif" }}>
                  <p>{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap justify-center items-center gap-3 w-full">
                  {buttonConfigs.map((btn) => (
                    <div
                      key={btn.mode}
                      className={`relative group transition-opacity duration-200 ${buttonStateClass(btn.mode)}`}
                    >
                      <button
                        onClick={() => handleGenerate(btn.mode)}
                        disabled={btn.disabled}
                        className={`w-52 h-12 inline-flex items-center justify-center px-4 border border-transparent text-sm font-bold uppercase rounded-lg text-white bg-[#1645DF] hover:bg-[#190074] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                          generatingMode === btn.mode ? 'ring-2 ring-white/40' : ''
                        }`}
                        style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}
                      >
                        {generatingMode === btn.mode && isGenerating ? 'Processing...' : btn.label.toUpperCase()}
                      </button>
                      <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-white border border-[#190074]/10 text-[#190074] text-xs rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10" style={{ fontFamily: "'Google Sans', sans-serif" }}>
                        <div className="absolute right-4 top-full w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
                        <p className="font-bold mb-1" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>{btn.tooltipTitle}</p>
                        <p>{btn.tooltipCopy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setReportData(null)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF]"
              >
                <RefreshCw className="-ml-1 mr-2 h-4 w-4 text-gray-500" />
                Start Over
              </button>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportPDF}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#1645DF] hover:bg-[#190074] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF]"
                >
                  <Download className="-ml-1 mr-2 h-4 w-4" />
                  Download PDF
                </button>
                <button
                  onClick={exportPNG}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#1645DF] hover:bg-[#190074] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF]"
                >
                  <ImageIcon className="-ml-1 mr-2 h-4 w-4" />
                  Download PNG
                </button>
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#1645DF] hover:bg-[#190074] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF]"
                >
                  <FileSpreadsheet className="-ml-1 mr-2 h-4 w-4" />
                  Download CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto pb-12">
              <div className="min-w-[8.5in] mx-auto bg-gray-200 p-8 rounded-xl flex justify-center">
                <div className="shadow-2xl bg-white">
                  <ReportPreview data={reportData} onUpdate={setReportData} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
