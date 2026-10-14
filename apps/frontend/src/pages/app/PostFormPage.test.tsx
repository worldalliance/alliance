import type { PostDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../../lib/AuthContext";
import { InviteSessionProvider } from "../../site/invite/InviteSession";
import { testAuthUser, testForumPosts } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import PostFormPage from "./PostFormPage";

let pendingCreate: Promise<void> | null = null;

/** Holds the create open until the returned callback runs. */
const deferCreate = (): (() => void) => {
  let land = () => {};
  pendingCreate = new Promise<void>((resolve) => {
    land = resolve;
  });
  return land;
};

const signedIn = authValue({ user: testAuthUser });

// happy-dom leaves `location` where it is on `history.pushState`.
declare const happyDOM: { setURL: (url: string) => void };
const setUrl = (url: string) => happyDOM.setURL(url);

const formUrl = "http://localhost/forum/edit/new";

afterEach(cleanup);

const savedPost = (title: string) =>
  ({
    ...testForumPosts[0],
    id: 7,
    title,
    editableContent: { body: "the body", attachments: [] },
  }) satisfies PostDto;

let findPost: () => Response | Promise<Response>;
let updatedBodies: unknown[] = [];

serveApi(
  routes({
    "GET /forum/posts/7": () => findPost(),
    "PATCH /forum/posts/7": async ({ request }) => {
      const body: { title: string } = await request.json();
      updatedBodies.push(body);
      return Response.json(savedPost(body.title));
    },
    "POST /forum/posts": async () => {
      if (pendingCreate) await pendingCreate;
      // react-router pushes the new URL before it re-renders, so the create
      // resolves with the page already renamed under the form.
      setUrl("http://localhost/forum/post/42");
      return Response.json({ id: 42 });
    },
  }),
);

beforeEach(() => {
  sessionStorage.clear();
  pendingCreate = null;
  setUrl(formUrl);
  findPost = () => Response.json(savedPost("Loaded title"));
  updatedBodies = [];
});

const draftStorageKey = `editablecontent:draft:v1:${formUrl}:post-new`;

const seedSavedDraft = () =>
  sessionStorage.setItem(
    draftStorageKey,
    JSON.stringify({
      dto: { body: "a draft worth keeping", attachments: [] },
      savedAt: new Date().toISOString(),
    }),
  );

const renderPostForm = (
  path: string,
  { client, wrapper } = queryWrapper(),
) => ({
  client,
  ...render(
    <AuthContext.Provider value={signedIn}>
      <MemoryRouter initialEntries={[path]}>
        <InviteSessionProvider>
          <Routes>
            <Route path="/forum/edit/:postId" element={<PostFormPage />} />
            <Route
              path="/forum/post/:id"
              element={<p>the published thread</p>}
            />
          </Routes>
        </InviteSessionProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
    { wrapper },
  ),
});

const renderNewThreadPage = () => renderPostForm("/forum/edit/new");

const renderEditPage = (query = queryWrapper()) => {
  setUrl("http://localhost/forum/edit/7");
  return renderPostForm("/forum/edit/7", query);
};

const titleInput = () =>
  screen.getByPlaceholderText<HTMLInputElement>("Enter title");

const schedulePicker = () =>
  document.querySelector<HTMLInputElement>("#schedulePostDate")!;

const publish = async () => {
  fireEvent.change(screen.getByPlaceholderText("Enter title"), {
    target: { value: "a title" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create Post" }));
  });
};

describe("PostFormPage", () => {
  it("drops the draft it published", async () => {
    seedSavedDraft();
    renderNewThreadPage();

    await publish();

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("drops the draft of a form that closed before the post landed", async () => {
    seedSavedDraft();
    const land = deferCreate();
    const { unmount } = renderNewThreadPage();

    await publish();
    unmount();
    await act(async () => land());

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("freezes the form while the create is in flight", async () => {
    seedSavedDraft();
    const land = deferCreate();
    renderNewThreadPage();

    await publish();

    expect(
      screen.getByPlaceholderText<HTMLInputElement>("Enter title").disabled,
    ).toBe(true);
    expect(
      screen.getByPlaceholderText<HTMLTextAreaElement>(
        "Write your post content here...",
      ).readOnly,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLInputElement>("Schedule post for later")
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" })
        .disabled,
    ).toBe(true);

    await act(async () => land());
  });

  it("freezes the schedule picker while the create is in flight", async () => {
    seedSavedDraft();
    const land = deferCreate();
    renderNewThreadPage();

    fireEvent.click(screen.getByLabelText("Schedule post for later"));
    // The box seeds the picker with now, which the submit then refuses as past.
    fireEvent.change(schedulePicker(), {
      target: { value: "2999-01-01T10:00" },
    });

    await publish();

    expect(schedulePicker().disabled).toBe(true);

    await act(async () => land());
  });

  it("fills the form with the post it edits", async () => {
    renderEditPage();

    expect(await screen.findByDisplayValue("Loaded title")).toBeDefined();
    expect(screen.getByDisplayValue("the body")).toBeDefined();
  });

  it("keeps the schedule of a post not yet visible", async () => {
    findPost = () =>
      Response.json({
        ...savedPost("Loaded title"),
        visibleAt: "2999-01-01T10:00:00.000Z",
      });

    renderEditPage();

    await screen.findByDisplayValue("Loaded title");
    expect(
      screen.getByLabelText<HTMLInputElement>("Schedule post for later")
        .checked,
    ).toBe(true);
  });

  it("waits for a reload before filling the form from a cached post, however fresh", async () => {
    const query = queryWrapper({ staleTime: Infinity });
    query.client.setQueryData(
      queryKeys.forumPost("7"),
      savedPost("Stale title"),
    );
    const reload = Promise.withResolvers<Response>();
    findPost = () => reload.promise;

    renderEditPage(query);

    expect(screen.getByText("Loading...")).toBeDefined();
    await act(async () => reload.resolve(Response.json(savedPost("Fresh"))));
    expect(await screen.findByDisplayValue("Fresh")).toBeDefined();
  });

  it("keeps edits across a reload that changes the post", async () => {
    const { client } = renderEditPage();
    await screen.findByDisplayValue("Loaded title");
    fireEvent.change(titleInput(), { target: { value: "My edit" } });

    findPost = () => Response.json(savedPost("Someone else's title"));
    await act(async () => {
      await client.refetchQueries();
      // The observer hands the reload to the page on a later tick.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(titleInput().value).toBe("My edit");
  });

  it("saves the edits and caches the saved post", async () => {
    const { client } = renderEditPage();
    await screen.findByDisplayValue("Loaded title");
    fireEvent.change(titleInput(), { target: { value: "My edit" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    });

    expect(await screen.findByText("the published thread")).toBeDefined();
    expect(updatedBodies).toMatchObject([{ title: "My edit" }]);
    expect(client.getQueryData(queryKeys.forumPost("7"))).toMatchObject({
      title: "My edit",
    });
  });

  it("says when the post is missing", async () => {
    findPost = () => Response.json({}, { status: 404 });

    renderEditPage();

    await screen.findByRole("heading", { name: "We couldn’t find that page" });
  });

  it("says when the server fails to load the post", async () => {
    findPost = () => Response.json({}, { status: 500 });

    renderEditPage();

    expect(
      await screen.findByText("Failed to load required data"),
    ).toBeDefined();
  });

  it("says when the post fails to load", async () => {
    findPost = () => Promise.reject(new TypeError("offline"));

    renderEditPage();

    await waitFor(() =>
      expect(screen.getByText("Failed to load required data")).toBeDefined(),
    );
  });
});
