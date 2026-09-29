import JSZip from 'jszip';

export const DEFAULT_OLD_TFN = '';
export const DEFAULT_NEW_TFN = '+1-888-548-7012';
export const DEFAULT_REPLACEMENT_WORD = 'Qatar';

export const GOOGLE_DOC_ID = '1wWLgilVoc0AabtNoDcmEHzYv2K4VjvHb7qfycs-ZCTU';
export const DEFAULT_GOOGLE_DOC_URL = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/edit`;
export const GOOGLE_SHEET_ID = '1E4gyzCpwb4eIwUubY6CiKkl9CjO49kw327D8bUfj5Fg';
export const DEFAULT_GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`;
export const LIBREOFFICE_WEBSITE_URL = 'https://www.libreoffice.org/';
export const LIBREOFFICE_DOWNLOAD_URL = 'https://www.libreoffice.org/download/';

/**
 * Extracts a clean Google Doc ID from either a full Google Docs URL or a raw ID string.
 */
export function extractGoogleDocId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return GOOGLE_DOC_ID;
  const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) return docMatch[1];
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  // If user pasted just the raw ID
  const cleanId = trimmed.split(/[/?#&]/)[0].trim();
  return cleanId || GOOGLE_DOC_ID;
}

export function buildGoogleDocUrl(input: string): string {
  const docId = extractGoogleDocId(input);
  return `https://docs.google.com/document/d/${docId}/edit`;
}

/**
 * Extracts a clean Google Sheet ID from either a full Google Sheets URL or a raw ID string.
 */
export function extractGoogleSheetId(input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return GOOGLE_SHEET_ID;
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch && sheetMatch[1]) return sheetMatch[1];
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) return idParamMatch[1];
  const cleanId = trimmed.split(/[/?#&]/)[0].trim();
  return cleanId || GOOGLE_SHEET_ID;
}

export function buildGoogleSheetUrl(input: string): string {
  const sheetId = extractGoogleSheetId(input);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

export interface SerpLocationOption {
  code: string;
  label: string;
  gl: string;
  hl: string;
  cr: string;
  googleDomain: string;
  canonicalPlace: string;
  acceptLang: string;
}

export const SERP_COUNTRY_LOCATIONS: SerpLocationOption[] = [
  {
    code: 'US',
    label: 'United States (Google USA)',
    gl: 'us',
    hl: 'en',
    cr: 'countryUS',
    googleDomain: 'www.google.com',
    canonicalPlace: 'United States',
    acceptLang: 'en-US,en;q=0.9',
  },
  {
    code: 'US-NY',
    label: 'United States — New York, NY',
    gl: 'us',
    hl: 'en',
    cr: 'countryUS',
    googleDomain: 'www.google.com',
    canonicalPlace: 'New York,New York,United States',
    acceptLang: 'en-US,en;q=0.9',
  },
  {
    code: 'US-CA',
    label: 'United States — Los Angeles, CA',
    gl: 'us',
    hl: 'en',
    cr: 'countryUS',
    googleDomain: 'www.google.com',
    canonicalPlace: 'Los Angeles,California,United States',
    acceptLang: 'en-US,en;q=0.9',
  },
  {
    code: 'US-TX',
    label: 'United States — Dallas, TX',
    gl: 'us',
    hl: 'en',
    cr: 'countryUS',
    googleDomain: 'www.google.com',
    canonicalPlace: 'Dallas,Texas,United States',
    acceptLang: 'en-US,en;q=0.9',
  },
  {
    code: 'UK',
    label: 'United Kingdom (Google UK)',
    gl: 'gb',
    hl: 'en-GB',
    cr: 'countryUK',
    googleDomain: 'www.google.co.uk',
    canonicalPlace: 'United Kingdom',
    acceptLang: 'en-GB,en;q=0.9',
  },
  {
    code: 'CA',
    label: 'Canada (Google CA)',
    gl: 'ca',
    hl: 'en-CA',
    cr: 'countryCA',
    googleDomain: 'www.google.ca',
    canonicalPlace: 'Canada',
    acceptLang: 'en-CA,en;q=0.9',
  },
  {
    code: 'AU',
    label: 'Australia (Google AU)',
    gl: 'au',
    hl: 'en-AU',
    cr: 'countryAU',
    googleDomain: 'www.google.com.au',
    canonicalPlace: 'Australia',
    acceptLang: 'en-AU,en;q=0.9',
  },
  {
    code: 'IN',
    label: 'India (Google IN)',
    gl: 'in',
    hl: 'en-IN',
    cr: 'countryIN',
    googleDomain: 'www.google.co.in',
    canonicalPlace: 'India',
    acceptLang: 'en-IN,en;q=0.9',
  },
  {
    code: 'AE',
    label: 'United Arab Emirates (Google AE)',
    gl: 'ae',
    hl: 'en',
    cr: 'countryAE',
    googleDomain: 'www.google.ae',
    canonicalPlace: 'United Arab Emirates',
    acceptLang: 'en-AE,en;q=0.9',
  },
  {
    code: 'DE',
    label: 'Germany (Google DE)',
    gl: 'de',
    hl: 'de',
    cr: 'countryDE',
    googleDomain: 'www.google.de',
    canonicalPlace: 'Germany',
    acceptLang: 'de-DE,de;q=0.9,en;q=0.8',
  },
  {
    code: 'FR',
    label: 'France (Google FR)',
    gl: 'fr',
    hl: 'fr',
    cr: 'countryFR',
    googleDomain: 'www.google.fr',
    canonicalPlace: 'France',
    acceptLang: 'fr-FR,fr;q=0.9,en;q=0.8',
  },
  {
    code: 'ES',
    label: 'Spain (Google ES)',
    gl: 'es',
    hl: 'es',
    cr: 'countryES',
    googleDomain: 'www.google.es',
    canonicalPlace: 'Spain',
    acceptLang: 'es-ES,es;q=0.9,en;q=0.8',
  },
  {
    code: 'MX',
    label: 'Mexico (Google MX)',
    gl: 'mx',
    hl: 'es-419',
    cr: 'countryMX',
    googleDomain: 'www.google.com.mx',
    canonicalPlace: 'Mexico',
    acceptLang: 'es-MX,es;q=0.9,en;q=0.8',
  },
  {
    code: 'SG',
    label: 'Singapore (Google SG)',
    gl: 'sg',
    hl: 'en',
    cr: 'countrySG',
    googleDomain: 'www.google.com.sg',
    canonicalPlace: 'Singapore',
    acceptLang: 'en-SG,en;q=0.9',
  },
  {
    code: 'QA',
    label: 'Qatar (Google QA)',
    gl: 'qa',
    hl: 'en',
    cr: 'countryQA',
    googleDomain: 'www.google.com.qa',
    canonicalPlace: 'Qatar',
    acceptLang: 'en-QA,en;q=0.9',
  },
];

const UULE_KEY_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Encodes any canonical location string (e.g., "United States" or "New York,New York,United States")
 * into Google Search's official UULE geolocation parameter so users can browse any country/city SERP without a VPN.
 */
export function encodeGoogleUule(canonicalPlace: string): string {
  const clean = (canonicalPlace || 'United States').trim();
  const keyChar = UULE_KEY_TABLE[clean.length % UULE_KEY_TABLE.length] || 'E';
  let b64 = '';
  if (typeof btoa === 'function') {
    b64 = btoa(unescape(encodeURIComponent(clean)));
  } else {
    b64 = Buffer.from(clean, 'utf-8').toString('base64');
  }
  return `w+CAIQICI${keyChar}${b64}`;
}

export const AVAILABLE_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Dutch', 'Chinese', 'Japanese', 'Arabic', 'Hindi', 'Russian',
  'Korean', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian',
  'Malay', 'Filipino', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Polish', 'Czech', 'Hungarian', 'Romanian',
  'Greek', 'Hebrew',
];

export const DEFAULT_AIRLINES = [
  'American',
  'Delta',
  'United',
  'Southwest',
  'Alaska',
  'JetBlue',
  'Avianca',
  'Frontier',
  'Allegiant Air',
  'Hawaiian',
  'KLM',
  'Latam',
  'Emirates',
  'easyJet',
  'Lufthansa',
  'Turkish',
  'Singapore',
  'WestJet',
  'Kayak',
  'Expedia',
  'Priceline',
  'Qantas',
  'Air Canada',
  'Swiss Air',
  'Spirit',
  'Sun Country',
  'Avelo',
  'JSX',
  'Cape Air',
  'Eastern',
  'Air Wisconsin',
  'Contour',
  'JustFly',
  'Travelocity',
  'Orbitz',
  'One Travel',
  'Momondo',
  'Wego',
  'Silver',
  'TUI',
  'Qatar',
  'British',
  'Jet2',
  'Breeze',
];

export const RANK_CHECKER_AIRLINES = [
  'American', 'Delta', 'United', 'Southwest', 'Alaska', 'JetBlue',
  'Avianca', 'Frontier', 'Allegiant', 'Hawaiian', 'KLM', 'Latam',
  'Emirates', 'easyJet', 'Lufthansa', 'Turkish', 'Singapore',
  'WestJet', 'Kayak', 'Expedia', 'Priceline', 'Qantas', 'Air Canada',
  'Swiss Air', 'TUI Airways', 'Qatar', 'British', 'Jet2',
  'Virgin Atlantic', 'Aer Lingus', 'Breeze Airways', 'Spirit Airlines',
  'Sun Country Airlines', 'Cape Air', 'Avelo Airlines', 'JSX',
  'Silver Airways', 'Eastern Airlines', 'Air Wisconsin', 'CommuteAir',
  'Contour Airlines',
];

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

export const DEFAULT_CREDENTIALS: ServiceAccountCredentials = {
  type: 'service_account',
  project_id: 'seo-automation-503206',
  private_key_id: '582bc8f3063eb3002b96b65611c0d2d3902c458e',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxM980rQat9nJP\nc1VPROwgVRI6PiMzJmPbPiDNE7A7L9SdxfdAICUEzU35AyeXX1r2BLdlEXZyfIi1\nQlavzc3art6j/bx1jRx9qGjMwkFEW4jcCl/fmgG1b2QigmmNnhTmF4+eoj6LRCGO\n+gtfFSwR63GA8UqxHzo5PkimtAYAu90gITOjbM14rvNDUSpYraL34yQaOGn8T10+\nJMvXq7We/oIK+r2//Qelp39GbuEmkGRXrZZJf6GZlqeIvz3sZG7lZA65UsP2dH5J\ntGiqbixEmIx7jsbzYkWhWosCWo6qRychJaTu0sOVh+tsbuskZASoUv69BAswE1qA\n+M5VtH+/AgMBAAECggEABCNSwjqLV8ltgFV2viC9GUD86ZQR4yixiqkeWV7Th4F/\nOyZbg7yi093hEdn1Aey3UkKbiPMQPqD4QEm9F698PLytdLIakiD3DVtYnY91UeqH\nsG7wyWchqxVfoHHf+e9uS+efWI3JXOjJljq+96I/vGgws/LuhfxVfu8cmzTEMlHA\nZOVXpwVnwr0Fw4WKX6LsNf/o8ZgFWQrRFnJ1+LYr545jlh+pPRKkxpS/9jGxlpqo\n+gV0BgKkPJVY6Hkb78KpCElm8EtVu+jWdiRserHzpjAk0d3xTD2gk+uSqO3oj0DU\ndSIya0UCkKxoIZWJWgKEUQ2Gw6npU0Q2tFkSJCo54QKBgQDf0LAHvJvTbYZMSVcG\nSGYVPdtFxNXe4hVTQm+/yeTpeAPkU7c4Nj3gWWO0OEJbyZazptsiBoh3eX17QKrP\nG6TLaclRcDtui4EQEh9pq/OqlOtANOiBpgjHj6ADsnXwZz9+QrPe8mywyBCVi/ko\nVREkBhAuzShAMuq3nf8bmooliwKBgQDKrzw4a4YbV05OS7l0sdo/SXeEsH1Zz+2s\nGNJq8AtYPeFVXdz8yKmRFFcKIMQLADIZW9cyguNAM6OP8Qa27vWR3Fn3Nsde6WIb\nBGGSWERzvtVXt0QvhomH+xZvAaV5IgLj9QSEKxBje5sQoDbowdRtwN2KSN7W1fWW\nnW0JghidHQKBgBUCegO/6MDIHzs6BzlHwo1r6RF7kLgDcQ0Hx4WxZhOkeHkOgrx8\nGwLcYUehoFkNa2Ah4aAoDNdqSCUxxNb8OVP+8i764hlWbx8bFGfPBGiW4h582PaS\np3BUQykVr4yJpKQtjsT27M0LesMPCKyIj7tZ9lruV0DvhqkF49SrhRxRAoGAT9WS\nLM79dct/xotBM1vSkVcIwrUZysSB42Wri/+dGFbXaN6d6tvHHqQaXJznW0Xqdd6c\n9wJjLKiqZkoT0P5yr89RiHSFNzdKM0YYgKJP5B9ovTIso2OkzHD0Nyk42muxI8Ug\n0EZ+IBFR1MymlCu01r4/BPcK/ygrofXEOxiJRWkCgYEAqGr9iKMjZ7pTIJoS9XME\n538soVw+/h4LufTucaf7NPq/4PfYHJckxBORT4nY0X9EEK0afbPx7oAMFePAeEUH\ndEdfc0tidol817CMUuP3dE+0QWSgxO/YxRe1rw1mUfZhIIXHfEEaxWiiy0CLk9SC\n5j8fqVemPH1uvT7dQRPOj8o=\n-----END PRIVATE KEY-----\n',
  client_email: 'seo-automation@seo-automation-503206.iam.gserviceaccount.com',
  client_id: '101671687949489223942',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:
    'https://www.googleapis.com/robot/v1/metadata/x509/seo-automation%40seo-automation-503206.iam.gserviceaccount.com',
  universe_domain: 'googleapis.com',
};

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseOldTfns(oldTfn: string): string[] {
  if (!oldTfn) return [];
  return oldTfn
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeAirlineForMatching(value: string): string {
  if (!value) return '';
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s/_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return normalized.replace(/\s+/g, ' ');
}

export function findMatchingAirlinesInText(
  text: string,
  airlineNames: string[]
): { airline: string; position: number }[] {
  if (!text || !airlineNames.length) return [];
  const normalizedText = normalizeAirlineForMatching(text);
  if (!normalizedText) return [];

  const matchesWithPositions: { airline: string; position: number }[] = [];
  for (const airline of airlineNames) {
    const normalizedAirline = normalizeAirlineForMatching(airline);
    if (!normalizedAirline) continue;
    const pos = normalizedText.indexOf(normalizedAirline);
    if (pos !== -1) {
      matchesWithPositions.push({ airline, position: pos });
    }
  }

  matchesWithPositions.sort((a, b) => a.position - b.position);
  return matchesWithPositions;
}

export function slugifyNoWhitespaceNoAirlines(text: string): string {
  let s = text.toLowerCase().trim();
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/airlines/g, '');
  s = s.replace(/[\s/_]+/g, '-');
  s = s.replace(/[^a-z0-9-]+/g, '');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || 'airline';
}

export function generateSequenceName(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

export function buildOutputName(airline: string): string {
  const slug = slugifyNoWhitespaceNoAirlines(airline);
  return generateSequenceName(slug);
}

export const FLEXIBLE_TFN_PATTERN =
  /(?:\+?\d{1,3}[-–—\s._/]+)?(?:\(\s*\d{2,4}\s*\)|\d{2,4})[-–—\s._/]+(?:\(\s*\d{2,4}\s*\)|\d{2,4})[-–—\s._/]+(?:\(\s*\d{3,5}\s*\)|\d{3,5})(?:[-–—\s._/]+(?:\(\s*\d{2,4}\s*\)|\d{2,4}))?/g;

export function detectTfnsInText(text: string): string[] {
  if (!text) return [];
  const pattern = new RegExp(FLEXIBLE_TFN_PATTERN.source, 'g');
  const seen = new Set<string>();
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const candidate = match[0].trim();
    const digits = candidate.replace(/[^\d]/g, '');
    if (digits.length >= 10 && digits.length <= 15 && !seen.has(candidate)) {
      seen.add(candidate);
      results.push(candidate);
    }
  }
  return results;
}

export function replaceTfnInString(
  text: string,
  oldTfnRaw: string,
  newTfn: string
): string {
  if (!text || !newTfn) return text;
  let updated = text;

  // 1. Replace explicit old TFNs first (longest first so partial substrings don't leave prefixes)
  const explicitOlds = parseOldTfns(oldTfnRaw).sort((a, b) => b.length - a.length);
  for (const oldVal of explicitOlds) {
    if (oldVal && updated.includes(oldVal)) {
      updated = updated.split(oldVal).join(newTfn);
    }
  }

  // 2. Also run the flexible regex detector covering +1--(888)-548-7012, +1-(888)-548-(7012 ), etc.
  const phoneRegex = new RegExp(FLEXIBLE_TFN_PATTERN.source, 'g');
  updated = updated.replace(phoneRegex, (matched) => {
    const digits = matched.replace(/[^\d]/g, '');
    if (digits.length >= 10 && digits.length <= 15) {
      return newTfn;
    }
    return matched;
  });

  return updated;
}

export function replaceAirlineInString(
  text: string,
  targetAirline: string,
  replacementWord: string,
  allKnownAirlines: string[],
  detectedAirlines: string[] = []
): string {
  if (!text || !targetAirline) return text;
  const repWord = replacementWord.trim() || DEFAULT_REPLACEMENT_WORD;

  const combined = Array.from(
    new Set([...DEFAULT_AIRLINES, ...allKnownAirlines, ...detectedAirlines])
  ).sort((a, b) => b.length - a.length);

  const placeholderWords: string[] = [];
  for (const known of combined) {
    const regex = new RegExp(escapeRegExp(known), 'i');
    if (regex.test(text)) {
      placeholderWords.push(known);
    }
  }

  if (repWord && !placeholderWords.includes(repWord)) {
    placeholderWords.unshift(repWord);
  } else if (repWord && placeholderWords.includes(repWord)) {
    const idx = placeholderWords.indexOf(repWord);
    placeholderWords.splice(idx, 1);
    placeholderWords.unshift(repWord);
  }

  for (const det of detectedAirlines) {
    if (
      !placeholderWords.includes(det) &&
      det.toLowerCase() !== targetAirline.toLowerCase()
    ) {
      placeholderWords.push(det);
    }
  }

  const filteredTokens = placeholderWords.filter(
    (pw) => pw.toLowerCase() !== targetAirline.toLowerCase()
  );

  let updated = text;
  for (const token of filteredTokens) {
    if (
      token.includes(' ') ||
      token.length >= 4 ||
      token.toLowerCase() === repWord.toLowerCase()
    ) {
      const pattern = new RegExp(escapeRegExp(token), 'gi');
      updated = updated.replace(pattern, targetAirline);
    } else {
      const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi');
      updated = updated.replace(pattern, targetAirline);
    }
  }
  return updated;
}

export function replaceAirlineKeywordForGenerator(
  content: string,
  sourceAirline: string,
  targetAirline: string
): string {
  const trimmedSource = sourceAirline.trim();
  if (trimmedSource) {
    const pattern = new RegExp(escapeRegExp(trimmedSource), 'gi');
    return content.replace(pattern, targetAirline);
  }
  const sortedPatterns = [...DEFAULT_AIRLINES]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const pattern = new RegExp(`(?<!\\w)(?:${sortedPatterns.join('|')})(?!\\w)`, 'gi');
  return content.replace(pattern, targetAirline);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(escaped: string): string {
  return escaped
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Extracts plain text from an uploaded .docx ArrayBuffer
 */
export async function extractTextFromDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = Object.keys(zip.files).filter(
    (name) =>
      name === 'word/document.xml' ||
      /^word\/header\d*\.xml$/.test(name) ||
      /^word\/footer\d*\.xml$/.test(name)
  );

  const parts: string[] = [];
  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file) continue;
    const xml = await file.async('string');
    const paragraphs = xml.split(/<\/w:p>/);
    for (const p of paragraphs) {
      const texts: string[] = [];
      const regex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(p)) !== null) {
        texts.push(unescapeXml(m[1]));
      }
      if (texts.length > 0) {
        parts.push(texts.join(''));
      }
    }
  }
  return parts.join('\n');
}

