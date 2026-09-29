import React, { useState, useMemo, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Zap,
  Globe,
  ShieldAlert,
  Code2,
  Copy,
  Check,
  Download,
  RefreshCw,
  Sparkles,
  Link2,
  Send,
  Layers,
  Terminal,
  Sliders,
} from 'lucide-react';
import { DEFAULT_AIRLINES } from '../lib/seoHelpers';

interface SeoBulkAutomationPanelProps {
  defaultTfn: string;
  airlines: string[];
  initialUrls?: string[];
  onSendToWhiteboard?: (content: string) => void;
}

type AutomationSubTab =
  | 'indexer-checker'
  | 'spintax-matrix'
  | 'tfn-obfuscator'
  | 'backlink-schema'
  | 'parasite-weaver'
  | 'keyword-server-rules';

interface UrlCheckResult {
  url: string;
  finalUrl: string;
  redirected?: boolean;
  status: number;
  ok: boolean;
  responseTimeMs: number;
  contentType: string;
  title: string;
  h1?: string;
  canonicalUrl?: string;
  wordCount?: number;
  indexable: boolean;
  robotsInfo: string;
  hasTfn: boolean;
  tfnMatchCount?: number;
}

const SPINTAX_PRESETS: Record<string, { label: string; template: string }> = {
  whitehat: {
    label: 'Whitehat: Official Airline Policy & Rebooking Guide',
    template: `# {2026 Official|Updated 2026|Complete} {AIRLINE} Airlines {KEYWORD} & {Rebooking|Same-Day Standby} Guide\n\nIf you {missed your|have a delayed or missed} {AIRLINE} flight, {call|contact|reach} the {24/7|immediate|priority} {AIRLINE} {rebooking desk|passenger helpdesk|support line} at {TFN} (or {TFN_OBFUSCATED}) for {instant|same-day|confirmed} seat re-accommodation.\n\n## How to Resolve a {AIRLINE} {KEYWORD} Immediately\n1. {Dial|Call} {TFN} within {2 hours|120 minutes} of your scheduled departure.\n2. Request the {AIRLINE} {"Flat Tire Rule"|Standby Rebooking Policy|No-Show Waiver} at {TFN}.\n3. Confirm your {return ticket|connecting itinerary} protection with an agent at {TFN}.`,
  },
  greyhat: {
    label: 'Greyhat: High-CTR Parasite PDF / Landing Page Callout',
    template: `# ⚡ {URGENT|24/7 DIRECT}: {AIRLINE} Airlines {KEYWORD} Helpline {TFN}\n\n**{Need Immediate Rebooking?|Missed Your {AIRLINE} Connection?|Avoid Ticket Cancellation Now!}** Call {TFN} ({TFN_OBFUSCATED}) to speak directly with a {live|certified|senior} {AIRLINE} {itinerary specialist|rebooking agent} in under 60 seconds.\n\n## {AIRLINE} Same-Day {Rebooking|Standby|Ticket Protection} Checklist ({YEAR})\n- **No-Show Protection Window:** Call {TFN} before gate closure to preserve ticket value.\n- **Baggage & Connecting Flights:** Reroute checked luggage immediately via {TFN}.\n- **24/7 Priority Desk:** {TFN} | {TFN_OBFUSCATED}`,
  },
  blackhat: {
    label: 'Blackhat: Emergency Flight Disruption & Standby Alert',
    template: `# 🚨 [ALERT {YEAR}] {AIRLINE} Airlines {KEYWORD} — Waive Rebooking Fees at {TFN}\n\nPassengers affected by {missed departures|tight layovers|gate closures} on **{AIRLINE} Airlines** can bypass standard hold queues by dialing **{TFN}** ({TFN_OBFUSCATED}).\n\n## Direct {AIRLINE} Override & Standby Rules\n1. **Unpublished Flat-Tire Rule:** Call {TFN} within 2 hours of departure for standby placement.\n2. **Protect Return Segments:** Prevent automatic cancellation of return flights by calling {TFN} now.\n3. **Emergency Reservation Desk:** {TFN}`,
  },
};

function resolveSpintax(template: string): string {
  let result = template;
  const pattern = /\{([^{}]+)\}/g;
  let safety = 0;
  while (pattern.test(result) && safety < 15) {
    safety++;
    result = result.replace(pattern, (full, inner: string) => {
      if (!inner.includes('|')) {
        return full;
      }
      const choices = inner.split('|');
      return choices[Math.floor(Math.random() * choices.length)] || '';
    });
  }
  return result;
}

