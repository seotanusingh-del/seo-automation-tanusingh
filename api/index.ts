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
  extractGoogleDocId,
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
        // Ignore Drive export error if text succeeded
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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (
    String(username || '').trim() === '8081368879' &&
    String(password || '') === 'seo.8268'
  ) {
    res.json({
      authenticated: true,
      username: '8081368879',
    });
    return;
  }

  res.status(401).json({
    authenticated: false,
    error: 'Invalid username or password.',
  });
});

function buildFlexibleTfnRegex(tfn: string): RegExp | null {
  const digits = (tfn || '').replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  // Use last 10 digits if 11 digits starting with 1 (US toll-free)
  const core =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (core.length === 10) {
    const p1 = core.slice(0, 3);
    const p2 = core.slice(3, 6);
    const p3 = core.slice(6, 10);
    return new RegExp(
      `(?:\\+?1[-\\s.]?)?\\(?${p1}\\)?[-\\s.]?${p2}[-\\s.]?${p3}`,
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
  const { airline = '', keyword = '', tfn = '' } = req.body as {
    airline?: string;
    keyword?: string;
    tfn?: string;
  };

  const query = `${airline} ${keyword}`.trim();
  if (!query) {
    res.status(400).json({ error: 'Query is required.' });
    return;
  }

  const tfnRegex = buildFlexibleTfnRegex(tfn);
  const results: {
    position: number;
    title: string;
    link: string;
    snippet: string;
    hasTfn: boolean;
  }[] = [];

  try {
    // 1. Try Google USA Page 1 (num=10, start=0, gl=us, hl=en, pws=0 Incognito non-personalized, UULE=United States)
    const googleUsaUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}&gl=us&hl=en&cr=countryUS&pws=0&nfpr=1&gws_rd=cr&uule=w+CAIQICIUVW5pdGVkIFN0YXRlcw==&num=10&start=0`;

    const gRes = await fetch(googleUsaUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: '', // Strictly Incognito (no cookies)
      },
    });

    if (gRes.ok) {
      const html = await gRes.text();
      if (!html.includes('Our systems have detected unusual traffic')) {
        // Extract blocks from Google Page 1 HTML
        const h3Regex =
          /<a\b[^>]*href="((?:https?:\/\/|\/url\?q=https?:\/\/)[^"]+)"[^>]*>[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
        let m: RegExpExecArray | null;
        while ((m = h3Regex.exec(html)) !== null && results.length < 10) {
          let rawLink = m[1];
          if (rawLink.startsWith('/url?q=')) {
            rawLink = decodeURIComponent(
              rawLink.slice(7).split('&')[0]
            );
          }
          if (rawLink.includes('google.com')) continue;

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

    // 2. If Google blocked automated cloud IP, fallback to USA Page 1 SERP via Yahoo US / DuckDuckGo US HTML (top 10 results only)
    if (results.length === 0) {
      const ddgUsaUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
        query
      )}&kl=us-en`;
      const dRes = await fetch(ddgUsaUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
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
      region: 'US (Incognito / Non-Personalized)',
      found: matchedResults.length > 0,
      matchCount: matchedResults.length,
      matchedResults,
      results: results.slice(0, 10),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `Failed to scan Page 1 USA SERP: ${errMsg}`,
    });
  }
});

export default app;
