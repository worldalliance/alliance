import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, cleanup, renderHook, screen } from "@testing-library/react";
import { useCopyInviteLink } from "./useCopyInviteLink";

beforeEach(() => {
  process.env.VITE_ALT_APP_URL = "https://example.com";
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  delete process.env.VITE_ALT_APP_URL;
});

it.each([
  [true, () => Promise.resolve()],
  [false, () => Promise.reject(new DOMException("denied"))],
])("reports copied=%p and toasts only a refusal", async (landed, writeText) => {
  jest.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
  const { result } = renderHook(useCopyInviteLink, { wrapper: ToastProvider });

  let copied: boolean | undefined;
  await act(async () => {
    copied = await result.current("abc123");
  });

  expect(copied).toBe(landed);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    "https://example.com/signup?ref=abc123",
  );
  expect(!!screen.queryByText("Could not copy the invite link.")).toBe(!landed);
});