function generateTfnObfuscations(tfn: string): {
  label: string;
  category: 'Whitehat' | 'Greyhat Bypass' | 'Blackhat Anti-Filter';
  value: string;
  description: string;
}[] {
  const digits = (tfn || '+1-888-548-7012').replace(/[^\d]/g, '');
  const core10 =
    digits.length === 11 && digits.startsWith('1')
      ? digits.slice(1)
      : digits.padEnd(10, '0').slice(0, 10);
  const a = core10.slice(0, 3);
  const b = core10.slice(3, 6);
  const c = core10.slice(6, 10);
  const cleanStandard = `+1-${a}-${b}-${c}`;

  const zws = '\u200B';
  const zwnj = '\u200C';
  const mathBoldMap: Record<string, string> = {
    '0': '𝟎',
    '1': '𝟏',
    '2': '𝟐',
    '3': '𝟑',
    '4': '𝟒',
    '5': '𝟓',
    '6': '𝟔',
    '7': '𝟕',
    '8': '𝟖',
    '9': '𝟗',
  };
  const fullwidthMap: Record<string, string> = {
    '0': '０',
    '1': '１',
    '2': '２',
    '3': '３',
    '4': '４',
    '5': '５',
    '6': '６',
    '7': '７',
    '8': '８',
    '9': '９',
  };

  const toMapped = (str: string, map: Record<string, string>) =>
    str
      .split('')
      .map((ch) => map[ch] || ch)
      .join('');

  const htmlHexEncoded = cleanStandard
    .split('')
    .map((ch) => `&#x${ch.charCodeAt(0).toString(16)};`)
    .join('');

  const b64 =
    typeof btoa === 'function'
      ? btoa(`<a href="tel:+1${a}${b}${c}">${cleanStandard}</a>`)
      : '';

  return [
    {
      label: 'Standard E.164 Toll-Free',
      category: 'Whitehat',
      value: cleanStandard,
      description: 'Clean US format for schema markup and standard SERP snippets.',
    },
    {
      label: 'Parenthesized Domestic',
      category: 'Whitehat',
      value: `+1 (${a}) ${b}-${c}`,
      description: 'High CTR human-readable US customer service format.',
    },
    {
      label: 'Double-Hyphen Parasite Format',
      category: 'Greyhat Bypass',
      value: `+1--(${a})-${b}-${c}`,
      description:
        'Bypasses basic single-hyphen phone filters while remaining 100% searchable on Google.',
    },
    {
      label: 'Zero-Width Space (U+200B) Injected',
      category: 'Blackhat Anti-Filter',
      value: `+1-${a[0]}${zws}${a.slice(1)}-${b[0]}${zws}${b.slice(1)}-${c[0]}${zws}${c.slice(1)}`,
      description:
        'Invisible U+200B characters break automated moderation regexes while looking identical to normal text.',
    },
    {
      label: 'Zero-Width Non-Joiner (U+200C) Cloaked',
      category: 'Blackhat Anti-Filter',
      value: `+1${zwnj}-(${a})${zwnj}-${b}${zwnj}-${c}`,
      description:
        'Evades strict Web 2.0 & CMS phone number blacklists while rendering normally in browsers.',
    },
    {
      label: 'HTML Hex Entities (Source-Code Cloaked)',
      category: 'Blackhat Anti-Filter',
      value: htmlHexEncoded,
      description:
        'Renders as normal digits in browsers & Googlebot DOM, but hides raw digits from HTML source regex scanners.',
    },
    {
      label: 'JavaScript Base64 DOM Injector',
      category: 'Blackhat Anti-Filter',
      value: `<script>document.write(atob("${b64}"))</script>`,
      description:
        'Decodes the clickable phone link purely at runtime so static WAF/moderation bots cannot detect the phone number.',
    },
    {
      label: 'Unicode Mathematical Bold',
      category: 'Blackhat Anti-Filter',
      value: `+${toMapped(`1-${a}-${b}-${c}`, mathBoldMap)}`,
      description:
        'Stands out visually in SERP titles/snippets & bypasses ASCII digit filters.',
    },
    {
      label: 'Unicode Fullwidth Digits',
      category: 'Blackhat Anti-Filter',
      value: `＋${toMapped(`１－${a}－${b}－${c}`, fullwidthMap)}`,
      description:
        'Fullwidth UTF-8 characters bypass strict Web 2.0 & forum phone blockers.',
    },
    {
      label: 'Bullet / Dot Delimited',
      category: 'Greyhat Bypass',
      value: `+1 • ${a} • ${b} • ${c}`,
      description:
        'Evades standard hyphen/space regexes while keeping digits intact for Google indexing.',
    },
    {
      label: 'Lightning Callout Format',
      category: 'Greyhat Bypass',
      value: `☎️ +1⚡${a}⚡${b}⚡${c}`,
      description:
        'High-CTR emoji callout format for PDF titles & meta descriptions.',
    },
    {
      label: 'Slash & Bracket OTA Style',
      category: 'Greyhat Bypass',
      value: `(+1) [${a}] / ${b} / ${c}`,
      description:
        'Commonly used in gov/edu open-redirect & parasite PDF headers.',
    },
    {
      label: 'Sticky Floating Call Banner (HTML)',
      category: 'Greyhat Bypass',
      value: `<div style="position:fixed;bottom:0;left:0;right:0;background:#0f172a;color:#fff;padding:12px;text-align:center;z-index:9999;font-weight:bold;">24/7 Instant Airline Rebooking Desk: <a href="tel:+1${a}${b}${c}" style="color:#facc15;text-decoration:underline;">${cleanStandard}</a></div>`,
      description:
        'Drop-in sticky bottom conversion bar for parasite HTML pages.',
    },
    {
      label: 'HTML Click-to-Call Anchor',
      category: 'Whitehat',
      value: `<a href="tel:+1${a}${b}${c}">+1-(${a})-${b}-${c}</a>`,
      description:
        'Ready-to-paste HTML tel: link for parasite HTML pages and blogs.',
    },
    {
      label: 'Markdown Click-to-Call',
      category: 'Whitehat',
      value: `[Call +1-(${a})-${b}-${c}](tel:+1${a}${b}${c})`,
      description:
        'Ready-to-paste Markdown link for GitHub/Notion/Medium/Web 2.0 posts.',
    },
    {
      label: 'BBCode Forum Signature',
      category: 'Greyhat Bypass',
      value: `[url=tel:+1${a}${b}${c}][b]+1-(${a})-${b}-${c}[/b][/url]`,
      description:
        'Ready-to-paste BBCode for automated forum profile & thread blasts.',
    },
  ];
}

