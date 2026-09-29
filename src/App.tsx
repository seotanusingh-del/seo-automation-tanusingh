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
  LogOut,
  Menu,
  Home,
  Link2,
  Sparkles,
  Globe,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  RotateCcw,
  Send,
  Mail,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import {
  DEFAULT_OLD_TFN,
  DEFAULT_NEW_TFN,
  DEFAULT_REPLACEMENT_WORD,
  DEFAULT_AIRLINES,
  DEFAULT_GOOGLE_DOC_URL,
  AVAILABLE_LANGUAGES,
  DEFAULT_CREDENTIALS,
  LIBREOFFICE_WEBSITE_URL,
  ServiceAccountCredentials,
  buildGoogleDocUrl,
  extractGoogleDocId,
  buildOutputName,
  generateSequenceName,
  extractTextFromDocxBuffer,
  detectTfnsInText,
  findMatchingAirlinesInText,
  processDocxTemplateBuffer,
  createDocxFromWhiteboard,
} from './lib/seoHelpers';
import {
  convertDocxBytesToPdfBytes,
  createPdfFromWhiteboard,
} from './lib/pdfEngine';
import { LinkConcatenatorPanel } from './components/LinkConcatenatorPanel';
import { AirlineContentGeneratorPanel } from './components/AirlineContentGeneratorPanel';
import { RankCheckerPanel } from './components/RankCheckerPanel';
import { SettingsAndGuidePanel } from './components/SettingsAndGuidePanel';
import { SeoBulkAutomationPanel } from './components/SeoBulkAutomationPanel';
import { LoginScreen } from './components/LoginScreen';
import { DEFAULT_TANU_AVATAR_DATA_URI } from './lib/defaultAvatar';

type TopTab =
  | 'home'
  | 'concat'
  | 'airline-content'
  | 'rank'
  | 'seo-automation'
  | 'settings';
type HomeMode = 'attach' | 'whiteboard';

interface GeneratedFileItem {
  name: string;
  airline: string;
  docxBytes: Uint8Array;
  pdfBytes: Uint8Array;
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function App() {
  // Always start unauthenticated on tab open, refresh, or re-open so the session is immediately locked
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasSavedWorkspace] = useState<boolean>(() => {
    return Boolean(
      localStorage.getItem('seo_last_active_tab') ||
        localStorage.getItem('seo_whiteboard_text') ||
        localStorage.getItem('seo_template_name')
    );
  });

  const [activeTab, setActiveTab] = useState<TopTab>(() => {
    const saved = localStorage.getItem('seo_last_active_tab') as TopTab | null;
    return saved || 'home';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [homeMode, setHomeMode] = useState<HomeMode>(() => {
    const saved = localStorage.getItem('seo_last_home_mode') as HomeMode | null;
    return saved || 'attach';
  });

  // User Profile & Configurable Application Default Values (Overwrite Mode)
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('seo_user_display_name') || 'TANU SINGH';
  });
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>(() => {
    const saved = localStorage.getItem('seo_user_avatar_url');
    if (!saved || saved.startsWith('/src/assets/')) {
      localStorage.removeItem('seo_user_avatar_url');
      return DEFAULT_TANU_AVATAR_DATA_URI;
    }
    return saved;
  });
  const [defaultOldTfn, setDefaultOldTfn] = useState<string>(() => {
    return localStorage.getItem('seo_default_old_tfn') || DEFAULT_OLD_TFN;
  });
  const [defaultNewTfn, setDefaultNewTfn] = useState<string>(() => {
    return localStorage.getItem('seo_default_new_tfn') || DEFAULT_NEW_TFN;
  });
  const [defaultReplacementWord, setDefaultReplacementWord] = useState<string>(
    () => {
      return (
        localStorage.getItem('seo_default_replacement_word') ||
        DEFAULT_REPLACEMENT_WORD
      );
    }
  );

  // Share to 3rd-Party Apps Modal State
  const [shareModalTarget, setShareModalTarget] = useState<{
    fileName: string;
    airlineLabel: string;
    fileCount: number;
  } | null>(null);
  const [copiedShareText, setCopiedShareText] = useState(false);

