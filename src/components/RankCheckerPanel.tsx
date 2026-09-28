import React, { useState, useMemo } from 'react';
import {
  ExternalLink,
  Copy,
  Edit3,
  Trash2,
  Check,
  Search,
  Rocket,
  X,
} from 'lucide-react';
import { RANK_CHECKER_AIRLINES } from '../lib/seoHelpers';

export const RankCheckerPanel: React.FC = () => {
  const VALUE_A = 'https://www.google.com/search?q=';
  const VALUE_D = '&cr=countryUS';

  const [tfnToFind, setTfnToFind] = useState('+1-866-857-4025');
  const [searchKeyword, setSearchKeyword] = useState('missed flights');
  const [filterAirline, setFilterAirline] = useState('');
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [copiedAirline, setCopiedAirline] = useState<string | null>(null);
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Ready. Click Open on any airline to copy the TFN (${tfnToFind}) for quick Ctrl+F / Cmd+F search and open the SERP query.`,
  ]);

  const linksData = useMemo(() => {
    const keywordFormatted = searchKeyword.trim().replace(/\s+/g, '+');
    const result: { airline: string; url: string }[] = [];

    for (const airline of RANK_CHECKER_AIRLINES) {
      if (
        filterAirline.trim() &&
        !airline.toLowerCase().includes(filterAirline.trim().toLowerCase())
      ) {
        continue;
      }
      const formattedB = airline.replace(/\s+/g, '+');
      const defaultUrl = `${VALUE_A}${formattedB}+${keywordFormatted}${VALUE_D}`;
      result.push({
        airline,
        url: customUrls[airline] || defaultUrl,
      });
    }
    return result;
  }, [searchKeyword, customUrls, filterAirline]);

  const addLog = (message: string) => {
    const nowStr = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${nowStr}] ${message}`, ...prev]);
  };

  const handleCopyUrl = async (airline: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAirline(airline);
      setTimeout(() => setCopiedAirline(null), 1500);
    } catch {
      // ignore
    }
  };

  const handleOpenSingle = async (airline: string, url: string) => {
    const tfn = tfnToFind.trim() || 'N/A';
    try {
      await navigator.clipboard.writeText(tfn);
    } catch {
      // ignore
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    addLog(`${airline} - TFN: ${tfn} (copied to clipboard for Ctrl+F) - Opened`);
  };

  const handleOpenBatch = async () => {
    const tfn = tfnToFind.trim() || 'N/A';
    try {
      await navigator.clipboard.writeText(tfn);
    } catch {
      // ignore
    }
    // Open top visible queries and log all
    linksData.slice(0, 10).forEach(({ url }) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    linksData.forEach(({ airline }) => {
      addLog(`${airline} - TFN: ${tfn} - Checked`);
    });
  };

  const saveCustomUrl = () => {
    if (!editingAirline) return;
    const trimmed = editUrlInput.trim();
    if (trimmed) {
      setCustomUrls((prev) => ({ ...prev, [editingAirline]: trimmed }));
      addLog(`Updated custom target URL for ${editingAirline}`);
    }
    setEditingAirline(null);
  };

  const clearLogs = () => {
    setLogs([`[${new Date().toLocaleTimeString()}] Log cleared.`]);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Bar: TFN & Keyword Setup */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              TFN Number to Find (Auto-Copied for Ctrl+F / Cmd+F)
            </label>
            <input
              type="text"
              value={tfnToFind}
              onChange={(e) => setTfnToFind(e.target.value)}
              placeholder="Enter TFN Number..."
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Search Keyword (Live Updates All 41 Queries)
            </label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCustomUrls({});
              }}
              placeholder="e.g. missed flights, upgrade seat plan..."
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleOpenBatch}
              className="w-full h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>Open Batch Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Results List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Generated Search Targets &amp; Quick Actions</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              Total Queries: {linksData.length}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filterAirline}
              onChange={(e) => setFilterAirline(e.target.value)}
              placeholder="Filter airline..."
              className="h-8 pl-8 pr-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="fast-scroll-container max-h-[380px] divide-y divide-slate-100">
          {linksData.map(({ airline, url }, idx) => (
            <div
              key={airline}
              className={`fast-scroll-row flex items-center gap-3 px-4 py-2.5 transition-colors ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
              } hover:bg-slate-100/80`}
            >
              <span className="w-40 text-xs sm:text-sm font-bold text-slate-900 truncate shrink-0">
                {airline}
              </span>
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 min-w-0 bg-transparent text-xs font-mono text-slate-600 focus:outline-none truncate"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingAirline(airline);
                    setEditUrlInput(url);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(airline, url)}
                  className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  {copiedAirline === airline ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSingle(airline, url)}
                  className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TFN Tracking Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <span className="text-xs font-bold text-slate-800">
            TFN Tracking Log
          </span>
          <button
            type="button"
            onClick={clearLogs}
            className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>
        <div className="fast-scroll-container max-h-36 p-4 bg-slate-900 text-slate-200 font-mono text-xs space-y-1">
          {logs.map((entry, i) => (
            <div key={i} className="leading-relaxed">
              {entry}
            </div>
          ))}
        </div>
      </div>

      {/* Edit URL Modal */}
      {editingAirline && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Target URL for {editingAirline}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAirline(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={editUrlInput}
              onChange={(e) => setEditUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCustomUrl();
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingAirline(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomUrl}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Save URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
