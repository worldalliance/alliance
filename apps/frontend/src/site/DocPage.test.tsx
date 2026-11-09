import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import FoundationPage from "../pages/static/FoundationPage";
import GovernancePage from "../pages/static/GovernancePage";
import GuidePage from "../pages/static/GuidePage";
import { authValue } from "../testing/authValue";
import {
  FOUNDATION_SECTION_ORDER,
  FOUNDATION_SECTIONS,
  GOVERNANCE_SECTION_ORDER,
  GOVERNANCE_SECTIONS,
  GUIDE_SECTION_ORDER,
  GUIDE_SECTIONS,
} from "./docContent";
import { DOC_TOC_LABEL } from "./DocPage";
import { InviteSessionProvider } from "./invite/InviteSession";

serveApi(
  routes({
    "GET /contract/current": () =>
      Response.json({ id: 1, markdown: "Terms", description: [] }),
  }),
);

const visit = (page: ReactNode) => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <AuthContext.Provider value={authValue()}>
          <InviteSessionProvider>{page}</InviteSessionProvider>
        </AuthContext.Provider>
      </SiteAppProvider>
    </MemoryRouter>,
    { wrapper },
  );
};

const labelsOf = <K extends string>(
  order: readonly K[],
  copy: Record<K, { label: string }>,
) => order.map((kind) => copy[kind].label);

function expectDocSections(labels: string[]) {
  for (const label of labels) {
    screen.getByRole("heading", { level: 2, name: label });
  }
  const navs = screen.getAllByRole("navigation", { name: DOC_TOC_LABEL });
  expect(navs).toHaveLength(2);
  for (const nav of navs) {
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(labels);
  }
}

test("the guide lists its sections beside the prose", () => {
  visit(<GuidePage />);
  expectDocSections(labelsOf(GUIDE_SECTION_ORDER, GUIDE_SECTIONS));
});

test("the foundation page uses the same section layout", () => {
  visit(<FoundationPage />);
  expectDocSections(labelsOf(FOUNDATION_SECTION_ORDER, FOUNDATION_SECTIONS));
});

test("the governance page uses the same section layout", () => {
  visit(<GovernancePage />);
  expectDocSections(labelsOf(GOVERNANCE_SECTION_ORDER, GOVERNANCE_SECTIONS));
});
