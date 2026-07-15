import { escapeSlackText } from './slack-format';

describe('escapeSlackText', () => {
  it('escapes the three Slack control characters', () => {
    expect(escapeSlackText('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('escapes & first so < and > are not double-escaped', () => {
    expect(escapeSlackText('<')).toBe('&lt;');
    expect(escapeSlackText('>')).toBe('&gt;');
    expect(escapeSlackText('&lt;')).toBe('&amp;lt;');
  });

  it('neutralizes Slack mention and link syntax', () => {
    expect(escapeSlackText('<!channel>')).toBe('&lt;!channel&gt;');
    expect(escapeSlackText('<https://evil.example|click me>')).toBe(
      '&lt;https://evil.example|click me&gt;',
    );
  });

  it('does not escape HTML-only characters like quotes', () => {
    expect(escapeSlackText(`"quoted" and 'quoted'`)).toBe(
      `"quoted" and 'quoted'`,
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeSlackText('Jane Doe signed their contract :)')).toBe(
      'Jane Doe signed their contract :)',
    );
  });
});
