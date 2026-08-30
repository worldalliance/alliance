import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

let pendingCreate: Promise<void> | null = null;

/** Holds the create open until the returned callback runs. */
const deferCreate = (): (() => void) => {
  let land = () => {};
  pendingCreate = new Promise<void>((resolve) => {
    land = resolve;
  });
  return land;
};

// react-router pushes the new URL before it re-renders, so the create resolves
// with the page already renamed under the form.
const forumCreatePost = jest.fn(async () => {
  if (pendingCreate) await pendingCreate;
  setUrl("http://localhost/forum/post/42");
  return { data: { id: 42 } };
});

jest.mock("@alliance/shared/client", () => ({
  forumCreatePost,
  forumFindOnePost: async () => ({ data: undefined }),
  forumUpdatePost: async () => ({ data: undefined }),
  imagesUploadImage: async () => ({ data: { key: "key" } }),
}));

jest.mock("../../lib/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

import PostFormPage from "./PostFormPage";

// happy-dom leaves `location` where it is on `history.pushState`.
declare const happyDOM: { setURL: (url: string) => void };
const setUrl = (url: string) => happyDOM.setURL(url);

const formUrl = "http://localhost/forum/edit/new";

afterEach(cleanup);

beforeEach(() => {
  sessionStorage.clear();
  pendingCreate = null;
  setUrl(formUrl);
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

const renderNewThreadPage = () =>
  render(
    <MemoryRouter initialEntries={["/forum/edit/new"]}>
      <Routes>
        <Route path="/forum/edit/:postId" element={<PostFormPage />} />
        <Route path="/forum/post/:id" element={<p>the published thread</p>} />
      </Routes>
    </MemoryRouter>,
  );

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
});
