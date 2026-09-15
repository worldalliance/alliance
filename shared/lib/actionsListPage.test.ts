import { FilterMode } from "./actionUtils";
import { filterActions } from "./actionsListPage";
import { makeAction, makeViewer } from "./testFixtures";

describe("filterActions", () => {
  it("keeps draft staff previews out of the All list", () => {
    const live = makeAction({ id: 1 });
    const preview = makeAction({
      id: 2,
      status: "draft",
      viewer: makeViewer({ staffPreview: true }),
    });

    expect(filterActions([live, preview], FilterMode.All)).toEqual([live]);
  });

  it("lists a non-draft staff preview in All as it would without preview", () => {
    const preview = makeAction({
      status: "office_action",
      viewer: makeViewer({ staffPreview: true, memberActionStarted: false }),
    });

    expect(filterActions([preview], FilterMode.All)).toEqual([preview]);
  });
});
