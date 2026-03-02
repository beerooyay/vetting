import React, { useState } from 'react';
import { FileText, Download, Image as ImageIcon, FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react';
import { ScorecardData } from './types';
import { parseScorecard } from './services/geminiService';
import ReportPreview from './components/ReportPreview';

// Declare global variables for the external libraries
declare const html2pdf: any;
declare const html2canvas: any;

export default function App() {
  const [inputText, setInputText] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ScorecardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError('Please paste the scorecard text first.');
      return;
    }
    
    if (!name.trim() || !domain.trim() || !address.trim() || !phone.trim()) {
      setError('Please fill out all dealership details (Name, Domain, Address, Phone).');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const data = await parseScorecard(inputText, { name, domain, address, phone });
      setReportData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the report.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPDF = () => {
    const element = document.getElementById('report-content');
    if (!element) return;
    
    const opt = {
      margin: 0,
      filename: 'AI_Vetting_Scorecard.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const exportPNG = () => {
    const element = document.getElementById('report-content');
    if (!element) return;

    html2canvas(element, { scale: 2, useCORS: true }).then((canvas: HTMLCanvasElement) => {
      const link = document.createElement('a');
      link.download = 'AI_Vetting_Scorecard.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const exportCSV = () => {
    const element = document.getElementById('scorecard-table');
    if (!element) return;

    let csv = [];
    const rows = element.querySelectorAll('tr');

    for (let i = 0; i < rows.length; i++) {
      let row = [];
      const cols = rows[i].querySelectorAll('td, th');

      for (let j = 0; j < cols.length; j++) {
        let data = (cols[j] as HTMLElement).innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
        row.push('"' + data + '"');
      }
      csv.push(row.join(','));
    }

    const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = 'Scorecard_Data.csv';
    downloadLink.href = window.URL.createObjectURL(csvFile);
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!reportData ? (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold mb-6 text-[#190074] uppercase" style={{ fontFamily: "'Barlow Semi Condensed', 'Barlow', sans-serif" }}>
                RUN AI SCORECARD REPORT
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="sm:col-span-2">
                  <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Dealership Name
                  </label>
                  <input
                    id="name-input"
                    type="text"
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-[#1645DF] focus:ring-[#1645DF] p-3 text-sm"
                    placeholder="e.g. Lindsay Buick GMC Columbus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="domain-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Domain
                  </label>
                  <input
                    id="domain-input"
                    type="text"
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-[#1645DF] focus:ring-[#1645DF] p-3 text-sm"
                    placeholder="e.g. lindsaybuickgmctruck.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    id="phone-input"
                    type="text"
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-[#1645DF] focus:ring-[#1645DF] p-3 text-sm"
                    placeholder="e.g. (614) 845-2571"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    id="address-input"
                    type="text"
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-[#1645DF] focus:ring-[#1645DF] p-3 text-sm"
                    placeholder="e.g. 300 N Hamilton Rd, Columbus, OH 43213"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="scorecard-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Paste Scorecard Below
                </label>
                <textarea
                  id="scorecard-input"
                  rows={10}
                  className="w-full rounded-lg border border-gray-300 shadow-sm focus:border-[#1645DF] focus:ring-[#1645DF] p-4 text-sm"
                  placeholder="Paste the raw AI Vetting Scorecard text here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isGenerating}
                />
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-md">
                  <p>{error}</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !inputText.trim()}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-[#1645DF] hover:bg-[#190074] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1645DF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileText className="-ml-1 mr-2 h-5 w-5" />
                      Generate Report
                    </>
                  )}
                </button>
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
