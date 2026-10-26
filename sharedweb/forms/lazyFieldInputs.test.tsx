import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { RenderField } from "./RenderField";
import { base, options } from "./RenderField.fixtures";

it("loads the ranking input's options", async () => {
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <RenderField
          fieldContext={staticFieldContext}
          field={{ ...base, kind: "ranking", options }}
        />
      </SiteAppProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText("First choice")).toBeTruthy();
});
