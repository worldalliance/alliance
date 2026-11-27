import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { EmailMockup } from "./MessageMockups";

it("renders an email body as the HTML the server sends, newlines as breaks", () => {
  render(
    <EmailMockup
      subject="Missed"
      body={'Hi\nwatch <a href="https://example.org">this video</a>'}
      recipient="Ana"
    />,
  );

  const body = screen.getByTitle("Email body");
  expect(body.getAttribute("sandbox")).not.toContain("allow-scripts");
  expect(body.getAttribute("srcdoc")).toContain(
    'Hi<br>watch <a href="https://example.org">this video</a>',
  );
});

it("opens an email body's links in a new tab, not in the preview", () => {
  render(<EmailMockup subject="Missed" body="Hi" recipient="Ana" />);

  const body = screen.getByTitle("Email body");
  expect(body.getAttribute("sandbox")).toContain("allow-popups");
  expect(body.getAttribute("srcdoc")).toStartWith('<base target="_blank">');
});
