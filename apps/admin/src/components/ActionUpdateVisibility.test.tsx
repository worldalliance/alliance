import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { actionUpdateAdmin } from "../lib/testing/actionUpdateAdmin";
import {
  HiddenFromMembersBanner,
  VisibilityControls,
} from "./ActionUpdateVisibility";

afterEach(cleanup);

const HOUR_MS = 60 * 60 * 1000;
const past = new Date(Date.now() - HOUR_MS).toISOString();
const future = new Date(Date.now() + HOUR_MS).toISOString();

const renderControls = (
  params: { visibleAt: string | null; date?: string; unsaved?: boolean },
  handlers: { onPublishNow?: () => void; onUnpublish?: () => void } = {},
) =>
  render(
    <VisibilityControls
      update={actionUpdateAdmin({
        visibleAt: params.visibleAt,
        date: params.date ?? future,
      })}
      hasUnsavedDetails={params.unsaved ?? false}
      changing={false}
      onPublishNow={handlers.onPublishNow ?? (() => {})}
      onUnpublish={handlers.onUnpublish ?? (() => {})}
    />,
  );

describe("HiddenFromMembersBanner", () => {
  it("says an unpublished update publishes on its first content save", () => {
    render(
      <HiddenFromMembersBanner
        update={actionUpdateAdmin({ visibleAt: null })}
      />,
    );
    expect(screen.getByText(/publishes the first time you save/)).toBeTruthy();
  });

  it("says when a scheduled update publishes", () => {
    render(
      <HiddenFromMembersBanner
        update={actionUpdateAdmin({ visibleAt: future })}
      />,
    );
    expect(
      screen.getByText(new Date(future).toLocaleString(), { exact: false }),
    ).toBeTruthy();
  });

  it("shows nothing once the update is published", () => {
    const { container } = render(
      <HiddenFromMembersBanner
        update={actionUpdateAdmin({ visibleAt: past })}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("VisibilityControls", () => {
  it("publishes a scheduled update now", () => {
    const onPublishNow = jest.fn();
    renderControls({ visibleAt: future }, { onPublishNow });
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    expect(onPublishNow).toHaveBeenCalled();
  });

  it("unpublishes a published update until its displayed date", () => {
    const onUnpublish = jest.fn();
    renderControls({ visibleAt: past }, { onUnpublish });
    fireEvent.click(
      screen.getByRole("button", { name: "Unpublish until displayed date" }),
    );
    expect(onUnpublish).toHaveBeenCalled();
  });

  it("won't unpublish over unsaved details", () => {
    renderControls({ visibleAt: past, unsaved: true });
    expect(screen.getByText("Save your changes first.")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Unpublish until displayed date" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("won't unpublish once the displayed date has passed", () => {
    renderControls({ visibleAt: past, date: past });
    expect(screen.getByText(/nothing to wait for/)).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Unpublish until displayed date" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
