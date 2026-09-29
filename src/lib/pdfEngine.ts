import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  replaceTfnInString,
  replaceAirlineInString,
  WhiteboardParagraphStyle,
} from './seoHelpers';

interface PdfTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: [number, number, number];
  fontSizePt: number;
  linkUrl?: string;
}

interface PdfParagraphBlock {
  type: 'paragraph';
  align: 'left' | 'center' | 'right' | 'justify';
  isHeading: number; // 0 = normal, 1 = H1, 2 = H2, 3 = H3
  isList: boolean;
  bgColor?: [number, number, number];
  runs: PdfTextRun[];
  embeddedImages: { dataUrl: string; format: 'PNG' | 'JPEG'; widthPt: number; heightPt: number }[];
}

interface PdfTableCell {
  text: string;
  bold: boolean;
  bgColor?: [number, number, number];
  textColor: [number, number, number];
}

interface PdfTableBlock {
  type: 'table';
  rows: PdfTableCell[][];
}

type PdfDocBlock = PdfParagraphBlock | PdfTableBlock;

function unescapeXml(escaped: string): string {
  return escaped
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Normalizes typography characters that standard PDF Latin-1 fonts don't support natively
 * so they never render as garbled symbols in vector PDFs.
 */
function sanitizeForPdfFont(input: string): string {
  if (!input) return '';
  return input
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '* ')
    // Strip surrogate-pair emojis that built-in PDF Type1 fonts cannot encode
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // Keep printable Latin-1 and common punctuation
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function parseHexColor(hex?: string | null): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, '');
  if (clean.toLowerCase() === 'auto' || clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function mapFontFamily(fontFamily?: string): 'helvetica' | 'times' | 'courier' {
  const f = (fontFamily || '').toLowerCase();
  if (f.includes('times') || f.includes('georgia') || f.includes('serif')) {
    return 'times';
  }
  if (f.includes('courier') || f.includes('mono') || f.includes('consolas')) {
    return 'courier';
  }
  return 'helvetica';
}

function parseRunXml(
  runXml: string,
  defaultSizePt: number,
  defaultBold: boolean,
  defaultColor: [number, number, number],
  linkUrl?: string
): PdfTextRun | null {
  const rPrMatch = runXml.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/);
  const rPr = rPrMatch ? rPrMatch[1] : '';

  const isBold =
    defaultBold ||
    /<w:b(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(rPr) ||
    /<w:b>/.test(rPr);
  const isItalic =
    /<w:i(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(rPr) ||
    /<w:i>/.test(rPr);
  const isUnderline =
    Boolean(linkUrl) ||
    /<w:u\b(?![^>]*w:val="none")[^>]*\/>/.test(rPr);

  const colorMatch = rPr.match(/<w:color\b[^>]*w:val="([^"]+)"/);
  const parsedColor = parseHexColor(colorMatch?.[1]);
  const color: [number, number, number] =
    parsedColor || (linkUrl ? [17, 85, 204] : defaultColor);

  const szMatch = rPr.match(/<w:sz\b[^>]*w:val="(\d+)"/);
  const fontSizePt = szMatch
    ? Math.max(8, Math.min(36, Math.round( parseInt(szMatch[1], 10) / 2 )))
    : defaultSizePt;

  // Extract text and line breaks inside the run
  const pieces: string[] = [];
  const tokenRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\b[^>]*\/>|<w:tab\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(runXml)) !== null) {
    if (m[0].startsWith('<w:br')) {
      pieces.push('\n');
    } else if (m[0].startsWith('<w:tab')) {
      pieces.push('    ');
    } else if (m[1] !== undefined) {
      pieces.push(unescapeXml(m[1]));
    }
  }

  const rawText = pieces.join('');
  if (!rawText) return null;

  return {
    text: rawText,
    bold: isBold,
    italic: isItalic,
    underline: isUnderline,
    color,
    fontSizePt,
    linkUrl,
  };
}

/**
 * Parses a DOCX archive into structured blocks (paragraphs, headings, runs, tables, images)
 */
