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
  Globe,
  Terminal,
  Info,
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
 * Builds a No-VPN Geolocated Google Search URL for ANY country/city in the world:
 * - Uses the selected country's Google domain (e.g. www.google.com, www.google.co.uk, www.google.ca)
 * - Injects official Google UULE geolocation parameter (uule=w+CAIQICI...) so no VPN is needed
 * - Adds gl=<country>, hl=<lang>, cr=country<CC>, gws_rd=cr (disables IP country redirect)
 * - Adds pws=0 & nfpr=1 (non-personalized Incognito SERP mode, zero history/cookie bias)
 * - Adds num=10&start=0 (Strictly Page 1 Only)
 * - Appends #:~:text=... fragment so Chrome automatically scrolls to & highlights the TFN on Page 1
 */
function buildNoVpnGooglePage1Url(
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
      `((?:\\+?1[-–—\\s._/•⚡]*)?\\(?${p1}\\)?[-–—\\s._/•⚡]*${p2}[-–—\\s._/•⚡]*${p3})`,
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
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>(() => {
    return localStorage.getItem('seo_rank_country') || 'US';
  });
  const [customLocationPlace, setCustomLocationPlace] = useState<string>(() => {
    return localStorage.getItem('seo_rank_custom_place') || '';
  });
  const [showNoVpnGuide, setShowNoVpnGuide] = useState(false);

  const [filterAirline, setFilterAirline] = useState('');
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [copiedAirline, setCopiedAirline] = useState<string | null>(null);
  const [copiedCmdAirline, setCopiedCmdAirline] = useState<string | null>(null);
  const [editingAirline, setEditingAirline] = useState<string | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');

  // Live Page-1 No-VPN Incognito TFN Scanner state
  const [scanningAirlines, setScanningAirlines] = useState<Record<string, boolean>>({});
  const [scanResults, setScanResults] = useState<Record<string, AirlineScanResult>>({});
  const [activePreviewAirline, setActivePreviewAirline] = useState<string | null>(null);
  const [isBatchScanning, setIsBatchScanning] = useState(false);

  const activePreset = useMemo(() => {
    return (
      SERP_COUNTRY_LOCATIONS.find((l) => l.code === selectedLocationCode) ||
      SERP_COUNTRY_LOCATIONS[0]
    );
  }, [selectedLocationCode]);

  const activePlaceName = customLocationPlace.trim() || activePreset.canonicalPlace;
  const activeUule = useMemo(() => encodeGoogleUule(activePlaceName), [activePlaceName]);

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Ready. No-VPN Geolocation (${activePreset.label}, UULE=${activeUule.slice(0, 18)}..., pws=0 Incognito, Page 1 Only) + Auto TFN Highlighting active.`,
  ]);

  const handleLocationChange = (code: string) => {
    setSelectedLocationCode(code);
    localStorage.setItem('seo_rank_country', code);
    setCustomUrls({});
    const found =
      SERP_COUNTRY_LOCATIONS.find((l) => l.code === code) || SERP_COUNTRY_LOCATIONS[0];
    addLog(
      `Switched Server Location to ${found.label} (gl=${found.gl}, domain=${found.googleDomain}, No-VPN UULE active).`
    );
  };

  const handleCustomPlaceChange = (val: string) => {
    setCustomLocationPlace(val);
    localStorage.setItem('seo_rank_custom_place', val);
    setCustomUrls({});
  };

  const linksData = useMemo(() => {
    const result: { airline: string; url: string }[] = [];

    for (const airline of RANK_CHECKER_AIRLINES) {
      if (
        filterAirline.trim() &&
        !airline.toLowerCase().includes(filterAirline.trim().toLowerCase())
      ) {
        continue;
      }
      const defaultUrl = buildNoVpnGooglePage1Url(
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
  }, [searchKeyword, tfnToFind, customUrls, filterAirline, activePreset, customLocationPlace]);

  function addLog(message: string) {
    const nowStr = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${nowStr}] ${message}`, ...prev]);
  }

  const handleCopyUrl = async (airline: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedAirline(airline);
      setTimeout(() => setCopiedAirline(null), 1500);
      addLog(
        `Copied ${activePreset.code} No-VPN Page-1 URL for ${airline} (Paste into Ctrl+Shift+N Incognito tab)`
      );
    } catch {
      // ignore
    }
  };

  /**
   * Copies a ready-to-run `chrome --incognito "<url>"` command for Win+R / Terminal
   * so the user can open a native OS Incognito window in 1 second.
   */
  const handleCopyIncognitoCommand = async (airline: string, url: string) => {
    const isMac =
      typeof navigator !== 'undefined' &&
      navigator.platform.toLowerCase().includes('mac');
    const cmd = isMac
      ? `open -na "Google Chrome" --args --incognito "${url}"`
      : `chrome --incognito "${url}"`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmdAirline(airline);
      setTimeout(() => setCopiedCmdAirline(null), 1800);
      addLog(
        `Copied native Chrome --incognito command for ${airline}! Press ${
          isMac ? 'Cmd+Space (Terminal)' : 'Win+R (Run)'
        } and paste to open native Incognito window.`
      );
    } catch {
      // ignore
    }
  };

  const runPage1NoVpnScan = async (airline: string, openModalAfter = false) => {
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
            `✅ [PAGE 1 HIT · ${activePreset.code}] ${airline} — Targeted TFN (${tfn}) FOUND ${record.matchCount} time(s) on Page 1!`
          );
        } else {
          addLog(
            `❌ [PAGE 1 MISS · ${activePreset.code}] ${airline} — Targeted TFN (${tfn}) NOT found on Page 1.`
          );
        }
        if (openModalAfter) {
          setActivePreviewAirline(airline);
        }
      }
    } catch {
      addLog(`Scan warning for ${airline}: Could not reach SERP proxy.`);
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
      `${airline} — Opened ${activePreset.label} (${activePlaceName}) Page 1 Only (pws=0 Incognito, UULE No-VPN, TFN: ${tfn})`
    );
    runPage1NoVpnScan(airline, false);
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
      `Opened batch of ${Math.min(10, linksData.length)} ${activePreset.label} Page-1 queries with TFN (${tfn}) auto-highlight.`
    );
  };

  const handleBatchScanPage1 = async () => {
    if (isBatchScanning) return;
    setIsBatchScanning(true);
    addLog(
      `Scanning ${activePreset.label} (${activePlaceName}) Page 1 (No-VPN Incognito) for TFN (${tfnToFind})...`
    );
    try {
      for (const item of linksData.slice(0, 12)) {
        await runPage1NoVpnScan(item.airline, false);
      }
    } finally {
      setIsBatchScanning(false);
    }
  };

  /**
   * Downloads a 1-click native Chrome --incognito launcher (.bat on Windows / .command on Mac)
   * that opens a real OS-level Chrome Incognito window on the chosen country's Google Server!
   */
  const downloadChromeIncognitoLauncher = (
    singleUrl?: string,
    airlineName?: string
  ) => {
    const targetUrls = singleUrl
      ? [singleUrl]
      : linksData.slice(0, 10).map((d) => d.url);

    const isMac =
      typeof navigator !== 'undefined' &&
      navigator.platform.toLowerCase().includes('mac');

    if (isMac) {
      const shLines = [
        '#!/usr/bin/env bash',
        `# Opens ${activePreset.label} (Page 1 Only, No-VPN UULE) in Native Chrome Incognito Mode`,
        ...targetUrls.map(
          (u) => `open -na "Google Chrome" --args --incognito "${u}"`
        ),
      ];
      const blob = new Blob([shLines.join('\n')], { type: 'text/plain' });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = airlineName
        ? `open-${airlineName.toLowerCase().replace(/\s+/g, '-')}-${activePreset.code.toLowerCase()}-incognito.command`
        : `open-google-${activePreset.code.toLowerCase()}-incognito-batch.command`;
      a.click();
      URL.revokeObjectURL(objUrl);
    } else {
      const batLines = [
        '@echo off',
        `REM Opens ${activePreset.label} (Page 1 Only, No-VPN UULE) in Native Chrome Incognito Mode`,
        ...targetUrls.map((u) => `start chrome --incognito "${u}"`),
      ];
      const blob = new Blob([batLines.join('\r\n')], { type: 'text/plain' });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = airlineName
        ? `open-${airlineName.toLowerCase().replace(/\s+/g, '-')}-${activePreset.code.toLowerCase()}-incognito.bat`
        : `open-google-${activePreset.code.toLowerCase()}-incognito-batch.bat`;
      a.click();
      URL.revokeObjectURL(objUrl);
    }

    addLog(
      `Downloaded native Chrome --incognito launcher for ${activePreset.label} (${targetUrls.length} URL(s)). Double-click the downloaded file to launch a real Chrome Incognito window!`
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
      {/* Top Banner: No-VPN Multi-Country Server + Native Incognito Controls (Clean Light UI) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Globe className="w-4 h-4 text-blue-600" />
                No-VPN Global Server: {activePreset.label}
              </span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-semibold">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                gl={activePreset.gl} · {activePreset.cr} · pws=0 (Incognito) · Page 1 Only
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Browse Any Country Without a VPN:</strong> Every query injects Google&rsquo;s official{' '}
              <code className="text-blue-700 bg-blue-50 px-1 rounded">uule={activeUule.slice(0, 20)}...</code> geolocation token +{' '}
              <code className="text-blue-700 bg-blue-50 px-1 rounded">gws_rd=cr</code> + <code className="text-blue-700 bg-blue-50 px-1 rounded">pws=0</code> to force{' '}
              <strong>{activePlaceName}</strong> results without a VPN. For <strong>Incognito Mode</strong>: click{' '}
              <strong>In-App Incognito P1</strong> (zero cookies inside the app), <strong>Right-Click &ldquo;Open {activePreset.code} P1&rdquo; &rarr; Open link in incognito window</strong>, or use the <strong>1-Click Native Chrome --incognito Launcher</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowNoVpnGuide((v) => !v)}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>{showNoVpnGuide ? 'Hide No-VPN & Incognito Guide' : 'How No-VPN & Incognito Work'}</span>
            </button>

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
                {isBatchScanning
                  ? `Scanning ${activePreset.code} P1...`
                  : `Scan Top 12 (${activePreset.code} Page 1)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => downloadChromeIncognitoLauncher()}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Downloads a 1-click launcher that opens native Chrome with --incognito on the selected country server"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Launch Native Chrome Incognito (.bat)</span>
            </button>
          </div>
        </div>

        {/* Collapsible Explanation: How to Browse Any Country Without VPN & Why/How Incognito Works */}
        {showNoVpnGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-blue-700 flex items-center gap-1.5">
                <span>01. How We Bypass VPN (Google UULE Token)</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Normally you need a VPN because Google checks your IP. We eliminate the VPN by encoding your chosen Country/City (<code>{activePlaceName}</code>) into Google&rsquo;s official Protobuf parameter (<code>uule={activeUule}</code>) combined with <code>gl={activePreset.gl}</code>, <code>cr={activePreset.cr}</code>, and <code>gws_rd=cr</code> (which stops Google from redirecting to your local country IP).
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-emerald-700 flex items-center gap-1.5">
                <span>02. Why Web Buttons Cannot Directly Open Chrome Incognito</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                For browser security, Chrome/Edge/Brave block normal webpage JavaScript (<code>window.open</code>) from spawning an OS-level Incognito window directly. Instead, we give you <strong>3 instant ways</strong> to browse in true Incognito:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                <li><strong>Right-click &ldquo;Open {activePreset.code} P1&rdquo;</strong> &rarr; <em>Open link in incognito window</em></li>
                <li>Click <strong>Cmd</strong> on any row &rarr; Press <code>Win+R</code> &rarr; Paste &rarr; Opens native <code>chrome --incognito</code></li>
                <li>Click <strong>In-App Incognito P1</strong> to scan &amp; highlight Page 1 via our zero-cookie backend proxy</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>03. Page-1 Only + Auto Yellow TFN Highlight</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Every URL includes <code>&amp;num=10&amp;start=0</code> (strictly Page 1 top 10 results) plus Chrome&rsquo;s Scroll-To-Text fragment (<code>#:~:text={tfnToFind}</code>) so if your Targeted TFN appears anywhere on Page 1, Chrome automatically scrolls to it and highlights it in yellow.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Country Location Selector + TFN + Keyword Setup */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Select Target Country / Google Server (No VPN Needed)
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
              Optional Custom City / Region Override (Any Location Worldwide)
            </label>
            <input
              type="text"
              value={customLocationPlace}
              onChange={(e) => handleCustomPlaceChange(e.target.value)}
              placeholder={`Default: ${activePreset.canonicalPlace} (or type e.g. Miami,Florida,United States)`}
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-3">
            <div className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Active No-VPN UULE Location
              </span>
              <span className="text-xs font-mono text-slate-800 truncate">
                {activePlaceName}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2 border-t border-slate-100">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              2. Targeted TFN Number to Find &amp; Highlight on Page 1
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
              3. Search Keyword (Updates All {RANK_CHECKER_AIRLINES.length}{' '}
              {activePreset.code} Page-1 Queries)
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
              <span>Open {activePreset.code} Page-1 Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Results List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            <span>
              {activePreset.label} ({activePlaceName}) · Page-1 Search Targets
            </span>
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
                  className="flex-1 min-w-[160px] bg-transparent text-xs font-mono text-slate-600 focus:outline-none truncate"
                />

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {/* 1. In-App No-VPN Incognito Page-1 Scanner & Highlighter */}
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => runPage1NoVpnScan(airline, true)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-yellow-200 hover:bg-yellow-300 border border-yellow-400 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="Browse Page 1 inside the app (Zero Cookies / No-VPN Server Proxy) & Highlight Targeted TFN"
                  >
                    {isScanning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden md:inline">
                      {isScanning ? 'Scanning P1...' : 'In-App Incognito P1'}
                    </span>
                  </button>

                  {/* 2. Copy Native `chrome --incognito` command */}
                  <button
                    type="button"
                    onClick={() => handleCopyIncognitoCommand(airline, url)}
                    className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title="Copy native `chrome --incognito` command (Paste in Win+R or Terminal to launch a real Chrome Incognito window)"
                  >
                    {copiedCmdAirline === airline ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden lg:inline text-emerald-700">Cmd Copied</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">Incognito Cmd</span>
                      </>
                    )}
                  </button>

                  {/* 3. Edit URL */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAirline(airline);
                      setEditUrlInput(url);
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Edit</span>
                  </button>

                  {/* 4. Copy URL */}
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

                  {/* 5. Real <a> anchor tag: Left-Click opens No-VPN Google Page 1 with TFN highlight; Right-Click -> "Open link in incognito window" */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleOpenSingle(airline)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    title={`Left-Click to open ${activePreset.label} Page 1 (No-VPN UULE + TFN Highlight) OR Right-Click -> "Open link in incognito window"`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open {activePreset.code} P1</span>
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
            No-VPN Global Server &amp; Page-1 TFN Tracking Log
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
        <div className="fast-scroll-container max-h-36 p-4 bg-slate-50 text-slate-700 font-mono text-xs space-y-1">
          {logs.map((entry, i) => (
            <div key={i} className="leading-relaxed">
              {entry}
            </div>
          ))}
        </div>
      </div>

      {/* Page-1 No-VPN Incognito SERP TFN Highlighter Modal */}
      {activeScanData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-5 shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeScanData.regionLabel} · Page 1 Only · {activeScanData.airline}
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
                  <strong className="text-slate-900">{activeScanData.tfn}</strong> · UULE:{' '}
                  <code>{activeScanData.uule.slice(0, 22)}...</code>
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
                  No organic snippets returned. Click &ldquo;Open {activePreset.code} Page 1&rdquo; below to view directly in your browser with automatic yellow TFN highlighting.
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
                    buildNoVpnGooglePage1Url(
                      activeScanData.airline,
                      searchKeyword,
                      activeScanData.tfn,
                      activePreset,
                      customLocationPlace
                    ),
                    activeScanData.airline
                  )
                }
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open in Native Chrome --incognito (.bat)</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={buildNoVpnGooglePage1Url(
                    activeScanData.airline,
                    searchKeyword,
                    activeScanData.tfn,
                    activePreset,
                    customLocationPlace
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open {activePreset.code} Page 1 (Auto-Highlight TFN)</span>
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