/**
 * Modifies a .docx template buffer by replacing TFN and Airline names across paragraphs,
 * tables, headers, and footers while keeping paragraph styling intact.
 */
export async function processDocxTemplateBuffer(
  templateBuffer: ArrayBuffer,
  airline: string,
  oldTfn: string,
  newTfn: string,
  replacementWord: string,
  allKnownAirlines: string[],
  detectedAirlines: string[]
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBuffer);
  const xmlFiles = Object.keys(zip.files).filter(
    (name) =>
      name === 'word/document.xml' ||
      /^word\/header\d*\.xml$/.test(name) ||
      /^word\/footer\d*\.xml$/.test(name)
  );

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file) continue;
    const xml = await file.async('string');

    // Replace paragraph by paragraph: first try run-by-run to preserve inline styles,
    // and if a token was split across runs, fallback to paragraph-level replacement.
    const updatedXml = xml.replace(/<w:p(?:\s+[^/>]*)*>[\s\S]*?<\/w:p>/g, (paraXml) => {
      const tMatches = Array.from(paraXml.matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g));
      if (tMatches.length === 0) return paraXml;

      const combinedOriginal = tMatches.map((m) => unescapeXml(m[1])).join('');
      let targetCombined = replaceTfnInString(combinedOriginal, oldTfn, newTfn);
      targetCombined = replaceAirlineInString(
        targetCombined,
        airline,
        replacementWord,
        allKnownAirlines,
        detectedAirlines
      );

      if (targetCombined === combinedOriginal) {
        return paraXml;
      }

      // Try run-by-run replacement first so individual <w:r> bold/color/links stay intact
      const runReplacedPieces: string[] = [];
      const runUpdatedXml = paraXml.replace(
        /<w:t(\s+[^>]*)?>([\s\S]*?)<\/w:t>/g,
        (_full, attrs, inner) => {
          const rawRunText = unescapeXml(inner);
          let repRun = replaceTfnInString(rawRunText, oldTfn, newTfn);
          repRun = replaceAirlineInString(
            repRun,
            airline,
            replacementWord,
            allKnownAirlines,
            detectedAirlines
          );
          runReplacedPieces.push(repRun);
          return `<w:t xml:space="preserve">${escapeXml(repRun)}</w:t>`;
        }
      );

      if (runReplacedPieces.join('') === targetCombined) {
        return runUpdatedXml;
      }

      // Fallback when Word split a phone number or airline name across multiple <w:t> runs
      let first = true;
      return paraXml.replace(/<w:t(\s+[^>]*)?>([\s\S]*?)<\/w:t>/g, (_full, attrs) => {
        if (first) {
          first = false;
          return `<w:t xml:space="preserve">${escapeXml(targetCombined)}</w:t>`;
        }
        return `<w:t${attrs || ''}></w:t>`;
      });
    });

    zip.file(fileName, updatedXml);
  }

  // Also update any tel: hyperlinks inside word/_rels/document.xml.rels
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile && newTfn) {
    const relsXml = await relsFile.async('string');
    const cleanNewTel = newTfn.replace(/[^\d+]/g, '');
    const updatedRels = relsXml.replace(
      /Target="tel:[^"]*"/gi,
      `Target="tel:${escapeXml(cleanNewTel)}"`
    );
    zip.file('word/_rels/document.xml.rels', updatedRels);
  }

  return zip.generateAsync({ type: 'uint8array' });
}

