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
  Eye,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react';
import { RANK_CHECKER_AIRLINES } from '../lib/seoHelpers';

interface SerpResultItem {
  position: number;
  title: string;
  link: string;
  snippet: string;
  hasTfn: boolean;
}

interface AirlineScanResult {
  airline: string;
  query: string;
  tfn: string;
  found: boolean;
  matchCount: number;
  results: SerpResultItem[];
  checkedAt: string;
}

/**
 * Builds a Scroll-To-Text Fragment (#:~:text=...) for Chrome/Edge/Brave
 * so that opening the Google USA Page 1 SERP automatically finds, scrolls to,
 * and highlights the Targeted TFN in yellow on Page 1.
 */
function buildTfnTextFragment(tfn: string): string {
  const trimmed = (tfn || '').trim();
  if (!trimmed) return '';

  const variants = new Set<string>([trimmed]);
  const digits = trimmed.replace(/[^\d]/g, '');
  const core10 =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (core10.length === 10) {
    const a = core10.slice(0, 3);
    const b = core10.slice(3, 6);
    const c = core10.slice(6, 10);
    variants.add(`+1-${a}-${b}-${c}`);
    variants.add(`1-${a}-${b}-${c}`);
    variants.add(`${a}-${b}-${c}`);
    variants.add(`(${a}) ${b}-${c}`);
    variants.add(`${a} ${b} ${c}`);
  }

  const params = Array.from(variants)
    .map((v) => `text=${encodeURIComponent(v)}`)
    .join('&');
  return `#:~:${params}`;
}

/**
 * Builds the canonical Google USA Server + Non-Personalized (Incognito equivalent) +
 * Page 1 Only (num=10&start=0) + TFN Auto-Highlight URL.
 */
function buildGoogleUsaIncognitoPage1Url(
  airline: string,
  keyword: string,
  tfn: string
): string {
  const q = `${airline.trim()} ${keyword.trim()}`.trim().replace(/\s+/g, '+');
  // gl=us (US Server), hl=en (US English), cr=countryUS (US Country),
  // pws=0 & nfpr=1 (Incognito Non-Personalized mode, zero history bias),
  // gws_rd=cr (Disable country redirect outside US),
  // uule=w+CAIQICIUVW5pdGVkIFN0YXRlcw== (Official Google UULE geolocation for United States),
  // num=10&start=0 (Strictly Page 1 Only - first 10 results)
  const baseUrl = `https://www.google.com/search?q=${q}&gl=us&hl=en&cr=countryUS&pws=0&nfpr=1&gws_rd=cr&uule=w+CAIQICIUVW5pdGVkIFN0YXRlcw==&num=10&start=0`;
  const highlightFragment = buildTfnTextFragment(tfn);
  return `${baseUrl}${highlightFragment}`;
}

/**
 * Highlights all occurrences of the Targeted TFN (in any formatting) inside a text string
 */
