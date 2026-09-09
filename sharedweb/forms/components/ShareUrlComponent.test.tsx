import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import { PreviewModeProvider } from "@alliance/shared/forms/previewMode";
import { sharePreviewPlaceholder } from "@alliance/shared/lib/copy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

let minted = 0;

jest.mock("@alliance/shared/client", () => ({
  shareUrlsGetShareLink: () => {
    minted += 1;
    return Promise.resolve({ data: { url: "https://example.org/s/abc" } });
  },
}));

import ShareUrlComponent from "./ShareUrlComponent";

const field: CustomComponentField = {
  id: "share",
  type: "input",
  kind: "custom",
  label: "Share",
  componentId: "shareUrl",
  componentConfig: { actionId: 7 },
};

function renderShare(previewMode?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PreviewModeProvider value={!!previewMode}>
        <ShareUrlComponent field={field} value={null} onChange={() => {}} />
      </PreviewModeProvider>
    </QueryClientProvider>,
  );
}

const copyButton = () => screen.getByRole("button", { name: "Copy" });

beforeEach(() => {
  minted = 0;
});

afterEach(cleanup);

describe("ShareUrlComponent", () => {
  it("mints a share code for a live form", async () => {
    renderShare();

    await waitFor(() =>
      expect(screen.getByText("https://example.org/s/abc")).toBeDefined(),
    );
    expect(minted).toBe(1);
    expect(copyButton().hasAttribute("disabled")).toBe(false);
  });

  it("asks for no link while previewing, since minting one stores it", async () => {
    renderShare(true);

    await waitFor(() =>
      expect(screen.getByText(sharePreviewPlaceholder)).toBeDefined(),
    );
    expect(minted).toBe(0);
    expect(copyButton().hasAttribute("disabled")).toBe(true);
  });
});
