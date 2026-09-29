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
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  RANK_CHECKER_AIRLINES,
  SERP_COUNTRY_LOCATIONS,
  SerpLocationOption,
  encodeGoogleUule,
} from '../lib/seoHelpers';

interface SerpResultItem {
  position: number;
  title: string;
  link: string;
  snippet: string;
  hasTfn: boolean;
  matchedIn?: string[];
}

interface AirlineScanResult {
  airline: string;
  query: string;
  tfn: string;
  regionLabel: string;
  uule: string;
  found: boolean;
  matchCount: number;
  results: SerpResultItem[];
  checkedAt: string;
}

/**
 * Builds a Scroll-To-Text Fragment (#:~:text=...) for Chrome/Edge/Brave
 * so that opening the Google Page 1 SERP automatically finds, scrolls to,
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
    variants.add(`+1--(${a})-${b}-${c}`);
  }

  const params = Array.from(variants)
    .map((v) => `text=${encodeURIComponent(v)}`)
    .join('&');
  return `#:~:${params}`;
}

/**
 * Builds a Geolocated Google Search URL for Page 1 with automatic TFN highlight fragment
 */
function buildGooglePage1Url(
  airline: string,
  keyword: string,
  tfn: string,
  locationPreset: SerpLocationOption,
  customPlaceOverride: string
): string {
  const q = `${airline.trim()} ${keyword.trim()}`.trim().replace(/\s+/g, '+');
  const place = customPlaceOverride.trim() || locationPreset.canonicalPlace;
  const uule = encodeGoogleUule(place);
  const baseUrl = `https://${locationPreset.googleDomain}/search?q=${q}&gl=${locationPreset.gl}&hl=${locationPreset.hl}&cr=${locationPreset.cr}&pws=0&nfpr=1&gws_rd=cr&uule=${encodeURIComponent(
    uule
  )}&num=10&start=0`;
  const highlightFragment = buildTfnTextFragment(tfn);
  return `${baseUrl}${highlightFragment}`;
}

/**
 * Highlights all occurrences of the Targeted TFN (in any formatting, including inside PDF URLs, Headings, or Descriptions)
 */
function highlightTfnInText(text: string, tfn: string): React.ReactNode {
  if (!text || !tfn.trim()) return text;
  const cleanText = text.replace(/\*\*/g, '');
  const digits = tfn.replace(/[^\d]/g, '');
  const core =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  let regex: RegExp;
  if (core.length === 10) {
    const p1 = core.slice(0, 3);
    const p2 = core.slice(3, 6);
    const p3a = core.slice(6, 8);
    const p3b = core.slice(8, 10);
    const sep = `[-–—\\s._/•⚡*→~()\\[\\]{}+]{0,6}`;
    regex = new RegExp(
      `((?:\\+?1${sep})?[(\\[{]*${p1}[)\\]}]*${sep}${p2}${sep}${p3a}${sep}${p3b})`,
      'gi'
    );
  } else {
    const escaped = tfn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return cleanText;
    regex = new RegExp(`(${escaped})`, 'gi');
  }

  const parts = cleanText.split(regex);
  if (parts.length === 1) return cleanText;

  return parts.map((part, idx) => {
    regex.lastIndex = 0;
    return regex.test(part) ? (
      <mark
        key={idx}
        className="bg-yellow-300 text-slate-950 font-bold px-1 py-0.5 rounded border border-yellow-500"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    );
  });
}

