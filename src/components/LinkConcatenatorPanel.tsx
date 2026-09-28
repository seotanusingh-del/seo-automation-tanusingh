import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { ServiceAccountCredentials, GOOGLE_SHEET_ID } from '../lib/seoHelpers';

export interface ConcatRowItem {
  id: number;
  prefix: string;
  suffix: string;
  result: string;
  selected: boolean;
}

interface LinkConcatenatorPanelProps {
  credentials: ServiceAccountCredentials;
}

export const LinkConcatenatorPanel: React.FC<LinkConcatenatorPanelProps> = ({
  credentials,
}) => {
  const [prefix, setPrefix] = useState('http://prescott-az.gov');
  const [suffix, setSuffix] = useState('');
  const [rows, setRows] = useState<ConcatRowItem[]>([]);
  const [rowCounter, setRowCounter] = useState(1);
  const [status, setStatus] = useState(
    'Ready. Add prefix and suffix values to generate links.'
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingRow, setEditingRow] = useState<ConcatRowItem | null>(null);
  const [editSuffixValue, setEditSuffixValue] = useState('');
  const suffixInputRef = useRef<HTMLInputElement>(null);

  const addRow = () => {
    const valA = prefix.trim();
    const valB = suffix.trim();
    if (!valA || !valB) {
      setStatus('Input Error: Both Common Value (Prefix) and Variable Value (Suffix) are required.');
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
    setStatus(`Added row #${rowCounter}: ${concatResult}`);
    suffixInputRef.current?.focus();
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
    setStatus(allSelected ? 'Deselected all rows.' : `Selected all ${rows.length} rows.`);
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
    const worksheetData = rows.map((r) => ({
      'Row ID': r.id,
      'Generated Link': r.result,
      Prefix: r.prefix,
      Suffix: r.suffix,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SEO Links');
    XLSX.writeFile(workbook, `seo-links-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setStatus(`Exported ${rows.length} row(s) to Excel.`);
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
          sheetId: GOOGLE_SHEET_ID,
          links: rows.map((r) => r.result),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync');
      }
      setStatus(
        silent
          ? `Auto-synced ${rows.length} links at ${data.timestamp}`
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

  useEffect(() => {
    if (!autoSync) return;
    const timer = setInterval(() => {
      if (rows.length > 0) {
        syncGoogleSheet(true);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [autoSync, rows, credentials]);

  return (
    <div className="flex flex-col gap-5">
      {/* Top Input Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Common Value (Prefix)
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
              Variable Value (Suffix)
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
              className="w-full h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>
          </div>
        </div>
      </div>

      {/* Generated Links List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Generated Links</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {rows.length} total
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Sheet ID: {GOOGLE_SHEET_ID.slice(0, 14)}...</span>
          </div>
        </div>

        <div className="fast-scroll-container max-h-[420px] divide-y divide-slate-100">
          {rows.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                No concatenated links generated yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter a common prefix and variable suffix above, then press Enter or click Add Row to build your link list.
              </p>
            </div>
          ) : (
            rows.map((row, idx) => (
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
                <span className="w-12 text-xs font-mono font-semibold text-slate-600 tabular-nums">
                  #{row.id}
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
            ))
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
              className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export to Excel</span>
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
                      ? 'Auto-sync enabled (every 60s)'
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
              <span>{isSyncing ? 'Syncing...' : 'Sync to Google Sheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <p className="text-xs italic text-slate-500 px-1">{status}</p>

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
