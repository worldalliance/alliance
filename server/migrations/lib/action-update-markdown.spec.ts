import { displayOnlySchema } from '@alliance/common/forms/display-only-schema';
import { markdownToDisplayBlocks } from './action-update-markdown';

const convert = (body: string, attachments: string[] = []) =>
  markdownToDisplayBlocks({ body, attachments });

describe('markdownToDisplayBlocks', () => {
  it('produces a schema the display-only parser accepts', () => {
    const schema = convert(
      '## Heading\n\nSome **bold** text.\n\n![alt](https://example.com/a.webp)',
    );
    expect(displayOnlySchema.safeParse(schema).success).toBe(true);
  });

  it('splits paragraphs, headings, images and quotes into their own blocks', () => {
    const { blocks } = convert(
      [
        '## Results',
        '',
        'We ran the study.',
        '',
        '> Thanks for sharing this.',
        '',
        '![chart](https://example.com/chart.webp)',
      ].join('\n'),
    );

    expect(blocks).toEqual([
      {
        type: 'display',
        id: 'block-1',
        kind: 'header',
        text: 'Results',
        level: 2,
      },
      {
        type: 'display',
        id: 'block-2',
        kind: 'text',
        text: 'We ran the study.',
      },
      {
        type: 'display',
        id: 'block-3',
        kind: 'quote',
        text: 'Thanks for sharing this.',
      },
      {
        type: 'display',
        id: 'block-4',
        kind: 'image',
        src: 'https://example.com/chart.webp',
        alt: 'chart',
      },
    ]);
  });

  it('keeps a list in one text block, including when it is loose', () => {
    const { blocks } = convert('- first\n\n- second\n\n- third');
    expect(blocks).toEqual([
      {
        type: 'display',
        id: 'block-1',
        kind: 'text',
        text: '- first\n\n- second\n\n- third',
      },
    ]);
  });

  it('inlines reference-style links so they survive the split', () => {
    const { blocks } = convert(
      [
        'See [PictoPocket][pictopocket] for details.',
        '',
        'And [RoHS] too.',
        '',
        '[pictopocket]: https://pictopocket.com/',
        '[rohs]: https://example.com/rohs',
      ].join('\n'),
    );

    expect(blocks).toEqual([
      {
        type: 'display',
        id: 'block-1',
        kind: 'text',
        text: 'See [PictoPocket](https://pictopocket.com/) for details.',
      },
      {
        type: 'display',
        id: 'block-2',
        kind: 'text',
        text: 'And [RoHS](https://example.com/rohs) too.',
      },
    ]);
  });

  it('leaves inline links alone', () => {
    const { blocks } = convert('A [link](https://example.com) inline.');
    expect(blocks[0].text).toBe('A [link](https://example.com) inline.');
  });

  it('joins consecutive blockquote lines into one quote', () => {
    const { blocks } = convert('> first line\n> second line\n\nAfter.');
    expect(blocks[0]).toMatchObject({
      kind: 'quote',
      text: 'first line\nsecond line',
    });
    expect(blocks[1]).toMatchObject({ kind: 'text', text: 'After.' });
  });

  it('turns attachments into expandable images', () => {
    const { blocks } = convert('Body.', ['1763935520222.webp']);
    expect(blocks[1]).toEqual({
      type: 'display',
      id: 'block-2',
      kind: 'image',
      src: '1763935520222.webp',
      alt: '',
      expandable: true,
    });
  });

  it('converts an empty body to an empty schema', () => {
    expect(convert('')).toEqual({ blocks: [] });
  });
});