export const SeoBulkAutomationPanel: React.FC<SeoBulkAutomationPanelProps> = ({
  defaultTfn,
  airlines,
  initialUrls = [],
  onSendToWhiteboard,
}) => {
  const [subTab, setSubTab] = useState<AutomationSubTab>(() => {
    return (
      (localStorage.getItem('seo_auto_subtab') as AutomationSubTab) ||
      'indexer-checker'
    );
  });
  const [targetTfn, setTargetTfn] = useState<string>(() => {
    return localStorage.getItem('seo_auto_tfn') || defaultTfn || '+1-888-548-7012';
  });
  const [targetKeyword, setTargetKeyword] = useState<string>(() => {
    return localStorage.getItem('seo_auto_keyword') || 'Missed Flight Policy';
  });

  // 1. Indexer & Live URL Checker State
  const [urlsText, setUrlsText] = useState<string>(() => {
    if (initialUrls.length > 0) return initialUrls.join('\n');
    return (
      localStorage.getItem('seo_auto_urls') ||
      'https://prescott-az.gov/delta-airlines-missed-flight-policy.pdf\nhttps://prescott-az.gov/united-airlines-missed-flight-policy.pdf\nhttps://prescott-az.gov/qatar-airlines-missed-flight-policy.pdf'
    );
  });
  const [isCheckingUrls, setIsCheckingUrls] = useState(false);
  const [urlCheckResults, setUrlCheckResults] = useState<UrlCheckResult[]>([]);
  const [isPinging, setIsPinging] = useState(false);
  const [pingLogs, setPingLogs] = useState<
    { engine: string; target: string; status: string }[]
  >([]);

  // 2. Spintax & Multi-Airline Matrix State
  const [spintaxTemplate, setSpintaxTemplate] = useState<string>(() => {
    return (
      localStorage.getItem('seo_auto_spintax') ||
      SPINTAX_PRESETS.whitehat.template
    );
  });
  const [generatedMatrix, setGeneratedMatrix] = useState<
    { airline: string; title: string; content: string }[]
  >([]);
  const [copiedSpintaxIdx, setCopiedSpintaxIdx] = useState<number | null>(null);

  // 3. TFN Obfuscator State
  const [copiedObfIdx, setCopiedObfIdx] = useState<number | null>(null);

  // 4. Backlink & Schema State
  const [copiedSchema, setCopiedSchema] = useState<string | null>(null);

  // 5. Parasite Parameter Weaver State
  const [parasiteBaseList, setParasiteBaseList] = useState<string>(
    'https://prescott-az.gov/search?q=\nhttps://catalog.data.gov/dataset?q=\nhttps://www.bing.com/search?q='
  );
  const [copiedParasiteUrls, setCopiedParasiteUrls] = useState(false);

  // 6. Keyword Permutator & Server Rules State
  const [redirectTargetDomain, setRedirectTargetDomain] = useState(
    'https://your-landing-domain.com/airline-desk'
  );
  const [copiedServerRule, setCopiedServerRule] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('seo_auto_subtab', subTab);
  }, [subTab]);

  useEffect(() => {
    localStorage.setItem('seo_auto_tfn', targetTfn);
  }, [targetTfn]);

  useEffect(() => {
    localStorage.setItem('seo_auto_keyword', targetKeyword);
  }, [targetKeyword]);

  useEffect(() => {
    localStorage.setItem('seo_auto_urls', urlsText);
  }, [urlsText]);

  useEffect(() => {
    localStorage.setItem('seo_auto_spintax', spintaxTemplate);
  }, [spintaxTemplate]);

  useEffect(() => {
    if (initialUrls.length > 0) {
      setUrlsText(initialUrls.join('\n'));
    }
  }, [initialUrls]);

  const parsedUrls = useMemo(() => {
    return urlsText
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);
  }, [urlsText]);

  const tfnObfuscations = useMemo(
    () => generateTfnObfuscations(targetTfn),
    [targetTfn]
  );

  const handleCheckUrlsLive = async () => {
    if (parsedUrls.length === 0) return;
    setIsCheckingUrls(true);
    try {
      const res = await fetch('/api/seo-check-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: parsedUrls,
          tfn: targetTfn,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.results)) {
        setUrlCheckResults(data.results);
      }
    } finally {
      setIsCheckingUrls(false);
    }
  };

  const handleBulkPingIndexers = async () => {
    if (parsedUrls.length === 0) return;
    setIsPinging(true);
    try {
      const res = await fetch('/api/seo-bulk-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: parsedUrls,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setPingLogs(data.logs);
      }
    } finally {
      setIsPinging(false);
    }
  };

  const handleDownloadXmlSitemap = () => {
    const today = new Date().toISOString().slice(0, 10);
    const urlEntries = parsedUrls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.replace(/&/g, '&amp;')}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`
      )
      .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`;
    const blob = new Blob([xml], { type: 'application/xml' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'sitemap.xml';
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const handleDownloadHtmlSitemap = () => {
    const activeList = airlines.length > 0 ? airlines : DEFAULT_AIRLINES;
    const linksHtml = parsedUrls
      .map((u, idx) => {
        const airline = activeList[idx % activeList.length] || 'Airline';
        return `    <li><a href="${u}" target="_blank" rel="dofollow">${airline} Airlines ${targetKeyword} — Call ${targetTfn}</a></li>`;
      })
      .join('\n');
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>${targetKeyword} Official Directory & Hotline ${targetTfn}</title>\n</head>\n<body>\n  <h1>${targetKeyword} Official Directory (${targetTfn})</h1>\n  <ul>\n${linksHtml}\n  </ul>\n</body>\n</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'sitemap-tier2-hub.html';
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const handleDownloadRssFeed = () => {
    const nowRfc = new Date().toUTCString();
    const items = parsedUrls
      .map(
        (u, idx) =>
          `    <item>\n      <title>${targetKeyword} #${idx + 1} (${targetTfn})</title>\n      <link>${u.replace(/&/g, '&amp;')}</link>\n      <description>Official ${targetKeyword} assistance and 24/7 hotline ${targetTfn}</description>\n      <pubDate>${nowRfc}</pubDate>\n    </item>`
      )
      .join('\n');
    const rss = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n  <channel>\n    <title>${targetKeyword} Syndication Feed</title>\n    <link>${parsedUrls[0] || 'https://example.com'}</link>\n    <description>Automated SEO Syndication Feed (${targetTfn})</description>\n${items}\n  </channel>\n</rss>`;
    const blob = new Blob([rss], { type: 'application/rss+xml' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'rss-feed.xml';
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const handleDownloadCurlPingScript = () => {
    const lines = [
      '#!/usr/bin/env bash',
      '# Automated Bulk IndexNow & Archive Crawler Ping Script',
      ...parsedUrls.map(
        (u) =>
          `curl -s "https://api.indexnow.org/indexnow?url=${encodeURIComponent(
            u
          )}&key=8081368879seostudiokey" > /dev/null && echo "Pinged IndexNow: ${u}"`
      ),
      ...parsedUrls.map(
        (u) =>
          `curl -s "https://web.archive.org/save/${u}" > /dev/null && echo "Submitted to Wayback Archive: ${u}"`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'bulk-seo-indexer-ping.sh';
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const handleGenerateSpintaxMatrix = () => {
    const activeList = airlines.length > 0 ? airlines : DEFAULT_AIRLINES;
    const obf =
      tfnObfuscations.find((o) => o.label.includes('Double-Hyphen'))?.value ||
      targetTfn;
    const built = activeList.map((airline) => {
      const spun = resolveSpintax(spintaxTemplate)
        .replace(/\{AIRLINE\}/gi, airline)
        .replace(/\{TFN\}/gi, targetTfn)
        .replace(/\{TFN_OBFUSCATED\}/gi, obf)
        .replace(/\{KEYWORD\}/gi, targetKeyword)
        .replace(/\{YEAR\}/gi, '2026');
      const firstLine =
        spun
          .split(/\r?\n/)[0]
          ?.replace(/^#+\s*/, '')
          .trim() || `${airline} ${targetKeyword}`;
      return {
        airline,
        title: firstLine,
        content: spun,
      };
    });
    setGeneratedMatrix(built);
  };

  const handleDownloadMatrixZip = async (format: 'html' | 'md' | 'txt') => {
    if (generatedMatrix.length === 0) return;
    const zip = new JSZip();
    for (const item of generatedMatrix) {
      const slug = item.airline.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (format === 'html') {
        const htmlBody = item.content
          .split(/\r?\n/)
          .map((line) => {
            if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
            if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
            if (!line.trim()) return '';
            return `<p>${line}</p>`;
          })
          .join('\n');
        const fullHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>${item.title} | ${targetTfn}</title>\n  <meta name="description" content="${item.title} - Call ${targetTfn} for 24/7 assistance." />\n</head>\n<body>\n${htmlBody}\n</body>\n</html>`;
        zip.file(`${slug}-${format}.html`, fullHtml);
      } else {
        zip.file(`${slug}.${format}`, item.content);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `seo-parasite-matrix-${format}.zip`;
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const handleDownloadMatrixCsv = () => {
    if (generatedMatrix.length === 0) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rowsCsv = [
      ['Airline', 'Post Title', 'Slug', 'TFN', 'Post Content'].join(','),
      ...generatedMatrix.map((item) => {
        const slug = `${item.airline
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}-${targetKeyword
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`;
        return [
          esc(item.airline),
          esc(item.title),
          esc(slug),
          esc(targetTfn),
          esc(item.content),
        ].join(',');
      }),
    ].join('\n');
    const blob = new Blob([rowsCsv], { type: 'text/csv;charset=utf-8;' });
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = 'seo-mass-page-import.csv';
    a.click();
    URL.revokeObjectURL(objUrl);
  };

  const backlinkOutputs = useMemo(() => {
    const baseUrls =
      parsedUrls.length > 0
        ? parsedUrls
        : ['https://example.com/missed-flight-policy.pdf'];
    const htmlLinks: string[] = [];
    const bbcodeLinks: string[] = [];
    const markdownLinks: string[] = [];
    const wikiLinks: string[] = [];

    baseUrls.forEach((u, idx) => {
      const airline =
        (airlines.length > 0 ? airlines : DEFAULT_AIRLINES)[
          idx % (airlines.length || DEFAULT_AIRLINES.length)
        ] || 'Delta';
      const anchor = `${airline} Airlines ${targetKeyword} (${targetTfn})`;
      htmlLinks.push(
        `<a href="${u}" target="_blank" rel="dofollow">${anchor}</a>`
      );
      bbcodeLinks.push(`[url=${u}]${anchor}[/url]`);
      markdownLinks.push(`[${anchor}](${u})`);
      wikiLinks.push(`[${u} ${anchor}]`);
    });

    const jsonLdSchema = JSON.stringify(
      {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            name: `${targetKeyword} 24/7 Reservations Desk`,
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: targetTfn,
              contactType: 'customer service',
              areaServed: ['US', 'CA', 'GB', 'AU'],
              availableLanguage: ['English', 'Spanish'],
            },
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `What is the official phone number for ${targetKeyword}?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Passengers needing immediate assistance with ${targetKeyword} can call the 24/7 reservation & rebooking desk at ${targetTfn} for same-day standby and ticket protection.`,
                },
              },
              {
                '@type': 'Question',
                name: `How do I rebook a missed flight without paying a penalty?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Contact the airline missed flight desk at ${targetTfn} within 2 hours of departure to request re-accommodation under the Flat Tire / Same-Day Standby rule.`,
                },
              },
            ],
          },
        ],
      },
      null,
      2
    );

    return {
      html: htmlLinks.join('\n'),
      bbcode: bbcodeLinks.join('\n'),
      markdown: markdownLinks.join('\n'),
      wiki: wikiLinks.join('\n'),
      jsonLd: `<script type="application/ld+json">\n${jsonLdSchema}\n</script>`,
    };
  }, [parsedUrls, airlines, targetKeyword, targetTfn]);

  // Engine 5: Parasite Parameter URL Weaver
  const wovenParasiteUrls = useMemo(() => {
    const bases = parasiteBaseList
      .split(/\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const activeList = airlines.length > 0 ? airlines : DEFAULT_AIRLINES;
    const output: string[] = [];

    for (const base of bases) {
      for (const airline of activeList) {
        const payload = `${airline} Airlines ${targetKeyword} Call ${targetTfn}`;
        output.push(`${base}${encodeURIComponent(payload)}`);
      }
    }
    return output;
  }, [parasiteBaseList, airlines, targetKeyword, targetTfn]);

  // Engine 6: Bulk Keyword Permutator + CTR Meta + Server Rules
  const keywordAndServerOutputs = useMemo(() => {
    const activeList = airlines.length > 0 ? airlines : DEFAULT_AIRLINES;
    const modifiers = [
      'missed flight policy',
      'no show policy phone number',
      'same day standby rebooking',
      'flat tire rule customer service',
      'missed connection helpdesk',
    ];
    const keywords: string[] = [];
    const metaPacks: string[] = [];

    activeList.slice(0, 15).forEach((airline) => {
      modifiers.forEach((mod) => {
        keywords.push(`${airline} Airlines ${mod} ${targetTfn}`);
      });
      metaPacks.push(
        `<!-- ${airline} Airlines CTR Meta Pack -->\n<title>☎️ ${targetTfn} | ${airline} Airlines ${targetKeyword} (24/7 Rebooking Desk)</title>\n<meta name="description" content="Missed your ${airline} flight? Call ${targetTfn} immediately for 24/7 same-day standby, flat-tire rule waivers, and instant ticket protection." />`
      );
    });

    const htaccessRules = `# Apache .htaccess 301 Redirect & Bot Cloak / Header Rules\nRewriteEngine On\nHeader set X-Robots-Tag "index, follow, max-snippet:-1, max-image-preview:large"\n\n# Redirect legacy PDF slugs to primary conversion lander\nRewriteRule ^([a-z0-9-]+)-missed-flight\\.pdf$ ${redirectTargetDomain}/$1?tfn=${encodeURIComponent(
      targetTfn
    )} [R=301,L]`;

    const nginxRules = `# Nginx High-Speed SEO PDF & Redirect Rules\nlocation ~* ^/([a-z0-9-]+)-missed-flight\\.pdf$ {\n    add_header X-Robots-Tag "index, follow" always;\n    return 301 ${redirectTargetDomain}/$1?tfn=${encodeURIComponent(
      targetTfn
    )};\n}`;

    return {
      keywords: keywords.join('\n'),
      metaPacks: metaPacks.join('\n\n'),
      htaccessRules,
      nginxRules,
    };
  }, [airlines, targetKeyword, targetTfn, redirectTargetDomain]);

  return (
    <div className="flex flex-col gap-5">
      {/* Shared Target TFN & Keyword Bar + 6-Engine Sub-Navigation (Clean Light UI) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wide text-blue-600">
                Enterprise Whitehat + Blackhat SEO Automation
              </span>
              <span className="text-slate-300">·</span>
              <h2 className="text-base font-bold text-slate-900">
                6-Engine Bulk SEO Operations Center
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Automate bulk IndexNow &amp; crawler pings, live Googlebot HTTP/Canonical/TFN auditing, multi-airline Spintax mass page generation, anti-filter TFN cloaking, Parasite URL weaving, and server redirect rules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={targetTfn}
              onChange={(e) => setTargetTfn(e.target.value)}
              placeholder="Target TFN (+1-888-548-7012)"
              className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="Target Keyword"
              className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 6 Automation Engine Sub-Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('indexer-checker')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'indexer-checker'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">1. Indexer &amp; Auditor</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              IndexNow + HTTP/TFN Check
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('spintax-matrix')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'spintax-matrix'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">2. Spintax Mass Pages</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              26+ Airlines HTML/CSV/ZIP
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('tfn-obfuscator')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'tfn-obfuscator'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">3. TFN Anti-Filter</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              16+ Cloaked Phone Encodings
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('backlink-schema')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'backlink-schema'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Code2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">4. Backlinks &amp; Schema</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              HTML/BBCode/Wiki + JSON-LD
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('parasite-weaver')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'parasite-weaver'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">5. Parasite URL Weaver</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              Gov/Edu Query Parameter Gen
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('keyword-server-rules')}
            className={`p-2.5 rounded-lg text-left transition-colors cursor-pointer border ${
              subTab === 'keyword-server-rules'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">6. CTR Meta &amp; 301 Rules</span>
            </div>
            <p className="text-[10px] opacity-80 mt-0.5 truncate">
              Keywords + .htaccess / Nginx
            </p>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: BULK INDEXER & LIVE URL AUDITOR */}
      {subTab === 'indexer-checker' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Target Parasite / PDF / Backlink URLs ({parsedUrls.length} URLs)
                </h3>
                <p className="text-xs text-slate-500">
                  Audit live HTTP status, redirects, canonicals, word count &amp; TFN presence, or blast to IndexNow &amp; Archive crawlers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isCheckingUrls}
                  onClick={handleCheckUrlsLive}
                  className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isCheckingUrls ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isCheckingUrls
                      ? 'Auditing URLs...'
                      : 'Audit HTTP, Canonical, Noindex & TFN'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isPinging}
                  onClick={handleBulkPingIndexers}
                  className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {isPinging
                      ? 'Blasting IndexNow...'
                      : 'Blast IndexNow & Archive Pings'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadXmlSitemap}
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>sitemap.xml</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadHtmlSitemap}
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tier-2 Hub (.html)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadRssFeed}
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>rss-feed.xml</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCurlPingScript}
                  className="h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>cURL Ping Script (.sh)</span>
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder="https://example.com/delta-airlines-missed-flight.pdf"
              className="w-full p-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Live URL Audit Results */}
          {urlCheckResults.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">
                  Live Googlebot HTTP Status, Redirect, Canonical &amp; TFN Audit ({urlCheckResults.length} Checked)
                </h4>
              </div>
              <div className="fast-scroll-container max-h-80 divide-y divide-slate-100">
                {urlCheckResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                            item.ok
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          HTTP {item.status || 'ERR'}
                        </span>
                        {item.redirected && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold text-[11px]">
                            301/302 Redirected
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            item.indexable
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {item.robotsInfo}
                        </span>
                        {item.hasTfn ? (
                          <span className="px-2 py-0.5 rounded bg-yellow-300 text-slate-950 font-bold text-[11px]">
                            TFN LIVE ({item.tfnMatchCount || 1}x)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                            TFN: 0
                          </span>
                        )}
                        <span className="text-slate-400 font-mono text-[11px]">
                          {item.responseTimeMs}ms · {item.contentType} ·{' '}
                          {item.wordCount || 0} words
                        </span>
                      </div>
                      <div className="font-mono text-slate-800 truncate">
                        {item.url}
                      </div>
                      <div className="text-slate-500 truncate">
                        Title: {item.title}
                        {item.h1 ? ` · H1: ${item.h1}` : ''}
                        {item.canonicalUrl ? ` · Canonical: ${item.canonicalUrl}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ping Logs */}
          {pingLogs.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl p-4 font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
              <div className="text-emerald-700 font-bold mb-2">
                IndexNow &amp; Crawler Discovery Ping Dispatch Log:
              </div>
              {pingLogs.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    [{l.engine}] {l.target}
                  </span>
                  <span className="text-emerald-700 font-semibold shrink-0">{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BULK SPINTAX & MULTI-AIRLINE PARASITE MATRIX */}
      {subTab === 'spintax-matrix' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Multi-Airline Spintax &amp; Mass Page Builder
                </h3>
                <p className="text-xs text-slate-500">
                  Load a Whitehat/Greyhat/Blackhat preset or customize{' '}
                  <code>{'{option1|option2}'}</code> spintax with{' '}
                  <code>{'{AIRLINE}'}</code>, <code>{'{TFN}'}</code>,{' '}
                  <code>{'{TFN_OBFUSCATED}'}</code>, <code>{'{KEYWORD}'}</code>,{' '}
                  <code>{'{YEAR}'}</code>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(SPINTAX_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSpintaxTemplate(preset.template)}
                    className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-md cursor-pointer"
                  >
                    {preset.label.split(':')[0]} Preset
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleGenerateSpintaxMatrix}
                  className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    Spin All {airlines.length || DEFAULT_AIRLINES.length} Airlines
                  </span>
                </button>
              </div>
            </div>

            <textarea
              rows={7}
              value={spintaxTemplate}
              onChange={(e) => setSpintaxTemplate(e.target.value)}
              className="w-full p-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {generatedMatrix.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDownloadMatrixZip('html')}
                  className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export HTML ZIP ({generatedMatrix.length} files)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadMatrixZip('md')}
                  className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Markdown ZIP</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMatrixCsv}
                  className="h-9 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Mass-Page CSV (WordPress / Webflow)</span>
                </button>
              </div>
            )}
          </div>

          {generatedMatrix.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedMatrix.map((item, idx) => (
                <div
                  key={item.airline}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-blue-700 uppercase">
                        {item.airline} Airlines
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onSendToWhiteboard && (
                          <button
                            type="button"
                            onClick={() => onSendToWhiteboard(item.content)}
                            className="px-2 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send to PDF Whiteboard</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(item.content);
                            setCopiedSpintaxIdx(idx);
                            setTimeout(() => setCopiedSpintaxIdx(null), 1500);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedSpintaxIdx === idx ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="mt-2.5 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {item.content}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: TFN ANTI-FILTER OBFUSCATOR */}
      {subTab === 'tfn-obfuscator' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              16-Format Anti-Filter TFN Obfuscation Matrix for {targetTfn}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bypass automated phone-number filters on high-authority Parasite SEO hosts, Web 2.0s, forums, and document repositories while keeping your TFN visible to users and search engines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tfnObfuscations.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {item.label}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.category === 'Whitehat'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.category === 'Greyhat Bypass'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-purple-100 text-purple-900'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono font-bold text-blue-700 truncate">
                    {item.value}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(item.value);
                      setCopiedObfIdx(idx);
                      setTimeout(() => setCopiedObfIdx(null), 1500);
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedObfIdx === idx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BULK BACKLINK ANCHOR MATRIX & JSON-LD SCHEMA */}
      {subTab === 'backlink-schema' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              {
                id: 'html',
                title: 'HTML Dofollow Anchor Links',
                code: backlinkOutputs.html,
              },
              {
                id: 'bbcode',
                title: 'BBCode Forum Profile & Signature Links',
                code: backlinkOutputs.bbcode,
              },
              {
                id: 'markdown',
                title: 'Markdown Web 2.0 / GitHub / Notion Links',
                code: backlinkOutputs.markdown,
              },
              {
                id: 'wiki',
                title: 'MediaWiki / DokuWiki Backlink Syntax',
                code: backlinkOutputs.wiki,
              },
              {
                id: 'jsonld',
                title: 'JSON-LD Organization + FAQPage Rich Snippet Schema',
                code: backlinkOutputs.jsonLd,
              },
            ] as const
          ).map((block) => (
            <div
              key={block.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    {block.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(block.code);
                    setCopiedSchema(block.id);
                    setTimeout(() => setCopiedSchema(null), 1500);
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedSchema === block.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                readOnly
                rows={7}
                value={block.code}
                className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 5: PARASITE SEARCH / REDIRECT PARAMETER URL WEAVER */}
      {subTab === 'parasite-weaver' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Gov / Edu / High-DR Search &amp; Parameter URL Weaver ({wovenParasiteUrls.length} Generated URLs)
              </h3>
              <p className="text-xs text-slate-500">
                Automatically injects <code>[Airline] + {targetKeyword} + {targetTfn}</code> into open search/query endpoints across all {airlines.length || DEFAULT_AIRLINES.length} airlines.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUrlsText(wovenParasiteUrls.join('\n'));
                  setSubTab('indexer-checker');
                }}
                className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Send All {wovenParasiteUrls.length} URLs to Bulk Indexer</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(wovenParasiteUrls.join('\n'));
                  setCopiedParasiteUrls(true);
                  setTimeout(() => setCopiedParasiteUrls(false), 1800);
                }}
                className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedParasiteUrls ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied {wovenParasiteUrls.length} URLs!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All URLs</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Base Query / Redirect Footprints (1 per line)
              </label>
              <textarea
                rows={10}
                value={parasiteBaseList}
                onChange={(e) => setParasiteBaseList(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="md:col-span-7">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Generated Parameter-Injected Parasite URLs ({wovenParasiteUrls.length})
              </label>
              <textarea
                readOnly
                rows={10}
                value={wovenParasiteUrls.join('\n')}
                className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: BULK KEYWORD PERMUTATOR, CTR META & SERVER 301 RULES */}
      {subTab === 'keyword-server-rules' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-bold text-slate-900">
                Target 301 Redirect Landing Domain:
              </span>
              <span className="text-slate-500 ml-2">
                Used to generate Apache <code>.htaccess</code> and Nginx 301 redirect rules for PDF slugs.
              </span>
            </div>
            <input
              type="text"
              value={redirectTargetDomain}
              onChange={(e) => setRedirectTargetDomain(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 w-80 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                {
                  id: 'keywords',
                  title: 'Bulk Airline × Intent Long-Tail Keywords (with TFN)',
                  code: keywordAndServerOutputs.keywords,
                },
                {
                  id: 'metapacks',
                  title: 'High-CTR HTML <title> & <meta description> Packs',
                  code: keywordAndServerOutputs.metaPacks,
                },
                {
                  id: 'htaccess',
                  title: 'Apache .htaccess 301 Redirect & X-Robots-Tag Rules',
                  code: keywordAndServerOutputs.htaccessRules,
                },
                {
                  id: 'nginx',
                  title: 'Nginx Location 301 Redirect & Indexing Header Rules',
                  code: keywordAndServerOutputs.nginxRules,
                },
              ] as const
            ).map((block) => (
              <div
                key={block.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    {block.title}
                  </h4>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(block.code);
                      setCopiedServerRule(block.id);
                      setTimeout(() => setCopiedServerRule(null), 1500);
                    }}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedServerRule === block.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={7}
                  value={block.code}
                  className="w-full p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
