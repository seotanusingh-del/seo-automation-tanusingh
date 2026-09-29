import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Edit3,
  CheckSquare,
  FileSpreadsheet,
  RefreshCw,
  Check,
  X,
  Table,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  ServiceAccountCredentials,
  DEFAULT_GOOGLE_SHEET_URL,
  DEFAULT_AIRLINES,
  extractGoogleSheetId,
  buildGoogleSheetUrl,
} from '../lib/seoHelpers';

export interface ConcatRowItem {
  id: number;
  prefix: string;
  suffix: string;
  result: string;
  selected: boolean;
}

interface LinkConcatenatorPanelProps {
  credentials: ServiceAccountCredentials;
  onSendUrlsToAutomation?: (urls: string[]) => void;
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const LinkConcatenatorPanel: React.FC<LinkConcatenatorPanelProps> = ({
  credentials,
  onSendUrlsToAutomation,
}) => {
  const [prefix, setPrefix] = useState<string>(() => {
    return localStorage.getItem('seo_concat_prefix') ?? 'http://prescott-az.gov';
  });
  const [suffix, setSuffix] = useState<string>(() => {
    return localStorage.getItem('seo_concat_suffix') ?? '';
  });
  const [rows, setRows] = useState<ConcatRowItem[]>(() => {
    try {
      const saved = localStorage.getItem('seo_concat_rows');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [rowCounter, setRowCounter] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('seo_concat_rows');
      const parsed: ConcatRowItem[] = saved ? JSON.parse(saved) : [];
      return parsed.length > 0 ? Math.max(...parsed.map((r) => r.id)) + 1 : 1;
    } catch {
      return 1;
    }
  });

  // Google Sheet Configuration State (persisted so user can change sheet anytime)
  const [sheetUrlInput, setSheetUrlInput] = useState<string>(() => {
    return localStorage.getItem('seo_google_sheet_url') || DEFAULT_GOOGLE_SHEET_URL;
  });
  const [sheetTabName, setSheetTabName] = useState<string>(() => {
    return localStorage.getItem('seo_google_sheet_tab') ?? 'SEO';
  });
  const [sheetColumn, setSheetColumn] = useState<string>(() => {
    return localStorage.getItem('seo_google_sheet_col') || 'B';
  });
  const [sheetStartRow, setSheetStartRow] = useState<number>(() => {
    return Number(localStorage.getItem('seo_google_sheet_start_row')) || 3;
  });
  const [includePrefixSuffixCols, setIncludePrefixSuffixCols] = useState<boolean>(false);

  // Sheet verification & last sync receipt
  const [verifiedSheetTitle, setVerifiedSheetTitle] = useState<string | null>(null);
  const [availableSheetTabs, setAvailableSheetTabs] = useState<string[]>([]);
  const [isCheckingSheet, setIsCheckingSheet] = useState(false);
  const [lastSyncReceipt, setLastSyncReceipt] = useState<{
    spreadsheetTitle: string;
    updatedRange: string;
    startRow: number;
    endRow: number;
    column: string;
    syncedCount: number;
    timestamp: string;
    sheetUrl: string;
  } | null>(null);
  const [copiedServiceEmail, setCopiedServiceEmail] = useState(false);
  const [copiedAllLinks, setCopiedAllLinks] = useState(false);

  // Bulk Paste Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSuffixText, setBulkSuffixText] = useState('');
  const [airlineSlugTopic, setAirlineSlugTopic] = useState('missed-flight-policy');

  const [status, setStatus] = useState(
    'Ready. Enter Prefix and Suffix above to concatenate links, or use Bulk Add.'
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(() => {
    return localStorage.getItem('seo_concat_auto_sync') !== 'false';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [savedSheetFlash, setSavedSheetFlash] = useState(false);
  const [exportedFlash, setExportedFlash] = useState(false);
  const [addedRowFlash, setAddedRowFlash] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ConcatRowItem | null>(null);
  const [editSuffixValue, setEditSuffixValue] = useState('');
  const suffixInputRef = useRef<HTMLInputElement>(null);

  // Pull globally saved Google Sheet configuration on mount so Mac & Phone stay in sync
  useEffect(() => {
    fetch('/api/workspace-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && cfg.updatedAt > 0) {
          if (cfg.googleSheetUrl) {
            setSheetUrlInput(cfg.googleSheetUrl);
            localStorage.setItem('seo_google_sheet_url', cfg.googleSheetUrl);
          }
          if (cfg.sheetTabName) {
            setSheetTabName(cfg.sheetTabName);
            localStorage.setItem('seo_google_sheet_tab', cfg.sheetTabName);
          }
          if (cfg.sheetColumn) {
            setSheetColumn(cfg.sheetColumn);
            localStorage.setItem('seo_google_sheet_col', cfg.sheetColumn);
          }
          if (cfg.sheetStartRow) {
            setSheetStartRow(Number(cfg.sheetStartRow));
            localStorage.setItem('seo_google_sheet_start_row', String(cfg.sheetStartRow));
          }
        }
      })
      .catch(() => {
        // ignore offline
      });
  }, []);

  useEffect(() => {
    localStorage.setItem('seo_concat_prefix', prefix);
  }, [prefix]);

  useEffect(() => {
    localStorage.setItem('seo_concat_suffix', suffix);
  }, [suffix]);

  useEffect(() => {
    localStorage.setItem('seo_concat_rows', JSON.stringify(rows));
  }, [rows]);

  useEffect(() => {
    localStorage.setItem('seo_google_sheet_url', sheetUrlInput);
  }, [sheetUrlInput]);

  useEffect(() => {
    localStorage.setItem('seo_google_sheet_tab', sheetTabName);
  }, [sheetTabName]);

  useEffect(() => {
    localStorage.setItem('seo_google_sheet_col', sheetColumn);
  }, [sheetColumn]);

  useEffect(() => {
    localStorage.setItem('seo_google_sheet_start_row', String(sheetStartRow));
  }, [sheetStartRow]);

  const cleanSheetId = useMemo(
    () => extractGoogleSheetId(sheetUrlInput),
    [sheetUrlInput]
  );

  const liveRangePreview = useMemo(() => {
    const start = Math.max(1, Number(sheetStartRow) || 3);
    const count = Math.max(1, rows.length);
    const end = start + count - 1;
    const col = (sheetColumn || 'B').toUpperCase();
    const endCol = includePrefixSuffixCols
      ? String.fromCharCode(Math.min(90, col.charCodeAt(0) + 2))
      : col;
    const cellPart =
      endCol !== col ? `${col}${start}:${endCol}${end}` : `${col}${start}:${col}${end}`;
    const tabPart = sheetTabName.trim() ? `${sheetTabName.trim()}!` : '';
    return {
      fullRange: `${tabPart}${cellPart}`,
      startRow: start,
      endRow: rows.length > 0 ? end : start,
      colDisplay: endCol !== col ? `${col} to ${endCol}` : col,
    };
  }, [sheetTabName, sheetColumn, sheetStartRow, rows.length, includePrefixSuffixCols]);

  const handleCheckSheetInfo = async (openLocationPrompt = false) => {
    setIsCheckingSheet(true);
    setStatus(`Checking Google Sheet (${cleanSheetId})...`);
    try {
      const res = await fetch('/api/check-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials,
          sheetId: cleanSheetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not inspect Google Sheet');
      }
      setVerifiedSheetTitle(data.title);
      if (Array.isArray(data.sheetTabs) && data.sheetTabs.length > 0) {
        setAvailableSheetTabs(data.sheetTabs);
        if (!data.sheetTabs.includes(sheetTabName) && data.sheetTabs[0]) {
          setSheetTabName(data.sheetTabs[0]);
        }
      }
      setStatus(
        `Verified Google Sheet: "${data.title}" · Select Tab, Column & Starting Row to save links.`
      );
      if (openLocationPrompt) {
        setShowLocationModal(true);
      }
    } catch (err: unknown) {
      setStatus(
        `Sheet Check Warning: ${err instanceof Error ? err.message : String(err)}`
      );
      if (openLocationPrompt) {
        setShowLocationModal(true);
      }
    } finally {
      setIsCheckingSheet(false);
    }
  };

  const handleSaveSheetLocationAndAutoSync = async () => {
    setSavedSheetFlash(true);
    setAutoSync(true);
    localStorage.setItem('seo_concat_auto_sync', 'true');
    try {
      await fetch('/api/workspace-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSheetUrl: sheetUrlInput.trim() || DEFAULT_GOOGLE_SHEET_URL,
          sheetTabName: sheetTabName.trim() || 'SEO',
          sheetColumn: sheetColumn || 'B',
          sheetStartRow: Math.max(1, Number(sheetStartRow) || 3),
        }),
      });
    } catch {
      // ignore
    }
    setShowLocationModal(false);
    setTimeout(() => setSavedSheetFlash(false), 1800);
    if (rows.length > 0) {
      await syncGoogleSheet(false);
    } else {
      setStatus(
        `Saved Google Sheet destination (${liveRangePreview.fullRange}) globally & enabled Auto-Sync! Links added above will automatically sync to Tab "${sheetTabName}", Column ${sheetColumn}, Starting Row ${sheetStartRow}.`
      );
    }
  };

  const addRow = () => {
    const valA = prefix.trim();
    const valB = suffix.trim();
    if (!valA || !valB) {
      setStatus(
        'Input Error: Both Common Value (Prefix) and Variable Value (Suffix) are required.'
      );
      return;
    }

    const concatResult = valA + valB;
    const newRow: ConcatRowItem = {
      id: rowCounter,
      prefix: valA,
      suffix: valB,
      result: concatResult,
      selected: false,
    };

    setRows((prev) => [...prev, newRow]);
    setRowCounter((prev) => prev + 1);
    setSuffix('');
    setAddedRowFlash(true);
    setTimeout(() => setAddedRowFlash(false), 900);
    setStatus(`Added row #${rowCounter}: ${concatResult}`);
    suffixInputRef.current?.focus();
  };

  const handleBulkAddSuffixes = () => {
    const valA = prefix.trim();
    if (!valA) {
      setStatus('Please enter a Common Value (Prefix) first.');
      return;
    }
    const lines = bulkSuffixText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setStatus('Paste at least one suffix line.');
      return;
    }

    let nextId = rowCounter;
    const newItems: ConcatRowItem[] = lines.map((line) => {
      const item: ConcatRowItem = {
        id: nextId++,
        prefix: valA,
        suffix: line,
        result: valA + line,
        selected: false,
      };
      return item;
    });

    setRows((prev) => [...prev, ...newItems]);
    setRowCounter(nextId);
    setBulkSuffixText('');
    setShowBulkModal(false);
    setStatus(`Bulk added ${newItems.length} concatenated links!`);
  };

  const handleGenerateAirlineSlugs = () => {
    const valA = prefix.trim() || 'http://prescott-az.gov';
    const cleanTopic =
      airlineSlugTopic
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'missed-flight-policy';

    let nextId = rowCounter;
    const newItems: ConcatRowItem[] = DEFAULT_AIRLINES.map((airline) => {
      const slug = airline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const sfx = `/${slug}-airlines-${cleanTopic}.pdf`;
      return {
        id: nextId++,
        prefix: valA,
        suffix: sfx,
        result: valA + sfx,
        selected: false,
      };
    });

    setRows((prev) => [...prev, ...newItems]);
    setRowCounter(nextId);
    setStatus(
      `Auto-generated ${newItems.length} airline SEO links (${cleanTopic})!`
    );
  };

  const handleCopyAllLinks = async () => {
    if (rows.length === 0) return;
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.result).join('\n'));
      setCopiedAllLinks(true);
      setStatus(`Copied all ${rows.length} links to clipboard!`);
      setTimeout(() => setCopiedAllLinks(false), 1800);
    } catch {
      setStatus('Clipboard copy failed.');
    }
  };

  const handleCopy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setStatus(`Copied row #${id} to clipboard.`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setStatus('Clipboard access failed.');
    }
  };

  const handleOpenLink = (url: string) => {
    const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setStatus(`Opened: ${targetUrl.slice(0, 60)}`);
  };

  const toggleSelectRow = (id: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const selectAll = () => {
    const allSelected = rows.length > 0 && rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
    setStatus(
      allSelected ? 'Deselected all rows.' : `Selected all ${rows.length} rows.`
    );
  };

  const deleteSelected = () => {
    const selectedCount = rows.filter((r) => r.selected).length;
    if (selectedCount === 0) {
      setStatus('Select at least one row to delete.');
      return;
    }
    setRows((prev) => prev.filter((r) => !r.selected));
    setStatus(`Deleted ${selectedCount} selected row(s).`);
  };

  const deleteSingleRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setStatus(`Deleted row #${id}.`);
  };

  const deleteAll = () => {
    if (rows.length === 0) return;
    setRows([]);
    setRowCounter(1);
    setStatus('All rows deleted.');
  };

  const openEditModal = (row?: ConcatRowItem) => {
    const target = row || rows.find((r) => r.selected) || rows[rows.length - 1];
    if (!target) {
      setStatus('No row available to edit.');
      return;
    }
    setEditingRow(target);
    setEditSuffixValue(target.suffix);
  };

  const saveEditedRow = () => {
    if (!editingRow) return;
    const trimmed = editSuffixValue.trim();
    if (!trimmed) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === editingRow.id
          ? { ...r, suffix: trimmed, result: r.prefix + trimmed }
          : r
      )
    );
    setStatus(`Updated row #${editingRow.id}`);
    setEditingRow(null);
  };

  const exportExcel = () => {
    if (rows.length === 0) {
      setStatus('No Data: Add links before exporting to Excel.');
      return;
    }
    // Export ONLY the concatenated links (one link per row in Column A, no extra columns or headers)
    const linkOnlyRows = rows.map((r) => [r.result]);
    const worksheet = XLSX.utils.aoa_to_sheet(linkOnlyRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Links');
    XLSX.writeFile(
      workbook,
      `concat-links-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    setExportedFlash(true);
    setTimeout(() => setExportedFlash(false), 1800);
    setStatus(`Exported ${rows.length} link(s) to Excel (links only).`);
  };

  const syncGoogleSheet = async (silent = false) => {
    if (rows.length === 0) {
      if (!silent) setStatus('No Data: Add links before syncing to Google Sheet.');
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials,
          sheetId: cleanSheetId,
          tabName: sheetTabName.trim(),
          column: sheetColumn,
          startRow: sheetStartRow,
          includePrefixSuffix: includePrefixSuffixCols,
          links: rows.map((r) => r.result),
          rowsData: rows.map((r) => ({
            id: r.id,
            prefix: r.prefix,
            suffix: r.suffix,
            result: r.result,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync');
      }
      if (data.spreadsheetTitle) {
        setVerifiedSheetTitle(data.spreadsheetTitle);
      }
      setLastSyncReceipt({
        spreadsheetTitle: data.spreadsheetTitle || 'Google Sheet',
        updatedRange: data.updatedRange || liveRangePreview.fullRange,
        startRow: data.startRow || liveRangePreview.startRow,
        endRow: data.endRow || liveRangePreview.endRow,
        column: data.column || sheetColumn,
        syncedCount: data.syncedCount || rows.length,
        timestamp: data.timestamp || new Date().toLocaleTimeString(),
        sheetUrl: data.sheetUrl || buildGoogleSheetUrl(sheetUrlInput),
      });
      setStatus(
        silent
          ? `Auto-synced ${rows.length} links to ${data.updatedRange} at ${data.timestamp}`
          : data.message
      );
    } catch (err: unknown) {
      if (!silent) {
        setStatus(
          `Sync Error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync whenever rows change if Auto-Sync is enabled
  useEffect(() => {
    if (!autoSync || rows.length === 0) return;
    const debounceTimer = setTimeout(() => {
      syncGoogleSheet(true);
    }, 1500);
    return () => clearTimeout(debounceTimer);
  }, [
    autoSync,
    rows,
    cleanSheetId,
    sheetTabName,
    sheetColumn,
    sheetStartRow,
    includePrefixSuffixCols,
  ]);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. TOP PRIORITY: Link Concatenator Input Bar + Bulk Generators */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Link Concatenator (Combine Prefix &amp; Suffix)
            </h2>
            <p className="text-xs text-slate-500">
              Enter your Common Value (Prefix) and Variable Value (Suffix) below to concatenate links immediately.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
            Sheet Target: {liveRangePreview.fullRange}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Common Value (Prefix Domain / Path)
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Enter prefix (e.g. http://prescott-az.gov)..."
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Variable Value (Suffix Slug / Query)
            </label>
            <input
              ref={suffixInputRef}
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addRow();
              }}
              placeholder="Enter suffix (press Enter to add)..."
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={addRow}
              className="w-full h-10 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-xs"
            >
              {addedRowFlash ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Row</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Bulk Actions Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Bulk Paste Suffixes (Multi-Line)</span>
            </button>

            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg p-1">
              <input
                type="text"
                value={airlineSlugTopic}
                onChange={(e) => setAirlineSlugTopic(e.target.value)}
                placeholder="missed-flight-policy"
                className="h-7 px-2.5 bg-white rounded border border-blue-200 text-xs font-mono text-slate-800 w-44 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateAirlineSlugs}
                className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Build All {DEFAULT_AIRLINES.length} Airline Links</span>
              </button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAllLinks}
                className="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedAllLinks ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied All {rows.length} Links!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Links</span>
                  </>
                )}
              </button>

              {onSendUrlsToAutomation && (
                <button
                  type="button"
                  onClick={() => onSendUrlsToAutomation(rows.map((r) => r.result))}
                  className="h-9 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Send to SEO Bulk Indexer / Checker</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Generated Links List with Exact Sheet Cell Badges & Sync Controls */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Generated Concatenated Links</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {rows.length} total
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <span>
              Destination Range: <strong>{liveRangePreview.fullRange}</strong>
            </span>
          </div>
        </div>

        <div className="fast-scroll-container max-h-[420px] divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                No concatenated links generated yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter a prefix and suffix above, click <strong>Bulk Paste Suffixes</strong>, or click <strong>Auto-Build All {DEFAULT_AIRLINES.length} Airline Links</strong> to populate your list.
              </p>
            </div>
          ) : (
            rows.map((row, idx) => {
              const targetSheetRowNum =
                Math.max(1, Number(sheetStartRow) || 3) + idx;
              const targetCellBadge = `${
                sheetTabName.trim() ? `${sheetTabName.trim()}!` : ''
              }${sheetColumn}${targetSheetRowNum}`;

              return (
                <div
                  key={row.id}
                  className={`fast-scroll-row flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    row.selected
                      ? 'bg-blue-50/80'
                      : idx % 2 === 0
                      ? 'bg-white'
                      : 'bg-slate-50/60'
                  } hover:bg-slate-100/80`}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleSelectRow(row.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="w-10 text-xs font-mono font-semibold text-slate-500 tabular-nums">
                    #{row.id}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-blue-700 shrink-0"
                    title={`This link will be written to cell ${targetCellBadge} in Google Sheets`}
                  >
                    {targetCellBadge}
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={row.result}
                    className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-mono text-slate-800 focus:outline-none truncate"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(row)}
                      className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.id, row.result)}
                      className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      {copiedId === row.id ? (
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
                      onClick={() => handleOpenLink(row.result)}
                      className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSingleRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                      title="Delete Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Control Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Select All</span>
            </button>
            <button
              type="button"
              onClick={() => openEditModal()}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit Row</span>
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              className="px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
            <button
              type="button"
              onClick={deleteAll}
              className="px-3 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {exportedFlash ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Exported Links!</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export to Excel (Links Only)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => {
                  setAutoSync(e.target.checked);
                  setStatus(
                    e.target.checked
                      ? `Auto-sync enabled (every 60s → ${liveRangePreview.fullRange})`
                      : 'Auto-sync disabled'
                  );
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Auto-Sync (60s)</span>
            </label>

            <button
              type="button"
              disabled={isSyncing}
              onClick={() => syncGoogleSheet(false)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>
                {isSyncing
                  ? `Syncing ${liveRangePreview.fullRange}...`
                  : `Sync to Sheet (${liveRangePreview.fullRange})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <p className="text-xs italic text-slate-500 px-1">{status}</p>

      {/* 3. BOTTOM SECTION: Shared Setup — Google Sheet Destination, Tab, Column & Row Mapping */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Table className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Shared Setup: Google Sheet Destination &amp; Row / Column Mapping
              </h3>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                Target Range: {liveRangePreview.fullRange}
              </span>
              {verifiedSheetTitle && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  Sheet: &ldquo;{verifiedSheetTitle}&rdquo;
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Configure which Google Sheet URL/ID, <strong>Worksheet Tab</strong>, <strong>Column</strong>, and <strong>Starting Row</strong> are updated when you click <strong>Sync to Sheet</strong> above.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isCheckingSheet}
              onClick={() => handleCheckSheetInfo(true)}
              className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingSheet ? 'animate-spin' : ''}`}
              />
              <span>
                {isCheckingSheet
                  ? 'Loading Sheet Tabs...'
                  : 'Update Sheet & Choose Save Location'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSaveSheetLocationAndAutoSync}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {savedSheetFlash ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved &amp; Auto-Synced!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Location &amp; Auto-Sync</span>
                </>
              )}
            </button>

            <a
              href={buildGoogleSheetUrl(sheetUrlInput)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <span>Open Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => {
                setSheetUrlInput(DEFAULT_GOOGLE_SHEET_URL);
                setSheetTabName('SEO');
                setSheetColumn('B');
                setSheetStartRow(3);
                setVerifiedSheetTitle(null);
                setStatus('Reset Google Sheet settings to default (SEO!B3).');
              }}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
              title="Reset to default Google Sheet"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Sheet URL + Tab + Column + Start Row Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Sheet URL or Spreadsheet ID (Paste New Link &amp; Press Enter)
            </label>
            <input
              type="text"
              value={sheetUrlInput}
              onChange={(e) => {
                setSheetUrlInput(e.target.value);
                setVerifiedSheetTitle(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCheckSheetInfo(true);
                }
              }}
              placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Worksheet Tab Name
            </label>
            {availableSheetTabs.length > 0 ? (
              <select
                value={sheetTabName}
                onChange={(e) => setSheetTabName(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {availableSheetTabs.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={sheetTabName}
                onChange={(e) => setSheetTabName(e.target.value)}
                placeholder="e.g. SEO or Sheet1"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Column
            </label>
            <select
              value={sheetColumn}
              onChange={(e) => setSheetColumn(e.target.value)}
              className="w-full h-10 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {COLUMNS.map((c) => (
                <option key={c} value={c}>
                  Column {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Start Row #
            </label>
            <input
              type="number"
              min={1}
              value={sheetStartRow}
              onChange={(e) =>
                setSheetStartRow(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Live Mapping Summary Bar */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700">
            <span>
              <strong>Active Sheet ID:</strong>{' '}
              <code className="text-slate-900 font-mono">{cleanSheetId}</code>
            </span>
            <span>
              <strong>Updating Cells:</strong>{' '}
              <code className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold font-mono">
                {liveRangePreview.fullRange}
              </code>{' '}
              (Column <strong>{liveRangePreview.colDisplay}</strong>, Row{' '}
              <strong>{liveRangePreview.startRow}</strong> to Row{' '}
              <strong>{liveRangePreview.endRow}</strong>)
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-medium text-slate-700">
              <input
                type="checkbox"
                checked={includePrefixSuffixCols}
                onChange={(e) => setIncludePrefixSuffixCols(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
              />
              <span>Also write Prefix &amp; Suffix in adjacent columns</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              If changing sheet, share Editor access with:
            </span>
            <code className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800">
              {credentials.client_email}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(credentials.client_email);
                  setCopiedServiceEmail(true);
                  setTimeout(() => setCopiedServiceEmail(false), 1800);
                } catch {
                  // ignore
                }
              }}
              className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded text-[11px] font-semibold text-blue-700 inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedServiceEmail ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Email</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Last Sync Receipt Banner */}
        {lastSyncReceipt && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Last Sync Confirmed ({lastSyncReceipt.timestamp}):</strong>{' '}
                Updated <strong>{lastSyncReceipt.syncedCount} rows</strong> in{' '}
                <strong>&ldquo;{lastSyncReceipt.spreadsheetTitle}&rdquo;</strong> &rarr; Range{' '}
                <code className="px-1.5 py-0.5 bg-emerald-100 rounded font-bold font-mono">
                  {lastSyncReceipt.updatedRange}
                </code>{' '}
                (Column {lastSyncReceipt.column}, Rows {lastSyncReceipt.startRow}–
                {lastSyncReceipt.endRow})
              </span>
            </div>
            <a
              href={lastSyncReceipt.sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-emerald-800 hover:underline inline-flex items-center gap-1"
            >
              <span>View Updated Rows in Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Choose Sheet Save Location Modal (Prompts for Tab, Column, and Start Row when Sheet is updated) */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Where Should Concatenated Links Be Saved?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {verifiedSheetTitle
                    ? `Connected to "${verifiedSheetTitle}" (${cleanSheetId})`
                    : `Sheet ID: ${cleanSheetId}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. On Which Sheet Tab?
                </label>
                {availableSheetTabs.length > 0 ? (
                  <select
                    value={sheetTabName}
                    onChange={(e) => setSheetTabName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {availableSheetTabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={sheetTabName}
                    onChange={(e) => setSheetTabName(e.target.value)}
                    placeholder="e.g. SEO or Sheet1"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Under Which Column?
                  </label>
                  <select
                    value={sheetColumn}
                    onChange={(e) => setSheetColumn(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c} value={c}>
                        Column {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Starting From Which Row #?
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={sheetStartRow}
                    onChange={(e) =>
                      setSheetStartRow(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 font-mono">
                Target Destination: <strong>{liveRangePreview.fullRange}</strong>{' '}
                (Tab <strong>{sheetTabName || 'Default'}</strong>, Column{' '}
                <strong>{sheetColumn}</strong>, starting at Row{' '}
                <strong>{sheetStartRow}</strong>)
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSheetLocationAndAutoSync}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save Location &amp; Auto-Sync Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Paste Suffixes Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Bulk Paste Suffixes (1 Per Line)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each line will be concatenated with prefix:{' '}
                  <code className="font-mono text-blue-700">{prefix}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={8}
              value={bulkSuffixText}
              onChange={(e) => setBulkSuffixText(e.target.value)}
              placeholder={`/delta-missed-flight.pdf\n/united-missed-flight.pdf\n/qatar-missed-flight.pdf`}
              className="w-full p-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAddSuffixes}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                Add All Rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Row Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Row #{editingRow.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="block text-xs font-semibold text-slate-500 mb-1">
                  Prefix (Common Value)
                </span>
                <p className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                  {editingRow.prefix}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modify Suffix (Variable Value)
                </label>
                <input
                  type="text"
                  value={editSuffixValue}
                  onChange={(e) => setEditSuffixValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditedRow();
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedRow}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
