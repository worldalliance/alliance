import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { heading } from "../../../../lib/testing/formCanvas";
import { renderFormBuilder } from "../../../../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        { id: "intro", type: "display", kind: "text", text: "Welcome" },
        {
          id: "pics",
          type: "display",
          kind: "images",
          images: [{ src: "https://example.com/a.png", alt: "A lake" }],
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("an images block on the canvas", () => {
  it("selects the block from a click on its image, and keeps its viewer out of reach", () => {
    renderFormBuilder(schema);
    const open = document.querySelector('[aria-label="Open image: A lake"]');
    expect(open).not.toBeNull();
    expect(open?.closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Select Images/ }));
    expect(heading()).toMatch(/^Images/);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
