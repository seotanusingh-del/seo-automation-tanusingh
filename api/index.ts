import express from 'express';
import { execFile, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { google } from 'googleapis';
import {
  DEFAULT_AIRLINES,
  DEFAULT_CREDENTIALS,
  GOOGLE_DOC_ID,
  GOOGLE_SHEET_ID,
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    const docResponse = await docs.documents.get({ documentId: docId });
    const bodyContent = docResponse.data.body?.content || [];
    const fullText = extractTextFromGoogleDocContent(bodyContent);

    if (!fullText.trim()) {
      res.status(400).json({ error: 'The Google Doc appears to be empty.' });
      return;
    }

    // Also export as DOCX binary from Google Drive
    let docxBase64: string | null = null;
    try {
      const exportRes = await drive.files.export(
        {
          fileId: docId,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        { responseType: 'arraybuffer' }
      );
      if (exportRes.data) {
        docxBase64 = Buffer.from(exportRes.data as ArrayBuffer).toString('base64');
      }
    } catch {
      // If Drive export fails, client will still construct a DOCX from fullText
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

    const resultLines: string[] = ['Google Doc Sync Results', '========================================'];
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
      error: `Failed to sync Google Doc: ${errMsg}`,
    });
  }
});

app.post('/api/sync-google-sheet', async (req, res) => {
  const {
    credentials = DEFAULT_CREDENTIALS,
    sheetId = GOOGLE_SHEET_ID,
    links = [],
  } = req.body as {
    credentials?: ServiceAccountCredentials;
    sheetId?: string;
    links?: string[];
  };

  if (!Array.isArray(links) || links.length === 0) {
    res.status(400).json({ error: 'No links provided to sync.' });
    return;
  }

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
    const startRow = 3;
    const endRow = startRow + links.length - 1;
    const values = links.map((l) => [l]);

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `SEO!B${startRow}:B${endRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    } catch {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `B${startRow}:B${endRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }

    res.json({
      syncedCount: links.length,
      timestamp: new Date().toLocaleTimeString(),
      message: `Synced ${links.length} links to Google Sheet (B${startRow}:B${endRow})!`,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Google Sheet Sync Error: ${errMsg}`,
    });
  }
});

export default app;
