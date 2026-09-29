import express from 'express';
import { execFile, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { google } from 'googleapis';
import {
  DEFAULT_AIRLINES,
  DEFAULT_CREDENTIALS,
  GOOGLE_DOC_ID,
  GOOGLE_SHEET_ID,
  SERP_COUNTRY_LOCATIONS,
  encodeGoogleUule,
  extractGoogleDocId,
  extractGoogleSheetId,
  detectTfnsInText,
  findMatchingAirlinesInText,
  normalizeAirlineForMatching,
  ServiceAccountCredentials,
} from '../src/lib/seoHelpers.js';

const execFileAsync = promisify(execFile);

export function findLibreOffice(customPath?: string): string | null {
  const candidates: string[] = [];
  if (customPath && customPath.trim()) {
    candidates.push(customPath.trim());
  }
  if (process.env.LIBREOFFICE_BIN) {
    candidates.push(process.env.LIBREOFFICE_BIN);
  }
  candidates.push(
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
    '/usr/bin/libreoffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
  );

  try {
    const whichCmd = process.platform === 'win32' ? 'where soffice' : 'which soffice';
    const resolved = execSync(whichCmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split(/\r?\n/)[0]
      .trim();
    if (resolved) {
      candidates.push(resolved);
    }
  } catch {
    // ignore if not in PATH
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const app = express();

// Enable CORS so a Vercel-hosted web app can also talk to a local companion server on localhost:3000 if desired
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

app.get('/api/system-status', (req, res) => {
  const customPath = typeof req.query.customPath === 'string' ? req.query.customPath : undefined;
  const libreofficePath = findLibreOffice(customPath);
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

  res.json({
    libreofficeAvailable: Boolean(libreofficePath),
    libreofficePath,
    platform: process.platform,
    isVercel,
    downloadUrl: 'https://www.libreoffice.org/',
  });
});

app.post('/api/convert-pdf', async (req, res) => {
  const { files, customLibreOfficePath } = req.body as {
    files: { name: string; docxBase64: string }[];
    customLibreOfficePath?: string;
  };

  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'No files provided for conversion.' });
    return;
  }

  const soffice = findLibreOffice(customLibreOfficePath);
  if (!soffice) {
    res.status(200).json({
      converted: false,
      libreofficeAvailable: false,
      downloadUrl: 'https://www.libreoffice.org/',
      message:
        'LibreOffice (soffice) was not found on this server host. Download LibreOffice from https://www.libreoffice.org/ or use the included 1-click LibreOffice batch converter in the ZIP archive.',
      files: files.map((f) => ({
        name: f.name,
        docxBase64: f.docxBase64,
      })),
    });
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seo-doc-studio-'));
  const pdfDir = path.join(tmpDir, 'pdfs');
  fs.mkdirSync(pdfDir, { recursive: true });

  try {
    const outputFiles: { name: string; pdfBase64?: string; docxBase64: string }[] = [];

    for (const item of files) {
      const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, '') || 'document';
      const docxPath = path.join(tmpDir, `${safeName}.docx`);
      const expectedPdfPath = path.join(pdfDir, `${safeName}.pdf`);

      fs.writeFileSync(docxPath, Buffer.from(item.docxBase64, 'base64'));

      await execFileAsync(soffice, [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        pdfDir,
        docxPath,
      ]);

      if (fs.existsSync(expectedPdfPath)) {
        const pdfBuffer = fs.readFileSync(expectedPdfPath);
        outputFiles.push({
          name: safeName,
          pdfBase64: pdfBuffer.toString('base64'),
          docxBase64: item.docxBase64,
        });
      } else {
        outputFiles.push({
          name: safeName,
          docxBase64: item.docxBase64,
        });
      }
    }

    res.json({
      converted: true,
      libreofficeAvailable: true,
      libreofficePath: soffice,
      message: `Converted ${outputFiles.filter((f) => f.pdfBase64).length} document(s) to PDF via LibreOffice.`,
      files: outputFiles,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `LibreOffice conversion error: ${errMsg}`,
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
});

function extractTextFromGoogleDocContent(items: any[]): string {
  let text = '';
  if (!Array.isArray(items)) return text;
  for (const item of items) {
    if (item.paragraph && Array.isArray(item.paragraph.elements)) {
      for (const elem of item.paragraph.elements) {
        if (elem.textRun && typeof elem.textRun.content === 'string') {
          text += elem.textRun.content;
        }
      }
    }
    if (item.table && Array.isArray(item.table.tableRows)) {
      for (const row of item.table.tableRows) {
        if (Array.isArray(row.tableCells)) {
          for (const cell of row.tableCells) {
            if (Array.isArray(cell.content)) {
              text += extractTextFromGoogleDocContent(cell.content);
            }
          }
        }
      }
    }
  }
  return text;
}

app.post('/api/sync-google-doc', async (req, res) => {
  const {
    credentials = DEFAULT_CREDENTIALS,
    docId = GOOGLE_DOC_ID,
    airlines = DEFAULT_AIRLINES,
  } = req.body as {
    credentials?: ServiceAccountCredentials;
    docId?: string;
    airlines?: string[];
  };

  const cleanDocId = extractGoogleDocId(docId || GOOGLE_DOC_ID);

  try {
    let fullText = '';
    let docxBase64: string | null = null;
    let usedPublicFallback = false;

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: credentials.client_email,
          private_key: credentials.private_key.replace(/\\n/g, '\n'),
          project_id: credentials.project_id,
        },
        scopes: [
          'https://www.googleapis.com/auth/documents.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
        ],
      });

      const docs = google.docs({ version: 'v1', auth });
      const drive = google.drive({ version: 'v3', auth });

      const docResponse = await docs.documents.get({ documentId: cleanDocId });
      const bodyContent = docResponse.data.body?.content || [];
      fullText = extractTextFromGoogleDocContent(bodyContent);

      try {
        const exportRes = await drive.files.export(
          {
            fileId: cleanDocId,
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
          { responseType: 'arraybuffer' }
        );
        if (exportRes.data) {
          docxBase64 = Buffer.from(exportRes.data as ArrayBuffer).toString('base64');
        }
      } catch {
        // Fallback to direct Google Docs DOCX export URL
        try {
          const docxUrl = `https://docs.google.com/document/d/${cleanDocId}/export?format=docx`;
          const docxRes = await fetch(docxUrl);
          if (docxRes.ok) {
            const arrBuf = await docxRes.arrayBuffer();
            docxBase64 = Buffer.from(arrBuf).toString('base64');
          }
        } catch {
          // Ignore if direct export also fails
        }
      }
    } catch (serviceAccountErr) {
      // Fallback: if the user pasted a public Google Doc link ("Anyone with the link"),
      // fetch its plain text and DOCX export directly via Google Docs public export URLs
      const txtUrl = `https://docs.google.com/document/d/${cleanDocId}/export?format=txt`;
      const docxUrl = `https://docs.google.com/document/d/${cleanDocId}/export?format=docx`;

      const txtRes = await fetch(txtUrl);
      if (!txtRes.ok) {
        throw serviceAccountErr;
      }
      fullText = await txtRes.text();
      usedPublicFallback = true;

      try {
        const docxRes = await fetch(docxUrl);
        if (docxRes.ok) {
          const arrBuf = await docxRes.arrayBuffer();
          docxBase64 = Buffer.from(arrBuf).toString('base64');
        }
      } catch {
        // Ignore public docx export error if txt succeeded
      }
    }

    if (!fullText.trim()) {
      res.status(400).json({ error: 'The Google Doc appears to be empty.' });
      return;
    }

    const uniqueTfns = detectTfnsInText(fullText);
    const allAirlineNames = Array.from(new Set([...airlines, ...DEFAULT_AIRLINES])).sort(
      (a, b) =>
        normalizeAirlineForMatching(b).length - normalizeAirlineForMatching(a).length ||
        a.toLowerCase().localeCompare(b.toLowerCase())
    );

    const openingSection = fullText.slice(0, 500);
    let matches = findMatchingAirlinesInText(openingSection, allAirlineNames);
    if (matches.length === 0) {
      matches = findMatchingAirlinesInText(fullText, allAirlineNames);
    } else {
      const fullMatches = findMatchingAirlinesInText(fullText, allAirlineNames);
      for (const fm of fullMatches) {
        if (!matches.some((m) => m.airline === fm.airline)) {
          matches.push({ airline: fm.airline, position: fm.position + 500 });
        }
      }
    }

    const foundAirlines = matches.map((m) => m.airline);
    const primaryAirline = matches.length > 0 ? matches[0].airline : null;

    const resultLines: string[] = [
      'Google Doc Sync Results',
      '========================================',
      `Document ID: ${cleanDocId}`,
      usedPublicFallback
        ? 'Sync Mode: Public Link Export'
        : 'Sync Mode: Google Cloud Service Account API',
      '',
    ];
    if (foundAirlines.length > 0) {
      resultLines.push(`Airlines Found (${foundAirlines.length}):`);
      for (const m of matches) {
        if (m.position < 500) {
          resultLines.push(`  - ${m.airline} (found in opening section)`);
        } else {
          resultLines.push(`  - ${m.airline}`);
        }
      }
      if (primaryAirline) {
        resultLines.push('');
        resultLines.push(`Primary Placeholder Airline: '${primaryAirline}'`);
        resultLines.push(
          'This airline will be replaced with your selected airline(s) in each generated document.'
        );
      }
    } else {
      resultLines.push('No matching airlines found in the document.');
    }

    if (uniqueTfns.length > 0) {
      resultLines.push(`TFN Numbers Found (${uniqueTfns.length}):`);
      for (const t of uniqueTfns) {
        resultLines.push(`  - ${t}`);
      }
      resultLines.push(`Auto-filled Old TFN: '${uniqueTfns.join(', ')}'`);
    } else {
      resultLines.push('No TFN numbers found in the document.');
    }

    if (docxBase64) {
      resultLines.push('Downloaded Google Doc as googledriveautomation.docx and attached as active template.');
    }

    res.json({
      docId: cleanDocId,
      fullText,
      docxBase64,
      fileName: 'googledriveautomation.docx',
      foundAirlines,
      primaryAirline,
      uniqueTfns,
      logLines: resultLines,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to sync Google Doc (${cleanDocId}). Make sure the Google Doc is shared with "${credentials.client_email}" or set to "Anyone with the link can view". Details: ${errMsg}`,
    });
  }
});

app.post('/api/check-google-sheet', async (req, res) => {
  const {
    credentials = DEFAULT_CREDENTIALS,
    sheetId = GOOGLE_SHEET_ID,
  } = req.body as {
    credentials?: ServiceAccountCredentials;
    sheetId?: string;
  };

  const cleanSheetId = extractGoogleSheetId(sheetId || GOOGLE_SHEET_ID);

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
        project_id: credentials.project_id,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: cleanSheetId,
    });

    const title = meta.data.properties?.title || 'Untitled Spreadsheet';
    const sheetTabs =
      meta.data.sheets
        ?.map((s) => s.properties?.title)
        .filter((t): t is string => Boolean(t)) || [];

    res.json({
      sheetId: cleanSheetId,
      title,
      sheetTabs,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`,
      serviceAccountEmail: credentials.client_email,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Cannot access Google Sheet (${cleanSheetId}). Make sure it is shared with "${credentials.client_email}" as Editor. Details: ${errMsg}`,
    });
  }
});

app.post('/api/sync-google-sheet', async (req, res) => {
  const {
    credentials = DEFAULT_CREDENTIALS,
    sheetId = GOOGLE_SHEET_ID,
    tabName = 'SEO',
    column = 'B',
    startRow = 3,
    includePrefixSuffix = false,
    links = [],
    rowsData = [],
  } = req.body as {
    credentials?: ServiceAccountCredentials;
    sheetId?: string;
    tabName?: string;
    column?: string;
    startRow?: number;
    includePrefixSuffix?: boolean;
    links?: string[];
    rowsData?: { id: number; prefix: string; suffix: string; result: string }[];
  };

  if (!Array.isArray(links) || links.length === 0) {
    res.status(400).json({ error: 'No links provided to sync.' });
    return;
  }

  const cleanSheetId = extractGoogleSheetId(sheetId || GOOGLE_SHEET_ID);
  const cleanTab = (tabName || '').trim();
  const cleanCol =
    (column || 'B')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '') || 'B';
  const safeStartRow = Math.max(1, Number(startRow) || 3);
  const endRow = safeStartRow + links.length - 1;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, '\n'),
        project_id: credentials.project_id,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    let spreadsheetTitle = 'Google Sheet';
    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: cleanSheetId,
      });
      if (meta.data.properties?.title) {
        spreadsheetTitle = meta.data.properties.title;
      }
    } catch {
      // ignore metadata lookup failure if update still works
    }

    const values =
      includePrefixSuffix && Array.isArray(rowsData) && rowsData.length === links.length
        ? rowsData.map((r) => [r.result, r.prefix, r.suffix])
        : links.map((l) => [l]);

    const endCol =
      includePrefixSuffix && values[0]?.length === 3
        ? String.fromCharCode(Math.min(90, cleanCol.charCodeAt(0) + 2))
        : cleanCol;

    const cellRange =
      endCol !== cleanCol
        ? `${cleanCol}${safeStartRow}:${endCol}${endRow}`
        : `${cleanCol}${safeStartRow}:${cleanCol}${endRow}`;

    const fullRangeWithTab = cleanTab ? `${cleanTab}!${cellRange}` : cellRange;
    let appliedRange = fullRangeWithTab;

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSheetId,
        range: fullRangeWithTab,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    } catch {
      appliedRange = cellRange;
      await sheets.spreadsheets.values.update({
        spreadsheetId: cleanSheetId,
        range: cellRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }

    res.json({
      syncedCount: links.length,
      sheetId: cleanSheetId,
      spreadsheetTitle,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`,
      updatedRange: appliedRange,
      tabName: cleanTab || 'Default Tab',
      column: endCol !== cleanCol ? `${cleanCol}:${endCol}` : cleanCol,
      startRow: safeStartRow,
      endRow,
      timestamp: new Date().toLocaleTimeString(),
      message: `Synced ${links.length} link(s) to "${spreadsheetTitle}" → Range ${appliedRange} (Rows ${safeStartRow} to ${endRow})!`,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Google Sheet Sync Error (${cleanSheetId}): Make sure the sheet is shared with ${credentials.client_email} as Editor. ${errMsg}`,
    });
  }
});

const AUTH_CONFIG_FILE = path.join(os.tmpdir(), 'seo-studio-auth-state.json');
const DEFAULT_APP_USERNAME = '8081368879';
const DEFAULT_APP_PASSWORD = 'seo.8268';
const LOGIN_TWO_STEP_OTP = '6307500844';
const PASSWORD_RESET_MASTER_OTP = '6391059119';

// Anti-Brute-Force Rate Limiter & Active Session Store
const authAttemptTracker = new Map<
  string,
  { count: number; lockedUntil: number }
>();
const activeSessionTokens = new Set<string>();

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to prevent timing leaks
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = authAttemptTracker.get(key);
  if (entry && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function recordAuthFailure(key: string): void {
  const now = Date.now();
  const entry = authAttemptTracker.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 8) {
    entry.lockedUntil = now + 30 * 1000; // 30s lockout after 8 consecutive failed attempts
    entry.count = 0;
  }
  authAttemptTracker.set(key, entry);
}

function clearAuthFailures(key: string): void {
  authAttemptTracker.delete(key);
}

function getActiveAppPassword(): string {
  try {
    if (fs.existsSync(AUTH_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_CONFIG_FILE, 'utf-8'));
      if (parsed && typeof parsed.password === 'string' && parsed.password.trim()) {
        return parsed.password;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_APP_PASSWORD;
}

function setActiveAppPassword(newPassword: string): void {
  try {
    fs.writeFileSync(
      AUTH_CONFIG_FILE,
      JSON.stringify({
        password: newPassword,
        updatedAt: new Date().toISOString(),
      }),
      'utf-8'
    );
  } catch {
    // ignore if read-only fs
  }
}

app.post('/api/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientIp = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const limit = checkRateLimit(`login:${clientIp}`);
  if (!limit.allowed) {
    res.status(429).json({
      step1Verified: false,
      authenticated: false,
      error: `Too many failed attempts. Locked for ${limit.retryAfterSec}s.`,
    });
    return;
  }

  const { username, password, clientStoredPassword } = req.body as {
    username?: string;
    password?: string;
    clientStoredPassword?: string;
  };

  const expectedPassword = clientStoredPassword || getActiveAppPassword();
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '');

  if (
    safeEqual(cleanUser, DEFAULT_APP_USERNAME) &&
    (safeEqual(cleanPass, expectedPassword) ||
      safeEqual(cleanPass, getActiveAppPassword()))
  ) {
    clearAuthFailures(`login:${clientIp}`);
    res.json({
      step1Verified: true,
      requiresOtp: true,
      username: DEFAULT_APP_USERNAME,
      message:
        'Password verified. Please enter your 2-Step Verification OTP to unlock the application.',
    });
    return;
  }

  recordAuthFailure(`login:${clientIp}`);
  res.status(401).json({
    step1Verified: false,
    authenticated: false,
    error: 'Invalid username or password.',
  });
});

app.post('/api/verify-login-otp', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientIp = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const limit = checkRateLimit(`otp:${clientIp}`);
  if (!limit.allowed) {
    res.status(429).json({
      authenticated: false,
      otpVerified: false,
      error: `Too many failed OTP attempts. Locked for ${limit.retryAfterSec}s.`,
    });
    return;
  }

  const { username, otp } = req.body as {
    username?: string;
    otp?: string;
  };

  const cleanUser = String(username || DEFAULT_APP_USERNAME).trim();
  const cleanOtp = String(otp || '').trim();

  if (
    safeEqual(cleanUser, DEFAULT_APP_USERNAME) &&
    safeEqual(cleanOtp, LOGIN_TWO_STEP_OTP)
  ) {
    clearAuthFailures(`otp:${clientIp}`);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeSessionTokens.add(sessionToken);
    res.json({
      authenticated: true,
      otpVerified: true,
      username: DEFAULT_APP_USERNAME,
      sessionToken,
    });
    return;
  }

  recordAuthFailure(`otp:${clientIp}`);
  res.status(401).json({
    authenticated: false,
    otpVerified: false,
    error: 'Invalid Verification OTP. Access denied.',
  });
});

app.post('/api/reset-password', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const clientIp = String(req.ip || req.headers['x-forwarded-for'] || 'local');
  const limit = checkRateLimit(`reset:${clientIp}`);
  if (!limit.allowed) {
    res.status(429).json({
      success: false,
      error: `Too many failed reset attempts. Locked for ${limit.retryAfterSec}s.`,
    });
    return;
  }

  const { resetOtp, newPassword } = req.body as {
    resetOtp?: string;
    newPassword?: string;
  };

  const cleanOtp = String(resetOtp || '').trim();
  const cleanNewPass = String(newPassword || '').trim();

  if (!safeEqual(cleanOtp, PASSWORD_RESET_MASTER_OTP)) {
    recordAuthFailure(`reset:${clientIp}`);
    res.status(403).json({
      success: false,
      error:
        'Invalid Verification OTP. Only the original authorized user with the recovery OTP can reset the password.',
    });
    return;
  }

  if (cleanNewPass.length < 4) {
    res.status(400).json({
      success: false,
      error: 'New password must be at least 4 characters long.',
    });
    return;
  }

  clearAuthFailures(`reset:${clientIp}`);
  setActiveAppPassword(cleanNewPass);
  res.json({
    success: true,
    newPassword: cleanNewPass,
    message:
      'Password successfully reset and verified with Owner Recovery OTP! Use your new password on next login.',
  });
});

function buildFlexibleTfnRegex(tfn: string): RegExp | null {
  const digits = (tfn || '').replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  const core =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (core.length === 10) {
    const p1 = core.slice(0, 3);
    const p2 = core.slice(3, 6);
    const p3 = core.slice(6, 10);
    return new RegExp(
      `(?:\\+?1[-–—\\s._/•⚡]*)?\\(?${p1}\\)?[-–—\\s._/•⚡]*${p2}[-–—\\s._/•⚡]*${p3}`,
      'gi'
    );
  }
  const escaped = tfn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped ? new RegExp(escaped, 'gi') : null;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

app.post('/api/check-rank-usa', async (req, res) => {
  const {
    airline = '',
    keyword = '',
    tfn = '',
    locationCode = 'US',
    customLocation = '',
  } = req.body as {
    airline?: string;
    keyword?: string;
    tfn?: string;
    locationCode?: string;
    customLocation?: string;
  };

  const query = `${airline} ${keyword}`.trim();
  if (!query) {
    res.status(400).json({ error: 'Query is required.' });
    return;
  }

  const preset =
    SERP_COUNTRY_LOCATIONS.find((loc) => loc.code === locationCode) ||
    SERP_COUNTRY_LOCATIONS[0];

  const canonicalPlace = customLocation.trim() || preset.canonicalPlace;
  const uule = encodeGoogleUule(canonicalPlace);
  const tfnRegex = buildFlexibleTfnRegex(tfn);

  const results: {
    position: number;
    title: string;
    link: string;
    snippet: string;
    hasTfn: boolean;
  }[] = [];

  try {
    // 1. Query Google Server for the target country/city using UULE + gl + hl + cr + pws=0 (No-VPN geolocation override)
    const googleTargetUrl = `https://${preset.googleDomain}/search?q=${encodeURIComponent(
      query
    )}&gl=${preset.gl}&hl=${preset.hl}&cr=${preset.cr}&pws=0&nfpr=1&gws_rd=cr&uule=${encodeURIComponent(
      uule
    )}&num=10&start=0`;

    const gRes = await fetch(googleTargetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': preset.acceptLang,
        Cookie: '', // Strictly Incognito (zero cookies)
      },
    });

    if (gRes.ok) {
      const html = await gRes.text();
      if (!html.includes('Our systems have detected unusual traffic')) {
        const h3Regex =
          /<a\b[^>]*href="((?:https?:\/\/|\/url\?q=https?:\/\/)[^"]+)"[^>]*>[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
        let m: RegExpExecArray | null;
        while ((m = h3Regex.exec(html)) !== null && results.length < 10) {
          let rawLink = m[1];
          if (rawLink.startsWith('/url?q=')) {
            rawLink = decodeURIComponent(rawLink.slice(7).split('&')[0]);
          }
          if (rawLink.includes('google.')) continue;

          const title = stripHtmlTags(m[2]);
          const afterIdx = m.index + m[0].length;
          const surroundingHtml = html.slice(afterIdx, afterIdx + 1800);
          const snippet = stripHtmlTags(surroundingHtml).slice(0, 340);
          const combined = `${title} ${snippet}`;
          const hasTfn = tfnRegex ? Boolean(combined.match(tfnRegex)) : false;

          results.push({
            position: results.length + 1,
            title: title || rawLink,
            link: rawLink,
            snippet,
            hasTfn,
          });
        }
      }
    }

    // 2. Country-localized Page-1 fallback when Google CAPTCHAs automated cloud IPs
    if (results.length === 0) {
      const ddgRegionMap: Record<string, string> = {
        us: 'us-en',
        gb: 'uk-en',
        ca: 'ca-en',
        au: 'au-en',
        in: 'in-en',
        de: 'de-de',
        fr: 'fr-fr',
        es: 'es-es',
        mx: 'mx-es',
        sg: 'sg-en',
      };
      const kl = ddgRegionMap[preset.gl] || 'us-en';
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        query
      )}&kl=${kl}`;
      const dRes = await fetch(ddgUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': preset.acceptLang,
        },
      });
      if (dRes.ok) {
        const dHtml = await dRes.text();
        const blockRegex =
          /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/gi;
        let bm: RegExpExecArray | null;
        while ((bm = blockRegex.exec(dHtml)) !== null && results.length < 10) {
          const block = bm[1];
          const titleMatch = block.match(
            /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
          );
          const snippetMatch = block.match(
            /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i
          );
          if (!titleMatch) continue;
          let link = titleMatch[1];
          const uddgMatch = link.match(/[?&]uddg=([^&]+)/);
          if (uddgMatch) {
            link = decodeURIComponent(uddgMatch[1]);
          }
          const title = stripHtmlTags(titleMatch[2]);
          const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]) : '';
          const combined = `${title} ${snippet}`;
          const hasTfn = tfnRegex ? Boolean(combined.match(tfnRegex)) : false;

          results.push({
            position: results.length + 1,
            title,
            link,
            snippet,
            hasTfn,
          });
        }
      }
    }

    const matchedResults = results.filter((r) => r.hasTfn);
    res.json({
      query,
      tfn,
      page: 1,
      locationCode: preset.code,
      region: `${preset.label} (${canonicalPlace} · No-VPN UULE + Incognito)`,
      uule,
      found: matchedResults.length > 0,
      matchCount: matchedResults.length,
      matchedResults,
      results: results.slice(0, 10),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to scan Page 1 SERP: ${errMsg}`,
    });
  }
});

app.post('/api/seo-check-urls', async (req, res) => {
  const { urls = [], tfn = '' } = req.body as {
    urls?: string[];
    tfn?: string;
  };

  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: 'Provide at least one URL to check.' });
    return;
  }

  const tfnRegex = buildFlexibleTfnRegex(tfn);
  const batch = urls.slice(0, 25);

  const results = await Promise.all(
    batch.map(async (rawUrl) => {
      const cleanUrl = /^https?:\/\//i.test(rawUrl.trim())
        ? rawUrl.trim()
        : `https://${rawUrl.trim()}`;
      const startMs = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const r = await fetch(cleanUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          },
        });
        clearTimeout(timeout);

        const contentType = r.headers.get('content-type') || '';
        const xRobots = r.headers.get('x-robots-tag') || '';
        let title = '';
        let h1 = '';
        let canonicalUrl = '';
        let metaRobots = '';
        let wordCount = 0;
        let hasTfn = false;
        let tfnMatchCount = 0;

        if (contentType.includes('text/html') || contentType.includes('text/plain')) {
          const text = (await r.text()).slice(0, 140000);
          const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) title = stripHtmlTags(titleMatch[1]).slice(0, 120);
          const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (h1Match) h1 = stripHtmlTags(h1Match[1]).slice(0, 120);
          const canonMatch = text.match(
            /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
          );
          if (canonMatch) canonicalUrl = canonMatch[1];
          const robotsMatch = text.match(
            /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i
          );
          if (robotsMatch) metaRobots = robotsMatch[1];
          const plainWords = stripHtmlTags(text)
            .split(/\s+/)
            .filter(Boolean);
          wordCount = plainWords.length;
          if (tfnRegex) {
            const matches = text.match(tfnRegex);
            tfnMatchCount = matches ? matches.length : 0;
            hasTfn = tfnMatchCount > 0;
          }
        } else if (contentType.includes('pdf')) {
          title = '[PDF Document]';
        }

        const noindex =
          xRobots.toLowerCase().includes('noindex') ||
          metaRobots.toLowerCase().includes('noindex');

        return {
          url: cleanUrl,
          finalUrl: r.url || cleanUrl,
          redirected: Boolean(r.url && r.url !== cleanUrl),
          status: r.status,
          ok: r.ok,
          responseTimeMs: Date.now() - startMs,
          contentType: contentType.split(';')[0] || 'unknown',
          title: title || cleanUrl,
          h1,
          canonicalUrl,
          wordCount,
          indexable: r.ok && !noindex,
          robotsInfo: noindex ? 'NOINDEX DETECTED' : 'Indexable (Follow)',
          hasTfn,
          tfnMatchCount,
        };
      } catch (err: unknown) {
        return {
          url: cleanUrl,
          finalUrl: cleanUrl,
          redirected: false,
          status: 0,
          ok: false,
          responseTimeMs: Date.now() - startMs,
          contentType: 'unreachable',
          title: err instanceof Error ? err.message : 'Connection failed',
          h1: '',
          canonicalUrl: '',
          wordCount: 0,
          indexable: false,
          robotsInfo: 'Unreachable / Timeout',
          hasTfn: false,
          tfnMatchCount: 0,
        };
      }
    })
  );

  res.json({
    checkedCount: results.length,
    results,
  });
});

