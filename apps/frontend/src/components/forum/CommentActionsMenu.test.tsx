import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CommentActionsMenu from "./CommentActionsMenu";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it.each([
  ["Copied!", () => Promise.resolve()],
  ["Copy failed", () => Promise.reject(new DOMException("denied"))],
])("says %s after Copy link", async (label, writeText) => {
  jest.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
  render(
    <CommentActionsMenu
      replyId={3}
      isOwner={false}
      isAdmin={false}
      isPinned={false}
      onEdit={() => {}}
      onDelete={() => {}}
      onPin={() => {}}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "More options" }));
  fireEvent.click(screen.getByText("Copy link"));

  expect(await screen.findByText(label)).toBeTruthy();
});
