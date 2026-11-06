import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { GOVERNANCE_SECTION_ORDER, GOVERNANCE_SECTIONS } from "./docContent";
import { GovernanceBody } from "./GovernanceBody";

serveApi(
  routes({
    "GET /contract/current": () =>
      Response.json({ id: 1, markdown: "Terms", description: [] }),
  }),
);

test("keeps membership, then the contract, then office and oversight", () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <GovernanceBody />
    </MemoryRouter>,
    { wrapper },
  );

  expect(
    screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(
    GOVERNANCE_SECTION_ORDER.map((kind) => GOVERNANCE_SECTIONS[kind].label),
  );
  expect(
    screen
      .getByText(
        "This membership contract may be revised with signed members' consent. Additional membership contracts can be offered at the office's discretion.",
      )
      .compareDocumentPosition(
        screen.getByRole("heading", { name: "Strategic office" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
});
