import { describe, expect, it } from "bun:test";
import { Features } from "./features";
import { InfoEntryId, visibleInfoResources } from "./informationPage";

const ids = (isFeatureEnabled: (feature: Features) => boolean) =>
  visibleInfoResources(isFeatureEnabled).map((resource) => resource.id);

describe("visibleInfoResources", () => {
  it("lists General updates between Action updates and Priorities when its flag is on", () => {
    const visible = ids((feature) => feature === Features.GeneralUpdatesLink);
    const index = visible.indexOf(InfoEntryId.GeneralUpdates);
    expect(visible[index - 1]).toBe(InfoEntryId.ActionUpdates);
    expect(visible[index + 1]).toBe(InfoEntryId.Priorities);
  });

  it("omits General updates when its flag is off", () => {
    const visible = ids(() => false);
    expect(visible).not.toContain(InfoEntryId.GeneralUpdates);
    expect(visible).toContain(InfoEntryId.Priorities);
  });
});