function highlightTfnInText(text: string, tfn: string): React.ReactNode {
  if (!text || !tfn.trim()) return text;
  const digits = tfn.replace(/[^\d]/g, '');
  const core =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  let regex: RegExp;
  if (core.length === 10) {
    const p1 = core.slice(0, 3);
    const p2 = core.slice(3, 6);
    const p3 = core.slice(6, 10);
    regex = new RegExp(
      `((?:\\+?1[-\\s.]?)?\\(?${p1}\\)?[-\\s.]?${p2}[-\\s.]?${p3})`,
      'gi'
    );
  } else {
    const escaped = tfn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return text;
    regex = new RegExp(`(${escaped})`, 'gi');
  }

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, idx) =>
    regex.test(part) ? (
      <mark
        key={idx}
        className="bg-yellow-300 text-slate-950 font-bold px-1 py-0.5 rounded border border-yellow-500"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const RankCheckerPanel: React.FC = () => {
  const [tfnToFind, setTfnToFind] = useState('+1-866-857-4025');
  const [searchKeyword, setSearchKeyword] = useState('missed flights');
  const [filterAirline, setFilterAirline] = useState('');
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [copiedAirline, setCopiedAirline] = useState<string | null>(null);
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');

  // Live Page-1 USA Incognito TFN Scanner state
  const [scanningAirlines, setScanningAirlines] = useState<Record<string, boolean>>({});
  const [scanResults, setScanResults] = useState<Record<string, AirlineScanResult>>({});
  const [activePreviewAirline, setActivePreviewAirline] = useState<string | null>(null);
  const [isBatchScanning, setIsBatchScanning] = useState(false);

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Ready. Google USA Server (gl=us, UULE=United States, pws=0 Incognito Mode, Page 1 Only num=10) + Auto TFN Highlighting active.`,
  ]);

  const linksData = useMemo(() => {
    const result: { airline: string; url: string }[] = [];

    for (const airline of RANK_CHECKER_AIRLINES) {
      if (
        filterAirline.trim() &&
        !airline.toLowerCase().includes(filterAirline.trim().toLowerCase())
      ) {
        continue;
      }
      const defaultUrl = buildGoogleUsaIncognitoPage1Url(
        airline,
        searchKeyword,
        tfnToFind
      );
      result.push({
        airline,
        url: customUrls[airline] || defaultUrl,
      });
    }
    return result;
  }, [searchKeyword, tfnToFind, customUrls, filterAirline]);

  const addLog = (message: string) => {
    const nowStr = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${nowStr}] ${message}`, ...prev]);
  };

  const handleCopyUrl = async (airline: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAirline(airline);
      setTimeout(() => setCopiedAirline(null), 1500);
      addLog(
        `Copied Google USA Page-1 URL for ${airline} (Paste in Ctrl+Shift+N Incognito tab)`
      );
    } catch {
      // ignore
    }
  };

  const runPage1UsaScan = async (airline: string, openModalAfter = false) => {
    const tfn = tfnToFind.trim();
    setScanningAirlines((prev) => ({ ...prev, [airline]: true }));
    try {
      const res = await fetch('/api/check-rank-usa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airline,
          keyword: searchKeyword.trim(),
          tfn,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const record: AirlineScanResult = {
          airline,
          query: data.query || `${airline} ${searchKeyword}`,
          tfn,
          found: Boolean(data.found),
          matchCount: Number(data.matchCount || 0),
          results: Array.isArray(data.results) ? data.results : [],
          checkedAt: new Date().toLocaleTimeString(),
        };
        setScanResults((prev) => ({ ...prev, [airline]: record }));
        if (record.found) {
          addLog(
            `✅ [PAGE 1 HIT] ${airline} - Targeted TFN (${tfn}) FOUND ${record.matchCount} time(s) on USA Page 1!`
          );
        } else {
          addLog(
            `❌ [PAGE 1 MISS] ${airline} - Targeted TFN (${tfn}) NOT found on USA Page 1.`
          );
        }
        if (openModalAfter) {
          setActivePreviewAirline(airline);
        }
      }
    } catch {
      addLog(`Scan warning for ${airline}: Could not reach USA SERP proxy.`);
    } finally {
      setScanningAirlines((prev) => ({ ...prev, [airline]: false }));
    }
  };

  const handleOpenSingle = async (airline: string) => {
    const tfn = tfnToFind.trim() || 'N/A';
    try {
      await navigator.clipboard.writeText(tfn);
    } catch {
      // ignore
    }
    addLog(
      `${airline} - Opened Google USA Server (Page 1 Only, pws=0 Incognito, Auto-Highlight TFN: ${tfn})`
    );
    // Also run the background Page-1 TFN check automatically
    runPage1UsaScan(airline, false);
  };

  const handleOpenBatch = async () => {
    const tfn = tfnToFind.trim() || 'N/A';
    try {
      await navigator.clipboard.writeText(tfn);
    } catch {
      // ignore
    }
    linksData.slice(0, 10).forEach(({ url }) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    addLog(
      `Opened batch of ${Math.min(10, linksData.length)} Google USA Page-1 queries with TFN (${tfn}) auto-highlight.`
    );
  };

  const handleBatchScanPage1 = async () => {
    if (isBatchScanning) return;
    setIsBatchScanning(true);
    addLog(
      `Scanning USA Page 1 (Incognito) for Targeted TFN (${tfnToFind}) across ${linksData.length} airlines...`
    );
    try {
      for (const item of linksData.slice(0, 12)) {
        await runPage1UsaScan(item.airline, false);
      }
    } finally {
      setIsBatchScanning(false);
    }
  };

  /**
   * Downloads a 1-click Windows (.bat) launcher that opens native Chrome in --incognito mode
   * directly on Google USA Page 1 with TFN highlighting for the selected airlines.
   */
  const downloadChromeIncognitoLauncher = (singleUrl?: string, airlineName?: string) => {
    const targetUrls = singleUrl
      ? [singleUrl]
      : linksData.slice(0, 10).map((d) => d.url);

    const batLines = [
      '@echo off',
      'REM Opens Google USA Server (Page 1 Only) in Native Chrome Incognito Mode with TFN Highlight',
      ...targetUrls.map((u) => `start chrome --incognito "${u}"`),
    ];
    const blob = new Blob([batLines.join('\r\n')], { type: 'text/plain' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = airlineName
      ? `open-${airlineName.toLowerCase().replace(/\s+/g, '-')}-usa-incognito.bat`
      : 'open-google-usa-incognito-batch.bat';
    a.click();
    URL.revokeObjectURL(objUrl);
    addLog(
      `Downloaded native Chrome --incognito USA Page-1 launcher (${targetUrls.length} URL(s)).`
    );
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

  const activeScanData = activePreviewAirline
    ? scanResults[activePreviewAirline]
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* USA Incognito & Page-1 TFN Highlight Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold">
              <Shield className="w-3.5 h-3.5" />
              USA Server + Page 1 Only + TFN Auto-Highlight
            </span>
            <span className="text-xs text-slate-300 font-mono">
              gl=us · cr=countryUS · pws=0 (Non-Personalized Incognito) · num=10 (Page 1) · #:~:text=TFN
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Click <strong>Open USA Page 1</strong> to open Google USA with automatic yellow TFN highlighting on Page 1 (or <strong>right-click &rarr; Open link in incognito window</strong>). Use <strong>Find &amp; Highlight TFN (Page 1)</strong> to scan and highlight your TFN on Page 1 directly inside the app.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isBatchScanning}
            onClick={handleBatchScanPage1}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {isBatchScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>
              {isBatchScanning ? 'Scanning Page 1...' : 'Scan Top 12 Page-1 TFN'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => downloadChromeIncognitoLauncher()}
            className="h-9 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Downloads a 1-click script that launches Chrome with --incognito on Google USA Page 1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Chrome Incognito Launcher (.bat)</span>
          </button>
        </div>
      </div>

      {/* Top Bar: TFN & Keyword Setup */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Targeted TFN Number to Find &amp; Highlight on Page 1
            </label>
            <input
              type="text"
              value={tfnToFind}
              onChange={(e) => setTfnToFind(e.target.value)}
              placeholder="e.g. +1-866-857-4025"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Search Keyword (Updates All {RANK_CHECKER_AIRLINES.length} Google USA Page-1 Queries)
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
              <span>Open USA Page-1 Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Results List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Google USA Page-1 Search Targets</span>
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

        <div className="fast-scroll-container max-h-[420px] divide-y divide-slate-100">
          {linksData.map(({ airline, url }, idx) => {
            const scan = scanResults[airline];
            const isScanning = Boolean(scanningAirlines[airline]);

            return (
              <div
                key={airline}
                className={`fast-scroll-row flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-2.5 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                } hover:bg-slate-100/80`}
              >
                <div className="w-44 shrink-0 flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {airline}
                  </span>
                  {scan && (
                    <button
                      type="button"
                      onClick={() => setActivePreviewAirline(airline)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer shrink-0 ${
                        scan.found
                          ? 'bg-yellow-300 text-slate-950 border border-yellow-500'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                      title="Click to view Page 1 results & TFN highlights"
                    >
                      {scan.found ? `P1 HIT (${scan.matchCount})` : 'P1: 0'}
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  readOnly
                  value={url}
                  className="flex-1 min-w-[180px] bg-transparent text-xs font-mono text-slate-600 focus:outline-none truncate"
                />

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => runPage1UsaScan(airline, true)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="Scan USA Page 1 Only & Highlight Targeted TFN"
                  >
                    {isScanning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden md:inline">
                      {isScanning ? 'Scanning P1...' : 'Find TFN (Page 1)'}
                    </span>
                  </button>

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

                  {/* Real <a> anchor tag so right-clicking shows "Open link in incognito window" in Chrome/Edge AND clicking opens Google USA Page 1 with #:~:text= TFN auto-highlight */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleOpenSingle(airline)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="Click to open Google USA Page 1 (with TFN highlight) or Right-Click -> Open link in incognito window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open USA P1</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TFN Tracking Log */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
          <span className="text-xs font-bold text-slate-800">
            USA Page-1 TFN Tracking Log
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

      {/* Page-1 USA Incognito SERP TFN Highlighter Modal */}
      {activeScanData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-5 shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    USA Page 1 Only (Incognito) · {activeScanData.airline}
                  </h3>
                  {activeScanData.found ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-300 text-slate-950 text-xs font-bold border border-yellow-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      TFN Highlighted ({activeScanData.matchCount} Match
                      {activeScanData.matchCount === 1 ? '' : 'es'} on Page 1)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Targeted TFN ({activeScanData.tfn}) Not Found on Page 1
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Query: &ldquo;{activeScanData.query}&rdquo; · Targeted TFN:{' '}
                  <strong className="text-slate-900">{activeScanData.tfn}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActivePreviewAirline(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="fast-scroll-container flex-1 my-3 space-y-2.5 pr-1">
              {activeScanData.results.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No organic snippets returned. Click &ldquo;Open Google USA Page 1&rdquo; below to view directly in your browser with automatic yellow TFN highlighting.
                </div>
              ) : (
                activeScanData.results.map((item) => (
                  <div
                    key={item.position}
                    className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                      item.hasTfn
                        ? 'bg-yellow-50/90 border-yellow-400 ring-2 ring-yellow-300'
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        Page 1 · Rank #{item.position}
                      </span>
                      {item.hasTfn && (
                        <span className="px-2 py-0.5 rounded bg-yellow-300 text-slate-950 font-bold text-[10px]">
                          TARGETED TFN MATCH ON PAGE 1
                        </span>
                      )}
                    </div>
                    <a
                      href={`${item.link}${buildTfnTextFragment(activeScanData.tfn)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-blue-700 hover:underline block"
                    >
                      {highlightTfnInText(item.title, activeScanData.tfn)}
                    </a>
                    <div className="text-[11px] font-mono text-emerald-700 truncate">
                      {item.link}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {highlightTfnInText(item.snippet, activeScanData.tfn)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() =>
                  downloadChromeIncognitoLauncher(
                    buildGoogleUsaIncognitoPage1Url(
                      activeScanData.airline,
                      searchKeyword,
                      activeScanData.tfn
                    ),
                    activeScanData.airline
                  )
                }
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open in Chrome --incognito (.bat)</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={buildGoogleUsaIncognitoPage1Url(
                    activeScanData.airline,
                    searchKeyword,
                    activeScanData.tfn
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Google USA Page 1 (Auto-Highlight TFN)</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePreviewAirline(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
