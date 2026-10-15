import { cleanup, render, screen, within } from "@testing-library/react";
import type { CollectiveResultTexts } from "../lib/updatePreview";
import { PreviewCountsKind, UpdatePreview } from "./UpdatePreview";

afterEach(cleanup);

const split: CollectiveResultTexts = {
  shortNotifString: "a hearing",
  splitCollectiveResult: true,
  nonCompleterResult: "",
  uninvolvedResult: "a hearing; join the next one",
};

const cardOf = (label: string) => {
  const found = screen.getByText(label).closest("div.rounded-md");
  if (!(found instanceof HTMLElement)) throw new Error(`no card for ${label}`);
  return found;
};
const card = (label: string) => within(cardOf(label));

describe("UpdatePreview", () => {
  it("counts each variation and marks a skipped group as not notified", () => {
    render(
      <UpdatePreview
        mode="normal"
        texts={split}
        counts={{
          kind: PreviewCountsKind.Counted,
          counts: {
            completed: 1,
            didNotComplete: 4,
            uninvolved: 5,
          },
        }}
      />,
    );

    expect(card("Completed the action").getByText("1 member")).toBeTruthy();
    const skipped = card("Didn't complete the action");
    expect(skipped.getByText("4 members")).toBeTruthy();
    expect(skipped.getByText(/Not notified/)).toBeTruthy();
    expect(cardOf("Away or not involved").textContent).toContain(
      "PushUpdate: a hearing; join the next one",
    );
  });

  it("highlights the parts that differ per member", () => {
    render(<UpdatePreview mode="normal" texts={split} />);

    expect(
      screen
        .getAllByText("[contribution]")
        .every((part) => part.tagName === "MARK"),
    ).toBe(true);
    expect(screen.queryByText(/^\d+ members?$/)).toBeNull();
  });

  it("says why the counts are missing", () => {
    render(
      <UpdatePreview
        mode="normal"
        texts={split}
        counts={{
          kind: PreviewCountsKind.Unavailable,
          reason: "Pick a tag to count recipients.",
        }}
      />,
    );

    expect(screen.getByText("Pick a tag to count recipients.")).toBeTruthy();
  });

  it("shows what blocks a send in place of the variations", () => {
    render(
      <UpdatePreview
        mode="normal"
        texts={{ ...split, shortNotifString: "", uninvolvedResult: "" }}
      />,
    );

    expect(screen.getByText("Write at least one group's result.")).toBeTruthy();
  });
});
