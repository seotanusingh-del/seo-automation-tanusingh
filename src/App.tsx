import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import {
  FileText,
  Upload,
  Zap,
  RefreshCw,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Sliders,
  Bold,
  Italic,
  Underline,
  Heading1,
  Type,
  Search,
  ExternalLink,
  Plus,
  X,
  FolderArchive,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  DEFAULT_OLD_TFN,
  DEFAULT_NEW_TFN,
  DEFAULT_REPLACEMENT_WORD,
  DEFAULT_AIRLINES,
  AVAILABLE_LANGUAGES,
  DEFAULT_CREDENTIALS,
  LIBREOFFICE_WEBSITE_URL,
  ServiceAccountCredentials,
  buildOutputName,
  generateSequenceName,
  extractTextFromDocxBuffer,
  detectTfnsInText,
  findMatchingAirlinesInText,
  processDocxTemplateBuffer,
  createDocxFromWhiteboard,
  buildLibreOfficeBatchScripts,
} from './lib/seoHelpers';
import { LinkConcatenatorPanel } from './components/LinkConcatenatorPanel';
import { AirlineContentGeneratorPanel } from './components/AirlineContentGeneratorPanel';
import { RankCheckerPanel } from './components/RankCheckerPanel';
import { SettingsAndGuidePanel } from './components/SettingsAndGuidePanel';

type TopTab = 'home' | 'concat' | 'airline-content' | 'rank' | 'settings';
type HomeMode = 'attach' | 'whiteboard';

interface GeneratedFileItem {
  name: string;
  airline: string;
  docxBytes: Uint8Array;
  pdfBase64?: string;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TopTab>('home');
  const [homeMode, setHomeMode] = useState<HomeMode>('attach');