  // Shared Config State (persisted to localStorage)
  const [oldTfn, setOldTfn] = useState<string>(() => {
    return (
      localStorage.getItem('seo_old_tfn') ??
      (localStorage.getItem('seo_default_old_tfn') || DEFAULT_OLD_TFN)
    );
  });
  const [newTfn, setNewTfn] = useState<string>(() => {
    return (
      localStorage.getItem('seo_new_tfn') ??
      (localStorage.getItem('seo_default_new_tfn') || DEFAULT_NEW_TFN)
    );
  });
  const [replacementWord, setReplacementWord] = useState<string>(() => {
    return (
      localStorage.getItem('seo_replacement_word') ??
      (localStorage.getItem('seo_default_replacement_word') ||
        DEFAULT_REPLACEMENT_WORD)
    );
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
    try {
      const saved = localStorage.getItem('seo_selected_airlines');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const map: Record<string, boolean> = {};
    DEFAULT_AIRLINES.forEach((a) => {
      map[a] = true;
    });
    return map;
  });
  const [detectedAirlines, setDetectedAirlines] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seo_detected_airlines');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [airlineSearch, setAirlineSearch] = useState('');

  // Output Options
  const [generatePdf, setGeneratePdf] = useState(true);
  const [generateZip, setGenerateZip] = useState(true);
  const [includeDocxInZip, setIncludeDocxInZip] = useState(false);

  // Google Docs Link State (persisted to localStorage, editable anytime)
  const [googleDocUrl, setGoogleDocUrl] = useState<string>(() => {
    return localStorage.getItem('seo_google_doc_url') ?? DEFAULT_GOOGLE_DOC_URL;
  });

  // Template Attachment State (persisted across accidental tab closes/refreshes)
  const [templateName, setTemplateName] = useState<string | null>(() => {
    return localStorage.getItem('seo_template_name') || null;
  });
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(() => {
    try {
      const b64 = localStorage.getItem('seo_template_base64');
      if (b64) {
        return base64ToUint8Array(b64).buffer as ArrayBuffer;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whiteboard State (persisted across accidental tab closes/refreshes)
  const [whiteboardText, setWhiteboardText] = useState<string>(() => {
    return (
      localStorage.getItem('seo_whiteboard_text') ??
      'Write or paste your content here.\nYou can add emojis, symbols, and rich text content.\nCall Qatar support at +1-800-555-0199 for missed flight assistance.'
    );
  });
  const [wbFontFamily, setWbFontFamily] = useState<string>(() => {
    return localStorage.getItem('seo_wb_font_family') || 'Calibri';
  });
  const [wbFontSize, setWbFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('seo_wb_font_size')) || 11;
  });
  const [wbBold, setWbBold] = useState<boolean>(() => {
    return localStorage.getItem('seo_wb_bold') === 'true';
  });
  const [wbItalic, setWbItalic] = useState<boolean>(() => {
    return localStorage.getItem('seo_wb_italic') === 'true';
  });
  const [wbUnderline, setWbUnderline] = useState<boolean>(() => {
    return localStorage.getItem('seo_wb_underline') === 'true';
  });
  const whiteboardRef = useRef<HTMLTextAreaElement>(null);

  // Generation & Sync State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingDoc, setIsSyncingDoc] = useState(false);
  const [globalActionNotice, setGlobalActionNotice] = useState<string | null>(null);
  const [syncedDocFlash, setSyncedDocFlash] = useState(false);
  const [generatedFlash, setGeneratedFlash] = useState(false);
  const [resetDefaultsFlash, setResetDefaultsFlash] = useState(false);
  const lastWorkspaceSyncRef = useRef<number>(
    Number(localStorage.getItem('seo_workspace_updated_at')) || 0
  );
  const activeSyncedDocIdRef = useRef<string>(
    localStorage.getItem('seo_synced_doc_id') || extractGoogleDocId(googleDocUrl)
  );
  const [statusMessage, setStatusMessage] = useState(
    'Ready to generate a fresh output set.'
  );
  const [syncModalLines, setSyncModalLines] = useState<string[] | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFileItem[]>([]);
  const [outputBatchName, setOutputBatchName] = useState<string | null>(null);

  // Airline Manager Modal
  const [showAirlineManager, setShowAirlineManager] = useState(false);
  const [bulkAirlinesInput, setBulkAirlinesInput] = useState('');
  const [automationSeedUrls, setAutomationSeedUrls] = useState<string[]>([]);

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

  useEffect(() => {
    localStorage.setItem('seo_google_doc_url', googleDocUrl);
  }, [googleDocUrl]);

  useEffect(() => {
    localStorage.setItem('seo_last_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('seo_last_home_mode', homeMode);
  }, [homeMode]);

  useEffect(() => {
    localStorage.setItem('seo_selected_airlines', JSON.stringify(selectedAirlines));
  }, [selectedAirlines]);

  useEffect(() => {
    localStorage.setItem('seo_detected_airlines', JSON.stringify(detectedAirlines));
  }, [detectedAirlines]);

  useEffect(() => {
    localStorage.setItem('seo_whiteboard_text', whiteboardText);
  }, [whiteboardText]);

  useEffect(() => {
    localStorage.setItem('seo_wb_font_family', wbFontFamily);
    localStorage.setItem('seo_wb_font_size', String(wbFontSize));
    localStorage.setItem('seo_wb_bold', String(wbBold));
    localStorage.setItem('seo_wb_italic', String(wbItalic));
    localStorage.setItem('seo_wb_underline', String(wbUnderline));
  }, [wbFontFamily, wbFontSize, wbBold, wbItalic, wbUnderline]);

  useEffect(() => {
    if (templateName && templateBuffer) {
      try {
        localStorage.setItem('seo_template_name', templateName);
        localStorage.setItem(
          'seo_template_base64',
          arrayBufferToBase64(templateBuffer)
        );
      } catch {
        // ignore if template exceeds localStorage quota
      }
    }
  }, [templateName, templateBuffer]);

  // Immediately clear any auth token on page unload, tab close, or refresh while keeping workspace saved
  useEffect(() => {
    localStorage.removeItem('seo_studio_auth_session');
    sessionStorage.removeItem('seo_studio_auth_session');

    const handleTabUnloadOrClose = () => {
      localStorage.removeItem('seo_studio_auth_session');
      sessionStorage.removeItem('seo_studio_auth_session');
    };

    window.addEventListener('beforeunload', handleTabUnloadOrClose);
    window.addEventListener('pagehide', handleTabUnloadOrClose);
    return () => {
      window.removeEventListener('beforeunload', handleTabUnloadOrClose);
      window.removeEventListener('pagehide', handleTabUnloadOrClose);
    };
  }, []);

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

  const triggerActionNotice = (msg: string, durationMs = 2200) => {
    setGlobalActionNotice(msg);
    setTimeout(() => {
      setGlobalActionNotice((prev) => (prev === msg ? null : prev));
    }, durationMs);
  };

  // Pull & sync global workspace state across Mac, Phone, and multiple browser windows
  const pullGlobalWorkspaceConfig = async () => {
    try {
      const res = await fetch('/api/workspace-config', { cache: 'no-store' });
      if (!res.ok) return;
      const cfg = await res.json();
      if (!cfg || !cfg.updatedAt || cfg.updatedAt <= lastWorkspaceSyncRef.current) {
        return;
      }
      lastWorkspaceSyncRef.current = cfg.updatedAt;
      localStorage.setItem('seo_workspace_updated_at', String(cfg.updatedAt));

      if (cfg.credentials && cfg.credentials.client_email) {
        setCredentials(cfg.credentials);
        localStorage.setItem('seo_credentials', JSON.stringify(cfg.credentials));
      }
      if (cfg.userName) {
        setUserName(cfg.userName);
        localStorage.setItem('seo_user_display_name', cfg.userName);
      }
      if (cfg.userAvatarUrl) {
        setUserAvatarUrl(cfg.userAvatarUrl);
        localStorage.setItem('seo_user_avatar_url', cfg.userAvatarUrl);
      }
      if (cfg.defaultOldTfn) {
        setDefaultOldTfn(cfg.defaultOldTfn);
        localStorage.setItem('seo_default_old_tfn', cfg.defaultOldTfn);
      }
      if (cfg.defaultNewTfn) {
        setDefaultNewTfn(cfg.defaultNewTfn);
        localStorage.setItem('seo_default_new_tfn', cfg.defaultNewTfn);
      }
      if (cfg.defaultReplacementWord) {
        setDefaultReplacementWord(cfg.defaultReplacementWord);
        localStorage.setItem('seo_default_replacement_word', cfg.defaultReplacementWord);
      }
      if (cfg.googleDocUrl) {
        const incomingDocId = extractGoogleDocId(cfg.googleDocUrl);
        const currentDocId = activeSyncedDocIdRef.current;
        setGoogleDocUrl(cfg.googleDocUrl);
        localStorage.setItem('seo_google_doc_url', cfg.googleDocUrl);

        if (incomingDocId !== currentDocId) {
          // Purge stale template cache when doc URL was changed on another device
          localStorage.removeItem('seo_template_base64');
          localStorage.removeItem('seo_template_name');
          setTemplateBuffer(null);
          setTemplateName(null);
        }

        if (cfg.syncedDocBase64) {
          const bytes = base64ToUint8Array(cfg.syncedDocBase64);
          setTemplateBuffer(bytes.buffer as ArrayBuffer);
          setTemplateName('googledriveautomation.docx');
          activeSyncedDocIdRef.current = incomingDocId;
          localStorage.setItem('seo_synced_doc_id', incomingDocId);
        }
        if (cfg.syncedDocText) {
          setWhiteboardText(cfg.syncedDocText);
          activeSyncedDocIdRef.current = incomingDocId;
          localStorage.setItem('seo_synced_doc_id', incomingDocId);
        }
        if (Array.isArray(cfg.syncedFoundAirlines) && cfg.syncedFoundAirlines.length > 0) {
          setDetectedAirlines(cfg.syncedFoundAirlines);
        }
        if (cfg.syncedPrimaryAirline) {
          setReplacementWord(cfg.syncedPrimaryAirline);
        }
        if (Array.isArray(cfg.syncedUniqueTfns) && cfg.syncedUniqueTfns.length > 0) {
          setOldTfn(cfg.syncedUniqueTfns.join(', '));
        }
      }
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    void pullGlobalWorkspaceConfig();
    const onFocus = () => {
      void pullGlobalWorkspaceConfig();
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      void pullGlobalWorkspaceConfig();
    }, 8000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, []);

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

  const handleSyncGoogleDoc = async (): Promise<ArrayBuffer | null> => {
    const cleanDocId = extractGoogleDocId(googleDocUrl);
    setIsSyncingDoc(true);
    setStatusMessage(`Syncing Google Doc (${cleanDocId})... Please wait.`);
    // Purge any stale cached template before syncing the new doc
    localStorage.removeItem('seo_template_base64');
    localStorage.removeItem('seo_template_name');
    let syncedBuffer: ArrayBuffer | null = null;
    try {
      const res = await fetch('/api/sync-google-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentials,
          docId: cleanDocId,
          airlines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync Google Doc.');
      }

      if (data.updatedAt) {
        lastWorkspaceSyncRef.current = data.updatedAt;
        localStorage.setItem('seo_workspace_updated_at', String(data.updatedAt));
      }
      activeSyncedDocIdRef.current = cleanDocId;
      localStorage.setItem('seo_synced_doc_id', cleanDocId);

      if (Array.isArray(data.foundAirlines) && data.foundAirlines.length > 0) {
        setDetectedAirlines(data.foundAirlines);
      }
      if (data.primaryAirline) {
        setReplacementWord(data.primaryAirline);
      }
      if (Array.isArray(data.uniqueTfns) && data.uniqueTfns.length > 0) {
        setOldTfn(data.uniqueTfns.join(', '));
      }

      if (data.fullText) {
        setWhiteboardText(data.fullText);
      }

      if (data.docxBase64) {
        const bytes = base64ToUint8Array(data.docxBase64);
        syncedBuffer = bytes.buffer as ArrayBuffer;
        setTemplateBuffer(syncedBuffer);
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
        syncedBuffer = fallbackDocx.buffer as ArrayBuffer;
        setTemplateBuffer(syncedBuffer);
        setTemplateName('googledriveautomation.docx');
      }

      setSyncedDocFlash(true);
      setTimeout(() => setSyncedDocFlash(false), 2000);
      triggerActionNotice(`✓ Synced Google Doc (${cleanDocId}) across all devices!`);
      setStatusMessage(
        `Sync complete (${cleanDocId}): ${data.foundAirlines?.length || 0} airline(s), ${
          data.uniqueTfns?.length || 0
        } TFN(s) found.`
      );
      if (Array.isArray(data.logLines)) {
        setSyncModalLines(data.logLines);
      }
      return syncedBuffer;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Google Doc sync failed: ${msg}`);
      return null;
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

    // Check if another device updated the Google Doc or credentials before generating
    await pullGlobalWorkspaceConfig();

    // If the Google Doc URL was updated and differs from the cached template's Doc ID, auto-sync the new doc first!
    let activeBuffer = templateBuffer;
    const currentTargetDocId = extractGoogleDocId(googleDocUrl);
    if (
      !useWhiteboard &&
      (!activeBuffer || activeSyncedDocIdRef.current !== currentTargetDocId)
    ) {
      const freshBuf = await handleSyncGoogleDoc();
      if (freshBuf) {
        activeBuffer = freshBuf;
      }
    }

    // If Old TFN is left empty, automatically use the configured Default Old TFN directly
    const effectiveOldTfn = oldTfn.trim() || defaultOldTfn || DEFAULT_OLD_TFN;
    const effectiveNewTfn = newTfn.trim() || defaultNewTfn || DEFAULT_NEW_TFN;
    const effectiveWord =
      replacementWord.trim() ||
      defaultReplacementWord ||
      DEFAULT_REPLACEMENT_WORD;

    if (!effectiveNewTfn) {
      setStatusMessage('Input Required: Please provide a New TFN value.');
      return;
    }

    if (useWhiteboard) {
      if (!whiteboardText.trim()) {
        setStatusMessage('Input Required: Write or paste content into the whiteboard before generating.');
        return;
      }
    } else if (!activeBuffer) {
      setStatusMessage('Input Required: Attach a DOCX template (or Sync Google Doc) before generating template outputs.');
      return;
    }

    if (!generatePdf) {
      setStatusMessage('Output Required: Enable Generate PDF to continue.');
      return;
    }

    setIsGenerating(true);
    setStatusMessage(
      `Generating web-native PDFs for ${activeSelectedAirlines.length} airline(s) (Old TFN: ${effectiveOldTfn} → New TFN: ${effectiveNewTfn})...`
    );

    try {
      const builtItems: GeneratedFileItem[] = [];

      for (const airline of activeSelectedAirlines) {
        const outName = buildOutputName(airline);
        let docxBytes: Uint8Array;
        let pdfBytes: Uint8Array;

        if (useWhiteboard) {
          const wbStyle = {
            fontFamily: wbFontFamily,
            fontSize: wbFontSize,
            bold: wbBold,
            italic: wbItalic,
            underline: wbUnderline,
          };
          docxBytes = await createDocxFromWhiteboard(
            whiteboardText,
            airline,
            effectiveOldTfn,
            effectiveNewTfn,
            effectiveWord,
            airlines,
            detectedAirlines,
            wbStyle
          );
          pdfBytes = createPdfFromWhiteboard(
            whiteboardText,
            airline,
            effectiveOldTfn,
            effectiveNewTfn,
            effectiveWord,
            airlines,
            detectedAirlines,
            wbStyle
          );
        } else {
          docxBytes = await processDocxTemplateBuffer(
            activeBuffer!,
            airline,
            effectiveOldTfn,
            effectiveNewTfn,
            effectiveWord,
            airlines,
            detectedAirlines
          );
          pdfBytes = await convertDocxBytesToPdfBytes(docxBytes);
        }

        builtItems.push({
          name: outName,
          airline,
          docxBytes,
          pdfBytes,
        });
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
      } else if (builtItems.length === 1) {
        downloadSingleFile(builtItems[0], 'pdf');
      }

      setStatusMessage(
        `Completed! Generated ${builtItems.length} ready-to-use PDF document(s) in ${folderName}.`
      );
      setGeneratedFlash(true);
      setTimeout(() => setGeneratedFlash(false), 2200);
      triggerActionNotice(`✓ Generated ${builtItems.length} PDF document(s)!`);
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

    for (const item of items) {
      // Place ready-to-use PDFs directly inside the batch folder (matching SEOAUTOMATION3.py)
      root.file(`${item.name}.pdf`, item.pdfBytes);
      if (includeDocxInZip) {
        root.folder('docx')!.file(`${item.name}.docx`, item.docxBytes);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-${generateSequenceName('zip')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingleFile = (
    item: GeneratedFileItem,
    format: 'pdf' | 'docx' = 'pdf'
  ) => {
    if (format === 'pdf') {
      const blob = new Blob([item.pdfBytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      });
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

  // Direct Share to 3rd-Party Apps + Auto-Download (Single PDF/DOCX or Full ZIP)
  const shareSingleFile = async (
    item: GeneratedFileItem,
    format: 'pdf' | 'docx' = 'pdf'
  ) => {
    // 1. Auto-download immediately so the file is saved without an extra step
    downloadSingleFile(item, format);

    const fileName = `${item.name}.${format}`;
    const mimeType =
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const bytes = format === 'pdf' ? item.pdfBytes : item.docxBytes;

    // 2. Attempt native OS / Browser file share to 3rd-party apps
    try {
      const fileObj = new File([bytes.buffer as ArrayBuffer], fileName, {
        type: mimeType,
      });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [fileObj] }))) {
        await nav.share({
          title: `${item.airline} Airlines Document (${fileName})`,
          text: `Sharing ${item.airline} Airlines document (${fileName}) — TFN: ${
            newTfn || defaultNewTfn
          }`,
          files: [fileObj],
        });
        setStatusMessage(
          `Auto-downloaded & shared ${fileName} to 3rd-party app!`
        );
        return;
      }
    } catch {
      // Fallback to 3rd-Party App Share Modal if native share sheet was dismissed or unsupported
    }

    setShareModalTarget({
      fileName,
      airlineLabel: item.airline,
      fileCount: 1,
    });
    setStatusMessage(
      `Auto-downloaded ${fileName}! Select a 3rd-party app to share.`
    );
  };

  const shareOutputZip = async (
    items = generatedFiles,
    batchFolder = outputBatchName || 'seo-pdfs'
  ) => {
    if (items.length === 0) {
      setStatusMessage(
        'No Output: Generate documents first before sharing ZIP.'
      );
      return;
    }

    const zip = new JSZip();
    const root = zip.folder(batchFolder)!;
    for (const item of items) {
      root.file(`${item.name}.pdf`, item.pdfBytes);
      if (includeDocxInZip) {
        root.folder('docx')!.file(`${item.name}.docx`, item.docxBytes);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `archive-${generateSequenceName('zip')}.zip`;

    // 1. Auto-download the ZIP immediately
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFileName;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Attempt native Web Share with ZIP file
    try {
      const zipFile = new File([blob], zipFileName, {
        type: 'application/zip',
      });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [zipFile] }))) {
        await nav.share({
          title: `SEO AUTOMATOR Output ZIP (${items.length} files)`,
          text: `Sharing ${items.length} generated airline PDFs (${zipFileName}) — TFN: ${
            newTfn || defaultNewTfn
          }`,
          files: [zipFile],
        });
        setStatusMessage(
          `Auto-downloaded & shared ${zipFileName} (${items.length} files)!`
        );
        return;
      }
    } catch {
      // Fallback to 3rd-Party App Share Modal
    }

    setShareModalTarget({
      fileName: zipFileName,
      airlineLabel: `${items.length} Airlines Batch`,
      fileCount: items.length,
    });
    setStatusMessage(
      `Auto-downloaded ${zipFileName}! Choose a 3rd-party app to share.`
    );
  };

  const handleResetHomeDefaultValues = () => {
    localStorage.removeItem('seo_old_tfn');
    localStorage.removeItem('seo_new_tfn');
    localStorage.removeItem('seo_replacement_word');
    setOldTfn(defaultOldTfn);
    setNewTfn(defaultNewTfn);
    setReplacementWord(defaultReplacementWord);
    setStatusMessage(
      `Reset Old TFN (${defaultOldTfn}), New TFN (${defaultNewTfn}), and Replacement Word (${defaultReplacementWord}) to configured defaults.`
    );
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

  const handleLogout = () => {
    localStorage.removeItem('seo_studio_auth_session');
    sessionStorage.removeItem('seo_studio_auth_session');
    setIsAuthenticated(false);
  };

  const navItems: Array<{
    id: TopTab;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'home',
      label: 'Airlines Pdf Generator',
      shortLabel: 'Airlines PDF',
      description: 'Multi-Airline PDF & DOCX Studio',
      icon: Home,
    },
    {
      id: 'concat',
      label: 'Link Conc Generator',
      shortLabel: 'Link Conc',
      description: 'URL Builder & Sheet Sync',
      icon: Link2,
    },
    {
      id: 'airline-content',
      label: 'Airline Content',
      shortLabel: 'Airlines',
      description: 'SEO Article Generator',
      icon: FileText,
    },
    {
      id: 'rank',
      label: 'Rank Checker',
      shortLabel: 'Rank Check',
      description: 'Multi-Country SERP Audit',
      icon: Globe,
    },
    {
      id: 'seo-automation',
      label: 'SEO Bulk Automation',
      shortLabel: 'Bulk SEO',
      description: 'Whitehat & Blackhat Suite',
      icon: Sparkles,
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      description: 'Defaults, Keys & Security',
      icon: Settings,
    },
  ];

  const currentNavItem =
    navItems.find((item) => item.id === activeTab) || navItems[0];

  const handleSelectTab = (tabId: TopTab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onAuthenticated={() => setIsAuthenticated(true)}
        hasSavedWorkspace={hasSavedWorkspace}
        lastSavedTab={activeTab}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Slide-Over Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Side Navigation (Clean Modern Light UI matching the workspace) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white text-slate-800 border-r border-slate-200 transition-all duration-200 lg:sticky lg:top-0 lg:h-screen ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-68'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-72 shadow-2xl'
            : '-translate-x-full w-72 lg:translate-x-0'
        }`}
      >
        {/* Sidebar Top Header: User Profile Icon + SEO AUTOMATOR + Workspace Suite · TANU SINGH */}
        <div className="h-18 px-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={() => handleSelectTab('home')}
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
          >
            <img
              src={userAvatarUrl || DEFAULT_TANU_AVATAR_DATA_URI}
              alt={userName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = DEFAULT_TANU_AVATAR_DATA_URI;
              }}
              className="w-10 h-10 rounded-full object-cover border-2 border-blue-600 shadow-xs shrink-0"
            />
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="min-w-0">
                <span className="text-sm font-extrabold tracking-tight text-slate-900 block truncate">
                  SEO AUTOMATOR
                </span>
                <span className="text-[11px] font-semibold text-blue-700 block truncate">
                  Workspace Suite · {userName}
                </span>
              </div>
            )}
          </button>

          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Drawer Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links inside Side Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {(!sidebarCollapsed || mobileMenuOpen) && (
            <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navigation
            </div>
          )}
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                title={
                  sidebarCollapsed
                    ? `${item.label} — ${item.description}`
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                } ${
                  sidebarCollapsed && !mobileMenuOpen
                    ? 'justify-center px-0'
                    : ''
                }`}
              >
                <IconComponent
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-blue-600'
                  }`}
                />
                {(!sidebarCollapsed || mobileMenuOpen) && (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold block truncate">
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] block truncate ${
                        isActive ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {item.description}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Action: Logout Only (Removed duplicate Generate button) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`w-full h-10 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-700 hover:text-red-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              sidebarCollapsed && !mobileMenuOpen ? 'px-0' : 'px-3.5'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!sidebarCollapsed || mobileMenuOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Right Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Responsive Top Context Bar (Clean Light UI, No Duplicate Generate Button) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {currentNavItem.label}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                {currentNavItem.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-slate-200">
              <img
                src={userAvatarUrl || DEFAULT_TANU_AVATAR_DATA_URI}
                alt={userName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = DEFAULT_TANU_AVATAR_DATA_URI;
                }}
                className="w-7 h-7 rounded-full object-cover border border-blue-500"
              />
              <span className="text-xs font-bold text-slate-800">
                {userName}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Global Application Loader & Action Feedback Bar */}
        {(isGenerating || isSyncingDoc || globalActionNotice) && (
          <div
            className={`mb-4 px-4 py-3 rounded-xl shadow-md flex items-center justify-between gap-3 transition-all ${
              isGenerating || isSyncingDoc
                ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              {isGenerating || isSyncingDoc ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isGenerating
                  ? `Generating ${activeSelectedAirlines.length} Airline PDF Document(s)... Please wait`
                  : isSyncingDoc
                  ? `Syncing Google Doc (${extractGoogleDocId(googleDocUrl)}) & Updating Template...`
                  : globalActionNotice}
              </span>
            </div>
            <span className="text-[11px] font-mono bg-black/15 px-2.5 py-0.5 rounded-full shrink-0">
              {isGenerating || isSyncingDoc ? 'Running...' : 'Completed'}
            </span>
          </div>
        )}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Shared Setup Section */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Airlines Pdf Generator — Shared Setup
                  </h2>
                  <p className="text-xs italic text-slate-500">
                    Leave Old TFN empty to automatically use your Default Old TFN ({defaultOldTfn}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleResetHomeDefaultValues();
                    setResetDefaultsFlash(true);
                    setTimeout(() => setResetDefaultsFlash(false), 1800);
                    triggerActionNotice('✓ Reset Old TFN, New TFN & Replacement Word to Defaults');
                  }}
                  className="h-8 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer"
                  title="Reset Old TFN, New TFN, and Replacement Word to configured defaults"
                >
                  {resetDefaultsFlash ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reset Applied!</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Default Values</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: TFN + Replacement Word + Airlines */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Old TFN Number
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem('seo_old_tfn');
                            setOldTfn('');
                          }}
                          className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
                        >
                          Clear (Use Default: {defaultOldTfn})
                        </button>
                      </div>
                      <input
                        type="text"
                        value={oldTfn}
                        onChange={(e) => {
                          localStorage.removeItem('seo_old_tfn');
                          setOldTfn(e.target.value);
                        }}
                        placeholder={`Default when empty: ${defaultOldTfn}`}
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
                    {/* Google Docs Link Bar (Editable Anytime) */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-slate-800">
                          Google Docs Link (Editable Anytime)
                        </label>
                        <div className="flex items-center gap-2">
                          <a
                            href={buildGoogleDocUrl(googleDocUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                            title="Open Google Doc in a new tab to edit content"
                          >
                            <span>Open &amp; Edit Doc</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {googleDocUrl !== DEFAULT_GOOGLE_DOC_URL && (
                            <button
                              type="button"
                              onClick={() => setGoogleDocUrl(DEFAULT_GOOGLE_DOC_URL)}
                              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={googleDocUrl}
                          onChange={(e) => setGoogleDocUrl(e.target.value)}
                          placeholder="Paste any Google Docs link or Document ID..."
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          disabled={isSyncingDoc}
                          onClick={() => void handleSyncGoogleDoc()}
                          className="h-9 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                        >
                          {isSyncingDoc ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Syncing...</span>
                            </>
                          ) : syncedDocFlash ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Synced!</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Sync</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Active ID: <code className="font-mono text-slate-700">{extractGoogleDocId(googleDocUrl)}</code>
                      </p>
                    </div>

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
                          <span>Generate PDF (Built-in Web PDF Engine — No External App Needed)</span>
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
                        <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeDocxInZip}
                            onChange={(e) => setIncludeDocxInZip(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Also Include .DOCX Files Inside ZIP</span>
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
                          onClick={() => shareOutputZip()}
                          className="h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                          title="Auto-downloads ZIP and directly shares to 3rd-party apps"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share Output ZIP</span>
                        </button>

                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => runGeneration(homeMode === 'whiteboard')}
                          className="h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : generatedFlash ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Generated!</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>Generate Document</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAirlineManager(true)}
                          className="h-10 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Manage Airlines</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSyncingDoc}
                          onClick={() => void handleSyncGoogleDoc()}
                          className="h-10 px-3 bg-blue-50 hover:bg-blue-100 active:scale-95 border border-blue-200 text-blue-700 disabled:opacity-50 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isSyncingDoc ? 'animate-spin' : ''
                            }`}
                          />
                          <span>
                            {isSyncingDoc
                              ? 'Syncing...'
                              : syncedDocFlash
                              ? 'Synced!'
                              : 'Sync Google Doc'}
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
                          className="col-span-2 h-9 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Latest Output</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Web PDF Engine Status & Optional LibreOffice Link */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-emerald-900 flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Web PDF Engine Active (No LibreOffice Needed)</span>
                      </span>
                      <span className="text-emerald-700 text-[11px] block truncate">
                        Generates direct searchable .pdf files in browser &amp; Vercel
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-2.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-md text-emerald-800 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Settings
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
                      onClick={() => shareOutputZip()}
                      className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Auto-download ZIP and directly share to 3rd-party apps"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share All as ZIP</span>
                    </button>
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
                          {file.name}.pdf
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => shareSingleFile(file, 'pdf')}
                          className="px-2 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                          title="Auto-download PDF and share to 3rd-party apps"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSingleFile(file, 'pdf')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadSingleFile(file, 'docx')}
                          className="px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                          title="Download DOCX version"
                        >
                          DOCX
                        </button>
                      </div>
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
          <LinkConcatenatorPanel
            credentials={credentials}
            onSendUrlsToAutomation={(urls) => {
              setAutomationSeedUrls(urls);
              setActiveTab('seo-automation');
            }}
          />
        )}

        {activeTab === 'airline-content' && <AirlineContentGeneratorPanel />}

        {activeTab === 'rank' && <RankCheckerPanel />}

        {activeTab === 'seo-automation' && (
          <SeoBulkAutomationPanel
            defaultTfn={newTfn}
            airlines={airlines}
            initialUrls={automationSeedUrls}
            onSendToWhiteboard={(content) => {
              setWhiteboardText(content);
              setHomeMode('whiteboard');
              setActiveTab('home');
              setStatusMessage(
                'Loaded spun article into Whiteboard! Click Generate Document to create PDFs.'
              );
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAndGuidePanel
            credentials={credentials}
            onSaveCredentials={(creds) => {
              localStorage.removeItem('seo_credentials');
              setCredentials(creds);
              localStorage.setItem('seo_credentials', JSON.stringify(creds));
            }}
            googleDocUrl={googleDocUrl}
            onChangeGoogleDocUrl={(nextUrl) => {
              localStorage.removeItem('seo_google_doc_url');
              localStorage.removeItem('seo_template_base64');
              localStorage.removeItem('seo_template_name');
              setTemplateBuffer(null);
              setTemplateName(null);
              setGoogleDocUrl(nextUrl);
              triggerActionNotice(`✓ Updated Google Doc URL (${extractGoogleDocId(nextUrl)}) & Purged Old Cache`);
            }}
            defaultOldTfn={defaultOldTfn}
            defaultNewTfn={defaultNewTfn}
            defaultReplacementWord={defaultReplacementWord}
            onUpdateDefaultValues={({ oldTfn: o, newTfn: n, replacementWord: w }) => {
              setDefaultOldTfn(o);
              setDefaultNewTfn(n);
              setDefaultReplacementWord(w);
              setOldTfn(o);
              setNewTfn(n);
              setReplacementWord(w);
            }}
            onResetAllDefaultValues={() => {
              setDefaultOldTfn(DEFAULT_OLD_TFN);
              setDefaultNewTfn(DEFAULT_NEW_TFN);
              setDefaultReplacementWord(DEFAULT_REPLACEMENT_WORD);
              setOldTfn(DEFAULT_OLD_TFN);
              setNewTfn(DEFAULT_NEW_TFN);
              setReplacementWord(DEFAULT_REPLACEMENT_WORD);
            }}
            userName={userName}
            onChangeUserName={(nextName) => {
              setUserName(nextName);
              localStorage.setItem('seo_user_display_name', nextName);
            }}
            userAvatarUrl={userAvatarUrl}
            onChangeUserAvatar={(nextAvatar) => {
              setUserAvatarUrl(nextAvatar);
              localStorage.setItem('seo_user_avatar_url', nextAvatar);
            }}
          />
        )}
        </main>

        {/* Mobile Bottom Quick Navigation Bar for Any Device Support */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-1 py-1 grid grid-cols-6 gap-0.5 shadow-lg">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'text-blue-600 bg-blue-50/80 font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <IconComponent className="w-4 h-4 shrink-0" />
                <span className="text-[10px] leading-tight mt-1 truncate max-w-full">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

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

      {/* Google Doc Sync Results Modal (Light UI) */}
      {syncModalLines && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
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
            <div className="fast-scroll-container max-h-80 p-3.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg font-mono text-xs space-y-1">
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

      {/* 3rd-Party App Direct Share Modal (Opened after Auto-Download) */}
      {shareModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Share to 3rd-Party Apps
                  </h3>
                  <p className="text-xs text-emerald-700 font-medium">
                    ✓ Auto-Downloaded: {shareModalTarget.fileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalTarget(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your file (<strong>{shareModalTarget.fileName}</strong>) has been automatically downloaded to your device. Choose a 3rd-party app below to share immediately:
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `SEO AUTOMATOR — ${shareModalTarget.airlineLabel} (${shareModalTarget.fileName}) | TFN: ${
                    newTfn || defaultNewTfn
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  window.location.origin
                )}&text=${encodeURIComponent(
                  `SEO AUTOMATOR — ${shareModalTarget.airlineLabel} (${shareModalTarget.fileName}) | TFN: ${
                    newTfn || defaultNewTfn
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </a>

              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
                  `SEO AUTOMATOR Output: ${shareModalTarget.fileName}`
                )}&body=${encodeURIComponent(
                  `Attached / Downloaded File: ${shareModalTarget.fileName}\nBatch: ${shareModalTarget.airlineLabel}\nActive TFN: ${
                    newTfn || defaultNewTfn
                  }`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-bold flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Gmail Compose</span>
              </a>

              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    `SEO AUTOMATOR — ${shareModalTarget.airlineLabel} (${shareModalTarget.fileName}) | TFN: ${
                      newTfn || defaultNewTfn
                    }`
                  );
                  setCopiedShareText(true);
                  setTimeout(() => setCopiedShareText(false), 1600);
                }}
                className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedShareText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied Info!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Summary</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShareModalTarget(null)}
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
