// Frozen helpers for `1786385686467-ActionUpdateSchemaSnapshot`. They live
// outside `migrations/*.ts` because TypeORM instantiates every export it finds
// there. Application code must not import them, and their behavior must not
// change once the migration has run.
//
// This deliberately copies rather than imports `common/forms`: the conversion
// is a one-time historical fact, and re-running it on a fresh database has to
// keep producing the rows production already has.
type ConvertedBlock = Record<string, unknown>;

const LINK_DEFINITION =
  /^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const THEMATIC_BREAK = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const STANDALONE_IMAGE =
  /^!\[([^\]]*)\]\(\s*<?([^\s>)]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/;
const BLOCKQUOTE = /^ {0,3}>\s?(.*)$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]\s|\d+[.)]\s)/;

// Reference-style links only resolve within a single markdown document, and
// splitting a body into blocks scatters the definitions away from their uses.
// Rewriting them inline first keeps every link working afterwards.
function inlineReferenceLinks(body: string): string {
  const definitions = new Map<string, string>();
  const kept: string[] = [];

  for (const line of body.split('\n')) {
    const definition = LINK_DEFINITION.exec(line);
    if (definition) {
      definitions.set(definition[1].toLowerCase(), definition[2]);
      continue;
    }
    kept.push(line);
  }

  const text = kept.join('\n');
  if (definitions.size === 0) return text;

  return text
    .replace(/(!?)\[([^\]]+)\]\[([^\]]*)\]/g, (whole, bang, label, ref) => {
      const url = definitions.get(String(ref || label).toLowerCase());
      return url ? `${bang}[${label}](${url})` : whole;
    })
    .replace(/(!?)\[([^\]]+)\](?![([])/g, (whole, bang, label) => {
      const url = definitions.get(String(label).toLowerCase());
      return url ? `${bang}[${label}](${url})` : whole;
    });
}

function isListLike(text: unknown): boolean {
  return typeof text === 'string' && LIST_ITEM.test(text.split('\n')[0]);
}

// A loose list is separated by blank lines, which would otherwise split into
// one text block per item.
function mergeAdjacentLists(blocks: ConvertedBlock[]): ConvertedBlock[] {
  const merged: ConvertedBlock[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (
      block.kind === 'text' &&
      previous?.kind === 'text' &&
      isListLike(block.text) &&
      isListLike(previous.text)
    ) {
      previous.text = `${String(previous.text)}\n\n${String(block.text)}`;
      continue;
    }
    merged.push(block);
  }
  return merged;
}

export function markdownToDisplayBlocks(params: {
  body: string;
  attachments: string[];
}): { blocks: ConvertedBlock[] } {
  const blocks: ConvertedBlock[] = [];
  const lines = inlineReferenceLinks(params.body.replace(/\r\n?/g, '\n')).split(
    '\n',
  );

  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (text) blocks.push({ kind: 'text', text });
  };

  const flushQuote = () => {
    const text = quote.join('\n').trim();
    quote = [];
    if (text) blocks.push({ kind: 'quote', text });
  };

  for (const line of lines) {
    const blockquote = BLOCKQUOTE.exec(line);
    if (blockquote) {
      flushParagraph();
      quote.push(blockquote[1]);
      continue;
    }
    flushQuote();

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        kind: 'header',
        text: heading[2],
        level: heading[1].length,
      });
      continue;
    }

    if (THEMATIC_BREAK.test(line)) {
      flushParagraph();
      blocks.push({ kind: 'divider' });
      continue;
    }

    const image = STANDALONE_IMAGE.exec(line);
    if (image) {
      flushParagraph();
      blocks.push({
        kind: 'image',
        src: image[2],
        alt: image[1],
        ...(image[3] ? { caption: image[3] } : {}),
      });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushQuote();

  for (const attachment of params.attachments) {
    if (attachment) {
      blocks.push({
        kind: 'image',
        src: attachment,
        alt: '',
        expandable: true,
      });
    }
  }

  return {
    blocks: mergeAdjacentLists(blocks).map((block, index) => ({
      type: 'display',
      id: `block-${index + 1}`,
      ...block,
    })),
  };
}

function readBlocks(schema: unknown): ConvertedBlock[] {
  if (typeof schema !== 'object' || schema === null || !('blocks' in schema)) {
    return [];
  }
  const { blocks } = schema;
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(
    (block): block is ConvertedBlock =>
      typeof block === 'object' && block !== null,
  );
}

export function displayBlocksToMarkdown(schema: unknown): string {
  return readBlocks(schema)
    .map((block) => {
      switch (block.kind) {
        case 'header':
          return `${'#'.repeat(Number(block.level) || 2)} ${String(block.text ?? '')}`;
        case 'quote':
          return String(block.text ?? '')
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n');
        case 'divider':
          return '---';
        case 'image':
          return `![${String(block.alt ?? '')}](${String(block.src ?? '')})`;
        default:
          return String(block.text ?? '');
      }
    })
    .filter((chunk) => chunk.length > 0)
    .join('\n\n');
}
