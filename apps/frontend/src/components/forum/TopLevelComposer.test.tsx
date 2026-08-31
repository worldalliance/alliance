import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import TopLevelComposer from "./TopLevelComposer";

afterEach(cleanup);

beforeEach(() => {
  sessionStorage.clear();
});

const Harness = ({ replyingTo }: { replyingTo: number | null }) => (
  <ToastProvider>
    <TopLevelComposer
      replyingTo={replyingTo}
      setReplyingTo={() => {}}
      onSubmit={() => {}}
      focusOnMount={false}
      tags={[]}
      setSelectedTagId={() => {}}
    />
  </ToastProvider>
);

it("keeps the thread draft while the user replies further down", () => {
  const { rerender } = render(<Harness replyingTo={null} />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "a thread comment I am still writing" },
  });

  rerender(<Harness replyingTo={5} />);
  expect(screen.queryByRole("textbox")).toBeNull();

  rerender(<Harness replyingTo={null} />);
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
    "a thread comment I am still writing",
  );
});
