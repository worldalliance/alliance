import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { CodeBlock } from "./CodeBlock";
import { CopyField } from "./CopyField";
import { Fact, FactList } from "./templates/Record";
import { ToastProvider } from "./ToastProvider";

afterEach(cleanup);

describe("CopyField", () => {
  it("says so when the clipboard refuses", async () => {
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    try {
      render(
        <ToastProvider>
          <CopyField label="Link" value="https://cdn.test/a.webp" />
        </ToastProvider>,
      );
      expect(screen.getByLabelText<HTMLInputElement>("Link").value).toBe(
        "https://cdn.test/a.webp",
      );
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      expect(
        await screen.findByText(
          "Couldn't copy the link. Select it and copy it yourself.",
        ),
      ).toBeTruthy();
    } finally {
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });
});

describe("CodeBlock", () => {
  it("keeps the text as given, for copying", () => {
    const command = "ffmpeg -i in.mp4\n  -hls_time 6 out.m3u8";
    const { container } = render(<CodeBlock>{command}</CodeBlock>);
    expect(container.querySelector("code")?.textContent).toBe(command);
  });
});

describe("Fact", () => {
  it("lets a long string break after each slash, reading as given", () => {
    const { container } = render(
      <FactList>
        <Fact label="MIME type">application/vnd.apple.mpegurl</Fact>
      </FactList>,
    );
    const value = container.querySelector("dd");
    expect(value?.textContent).toBe("application/vnd.apple.mpegurl");
    expect(value?.querySelectorAll("wbr")).toHaveLength(1);
  });
});
