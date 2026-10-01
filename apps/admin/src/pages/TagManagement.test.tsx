import type { CreateTagDto, TagDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import TagManagement from "./TagManagement";

afterEach(cleanup);

const tag: TagDto = {
  id: "tag-1",
  name: "Volunteers",
  description: "People who volunteer",
  publicDisplayName: "Helpers",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  users: [],
};

let creates: CreateTagDto[] = [];
let updates: CreateTagDto[] = [];

serveApi(
  routes({
    "GET /user/tags": () => Response.json([tag]),
    "POST /user/createTag": async ({ request }) => {
      creates.push(await request.json());
      return Response.json(tag);
    },
    "POST /user/tags/:tagId/update": async ({ request }) => {
      updates.push(await request.json());
      return Response.json(tag);
    },
  }),
);

beforeEach(() => {
  creates = [];
  updates = [];
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <TagManagement />
    </MemoryRouter>,
    queryWrapper(),
  );

it("creates a tag without a public display name", async () => {
  renderPage();

  fireEvent.change(screen.getByLabelText("Tag name"), {
    target: { value: "Organizers" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "People who organize" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create tag" }));

  await waitFor(() =>
    expect(creates).toEqual([
      {
        name: "Organizers",
        description: "People who organize",
        publicDisplayName: null,
      },
    ]),
  );
});

it("clears a tag's public display name when the field is emptied", async () => {
  renderPage();

  fireEvent.click(await screen.findByText("Edit"));
  fireEvent.change(screen.getByDisplayValue("Helpers"), {
    target: { value: "  " },
  });
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() =>
    expect(updates).toEqual([
      {
        name: "Volunteers",
        description: "People who volunteer",
        publicDisplayName: null,
      },
    ]),
  );
});
