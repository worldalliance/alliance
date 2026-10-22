import type LinkifyIt from "linkify-it";
import MarkdownIt from "markdown-it";

/** Autolinks what web's remark-gfm does: scheme URLs, `www.` hosts, and emails. */
export const markdownParser = MarkdownIt({ typographer: true, linkify: true });

const neverMatches = { validate: () => 0 };

// Fuzzy links stay off, or a missing space after a period ("agree.It") links a
// stranger's domain.
markdownParser.linkify
  .set({ fuzzyLink: false })
  .add("//", neverMatches)
  .add("ftp:", neverMatches)
  .add("www.", {
    validate: (text, pos, self) =>
      text
        .slice(pos)
        .match(
          new RegExp(
            `^${self.re.src_host_port_strict}${self.re.src_path}`,
            "i",
          ),
        )?.[0].length ?? 0,
    normalize: (match: LinkifyIt.Match) => {
      match.url = `http://${match.url}`;
    },
  });

/**
 * CommonMark alone, rendered the way a rich copy text block is copied: raw html
 * stays as typed and a soft break joins its lines with a space.
 */
export const commonMarkParser = MarkdownIt("commonmark", { html: false });

commonMarkParser.core.ruler.push("as_copied", (state) => {
  for (const token of state.tokens) {
    token.children =
      token.children?.map((child) => {
        if (child.type !== "softbreak") return child;
        const space = new state.Token("text", "", 0);
        space.content = " ";
        return space;
      }) ?? null;
  }
  return true;
});
