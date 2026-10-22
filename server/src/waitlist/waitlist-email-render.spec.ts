import { R } from "@alliance/common/result";
import { WaitlistEmailPlaceholder } from "@alliance/common/waitlistEmail";
import { describe, expect, it } from "bun:test";
import {
  renderWaitlistEmail,
  type WaitlistEmailValues,
} from "./waitlist-email-render";

const VALUES: WaitlistEmailValues = {
  [WaitlistEmailPlaceholder.Name]: "Ada Lovelace",
  [WaitlistEmailPlaceholder.OrganizationName]: "Analytical Society",
  [WaitlistEmailPlaceholder.SignupLink]: "https://example.com/signup?ref=a_b-c",
  [WaitlistEmailPlaceholder.PersonalShareLink]:
    "https://example.com/projects/x?ref=d_e",
};

const render = (
  subject: string,
  body: string,
  values: Partial<WaitlistEmailValues> = {},
) =>
  R.unwrap(
    renderWaitlistEmail({ subject, body, values: { ...VALUES, ...values } }),
  );

describe("renderWaitlistEmail", () => {
  it("fills placeholders in the subject and renders the body's Markdown", () => {
    const rendered = render(
      "Hi #{name} from #{organizationName}",
      "**Welcome**, #{name}!\nSecond line\n\n[Sign up](#{signupLink}) or share #{personalShareLink}",
    );
    expect(rendered.subject).toBe("Hi Ada Lovelace from Analytical Society");
    expect(rendered.bodyHtml).toBe(
      '<p><strong>Welcome</strong>, Ada Lovelace!<br>\nSecond line</p>\n<p><a href="https://example.com/signup?ref=a_b-c">Sign up</a> or share <a href="https://example.com/projects/x?ref=d_e">https://example.com/projects/x?ref=d_e</a></p>\n',
    );
  });

  it("keeps a link whole beside emphasis, and as a written link target", () => {
    const { bodyHtml } = render(
      "Hi",
      "_Share #{personalShareLink}_ or [sign up](#{signupLink}) or <#{signupLink}>",
    );
    expect(bodyHtml).toBe(
      '<p><em>Share <a href="https://example.com/projects/x?ref=d_e">https://example.com/projects/x?ref=d_e</a></em> or <a href="https://example.com/signup?ref=a_b-c">sign up</a> or <a href="https://example.com/signup?ref=a_b-c">https://example.com/signup?ref=a_b-c</a></p>\n',
    );
  });

  it("keeps a link inside link text from nesting a link", () => {
    const { bodyHtml } = render(
      "Hi",
      "[#{signupLink}](#{signupLink}) [Go to #{signupLink}](#{signupLink}) [**#{signupLink}**](#{signupLink})",
    );
    const link = "https://example.com/signup?ref=a_b-c";
    expect(bodyHtml).toBe(
      `<p><a href="${link}">${link}</a> <a href="${link}">Go to ${link}</a> <a href="${link}"><strong>${link}</strong></a></p>\n`,
    );
  });

  it("URL-encodes a name used in a link target", () => {
    const { bodyHtml } = render(
      "Hi",
      "[x](#{name}) [y](https://example.com/?n=#{name})",
      { [WaitlistEmailPlaceholder.Name]: "javascript:alert(1) & co" },
    );
    expect(bodyHtml).toBe(
      '<p><a href="javascript%3Aalert(1)%20%26%20co">x</a> <a href="https://example.com/?n=javascript%3Aalert(1)%20%26%20co">y</a></p>\n',
    );
  });

  it("keeps a name in a link title or code block info as text", () => {
    const { bodyHtml } = render(
      "Hi",
      '[x](https://example.com "For #{name}")\n\n```#{name}\ncode\n```',
      { [WaitlistEmailPlaceholder.Name]: "Ada L" },
    );
    expect(bodyHtml).toBe(
      '<p><a href="https://example.com" title="For Ada L">x</a></p>\n<pre><code class="language-Ada">code\n</code></pre>\n',
    );
  });

  it("keeps a name followed by a domain ending as text", () => {
    const { bodyHtml } = render(
      "Hi",
      "Visit #{name}.com or #{organizationName}.org",
    );
    expect(bodyHtml).toBe(
      "<p>Visit Ada Lovelace.com or Analytical Society.org</p>\n",
    );
  });

  it("keeps a typed URL linked with a name after its host", () => {
    const { bodyHtml } = render(
      "Hi",
      "Visit https://example.com/?n=#{name} or #{name}@example.com",
    );
    expect(bodyHtml).toBe(
      '<p>Visit <a href="https://example.com/?n=Ada%20Lovelace">https://example.com/?n=Ada Lovelace</a> or Ada Lovelace@example.com</p>\n',
    );
  });

  it("puts a name holding replacement patterns in as it is", () => {
    const { bodyHtml } = render("Hi", "Dear #{name}, welcome", {
      [WaitlistEmailPlaceholder.Name]: "A$'B $& $` $$",
    });
    expect(bodyHtml).toBe("<p>Dear A$'B $&amp; $` $$, welcome</p>\n");
  });

  it("puts values into code as they are", () => {
    const { bodyHtml } = render(
      "Hi",
      "`#{signupLink}` `#{name}`\n\n```\n#{personalShareLink}\n```",
      { [WaitlistEmailPlaceholder.Name]: "a*b_c" },
    );
    expect(bodyHtml).toBe(
      "<p><code>https://example.com/signup?ref=a_b-c</code> <code>a*b_c</code></p>\n<pre><code>https://example.com/projects/x?ref=d_e\n</code></pre>\n",
    );
  });

  it("keeps an entrant's name from adding HTML, formatting, or links", () => {
    const { bodyHtml } = render("Hi", "Hello #{name}", {
      [WaitlistEmailPlaceholder.Name]:
        "<img src=x onerror=alert(1)> **bold** [x](https://evil.example) &amp;\n# heading",
    });
    expect(bodyHtml).toBe(
      "<p>Hello &lt;img src=x onerror=alert(1)&gt; **bold** [x](https://evil.example) &amp;amp; # heading</p>\n",
    );
  });

  it("keeps raw HTML in the body as text", () => {
    expect(render("Hi", "<script>x</script>").bodyHtml).toBe(
      "<p>&lt;script&gt;x&lt;/script&gt;</p>\n",
    );
  });

  it("fails with the used placeholders that have no value", () => {
    expect(
      renderWaitlistEmail({
        subject: "#{organizationName}",
        body: "#{name} #{signupLink}",
        values: {
          ...VALUES,
          [WaitlistEmailPlaceholder.OrganizationName]: null,
          [WaitlistEmailPlaceholder.SignupLink]: null,
          [WaitlistEmailPlaceholder.PersonalShareLink]: null,
        },
      }),
    ).toEqual(
      R.failure([
        WaitlistEmailPlaceholder.OrganizationName,
        WaitlistEmailPlaceholder.SignupLink,
      ]),
    );
  });

  it("throws on a placeholder validation should have refused", () => {
    expect(() => render("#{firstname}", "")).toThrow(
      "unknown waitlist email placeholders",
    );
  });
});
