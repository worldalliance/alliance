import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { RenderField } from "./RenderField";

afterEach(cleanup);
serveApi(routes({}));

it.each([false, true])(
  "hides the dropdown label addon when hideLabel=%s",
  (hideLabel) => {
    render(
      <MemoryRouter>
        <SiteAppProvider>
          <RenderField
            field={{
              id: "location",
              type: "input",
              kind: "select",
              label: "**Location**",
              searchable: true,
              options: [{ label: "New York", value: "ny" }],
            }}
            hideLabel={hideLabel}
            labelRightAddon={<button type="button">Show publicly</button>}
          />
        </SiteAppProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("combobox", { name: "Location" })).toBeTruthy();
    expect(screen.queryByText("Show publicly") !== null).toBe(!hideLabel);
    expect(screen.queryByText("Optional") !== null).toBe(!hideLabel);
  },
);
