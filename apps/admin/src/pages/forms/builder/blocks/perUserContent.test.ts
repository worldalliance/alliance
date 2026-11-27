import type { TextBlock } from "@alliance/common/forms/display-blocks";
import { importManualContent } from "./perUserContent";

const block: TextBlock = {
  type: "display",
  kind: "text",
  id: "note",
  text: "Hello",
  manualPerUser: true,
  manualUserContent: {
    "7": { text: "Dear Ana" },
    "8": { text: "" },
  },
};

describe("importManualContent", () => {
  it("counts only the users whose differing text it replaces", () => {
    expect(
      importManualContent({
        block,
        field: "text",
        entries: { "7": "Hi Ana", "8": "Hi Ben", "9": "Hi Cy" },
      }),
    ).toEqual({
      manualUserContent: {
        "7": { text: "Hi Ana" },
        "8": { text: "Hi Ben" },
        "9": { text: "Hi Cy" },
      },
      imported: 3,
      overwritten: 1,
    });
  });

  it("leaves a user whose text already matches", () => {
    expect(
      importManualContent({
        block,
        field: "text",
        entries: { "7": "Dear Ana" },
      }),
    ).toMatchObject({ imported: 0, overwritten: 0 });
  });
});
