import React, { useState, useMemo } from 'react';
import { Plus, Copy, Trash2, Check, Search } from 'lucide-react';
import {
  DEFAULT_AIRLINES,
  replaceAirlineKeywordForGenerator,
} from '../lib/seoHelpers';

export interface GeneratedAirlinePage {
  id: number;
  airline: string;
  header: string;
  paragraph: string;
}

export const AirlineContentGeneratorPanel: React.FC = () => {
  const [sourceKeyword, setSourceKeyword] = useState('');
  const [headerInput, setHeaderInput] = useState('');
  const [paragraphInput, setParagraphInput] = useState('');
  const [pages, setPages] = useState<GeneratedAirlinePage[]>([]);
  const [rowCounter, setRowCounter] = useState(1);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState(
    'Ready. Enter a header and paragraph. Leave the airline keyword blank for automatic 44-airline replacement.'
  );

  const addPages = () => {
    const cleanHeader = headerInput.trim();
    const cleanParagraph = paragraphInput.trim();

    if (!cleanHeader || !cleanParagraph) {
      setStatus(
        'Input Error: Header and paragraph are required. Leave airline keyword blank to auto-detect any airline from the 44-name list.'
      );
      return;
    }

    const newEntries: GeneratedAirlinePage[] = [];
    let currentId = rowCounter;

    for (const airline of DEFAULT_AIRLINES) {
      const generatedHeader = replaceAirlineKeywordForGenerator(
        cleanHeader,
        sourceKeyword,
        airline
      );
      const generatedParagraph = replaceAirlineKeywordForGenerator(
        cleanParagraph,
        sourceKeyword,
        airline
      );
      newEntries.push({
        id: currentId,
        airline,
        header: generatedHeader,
        paragraph: generatedParagraph,
      });
      currentId += 1;
    }

    setPages((prev) => [...prev, ...newEntries]);
    setRowCounter(currentId);
    setHeaderInput('');
    setParagraphInput('');
    setStatus(
      `Added ${DEFAULT_AIRLINES.length} pages. Total generated pages: ${
        pages.length + newEntries.length
      }.`
    );
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setStatus('Copied content to clipboard.');
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setStatus('Failed to copy to clipboard.');
    }
  };

  const clearAll = () => {
    setPages([]);
    setRowCounter(1);
    setStatus('All generated airline pages cleared.');
  };

  const filteredPages = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.airline.toLowerCase().includes(q) ||
        p.header.toLowerCase().includes(q) ||
        p.paragraph.toLowerCase().includes(q)
    );
  }, [pages, filterQuery]);

  return (
    <div className="flex flex-col gap-5">
      {/* Input Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Airline Keyword to Replace (Optional)
            </label>
            <input
              type="text"
              value={sourceKeyword}
              onChange={(e) => setSourceKeyword(e.target.value)}
              placeholder="e.g. Qatar (leave blank for automatic 44-airline detection)"
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Header Template
            </label>
            <input
              type="text"
              value={headerInput}
              onChange={(e) => setHeaderInput(e.target.value)}
              placeholder="Enter header (e.g. How to Resolve Qatar Missed Flight Policy)..."
              className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Paragraph Content (Press Ctrl+Enter to generate)
            </label>
            <textarea
              rows={3}
              value={paragraphInput}
              onChange={(e) => setParagraphInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  addPages();
                }
              }}
              placeholder="Write or paste paragraph template here..."
              className="w-full p-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
            />
          </div>
          <button
            type="button"
            onClick={addPages}
            className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add 44 Airline Pages</span>
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Generated Airline Headers &amp; Paragraphs</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {filteredPages.length} of {pages.length} rows
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter by airline or text..."
                className="h-8 pl-8 pr-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            {pages.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="h-8 px-3 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        <div className="fast-scroll-container max-h-[480px] divide-y divide-slate-200">
          {filteredPages.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <p className="text-sm font-medium text-slate-700 mb-1">
                {pages.length === 0
                  ? 'No airline headers and paragraphs generated yet'
                  : 'No rows match your search filter'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter a header and paragraph above and click &ldquo;Add 44 Airline Pages&rdquo; to automatically generate customized variations for all 44 airlines.
              </p>
            </div>
          ) : (
            filteredPages.map((row, idx) => (
              <div
                key={row.id}
                className={`fast-scroll-card-row p-3.5 flex flex-col md:flex-row md:items-center gap-3 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                } hover:bg-slate-100/70`}
              >
                <div className="flex items-center gap-3 md:w-44 shrink-0">
                  <span className="w-10 text-xs font-mono font-semibold text-slate-500 tabular-nums">
                    #{row.id}
                  </span>
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {row.airline}
                  </span>
                </div>

                <div className="flex-1 space-y-2 min-w-0">
                  {/* Header Row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={row.header}
                      className="flex-1 h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(`h-${row.id}`, row.header)}
                      className="h-8 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors flex items-center gap-1.5 w-36 justify-center shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      {copiedKey === `h-${row.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Header</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Header</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Paragraph Row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={row.paragraph}
                      className="flex-1 h-8 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(`p-${row.id}`, row.paragraph)}
                      className="h-8 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1.5 w-36 justify-center shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      {copiedKey === `p-${row.id}` ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Para</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Paragraph</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-xs italic text-slate-500 px-1">{status}</p>
    </div>
  );
};