async function parseDocxIntoBlocks(docxBytes: Uint8Array): Promise<PdfDocBlock[]> {
  const zip = await JSZip.loadAsync(docxBytes);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    return [];
  }
  const xml = await docFile.async('string');

  // Parse relationships for hyperlinks and images
  const relsMap = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
    let rm: RegExpExecArray | null;
    while ((rm = relRegex.exec(relsXml)) !== null) {
      relsMap.set(rm[1], unescapeXml(rm[2]));
    }
  }

  const blocks: PdfDocBlock[] = [];

  // Match top-level tables and paragraphs in document order
  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch ? bodyMatch[1] : xml;

  const blockRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\s*\/>/g;
  let bm: RegExpExecArray | null;

  while ((bm = blockRegex.exec(bodyXml)) !== null) {
    const chunk = bm[0];

    if (chunk.startsWith('<w:tbl')) {
      // Parse table
      const rows: PdfTableCell[][] = [];
      const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
      let rm: RegExpExecArray | null;
      while ((rm = rowRegex.exec(chunk)) !== null) {
        const rowXml = rm[1];
        const cells: PdfTableCell[] = [];
        const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
        let cm: RegExpExecArray | null;
        while ((cm = cellRegex.exec(rowXml)) !== null) {
          const cellXml = cm[1];
          const shdMatch = cellXml.match(/<w:shd\b[^>]*w:fill="([^"]+)"/);
          const bgColor = parseHexColor(shdMatch?.[1]) || undefined;
          const isBold = /<w:b(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(cellXml);
          const colorMatch = cellXml.match(/<w:color\b[^>]*w:val="([^"]+)"/);
          const textColor = parseHexColor(colorMatch?.[1]) || [15, 23, 42];

          const cellParas: string[] = [];
          const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
          let pm: RegExpExecArray | null;
          while ((pm = pRegex.exec(cellXml)) !== null) {
            const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
            const pTexts: string[] = [];
            let tm: RegExpExecArray | null;
            while ((tm = tRegex.exec(pm[1])) !== null) {
              pTexts.push(unescapeXml(tm[1]));
            }
            if (pTexts.length > 0) {
              cellParas.push(pTexts.join(''));
            }
          }

          cells.push({
            text: cellParas.join('\n'),
            bold: isBold,
            bgColor,
            textColor,
          });
        }
        if (cells.length > 0) {
          rows.push(cells);
        }
      }
      if (rows.length > 0) {
        blocks.push({ type: 'table', rows });
      }
      continue;
    }

    // Parse paragraph
    const pPrMatch = chunk.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[1] : '';

    let isHeading = 0;
    const styleMatch = pPr.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/i);
    if (styleMatch) {
      const st = styleMatch[1].toLowerCase();
      if (st.includes('title') || st.includes('heading1') || st === 'h1') isHeading = 1;
      else if (st.includes('heading2') || st === 'h2' || st.includes('subtitle')) isHeading = 2;
      else if (st.includes('heading3') || st.includes('heading4') || st === 'h3') isHeading = 3;
    }

    let align: 'left' | 'center' | 'right' | 'justify' = 'left';
    const jcMatch = pPr.match(/<w:jc\b[^>]*w:val="([^"]+)"/i);
    if (jcMatch) {
      const jc = jcMatch[1].toLowerCase();
      if (jc === 'center') align = 'center';
      else if (jc === 'right' || jc === 'end') align = 'right';
      else if (jc === 'both' || jc === 'distribute') align = 'justify';
    }

    const isList = /<w:numPr\b/.test(pPr);
    const shdMatch = pPr.match(/<w:shd\b[^>]*w:fill="([^"]+)"/);
    const bgColor = parseHexColor(shdMatch?.[1]) || undefined;

    const defaultSizePt =
      isHeading === 1 ? 18 : isHeading === 2 ? 14 : isHeading === 3 ? 12.5 : 11;
    const defaultBold = isHeading > 0;
    const defaultColor: [number, number, number] = [15, 23, 42];

    const runs: PdfTextRun[] = [];
    const embeddedImages: {
      dataUrl: string;
      format: 'PNG' | 'JPEG';
      widthPt: number;
      heightPt: number;
    }[] = [];

    // Check for embedded images (<a:blip r:embed="rId..."/>)
    const blipRegex = /<a:blip\b[^>]*r:embed="([^"]+)"[^>]*\/?>/g;
    let blm: RegExpExecArray | null;
    while ((blm = blipRegex.exec(chunk)) !== null) {
      const rId = blm[1];
      const target = relsMap.get(rId);
      if (target) {
        const normalizedPath = target.startsWith('word/')
          ? target
          : `word/${target.replace(/^\.\.\//, '')}`;
        const imgFile = zip.file(normalizedPath);
        if (imgFile) {
          try {
            const imgB64 = await imgFile.async('base64');
            const lower = normalizedPath.toLowerCase();
            const isPng = lower.endsWith('.png');
            const isJpg = lower.endsWith('.jpg') || lower.endsWith('.jpeg');
            if (isPng || isJpg) {
              // Check extent cx / cy in EMUs (1 pt = 12700 EMUs)
              const extMatch = chunk.match(/<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
              let widthPt = extMatch ? Math.round(parseInt(extMatch[1], 10) / 12700) : 320;
              let heightPt = extMatch ? Math.round(parseInt(extMatch[2], 10) / 12700) : 180;
              if (widthPt > 480) {
                const ratio = 480 / widthPt;
                widthPt = 480;
                heightPt = Math.round(heightPt * ratio);
              }
              embeddedImages.push({
                dataUrl: `data:image/${isPng ? 'png' : 'jpeg'};base64,${imgB64}`,
                format: isPng ? 'PNG' : 'JPEG',
                widthPt: Math.max(40, widthPt),
                heightPt: Math.max(30, heightPt),
              });
            }
          } catch {
            // ignore unsupported image format
          }
        }
      }
    }

    // Parse hyperlinks and runs inside the paragraph
    const inlineRegex = /<w:hyperlink\b[^>]*>[\s\S]*?<\/w:hyperlink>|<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
    let im: RegExpExecArray | null;
    while ((im = inlineRegex.exec(chunk)) !== null) {
      const inlineChunk = im[0];
      if (inlineChunk.startsWith('<w:hyperlink')) {
        const rIdMatch = inlineChunk.match(/r:id="([^"]+)"/);
        const linkUrl = rIdMatch ? relsMap.get(rIdMatch[1]) : undefined;
        const innerRunRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
        let irm: RegExpExecArray | null;
        while ((irm = innerRunRegex.exec(inlineChunk)) !== null) {
          const parsed = parseRunXml(
            irm[0],
            defaultSizePt,
            defaultBold,
            defaultColor,
            linkUrl
          );
          if (parsed) runs.push(parsed);
        }
      } else {
        const parsed = parseRunXml(
          inlineChunk,
          defaultSizePt,
          defaultBold,
          defaultColor
        );
        if (parsed) runs.push(parsed);
      }
    }

    blocks.push({
      type: 'paragraph',
      align,
      isHeading,
      isList,
      bgColor,
      runs,
      embeddedImages,
    });
  }

  return blocks;
}