export const RankCheckerPanel: React.FC = () => {
  const [tfnToFind, setTfnToFind] = useState('+1-866-857-4025');
  const [searchKeyword, setSearchKeyword] = useState('missed flights');
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>(() => {
    return localStorage.getItem('seo_rank_country') || 'US';
  });
  const [customLocationPlace, setCustomLocationPlace] = useState<string>(() => {
    return localStorage.getItem('seo_rank_custom_place') || '';
  });

  const [filterAirline, setFilterAirline] = useState('');
  const [deletedAirlines, setDeletedAirlines] = useState<string[]>([]);
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [copiedAirline, setCopiedAirline] = useState<string | null>(null);
  const [openedAirline, setOpenedAirline] = useState<string | null>(null);
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [savedUrlFlash, setSavedUrlFlash] = useState(false);

  // Page-1 TFN Scanner state
  const [scanningAirlines, setScanningAirlines] = useState<Record<string, boolean>>({});
  const [scanResults, setScanResults] = useState<Record<string, AirlineScanResult>>({});
  const [activePreviewAirline, setActivePreviewAirline] = useState<string | null>(null);
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  const activePreset = useMemo(() => {
    return (
      SERP_COUNTRY_LOCATIONS.find((l) => l.code === selectedLocationCode) ||
      SERP_COUNTRY_LOCATIONS[0]
    );
  }, [selectedLocationCode]);

  const activePlaceName = customLocationPlace.trim() || activePreset.canonicalPlace;
  const activeUule = useMemo(() => encodeGoogleUule(activePlaceName), [activePlaceName]);

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Ready. Enter Targeted TFN & Keyword above, then click "TFN Check" on any row or "Bulk TFN Num Search".`,
  ]);

  const handleLocationChange = (code: string) => {
    setSelectedLocationCode(code);
    localStorage.setItem('seo_rank_country', code);
    setCustomUrls({});
    const found =
      SERP_COUNTRY_LOCATIONS.find((l) => l.code === code) || SERP_COUNTRY_LOCATIONS[0];
    addLog(`Switched target location to ${found.label} (${found.googleDomain}).`);
  };

  const handleCustomPlaceChange = (val: string) => {
    setCustomLocationPlace(val);
    localStorage.setItem('seo_rank_custom_place', val);
    setCustomUrls({});
  };

  const linksData = useMemo(() => {
    const result: { airline: string; url: string }[] = [];

    for (const airline of RANK_CHECKER_AIRLINES) {
      if (deletedAirlines.includes(airline)) continue;
      if (
        filterAirline.trim() &&
        !airline.toLowerCase().includes(filterAirline.trim().toLowerCase())
      ) {
        continue;
      }
      const defaultUrl = buildGooglePage1Url(
        airline,
        searchKeyword,
        tfnToFind,
        activePreset,
        customLocationPlace
      );
      result.push({
        airline,
        url: customUrls[airline] || defaultUrl,
      });
    }
    return result;
  }, [
    searchKeyword,
    tfnToFind,
    customUrls,
    filterAirline,
    activePreset,
    customLocationPlace,
    deletedAirlines,
  ]);

  function addLog(message: string) {
    const nowStr = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${nowStr}] ${message}`, ...prev]);
  }

  const handleCopyUrl = async (airline: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAirline(airline);
      setTimeout(() => setCopiedAirline(null), 1500);
      addLog(`Copied Page-1 URL for ${airline}`);
    } catch {
      // ignore
    }
  };

  const handleDeleteRow = (airline: string) => {
    setDeletedAirlines((prev) => (prev.includes(airline) ? prev : [...prev, airline]));
    addLog(`Deleted ${airline} from Rank Checker list.`);
  };

  const handleRestoreDeleted = () => {
    setDeletedAirlines([]);
    addLog(`Restored all ${RANK_CHECKER_AIRLINES.length} airlines.`);
  };

  const runTfnCheck = async (airline: string, openModalAfter = true) => {
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
          locationCode: selectedLocationCode,
          customLocation: customLocationPlace.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const record: AirlineScanResult = {
          airline,
          query: data.query || `${airline} ${searchKeyword}`,
          tfn,
          regionLabel: data.region || `${activePreset.label} (${activePlaceName})`,
          uule: data.uule || activeUule,
          found: Boolean(data.found),
          matchCount: Number(data.matchCount || 0),
          results: Array.isArray(data.results) ? data.results : [],
          checkedAt: new Date().toLocaleTimeString(),
        };
        setScanResults((prev) => ({ ...prev, [airline]: record }));
        if (record.found) {
          addLog(
            `✅ [PAGE 1 HIT] ${airline} — TFN (${tfn}) FOUND in ${record.matchCount} result(s) on Page 1!`
          );
        } else {
          addLog(
            `❌ [PAGE 1 MISS] ${airline} — TFN (${tfn}) NOT found on Page 1.`
          );
        }
        if (openModalAfter) {
          setActivePreviewAirline(airline);
        }
      }
    } catch {
      addLog(`TFN Check error for ${airline}: Could not reach SERP checker.`);
    } finally {
      setScanningAirlines((prev) => ({ ...prev, [airline]: false }));
    }
  };

  const handleOpenSingle = async (airline: string) => {
    const tfn = tfnToFind.trim() || 'N/A';
    setOpenedAirline(airline);
    setTimeout(() => setOpenedAirline(null), 1200);
    try {
      await navigator.clipboard.writeText(tfn);
    } catch {
      // ignore
    }
    addLog(`${airline} — Opened ${activePreset.label} Page 1 (TFN: ${tfn})`);
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
      `Opened batch of ${Math.min(10, linksData.length)} Page-1 queries with TFN (${tfn}) highlight.`
    );
  };

  const handleBulkTfnSearch = async () => {
    if (isBulkSearching || linksData.length === 0) return;
    setIsBulkSearching(true);
    const total = linksData.length;
    setBulkProgress({ current: 0, total });
    addLog(
      `Starting Bulk TFN Search across ${total} airlines for TFN (${tfnToFind})...`
    );
    try {
      for (let i = 0; i < linksData.length; i++) {
        setBulkProgress({ current: i + 1, total });
        await runTfnCheck(linksData[i].airline, false);
      }
      addLog(`Completed Bulk TFN Search across ${total} airlines!`);
    } finally {
      setIsBulkSearching(false);
      setBulkProgress(null);
    }
  };

  const saveCustomUrl = () => {
    if (!editingAirline) return;
    const trimmed = editUrlInput.trim();
    if (trimmed) {
      setCustomUrls((prev) => ({ ...prev, [editingAirline]: trimmed }));
      addLog(`Updated custom target URL for ${editingAirline}`);
    }
    setSavedUrlFlash(true);
    setTimeout(() => {
      setSavedUrlFlash(false);
      setEditingAirline(null);
    }, 350);
  };

  const clearLogs = () => {
    setLogs([`[${new Date().toLocaleTimeString()}] Log cleared.`]);
  };

  const activeScanData = activePreviewAirline
    ? scanResults[activePreviewAirline]
    : null;

  const totalHitsCount = useMemo(() => {
    return Object.values(scanResults).filter((r) => r.found).length;
  }, [scanResults]);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Progress Loader Bar when Bulk TFN Search is running */}
      {isBulkSearching && bulkProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-blue-900">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span>
              Running Bulk TFN Num Search ({bulkProgress.current} of{' '}
              {bulkProgress.total} airlines)... Checking PDF URLs, Headings &amp;
              Descriptions on Page 1
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-mono font-bold">
            {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
          </span>
        </div>
      )}

      {/* Country Location Selector + TFN + Keyword + Bulk TFN Search Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Select Target Country / Google Server
            </label>
            <select
              value={selectedLocationCode}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {SERP_COUNTRY_LOCATIONS.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.label} ({loc.googleDomain} · gl={loc.gl})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional Custom City / Region Override
            </label>
            <input
              type="text"
              value={customLocationPlace}
              onChange={(e) => handleCustomPlaceChange(e.target.value)}
              placeholder={`Default: ${activePreset.canonicalPlace}`}
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <div className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Active Location &amp; Hits
              </span>
              <span className="text-xs font-mono text-slate-800 truncate">
                {activePlaceName} · Hits: {totalHitsCount}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-100">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              2. Targeted TFN Number to Find &amp; Highlight
            </label>
            <input
              type="text"
              value={tfnToFind}
              onChange={(e) => setTfnToFind(e.target.value)}
              placeholder="e.g. +1-866-857-4025"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              3. Search Keyword
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
              disabled={isBulkSearching || linksData.length === 0}
              onClick={handleBulkTfnSearch}
              className="w-full h-10 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
            >
              {isBulkSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Searching{' '}
                    {bulkProgress
                      ? `${bulkProgress.current}/${bulkProgress.total}`
                      : '...'}
                  </span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Bulk TFN Num Search</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleOpenBatch}
              className="w-full h-10 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
            >
              <Rocket className="w-4 h-4" />
              <span>Bulk Open</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Results List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            <span>
              {activePreset.label} · Page-1 Search Targets
            </span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              Showing {linksData.length} of {RANK_CHECKER_AIRLINES.length}
            </span>
            {deletedAirlines.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreDeleted}
                className="px-2.5 py-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Deleted ({deletedAirlines.length})</span>
              </button>
            )}
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

        <div className="fast-scroll-container max-h-[460px] divide-y divide-slate-100">
          {linksData.map(({ airline, url }, idx) => {
            const scan = scanResults[airline];
            const isScanning = Boolean(scanningAirlines[airline]);

            return (
              <div
                key={airline}
                className={`fast-scroll-row flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-2.5 transition-colors ${
                  scan?.found
                    ? 'bg-yellow-50/80'
                    : idx % 2 === 0
                    ? 'bg-white'
                    : 'bg-slate-50/60'
                } hover:bg-slate-100/80`}
              >
                <div className="w-48 shrink-0 flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {airline}
                  </span>
                  {scan && (
                    <button
                      type="button"
                      onClick={() => setActivePreviewAirline(airline)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer shrink-0 transition-all active:scale-95 ${
                        scan.found
                          ? 'bg-yellow-300 text-slate-950 border border-yellow-500 shadow-2xs'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                      title="Click to view Page 1 results & TFN highlights"
                    >
                      {scan.found ? `TFN HIT (${scan.matchCount})` : 'No TFN Hit'}
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  readOnly
                  value={url}
                  className="flex-1 min-w-[160px] bg-transparent text-xs font-mono text-slate-600 focus:outline-none truncate"
                />

                {/* ONLY the 5 required buttons: TFN Check, Edit, Open, Copy, Delete */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {/* 1. TFN Num Check Button */}
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => runTfnCheck(airline, true)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-yellow-200 hover:bg-yellow-300 active:scale-95 border border-yellow-400 rounded-md transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="Check Page 1 for TFN in PDF URL, Heading, or Description & Highlight Matches"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        <span>TFN Check</span>
                      </>
                    )}
                  </button>

                  {/* 2. Edit Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAirline(airline);
                      setEditUrlInput(url);
                    }}
                    className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 active:scale-95 rounded-md transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  {/* 3. Open Button */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleOpenSingle(airline)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-md transition-all inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    {openedAirline === airline ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Opened</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </>
                    )}
                  </a>

                  {/* 4. Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(airline, url)}
                    className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:scale-95 rounded-md transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
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

                  {/* 5. Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(airline)}
                    className="px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 active:scale-95 rounded-md transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title={`Delete ${airline} row`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Delete</span>
                  </button>
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
            Page-1 TFN Check Activity Log
          </span>
          <button
            type="button"
            onClick={clearLogs}
            className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 active:scale-95 rounded-md transition-all flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>
        <div className="fast-scroll-container max-h-36 p-4 bg-slate-50 text-slate-700 font-mono text-xs space-y-1">
          {logs.map((entry, i) => (
            <div key={i} className="leading-relaxed">
              {entry}
            </div>
          ))}
        </div>
      </div>

      {/* Page-1 TFN Highlighter Modal */}
      {activeScanData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-5 shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeScanData.regionLabel} · Page 1 · {activeScanData.airline}
                  </h3>
                  {activeScanData.found ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-300 text-slate-950 text-xs font-bold border border-yellow-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      TFN Found &amp; Highlighted ({activeScanData.matchCount} Match
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
                  No snippets returned. Click &ldquo;Open Page 1&rdquo; below to view directly in your browser with automatic yellow TFN highlighting.
                </div>
              ) : (
                activeScanData.results.map((item) => (
                  <div
                    key={item.position}
                    className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                      item.hasTfn
                        ? 'bg-yellow-50/90 border-yellow-400 ring-2 ring-yellow-300'
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        Page 1 · Rank #{item.position}
                      </span>
                      {item.hasTfn && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-yellow-300 text-slate-950 font-bold text-[10px]">
                            TARGETED TFN FOUND ON PAGE 1
                          </span>
                          {item.matchedIn && item.matchedIn.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[10px]">
                              Matched in: {item.matchedIn.join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Heading (Title) with TFN Highlight */}
                    <a
                      href={`${item.link}${buildTfnTextFragment(activeScanData.tfn)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-blue-700 hover:underline block"
                    >
                      {highlightTfnInText(item.title, activeScanData.tfn)}
                    </a>

                    {/* PDF / Site Address (URL) with TFN Highlight */}
                    <div className="text-[11px] font-mono text-emerald-700 break-all">
                      {highlightTfnInText(item.link, activeScanData.tfn)}
                    </div>

                    {/* Description (Snippet) with TFN Highlight */}
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {highlightTfnInText(item.snippet, activeScanData.tfn)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <a
                href={buildGooglePage1Url(
                  activeScanData.airline,
                  searchKeyword,
                  activeScanData.tfn,
                  activePreset,
                  customLocationPlace
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg inline-flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open {activePreset.code} Page 1</span>
              </a>
              <button
                type="button"
                onClick={() => setActivePreviewAirline(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-lg cursor-pointer transition-all"
              >
                Close
              </button>
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
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
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
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 active:scale-95 rounded-lg cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomUrl}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {savedUrlFlash ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save URL</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
