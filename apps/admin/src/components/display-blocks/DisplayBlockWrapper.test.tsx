import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { openSection, selectElement } from "../../lib/testing/formCanvas";
import { renderFormBuilder } from "../../lib/testing/renderFormBuilder";

afterEach(cleanup);

serveApi(routes({}, () => Response.json([])));

const hasCity: VisibleIfFormula = {
  conditions: { c1: { kind: "userHasCity", userHasCity: true } },
  formula: "c1",
};

describe("a display block's own visibility", () => {
  it("clears the condition from every user's content too", () => {
    renderFormBuilder({
      pages: [
        {
          id: "p1",
          fields: [
            {
              type: "display",
              kind: "copytext",
              id: "block-1",
              text: "",
              visibleIfFormula: hasCity,
              manualPerUser: true,
              manualUserContent: {
                "7": { text: "Dear Ana", visibleIfFormula: hasCity },
              },
            },
          ],
        },
      ],
      outputViews: [],
    });
    selectElement("Copy Text Block");
    openSection("Conditions");
    fireEvent.click(
      screen.getByRole("button", { name: "Remove all conditions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit form JSON" }));
    const json = screen.getByRole<HTMLTextAreaElement>("textbox", {
      name: "Form JSON",
    }).value;
    expect(json).not.toContain("visibleIfFormula");
    expect(json).toContain("Dear Ana");
  });
});