/**
 * Renders structured document blocks into a real, text-searchable, SEO-indexable PDF (Uint8Array)
 */
function renderBlocksToPdfBytes(
  blocks: PdfDocBlock[],
  fontFamilyName = 'Calibri'
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  });

  const pdfFont = mapFontFamily(fontFamilyName);
  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt
  const marginX = 50;
  const marginTop = 52;
  const marginBottom = 52;
  const usableWidth = pageWidth - marginX * 2;

  let cursorY = marginTop;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      cursorY = marginTop;
    }
  };

  for (const block of blocks) {
    if (block.type === 'table') {
      const numCols = Math.max(1, ...block.rows.map((r) => r.length));
      const colWidth = usableWidth / numCols;
      const cellPadding = 6;
      const tableFontSize = 10;

      doc.setFontSize(tableFontSize);

      for (let rIdx = 0; rIdx < block.rows.length; rIdx++) {
        const row = block.rows[rIdx];
        let maxLines = 1;
        const wrappedCells: string[][] = [];

        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cell = row[cIdx];
          const cleanText = sanitizeForPdfFont(cell?.text || '');
          const lines: string[] = doc.splitTextToSize(
            cleanText || ' ',
            colWidth - cellPadding * 2
          );
          wrappedCells.push(lines);
          if (lines.length > maxLines) {
            maxLines = lines.length;
          }
        }

        const lineHeight = tableFontSize * 1.35;
        const rowHeight = maxLines * lineHeight + cellPadding * 2;
        ensureSpace(rowHeight + 4);

        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cell = row[cIdx];
          const cellX = marginX + cIdx * colWidth;
          const bg = cell?.bgColor || (rIdx === 0 ? [241, 245, 249] : undefined);

          if (bg) {
            doc.setFillColor(bg[0], bg[1], bg[2]);
            doc.rect(cellX, cursorY, colWidth, rowHeight, 'F');
          }

          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.75);
          doc.rect(cellX, cursorY, colWidth, rowHeight, 'S');

          const isBold = cell?.bold || rIdx === 0;
          doc.setFont(pdfFont, isBold ? 'bold' : 'normal');
          const tc = cell?.textColor || [15, 23, 42];
          doc.setTextColor(tc[0], tc[1], tc[2]);

          const lines = wrappedCells[cIdx];
          for (let lIdx = 0; lIdx < lines.length; lIdx++) {
            doc.text(
              lines[lIdx],
              cellX + cellPadding,
              cursorY + cellPadding + tableFontSize + lIdx * lineHeight
            );
          }
        }

        cursorY += rowHeight;
      }

      cursorY += 10;
      continue;
    }

    // Paragraph block
    for (const img of block.embeddedImages) {
      ensureSpace(img.heightPt + 12);
      const imgX =
        block.align === 'center'
          ? marginX + (usableWidth - img.widthPt) / 2
          : marginX;
      try {
        doc.addImage(
          img.dataUrl,
          img.format,
          imgX,
          cursorY,
          img.widthPt,
          img.heightPt
        );
        cursorY += img.heightPt + 10;
      } catch {
        // skip broken image
      }
    }

    if (block.runs.length === 0) {
      cursorY += 8;
      continue;
    }

    // Determine dominant paragraph style from runs
    const rawCombined = block.runs.map((r) => r.text).join('');
    let combinedText = sanitizeForPdfFont(rawCombined);
    if (!combinedText.trim()) {
      cursorY += 8;
      continue;
    }

    if (block.isList) {
      combinedText = `•  ${combinedText}`;
    }

    // Support markdown-style headings inside paragraphs (# , ## , ### )
    let headingLevel = block.isHeading;
    if (combinedText.startsWith('### ')) {
      headingLevel = 3;
      combinedText = combinedText.slice(4);
    } else if (combinedText.startsWith('## ')) {
      headingLevel = 2;
      combinedText = combinedText.slice(3);
    } else if (combinedText.startsWith('# ')) {
      headingLevel = 1;
      combinedText = combinedText.slice(2);
    }

    const maxRunFontSize = Math.max(
      ...block.runs.map((r) => r.fontSizePt),
      11
    );
    const fontSizePt =
      headingLevel === 1
        ? Math.max(18, maxRunFontSize)
        : headingLevel === 2
        ? Math.max(14, maxRunFontSize)
        : headingLevel === 3
        ? Math.max(12.5, maxRunFontSize)
        : maxRunFontSize;

    const anyBold = headingLevel > 0 || block.runs.some((r) => r.bold);
    const anyItalic = block.runs.some((r) => r.italic);
    const anyUnderline = block.runs.some((r) => r.underline);
    const primaryColor =
      block.runs.find((r) => r.color[0] !== 15 || r.color[1] !== 23 || r.color[2] !== 42)
        ?.color || block.runs[0].color;
    const linkUrl = block.runs.find((r) => r.linkUrl)?.linkUrl;

    const fontStyle =
      anyBold && anyItalic
        ? 'bolditalic'
        : anyBold
        ? 'bold'
        : anyItalic
        ? 'italic'
        : 'normal';

    doc.setFont(pdfFont, fontStyle);
    doc.setFontSize(fontSizePt);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    if (headingLevel > 0) {
      cursorY += headingLevel === 1 ? 6 : 4;
    }

    const indentX = block.isList ? 14 : 0;
    const lineMaxWidth = usableWidth - indentX;
    const wrappedLines: string[] = doc.splitTextToSize(combinedText, lineMaxWidth);
    const lineHeight = fontSizePt * 1.42;

    if (block.bgColor) {
      const boxHeight = wrappedLines.length * lineHeight + 8;
      ensureSpace(boxHeight);
      doc.setFillColor(block.bgColor[0], block.bgColor[1], block.bgColor[2]);
      doc.rect(marginX, cursorY - 2, usableWidth, boxHeight, 'F');
    }

    for (const line of wrappedLines) {
      ensureSpace(lineHeight + 2);
      let drawX = marginX + indentX;
      const textWidth = doc.getTextWidth(line);

      if (block.align === 'center') {
        drawX = marginX + (usableWidth - textWidth) / 2;
      } else if (block.align === 'right') {
        drawX = marginX + usableWidth - textWidth;
      }

      doc.text(line, drawX, cursorY + fontSizePt);

      if (anyUnderline) {
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.6);
        doc.line(
          drawX,
          cursorY + fontSizePt + 2,
          drawX + textWidth,
          cursorY + fontSizePt + 2
        );
      }

      // Add clickable PDF link annotation if linkUrl or phone number is present
      if (linkUrl) {
        doc.link(drawX, cursorY, textWidth, lineHeight, { url: linkUrl });
      } else {
        const urlMatch = line.match(/https?:\/\/[^\s)]+/);
        if (urlMatch) {
          doc.link(drawX, cursorY, textWidth, lineHeight, { url: urlMatch[0] });
        } else {
          const phoneMatch = line.match(
            /[+]?[\d]{1,3}[-\s.]?\(?[\d]{2,4}\)?[-\s.]?[\d]{2,4}[-\s.]?[\d]{2,4}/
          );
          if (phoneMatch) {
            const cleanTel = phoneMatch[0].replace(/[^\d+]/g, '');
            if (cleanTel.length >= 7) {
              doc.link(drawX, cursorY, textWidth, lineHeight, {
                url: `tel:${cleanTel}`,
              });
            }
          }
        }
      }

      cursorY += lineHeight;
    }

    cursorY += headingLevel > 0 ? 6 : 5;
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Converts a processed .docx Uint8Array directly into a vector PDF Uint8Array in the browser
 */