export interface WhiteboardParagraphStyle {
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Generates a valid .docx file (Uint8Array) from Whiteboard text or HTML lines
 */
export async function createDocxFromWhiteboard(
  rawText: string,
  airline: string,
  oldTfn: string,
  newTfn: string,
  replacementWord: string,
  allKnownAirlines: string[],
  detectedAirlines: string[],
  style: WhiteboardParagraphStyle
): Promise<Uint8Array> {
  let processed = replaceTfnInString(rawText, oldTfn, newTfn);
  processed = replaceAirlineInString(
    processed,
    airline,
    replacementWord,
    allKnownAirlines,
    detectedAirlines
  );

  const lines = processed.split(/\r?\n/);
  const halfPtSize = Math.max(16, Math.min(96, (style.fontSize || 11) * 2));
  const fontName = escapeXml(style.fontFamily || 'Calibri');

  const bodyParagraphs = lines
    .map((line) => {
      if (!line.trim()) {
        return '<w:p/>';
      }
      const isHeading = line.startsWith('# ');
      const cleanLine = isHeading ? line.slice(2) : line;
      const runSize = isHeading ? 40 : halfPtSize;
      const isBold = isHeading || Boolean(style.bold);

      return `<w:p>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/>
            <w:sz w:val="${runSize}"/>
            <w:szCs w:val="${runSize}"/>
            ${isBold ? '<w:b/>' : ''}
            ${style.italic ? '<w:i/>' : ''}
            ${style.underline ? '<w:u w:val="single"/>' : ''}
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(cleanLine)}</w:t>
        </w:r>
      </w:p>`;
    })
    .join('\n');

  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParagraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  return zip.generateAsync({ type: 'uint8array' });
}

/**
 * Generates cross-platform LibreOffice helper scripts included inside the ZIP bundle
 * so that when the web app is used on Vercel (cloud), the user can convert all generated DOCX
 * files to PDF with one click using their local LibreOffice installation (`soffice --headless --convert-to pdf`).
 */
export function buildLibreOfficeBatchScripts(): {
  macLinuxSh: string;
  windowsBat: string;
  readmeTxt: string;
} {
  const macLinuxSh = `#!/usr/bin/env bash
# SEO Document Studio - LibreOffice Batch DOCX-to-PDF Converter
# Official LibreOffice Download: https://www.libreoffice.org/
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

SOFFICE_BIN="\${LIBREOFFICE_BIN:-}"
if [ -z "$SOFFICE_BIN" ]; then
  for candidate in "/Applications/LibreOffice.app/Contents/MacOS/soffice" "/opt/homebrew/bin/soffice" "/usr/bin/soffice" "/usr/local/bin/soffice" "$(command -v soffice 2>/dev/null)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      SOFFICE_BIN="$candidate"
      break
    fi
  done
fi

if [ -z "$SOFFICE_BIN" ]; then
  echo "❌ LibreOffice (soffice) was not found on your system."
  echo "⬇ Please download and install LibreOffice from: https://www.libreoffice.org/"
  exit 1
fi

mkdir -p pdfs
echo "⚡ Converting DOCX files to PDF using LibreOffice ($SOFFICE_BIN)..."
"$SOFFICE_BIN" --headless --convert-to pdf --outdir "./pdfs" ./docx/*.docx
echo "✅ Done! All PDFs have been saved in the ./pdfs folder."
`;

  const windowsBat = `@echo off
REM SEO Document Studio - LibreOffice Batch DOCX-to-PDF Converter
REM Official LibreOffice Download: https://www.libreoffice.org/

cd /d "%~dp0"
set "SOFFICE_BIN="

if exist "C:\\Program Files\\LibreOffice\\program\\soffice.exe" (
  set "SOFFICE_BIN=C:\\Program Files\\LibreOffice\\program\\soffice.exe"
) else if exist "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe" (
  set "SOFFICE_BIN=C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
) else (
  where soffice >nul 2>nul && set "SOFFICE_BIN=soffice"
)

if "%SOFFICE_BIN%"=="" (
  echo [ERROR] LibreOffice was not found on your computer.
  echo Please download and install LibreOffice from: https://www.libreoffice.org/
  pause
  exit /b 1
)

if not exist "pdfs" mkdir pdfs
echo Converting DOCX files to PDF using LibreOffice...
for %%f in (docx\\*.docx) do (
  "%SOFFICE_BIN%" --headless --convert-to pdf --outdir "pdfs" "%%f"
)
echo Done! All PDFs are in the pdfs folder.
pause
`;

  const readmeTxt = `SEO DOCUMENT STUDIO - LIBREOFFICE PDF CONVERSION
================================================

Download LibreOffice: https://www.libreoffice.org/

If these files were generated from the cloud (Vercel) where desktop LibreOffice
is not running locally on the server:
1. Make sure LibreOffice is installed on your computer (https://www.libreoffice.org/)
2. Extract this ZIP folder.
3. On Windows: Double-click "convert_to_pdf_windows.bat"
   On macOS / Linux: Run "bash convert_to_pdf_mac_linux.sh" in Terminal
4. All DOCX files in ./docx/ will be converted into ./pdfs/ using:
   soffice --headless --convert-to pdf
`;

  return { macLinuxSh, windowsBat, readmeTxt };
}
