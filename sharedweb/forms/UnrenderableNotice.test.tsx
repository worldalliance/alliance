import { ExceptionEvent } from "@alliance/common/analytics";
import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import {
  __resetReportedUnrenderableForTests,
  UnrenderableSubject,
} from "@alliance/shared/forms/unrenderable";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import { render, screen } from "@testing-library/react";
import UnrenderableNotice from "./UnrenderableNotice";

const FORM = { formId: 1, formSnapshotId: 2, actionId: 3 };

const reported = recordExceptions();

beforeEach(() => __resetReportedUnrenderableForTests());

describe("UnrenderableNotice", () => {
  it("offers a reload for content this build is too old for, and reports it", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        content={{ actionUpdateId: 4 }}
        reason={UnrenderableReason.OutdatedClient}
        detail="Unknown kind: carousel"
      />,
    );

    expect(
      screen.getByText("This update needs the latest version of Alliance"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    expect(reported).toEqual([
      expect.objectContaining({
        event: ExceptionEvent.ContentNeedsNewerClient,
        properties: {
          subject: UnrenderableSubject.Update,
          reason: UnrenderableReason.OutdatedClient,
          detail: "Unknown kind: carousel",
          actionUpdateId: 4,
        },
      }),
    ]);
  });

  it("reports the same content once however many times it mounts", () => {
    const notice = (
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
        content={FORM}
        reason={UnrenderableReason.ContentProblem}
        detail="#{once}: broken"
      />
    );
    render(notice).unmount();
    render(notice);
    render(notice);

    expect(reported).toHaveLength(1);
  });

  it("reports each piece of content with the same problem", () => {
    const notice = (actionUpdateId: number) => (
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        content={{ actionUpdateId }}
        reason={UnrenderableReason.ContentProblem}
        detail="blocks.0: broken"
      />
    );
    render(notice(5));
    render(notice(6));

    expect(reported).toHaveLength(2);
  });

  it("tells members broken content isn't theirs to fix", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
        content={FORM}
        reason={UnrenderableReason.ContentProblem}
        detail="#{total}: broken"
      />,
    );

    expect(screen.getByText("There's a problem with this form")).toBeTruthy();
    expect(screen.getByText("Please try again later.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  });

  it("offers staff a reload for content their tab is too old for", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        content={{ actionUpdateId: 4 }}
        reason={UnrenderableReason.OutdatedClient}
        detail="Unknown kind: carousel"
        showDetail
      />,
    );

    expect(screen.getByText("Unknown kind: carousel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });

  it("shows staff the detail without reporting it", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
        content={FORM}
        reason={UnrenderableReason.ContentProblem}
        detail="#{total}: broken"
        showDetail
      />,
    );

    expect(screen.getByText("#{total}: broken")).toBeTruthy();
    expect(screen.queryByText("Please try again later.")).toBeNull();
    expect(reported).toEqual([]);
  });
});
