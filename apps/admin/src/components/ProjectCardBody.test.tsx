import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { buildProjectCard } from "../lib/projectCards";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ProjectCardBody, { ProjectCounts } from "./ProjectCardBody";

const project = { id: 1, name: "Clean air", slug: "clean-air", category: [] };

it("counts the steps in status pills, blue only for live ones", () => {
  const step = (id: number, status: "member_action" | "completed" | "failed") =>
    adminActionListItem(id, `Step ${id}`, { status, project });
  render(
    <ProjectCounts
      card={buildProjectCard({
        project,
        actions: [
          step(1, "member_action"),
          step(2, "completed"),
          step(3, "failed"),
        ],
        now: new Date(),
      })}
    />,
  );
  expect(screen.getByText("1 live").className).toContain("bg-blue-100");
  expect(screen.getByText("2 done").className).toContain("bg-zinc-100");
});

it.each([true, false])(
  "names each step's status once, detailed %p",
  (detailed) => {
    render(
      <MemoryRouter>
        <ProjectCardBody
          card={buildProjectCard({
            project,
            actions: [
              adminActionListItem(1, "Rally", { status: "failed", project }),
            ],
            now: new Date(),
          })}
          participantsById={new Map()}
          detailed={detailed}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Failed")).toHaveLength(1);
  },
);

it("names the status of an open detailed step beside its phase", () => {
  render(
    <MemoryRouter>
      <ProjectCardBody
        card={buildProjectCard({
          project,
          actions: [
            adminActionListItem(1, "Letter", {
              status: "office_action",
              project,
            }),
          ],
          now: new Date(),
        })}
        participantsById={new Map()}
        detailed
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Draft")).toBeTruthy();
  expect(screen.getByText("Office action")).toBeTruthy();
});
