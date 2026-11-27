import type { CreateTagDto } from "@alliance/shared/client";
import { makeProfile, makeTag } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import TagsPage from "./TagsPage";

afterEach(cleanup);

const tag = makeTag({
  name: "Volunteers",
  description: "People who volunteer",
  publicDisplayName: "Helpers",
  users: [{ ...makeProfile(7), displayName: "Sam" }],
});
const other = makeTag({ id: "tag-2", name: "Captains" });

let listed = [tag, other];
let listStatus = 200;
let deleteStatus = 200;
let updateStatus = 200;
let creates: CreateTagDto[] = [];
let updates: CreateTagDto[] = [];
let deletes: string[] = [];
let updateHeld: Promise<void> = Promise.resolve();

serveApi(
  routes({
    "GET /user/tags": () =>
      listStatus === 200
        ? Response.json(listed)
        : Response.json({ message: "Admins only" }, { status: listStatus }),
    "POST /user/createTag": async ({ request }) => {
      creates.push(await request.json());
      return Response.json(tag);
    },
    "POST /user/tags/:tagId/update": async ({ request }) => {
      await updateHeld;
      if (updateStatus !== 200)
        return Response.json(
          { message: "That name is taken" },
          { status: updateStatus },
        );
      updates.push(await request.json());
      return Response.json(tag);
    },
    "DELETE /user/tags/:tagId": ({ params }) => {
      if (deleteStatus !== 200)
        return Response.json(
          { message: "A reminder uses this tag" },
          { status: deleteStatus },
        );
      deletes.push(String(params.tagId));
      listed = listed.filter((candidate) => candidate.id !== params.tagId);
      return Response.json({});
    },
  }),
);

afterEach(() => {
  listed = [tag, other];
  listStatus = 200;
  deleteStatus = 200;
  updateStatus = 200;
  creates = [];
  updates = [];
  deletes = [];
  updateHeld = Promise.resolve();
});

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [{ path: "/members/tags", element: <TagsPage /> }],
      },
    ],
    { initialEntries: ["/members/tags"] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    queryWrapper(),
  );
};

const openNewTag = async () => {
  await screen.findByRole("heading", { name: "Volunteers" });
  fireEvent.click(screen.getAllByRole("button", { name: "New tag…" })[0]);
  return within(await screen.findByRole("dialog"));
};

it("creates a tag without a public display name", async () => {
  renderPage();
  const dialog = await openNewTag();
  await waitFor(() =>
    expect(document.activeElement).toBe(dialog.getByLabelText("Name")),
  );

  fireEvent.change(dialog.getByLabelText("Name"), {
    target: { value: "Organizers" },
  });
  fireEvent.change(dialog.getByLabelText("Description"), {
    target: { value: "People who organize" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create tag" }));

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

it("asks for a name and a description before creating a tag", async () => {
  renderPage();
  const dialog = await openNewTag();

  fireEvent.click(dialog.getByRole("button", { name: "Create tag" }));

  expect(await dialog.findByText("Enter a name")).toBeTruthy();
  expect(dialog.getByText("Enter a description")).toBeTruthy();
  expect(creates).toEqual([]);
});

it("refuses a name another tag has", async () => {
  renderPage();
  const dialog = await openNewTag();

  fireEvent.change(dialog.getByLabelText("Name"), {
    target: { value: "Captains" },
  });
  fireEvent.change(dialog.getByLabelText("Description"), {
    target: { value: "Again" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create tag" }));

  expect(await dialog.findByText("Enter a name no other tag has")).toBeTruthy();
  expect(creates).toEqual([]);
});

it("clears a tag's public display name when the field is emptied", async () => {
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Volunteers" }),
  );
  expect(document.activeElement).toBe(screen.getByDisplayValue("Volunteers"));
  fireEvent.change(screen.getByDisplayValue("Helpers"), {
    target: { value: "  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() =>
    expect(updates).toEqual([
      {
        name: "Volunteers",
        description: "People who volunteer",
        publicDisplayName: null,
      },
    ]),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(),
  );
});

it("keeps a card open with what was typed while its save ran", async () => {
  let release = () => {};
  updateHeld = new Promise((resolve) => {
    release = resolve;
  });
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Volunteers" }),
  );
  fireEvent.change(screen.getByDisplayValue("Helpers"), {
    target: { value: "Crew" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .getAttribute("aria-busy"),
    ).toBe("true"),
  );
  fireEvent.change(screen.getByDisplayValue("People who volunteer"), {
    target: { value: "Typed during save" },
  });
  release();

  await waitFor(() =>
    expect(updates).toEqual([
      {
        name: "Volunteers",
        description: "People who volunteer",
        publicDisplayName: "Crew",
      },
    ]),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .getAttribute("aria-busy"),
    ).not.toBe("true"),
  );
  expect(screen.getByDisplayValue("Typed during save")).toBeTruthy();
});

it("keeps the fields and says why when a save is refused", async () => {
  updateStatus = 400;
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Volunteers" }),
  );
  fireEvent.change(screen.getByDisplayValue("Helpers"), {
    target: { value: "Crew" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findAllByText("That name is taken")).toHaveLength(1);
  expect(screen.getByDisplayValue("Crew")).toBeTruthy();
});

it("lists tags by name with who has each", async () => {
  renderPage();

  await screen.findByRole("heading", { name: "Volunteers" });
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
  ).toEqual(["Captains", "Volunteers"]);
  expect(screen.getByText("Public name: Helpers")).toBeTruthy();
  expect(screen.getByText("No members")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "1 member: Volunteers" }));
  expect(screen.getByRole("link", { name: "Sam" }).getAttribute("href")).toBe(
    "/members/7",
  );
});

it("deletes a tag only after the confirmation says who loses it", async () => {
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Delete: Volunteers" }),
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(
    dialog.getByText(
      "It comes off the 1 member who has it. Task audiences and form checks that use it will treat every member as not having it. This can't be undone.",
    ),
  ).toBeTruthy();
  expect(deletes).toEqual([]);
  fireEvent.click(dialog.getByRole("button", { name: "Delete tag" }));

  await waitFor(() => expect(deletes).toEqual(["tag-1"]));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { level: 2, name: "Volunteers" }),
    ).toBeNull(),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Edit: Captains" }),
    ),
  );
});

it("says once why a tag couldn't be deleted and keeps it", async () => {
  deleteStatus = 409;
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Delete: Volunteers" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete tag",
    }),
  );

  expect(await screen.findAllByText("A reminder uses this tag")).toHaveLength(
    1,
  );
  expect(screen.getByRole("heading", { name: "Volunteers" })).toBeTruthy();
});

it("says tags are loading, then why they couldn't load", async () => {
  listStatus = 403;
  renderPage();

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("No tags yet")).toBeNull();
  expect(screen.queryByText("Couldn't load tags")).toBeNull();

  expect(await screen.findByText("Couldn't load tags")).toBeTruthy();
  expect(screen.getByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("No tags yet")).toBeNull();
});