export async function convertDocxBytesToPdfBytes(
  docxBytes: Uint8Array
): Promise<Uint8Array> {
  const blocks = await parseDocxIntoBlocks(docxBytes);
  return renderBlocksToPdfBytes(blocks, 'Calibri');
}

/**
 * Generates a vector PDF Uint8Array directly from Whiteboard text and styles
 */
export function createPdfFromWhiteboard(
  rawText: string,
  airline: string,
  oldTfn: string,
  newTfn: string,
  replacementWord: string,
  allKnownAirlines: string[],
  detectedAirlines: string[],
  style: WhiteboardParagraphStyle
): Uint8Array {
  let processed = replaceTfnInString(rawText, oldTfn, newTfn);
  processed = replaceAirlineInString(
    processed,
    airline,
    replacementWord,
    allKnownAirlines,
    detectedAirlines
  );

  const lines = processed.split(/\r?\n/);
  const blocks: PdfDocBlock[] = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return {
        type: 'paragraph',
        align: 'left',
        isHeading: 0,
        isList: false,
        runs: [],
        embeddedImages: [],
      };
    }

    let isHeading = 0;
    let text = line;
    if (line.startsWith('### ')) {
      isHeading = 3;
      text = line.slice(4);
    } else if (line.startsWith('## ')) {
      isHeading = 2;
      text = line.slice(3);
    } else if (line.startsWith('# ')) {
      isHeading = 1;
      text = line.slice(2);
    }

    const isList = /^[-*•]\s+/.test(trimmed);
    if (isList) {
      text = trimmed.replace(/^[-*•]\s+/, '');
    }

    return {
      type: 'paragraph',
      align: 'left',
      isHeading,
      isList,
      runs: [
        {
          text,
          bold: isHeading > 0 || Boolean(style.bold),
          italic: Boolean(style.italic),
          underline: Boolean(style.underline),
          color: [15, 23, 42],
          fontSizePt:
            isHeading === 1
              ? Math.max(18, (style.fontSize || 11) + 6)
              : isHeading === 2
              ? Math.max(14, (style.fontSize || 11) + 3)
              : style.fontSize || 11,
        },
      ],
      embeddedImages: [],
    };
  });

  return renderBlocksToPdfBytes(blocks, style.fontFamily || 'Calibri');
}
