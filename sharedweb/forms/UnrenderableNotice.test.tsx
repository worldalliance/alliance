import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import { render, screen } from "@testing-library/react";
import UnrenderableNotice from "./UnrenderableNotice";

describe("UnrenderableNotice", () => {
  it("offers a reload for content this build is too old for", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        reason={UnrenderableReason.OutdatedClient}
        detail="Unknown kind: carousel"
      />,
    );

    expect(
      screen.getByText("This update needs the latest version of Alliance"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });

  it("tells members broken content isn't theirs to fix", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
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
        reason={UnrenderableReason.OutdatedClient}
        detail="Unknown kind: carousel"
        showDetail
      />,
    );

    expect(screen.getByText("Unknown kind: carousel")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });

  it("shows staff the detail", () => {
    render(
      <UnrenderableNotice
        subject={UnrenderableSubject.Form}
        reason={UnrenderableReason.ContentProblem}
        detail="#{total}: broken"
        showDetail
      />,
    );

    expect(screen.getByText("#{total}: broken")).toBeTruthy();
    expect(screen.queryByText("Please try again later.")).toBeNull();
  });
});