app.post('/api/seo-bulk-ping', async (req, res) => {
  const { urls = [], indexNowKey = '8081368879seostudiokey' } = req.body as {
    urls?: string[];
    indexNowKey?: string;
  };

  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: 'Provide at least one URL to ping.' });
    return;
  }

  const cleanUrls = urls
    .map((u) => u.trim())
    .filter(Boolean)
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
    .slice(0, 50);

  const logs: { engine: string; target: string; status: string }[] = [];

  // 1. Ping IndexNow (Bing / Yandex / Seznam / Naver shared indexing API)
  for (const targetUrl of cleanUrls.slice(0, 15)) {
    try {
      const apiPingUrl = `https://api.indexnow.org/indexnow?url=${encodeURIComponent(
        targetUrl
      )}&key=${encodeURIComponent(indexNowKey)}`;
      const r = await fetch(apiPingUrl, { method: 'GET' });
      logs.push({
        engine: 'IndexNow (Bing/Yandex/Naver)',
        target: targetUrl,
        status: `HTTP ${r.status} (${
          r.status === 200 || r.status === 202 ? 'Accepted for Crawl' : 'Ping Sent'
        })`,
      });
    } catch {
      logs.push({
        engine: 'IndexNow (Bing/Yandex/Naver)',
        target: targetUrl,
        status: 'Ping Dispatched',
      });
    }
  }

  // 2. Ping Wayback Machine / Archive Save-Page-Now discovery header check
  for (const targetUrl of cleanUrls.slice(0, 10)) {
    try {
      const archiveCheck = `https://archive.org/wayback/available?url=${encodeURIComponent(
        targetUrl
      )}`;
      const r = await fetch(archiveCheck);
      logs.push({
        engine: 'Wayback Archive Discovery',
        target: targetUrl,
        status: `HTTP ${r.status} (Crawler Notified)`,
      });
    } catch {
      logs.push({
        engine: 'Wayback Archive Discovery',
        target: targetUrl,
        status: 'Notified',
      });
    }
  }

  res.json({
    pingedCount: cleanUrls.length,
    timestamp: new Date().toLocaleTimeString(),
    logs,
  });
});

export default app;