  // Shared Config State (persisted to localStorage)
  const [oldTfn, setOldTfn] = useState<string>(() => {
    return localStorage.getItem('seo_old_tfn') ?? DEFAULT_OLD_TFN;
  });
  const [newTfn, setNewTfn] = useState<string>(() => {
    return localStorage.getItem('seo_new_tfn') ?? DEFAULT_NEW_TFN;
  });
  const [replacementWord, setReplacementWord] = useState<string>(() => {
    return localStorage.getItem('seo_replacement_word') ?? DEFAULT_REPLACEMENT_WORD;
  });
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem('seo_language') ?? 'English';
  });
  const [airlines, setAirlines] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seo_airlines');
      return saved ? JSON.parse(saved) : [...DEFAULT_AIRLINES];
    } catch {
      return [...DEFAULT_AIRLINES];
    }
  });
  const [selectedAirlines, setSelectedAirlines] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    DEFAULT_AIRLINES.forEach((a) => {
      map[a] = true;
    });
    return map;
  });
  const [detectedAirlines, setDetectedAirlines] = useState<string[]>([]);
  const [airlineSearch, setAirlineSearch] = useState('');

  // Output Options
  const [generatePdf, setGeneratePdf] = useState(true);
  const [generateZip, setGenerateZip] = useState(true);

  // Template Attachment State
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whiteboard State
  const [whiteboardText, setWhiteboardText] = useState(
    'Write or paste your content here.\nYou can add emojis, symbols, and rich text content.\nCall Qatar support at +1-800-555-0199 for missed flight assistance.'
  );
  const [wbFontFamily, setWbFontFamily] = useState('Calibri');
  const [wbFontSize, setWbFontSize] = useState(11);
  const [wbBold, setWbBold] = useState(false);
  const [wbItalic, setWbItalic] = useState(false);
  const [wbUnderline, setWbUnderline] = useState(false);
  const whiteboardRef = useRef<HTMLTextAreaElement>(null);

  // Generation & Sync State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingDoc, setIsSyncingDoc] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Ready to generate a fresh output set.'
  );
  const [syncModalLines, setSyncModalLines] = useState<string[] | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFileItem[]>([]);
  const [outputBatchName, setOutputBatchName] = useState<string | null>(null);

  // Airline Manager Modal
  const [showAirlineManager, setShowAirlineManager] = useState(false);
  const [bulkAirlinesInput, setBulkAirlinesInput] = useState('');

  // Settings & LibreOffice State
  const [credentials, setCredentials] = useState<ServiceAccountCredentials>(() => {
    try {
      const saved = localStorage.getItem('seo_credentials');
      return saved ? JSON.parse(saved) : DEFAULT_CREDENTIALS;
    } catch {
      return DEFAULT_CREDENTIALS;
    }
  });
  const [libreOfficePath, setLibreOfficePath] = useState<string>(() => {
    return localStorage.getItem('seo_libreoffice_path') ?? '';
  });
  const [localBridgeUrl, setLocalBridgeUrl] = useState<string>(() => {
    return localStorage.getItem('seo_local_bridge_url') ?? '';
  });
  const [serverStatus, setServerStatus] = useState<{
    libreofficeAvailable: boolean;
    libreofficePath: string | null;
    platform: string;
    isVercel: boolean;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('seo_old_tfn', oldTfn);
  }, [oldTfn]);

  useEffect(() => {
    localStorage.setItem('seo_new_tfn', newTfn);
  }, [newTfn]);

  useEffect(() => {
    localStorage.setItem('seo_replacement_word', replacementWord);
  }, [replacementWord]);

  useEffect(() => {
    localStorage.setItem('seo_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('seo_airlines', JSON.stringify(airlines));
  }, [airlines]);

  const checkServerStatus = async () => {
    const baseUrl = localBridgeUrl.trim().replace(/\/$/, '');
    try {
      const res = await fetch(
        `${baseUrl}/api/system-status?customPath=${encodeURIComponent(
          libreOfficePath
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch {
      // ignore if offline
    }
  };

  useEffect(() => {
    checkServerStatus();
  }, [libreOfficePath, localBridgeUrl]);

  const filteredAirlines = useMemo(() => {
    const q = airlineSearch.trim().toLowerCase();
    if (!q) return airlines;
    return airlines.filter((a) => a.toLowerCase().includes(q));
  }, [airlines, airlineSearch]);

  const activeSelectedAirlines = useMemo(() => {
    return airlines.filter((a) => selectedAirlines[a] !== false);
  }, [airlines, selectedAirlines]);

  const toggleSelectAllAirlines = () => {
    const allSelected = airlines.every((a) => selectedAirlines[a] !== false);
    const next: Record<string, boolean> = {};
    airlines.forEach((a) => {
      next[a] = !allSelected;
    });
    setSelectedAirlines(next);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    setTemplateBuffer(buffer);
    setTemplateName(file.name);
    setStatusMessage(`Loaded template: ${file.name}`);

    // Auto-detect TFNs and Airlines in the attached DOCX
    try {
      const extractedText = await extractTextFromDocxBuffer(buffer);
      const tfns = detectTfnsInText(extractedText);
      if (tfns.length > 0) {
        setOldTfn(tfns.join(', '));
      }
      const matches = findMatchingAirlinesInText(extractedText, [
        ...airlines,
        ...DEFAULT_AIRLINES,
      ]);
      if (matches.length > 0) {
        setDetectedAirlines(matches.map((m) => m.airline));
        setReplacementWord(matches[0].airline);
        setStatusMessage(
          `Loaded ${file.name} · Auto-detected placeholder '${matches[0].airline}' and ${tfns.length} TFN(s).`
        );
      }
    } catch {
      // ignore extraction error if non-standard docx
    }
  };

  const handleSyncGoogleDoc = async () => {
    setIsSyncingDoc(true);
    setStatusMessage('Syncing Google Doc... Please wait.');
    try {
      const res = await fetch('/api/sync-google-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials,
          airlines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync Google Doc.');
      }

      if (Array.isArray(data.foundAirlines) && data.foundAirlines.length > 0) {
        setDetectedAirlines(data.foundAirlines);
      }
      if (data.primaryAirline) {
        setReplacementWord(data.primaryAirline);
      }
      if (Array.isArray(data.uniqueTfns) && data.uniqueTfns.length > 0) {
        setOldTfn(data.uniqueTfns.join(', '));
      }

      if (data.docxBase64) {
        const bytes = base64ToUint8Array(data.docxBase64);
        setTemplateBuffer(bytes.buffer as ArrayBuffer);
        setTemplateName(data.fileName || 'googledriveautomation.docx');
      } else if (data.fullText) {
        // Build a valid DOCX template buffer from fullText if direct export wasn't returned
        const fallbackDocx = await createDocxFromWhiteboard(
          data.fullText,
          data.primaryAirline || replacementWord,
          oldTfn,
          oldTfn || newTfn,
          replacementWord,
          airlines,
          [],
          { fontFamily: 'Calibri', fontSize: 11 }
        );
        setTemplateBuffer(fallbackDocx.buffer as ArrayBuffer);
        setTemplateName('googledriveautomation.docx');
      }

      setStatusMessage(
        `Sync complete: ${data.foundAirlines?.length || 0} airline(s), ${
          data.uniqueTfns?.length || 0
        } TFN(s) found.`
      );
      if (Array.isArray(data.logLines)) {
        setSyncModalLines(data.logLines);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Google Doc sync failed: ${msg}`);
    } finally {
      setIsSyncingDoc(false);
    }
  };

  const runGeneration = async (useWhiteboard: boolean) => {
    if (isGenerating) return;

    if (activeSelectedAirlines.length === 0) {
      setStatusMessage('Input Required: Select at least one airline before generating outputs.');
      return;
    }

    if (!oldTfn.trim() || !newTfn.trim()) {
      setStatusMessage('Input Required: Please provide both Old and New TFN values.');
      return;
    }

    if (useWhiteboard) {
      if (!whiteboardText.trim()) {
        setStatusMessage('Input Required: Write or paste content into the whiteboard before generating.');
        return;
      }
    } else if (!templateBuffer) {
      setStatusMessage('Input Required: Attach a DOCX template (or Sync Google Doc) before generating template outputs.');
      return;
    }

    if (!generatePdf) {
      setStatusMessage('Output Required: Enable Generate PDF to continue.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage(
      `Generating documents for ${activeSelectedAirlines.length} airline(s)...`
    );

    try {
      const builtItems: GeneratedFileItem[] = [];

      for (const airline of activeSelectedAirlines) {
        const outName = buildOutputName(airline);
        let docxBytes: Uint8Array;

        if (useWhiteboard) {
          docxBytes = await createDocxFromWhiteboard(
            whiteboardText,
            airline,
            oldTfn.trim(),
            newTfn.trim(),
            replacementWord.trim() || DEFAULT_REPLACEMENT_WORD,
            airlines,
            detectedAirlines,
            {
              fontFamily: wbFontFamily,
              fontSize: wbFontSize,
              bold: wbBold,
              italic: wbItalic,
              underline: wbUnderline,
            }
          );
        } else {
          docxBytes = await processDocxTemplateBuffer(
            templateBuffer!,
            airline,
            oldTfn.trim(),
            newTfn.trim(),
            replacementWord.trim() || DEFAULT_REPLACEMENT_WORD,
            airlines,
            detectedAirlines
          );
        }

        builtItems.push({
          name: outName,
          airline,
          docxBytes,
        });
      }

      // Attempt server-side or local-bridge LibreOffice PDF conversion
      const baseUrl = localBridgeUrl.trim().replace(/\/$/, '');
      let pdfConvertedCount = 0;
      try {
        const response = await fetch(`${baseUrl}/api/convert-pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customLibreOfficePath: libreOfficePath,
            files: builtItems.map((item) => ({
              name: item.name,
              docxBase64: uint8ArrayToBase64(item.docxBytes),
            })),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.converted && Array.isArray(result.files)) {
            const pdfMap = new Map<string, string>();
            for (const f of result.files) {
              if (f.pdfBase64) {
                pdfMap.set(f.name, f.pdfBase64);
                pdfConvertedCount += 1;
              }
            }
            for (const item of builtItems) {
              const pdfB64 = pdfMap.get(item.name);
              if (pdfB64) {
                item.pdfBase64 = pdfB64;
              }
            }
          }
        }
      } catch {
        // Fallback to bundling DOCX + 1-click LibreOffice batch converter
      }

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const folderName = `seo-pdfs-${dd}-${mm}-${yyyy}`;

      setGeneratedFiles(builtItems);
      setOutputBatchName(folderName);

      if (generateZip) {
        await downloadOutputZip(builtItems, folderName);
      }

      if (pdfConvertedCount > 0) {
        setStatusMessage(
          `Completed! Converted ${pdfConvertedCount} PDF(s) via LibreOffice in ${folderName}.`
        );
      } else {
        setStatusMessage(
          `Completed! Generated ${builtItems.length} airline document(s) in ${folderName} with 1-click LibreOffice PDF batch converter.`
        );
      }
    } catch (err: unknown) {
      setStatusMessage(
        `Generation Failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadOutputZip = async (
    items = generatedFiles,
    batchFolder = outputBatchName || 'seo-pdfs'
  ) => {
    if (items.length === 0) {
      setStatusMessage('No Output: Generate documents first before downloading ZIP.');
      return;
    }

    const zip = new JSZip();
    const root = zip.folder(batchFolder)!;
    const docxFolder = root.folder('docx')!;
    const pdfFolder = root.folder('pdfs')!;

    for (const item of items) {
      docxFolder.file(`${item.name}.docx`, item.docxBytes);
      if (item.pdfBase64) {
        pdfFolder.file(`${item.name}.pdf`, base64ToUint8Array(item.pdfBase64));
      }
    }

    // Always include the 1-click LibreOffice batch scripts for local conversion
    const scripts = buildLibreOfficeBatchScripts();
    root.file('convert_to_pdf_mac_linux.sh', scripts.macLinuxSh, {
      unixPermissions: '755',
    });
    root.file('convert_to_pdf_windows.bat', scripts.windowsBat);
    root.file('README_LIBREOFFICE.txt', scripts.readmeTxt);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-${generateSequenceName('zip')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingleFile = (item: GeneratedFileItem) => {
    if (item.pdfBase64) {
      const bytes = base64ToUint8Array(item.pdfBase64);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([item.docxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.name}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const deleteLatestOutput = () => {
    if (generatedFiles.length === 0 && !templateBuffer) {
      setStatusMessage('No Output: There is no generated output or attached DOCX to delete.');
      return;
    }
    setGeneratedFiles([]);
    setOutputBatchName(null);
    setTemplateBuffer(null);
    setTemplateName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setStatusMessage('Deleted latest generated output batch and reset attached DOCX template.');
  };

  const handleAddBulkAirlines = () => {
    const raw = bulkAirlinesInput.trim();
    if (!raw) return;
    const parts = raw
      .replace(/\n/g, ',')
      .split(',')
      .map((p) => p.trim().replace(/_/g, ' '))
      .filter(Boolean);
    if (parts.length === 0) return;

    const updated = [...airlines];
    const nextSelected = { ...selectedAirlines };
    for (const p of parts) {
      if (!updated.includes(p)) {
        updated.push(p);
        nextSelected[p] = true;
      }
    }
    setAirlines(updated);
    setSelectedAirlines(nextSelected);
    setBulkAirlinesInput('');
    setStatusMessage(`Added ${parts.length} airline(s).`);
  };

  const applyWhiteboardHeading = () => {
    const el = whiteboardRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setWhiteboardText((prev) => `# ${prev}`);
      return;
    }
    const selected = whiteboardText.slice(start, end);
    const updated =
      whiteboardText.slice(0, start) +
      `# ${selected}` +
      whiteboardText.slice(end);
    setWhiteboardText(updated);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark (single text element) */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          SEO Document Studio
        </a>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'home'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('concat')}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'concat'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Link Conc Generator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('airline-content')}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'airline-content'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Airline Content
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rank')}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'rank'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Rank Checker
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Settings &amp; Setup Guide
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          <a
            href={LIBREOFFICE_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Get LibreOffice</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={() => {
              setActiveTab('home');
              runGeneration(homeMode === 'whiteboard');
            }}
            disabled={isGenerating}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'Generating...' : 'Generate Document'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 py-6">
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Shared Setup Section */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-200">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  Shared Setup
                </h1>
                <p className="text-xs italic text-slate-500">
                  These controls stay available across both Attach Document and Whiteboard modes.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: TFN + Replacement Word + Airlines */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Old TFN Number
                      </label>
                      <input
                        type="text"
                        value={oldTfn}
                        onChange={(e) => setOldTfn(e.target.value)}
                        placeholder="e.g. +1-800-555-0199 (or Sync Google Doc)"
                        className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        New TFN Number
                      </label>
                      <input
                        type="text"
                        value={newTfn}
                        onChange={(e) => setNewTfn(e.target.value)}
                        placeholder="New TFN..."
                        className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Replacement Word
                      </label>
                      <span className="text-[11px] italic text-slate-500">
                        Replaced with each selected airline name
                      </span>
                    </div>
                    <input
                      type="text"
                      value={replacementWord}
                      onChange={(e) => setReplacementWord(e.target.value)}
                      placeholder="e.g. Qatar"
                      className="w-full h-10 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Select Airlines List with High-Speed Scrolling */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          Select Airlines
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs font-mono text-slate-600 tabular-nums">
                          {activeSelectedAirlines.length} / {airlines.length} selected
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={airlineSearch}
                            onChange={(e) => setAirlineSearch(e.target.value)}
                            placeholder="Quick filter..."
                            className="h-8 pl-7 pr-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={toggleSelectAllAirlines}
                          className="h-8 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {airlines.every((a) => selectedAirlines[a] !== false)
                            ? 'Deselect All'
                            : 'Select All'}
                        </button>
                      </div>
                    </div>

                    <div className="fast-scroll-container h-48 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {filteredAirlines.map((airline) => {
                        const checked = selectedAirlines[airline] !== false;
                        return (
                          <label
                            key={airline}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer select-none transition-colors ${
                              checked
                                ? 'bg-white text-slate-900 border border-slate-200/80'
                                : 'text-slate-500 hover:bg-white/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedAirlines((prev) => ({
                                  ...prev,
                                  [airline]: e.target.checked,
                                }))
                              }
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate">{airline}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Output Options + Language + Quick Actions */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-5 lg:border-l lg:border-slate-200 lg:pl-6">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xs font-bold text-slate-800 mb-2.5">
                        Output Options
                      </h2>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={generatePdf}
                            onChange={(e) => setGeneratePdf(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Generate PDF (via LibreOffice Engine)</span>
                        </label>
                        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={generateZip}
                            onChange={(e) => setGenerateZip(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Compress Outputs to ZIP Automatically</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Document Language
                      </label>
                      <p className="text-[11px] italic text-slate-500 mb-2">
                        Select the language of your input document.
                      </p>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {AVAILABLE_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Actions Grid */}
                    <div className="pt-3 border-t border-slate-200">
                      <h2 className="text-xs font-bold text-slate-800 mb-2.5">
                        Quick Actions
                      </h2>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => downloadOutputZip()}
                          className="h-10 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <FolderArchive className="w-3.5 h-3.5" />
                          <span>Download Output ZIP</span>
                        </button>

                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => runGeneration(homeMode === 'whiteboard')}
                          className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>
                            {isGenerating ? 'Generating...' : 'Generate Document'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAirlineManager(true)}
                          className="h-10 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Manage Airlines</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSyncingDoc}
                          onClick={handleSyncGoogleDoc}
                          className="h-10 px-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isSyncingDoc ? 'animate-spin' : ''
                            }`}
                          />
                          <span>
                            {isSyncingDoc ? 'Syncing...' : 'Sync Google Doc'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Attach Document</span>
                        </button>

                        <button
                          type="button"
                          onClick={deleteLatestOutput}
                          className="h-10 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Latest Output</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* LibreOffice Quick Status & Download Link */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 block truncate">
                        External PDF Engine: LibreOffice
                      </span>
                      <a
                        href={LIBREOFFICE_WEBSITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px]"
                      >
                        <span>https://www.libreoffice.org/</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-md text-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Setup Guide
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Mode Switcher: Attach Document vs Whiteboard */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setHomeMode('attach')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      homeMode === 'attach'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Attach Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeMode('whiteboard')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      homeMode === 'whiteboard'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>Whiteboard</span>
                  </button>
                </div>

                <span className="text-xs text-slate-500">
                  {homeMode === 'attach'
                    ? 'Template Mode: Preserves tables, headers, footers, and layout'
                    : 'Whiteboard Mode: Create rich documents from scratch'}
                </span>
              </div>

              {homeMode === 'attach' ? (
                <div className="p-6 space-y-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Attach Document Template
                    </h2>
                    <p className="text-xs italic text-slate-500 mt-0.5">
                      Use a DOCX template when you want the generated files to follow an existing layout.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    onChange={handleFileAttach}
                    className="hidden"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-11 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Attach DOCX Template</span>
                    </button>

                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => runGeneration(false)}
                      className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>
                        {isGenerating ? 'Generating...' : 'Generate from Template'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                    <span className="font-semibold">Active Template:</span>
                    <span className="font-mono text-slate-800">
                      {templateName || 'No template attached'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      Whiteboard Editor
                    </h2>
                    <span className="text-xs italic text-slate-500">
                      Configure typography and formatting styles for your generated airline documents.
                    </span>
                  </div>

                  {/* Whiteboard Toolbar */}
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={applyWhiteboardHeading}
                      className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-800 flex items-center gap-1 cursor-pointer"
                      title="Insert Heading"
                    >
                      <Heading1 className="w-3.5 h-3.5" />
                      <span>H1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWbBold((b) => !b)}
                      className={`px-2.5 py-1.5 text-xs font-bold border rounded flex items-center gap-1 cursor-pointer ${
                        wbBold
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                      <span>B</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWbItalic((i) => !i)}
                      className={`px-2.5 py-1.5 text-xs font-bold border rounded flex items-center gap-1 cursor-pointer ${
                        wbItalic
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Italic className="w-3.5 h-3.5" />
                      <span>I</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWbUnderline((u) => !u)}
                      className={`px-2.5 py-1.5 text-xs font-bold border rounded flex items-center gap-1 cursor-pointer ${
                        wbUnderline
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Underline className="w-3.5 h-3.5" />
                      <span>U</span>
                    </button>

                    <select
                      value={wbFontFamily}
                      onChange={(e) => setWbFontFamily(e.target.value)}
                      className="h-8 px-2.5 rounded border border-slate-300 bg-white text-xs text-slate-800"
                    >
                      {[
                        'Calibri',
                        'Segoe UI',
                        'Arial',
                        'Times New Roman',
                        'Georgia',
                        'Courier New',
                      ].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    <select
                      value={wbFontSize}
                      onChange={(e) => setWbFontSize(Number(e.target.value))}
                      className="h-8 px-2.5 rounded border border-slate-300 bg-white text-xs font-mono text-slate-800"
                    >
                      {[9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32].map(
                        (s) => (
                          <option key={s} value={s}>
                            {s} pt
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <textarea
                    ref={whiteboardRef}
                    rows={8}
                    value={whiteboardText}
                    onChange={(e) => setWhiteboardText(e.target.value)}
                    style={{
                      fontFamily: wbFontFamily,
                      fontWeight: wbBold ? 700 : 400,
                      fontStyle: wbItalic ? 'italic' : 'normal',
                      textDecoration: wbUnderline ? 'underline' : 'none',
                    }}
                    className="w-full p-4 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => runGeneration(true)}
                    className="w-full h-11 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      {isGenerating ? 'Generating...' : 'Generate from Whiteboard'}
                    </span>
                  </button>
                </div>
              )}
            </section>

            {/* Generated Outputs Table */}
            {generatedFiles.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Generated Output Files ({outputBatchName})</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-xs text-slate-600 tabular-nums">
                      {generatedFiles.length} files
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadOutputZip()}
                      className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download All as ZIP</span>
                    </button>
                  </div>
                </div>

                {!generatedFiles[0]?.pdfBase64 && (
                  <div className="px-5 py-2.5 bg-amber-50/80 border-b border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Cloud Mode: Your ZIP archive includes all customized <code>.docx</code> files plus 1-click LibreOffice batch converters (<code>convert_to_pdf_windows.bat</code> &amp; <code>convert_to_pdf_mac_linux.sh</code>). Need LibreOffice?
                      </span>
                    </div>
                    <a
                      href={LIBREOFFICE_WEBSITE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-700 underline whitespace-nowrap"
                    >
                      Download from libreoffice.org
                    </a>
                  </div>
                )}

                <div className="fast-scroll-container max-h-72 divide-y divide-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
                  {generatedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="fast-scroll-row bg-white px-4 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {file.airline}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 block truncate">
                          {file.name}.{file.pdfBase64 ? 'pdf' : 'docx'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadSingleFile(file)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{file.pdfBase64 ? 'PDF' : 'DOCX'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Status Bar */}
            <p className="text-xs italic text-slate-500 px-1">{statusMessage}</p>
          </div>
        )}

        {activeTab === 'concat' && (
          <LinkConcatenatorPanel credentials={credentials} />
        )}

        {activeTab === 'airline-content' && <AirlineContentGeneratorPanel />}

        {activeTab === 'rank' && <RankCheckerPanel />}

        {activeTab === 'settings' && (
          <SettingsAndGuidePanel
            credentials={credentials}
            onSaveCredentials={(creds) => {
              setCredentials(creds);
              localStorage.setItem('seo_credentials', JSON.stringify(creds));
            }}
            libreOfficePath={libreOfficePath}
            onChangeLibreOfficePath={(p) => {
              setLibreOfficePath(p);
              localStorage.setItem('seo_libreoffice_path', p);
            }}
            localBridgeUrl={localBridgeUrl}
            onChangeLocalBridgeUrl={(u) => {
              setLocalBridgeUrl(u);
              localStorage.setItem('seo_local_bridge_url', u);
            }}
            serverStatus={serverStatus}
            onRefreshServerStatus={checkServerStatus}
          />
        )}
      </main>

      {/* Airline Manager Modal */}
      {showAirlineManager && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-5 shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Airline Manager ({airlines.length} Airlines)
              </h3>
              <button
                type="button"
                onClick={() => setShowAirlineManager(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="fast-scroll-container flex-1 my-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
              {airlines.map((airline, idx) => (
                <div
                  key={airline}
                  className={`fast-scroll-row flex items-center justify-between px-3.5 py-2 text-xs ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                  }`}
                >
                  <span className="font-medium text-slate-800">{airline}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAirlines((prev) => prev.filter((a) => a !== airline))
                    }
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    title="Remove Airline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800">
                Add Airlines (Bulk)
              </label>
              <p className="text-[11px] italic text-slate-500">
                Separate with commas or new lines. Use underscore (_) for spaces.
              </p>
              <textarea
                rows={3}
                value={bulkAirlinesInput}
                onChange={(e) => setBulkAirlinesInput(e.target.value)}
                placeholder="e.g. Virgin_Atlantic, Air_France, Cathay_Pacific"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAddBulkAirlines}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Airlines</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAirlines([...DEFAULT_AIRLINES]);
                      setStatusMessage('Reset airlines to defaults.');
                    }}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Reset to Defaults
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAirlineManager(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Save &amp; Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Doc Sync Results Modal */}
      {syncModalLines && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                Sync Google Doc Results
              </h3>
              <button
                type="button"
                onClick={() => setSyncModalLines(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="fast-scroll-container max-h-80 p-3.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs space-y-1">
              {syncModalLines.map((line, idx) => (
                <div key={idx}>{line || '\u00A0'}</div>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setSyncModalLines(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
