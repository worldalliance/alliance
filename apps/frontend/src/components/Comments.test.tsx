import { CommentDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as AppMarkdownWrapperModule from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import * as UserDisplayNameModule from "@alliance/sharedweb/ui/UserDisplayName";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router";

let loadAttempts = 0;
let loadSucceeds = false;
let loadedThread: CommentDto[] = [];
// While set, a load parks its resolver here instead of answering, so a test can
// read the row while the request is out.
let inFlight: (() => void)[] | null = null;

// Auto-cleanup registers once, in whichever file imports the library first, so
// a file that renders has to ask for its own.
afterEach(cleanup);

afterEach(() => {
  loadAttempts = 0;
  loadSucceeds = false;
  loadedThread = [];
  inFlight = null;
});

let markdownParses = 0;
let commentRenders = 0;

serveApi(
  routes({
    "GET /forum/posts/:id/comments": async () => {
      loadAttempts++;
      if (inFlight)
        await new Promise<void>((resolve) => inFlight?.push(resolve));
      return loadSucceeds
        ? Response.json(loadedThread)
        : Response.json({ statusCode: 500, message: "no" }, { status: 500 });
    },
  }),
);

beforeEach(() => {
  markdownParses = 0;
  commentRenders = 0;
  jest
    .spyOn(AppMarkdownWrapperModule, "default")
    .mockImplementation(({ markdownContent }) => {
      markdownParses++;
      return <div>{markdownContent}</div>;
    });
  jest
    .spyOn(UserDisplayNameModule, "default")
    .mockImplementation(({ children }) => {
      commentRenders++;
      return <span>{children}</span>;
    });
});

import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import Comments from "./Comments";

const noop = () => Promise.resolve();

const loggedOut: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: noop,
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
};

const withProviders = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <AuthContext.Provider value={loggedOut}>{ui}</AuthContext.Provider>
    </MemoryRouter>
  </QueryClientProvider>
);

const author: CommentDto["author"] = {
  id: 1,
  displayName: "Jane Smith",
  profilePicture: "",
  admin: false,
  staff: false,
  ambassador: false,
  profileDescription: null,
  hasActiveContract: true,
  isCommunityLeader: false,
  anonymous: false,
};

const comments: CommentDto[] = [1, 2, 3].map((id) => ({
  id,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  tagId: null,
  author,
  children: [],
  likes: [],
  likesCount: 0,
  editableContent: { body: `comment ${id}`, attachments: [] },
}));

let rerenderParent = () => {};

const Parent = () => {
  const [count, setCount] = useState(0);
  rerenderParent = () => setCount((current) => current + 1);
  return (
    <div>
      <span>count {count}</span>
      <Comments objectId={1} type="post" initialComments={comments} />
    </div>
  );
};

it("leaves the comment tree alone when something above it renders", async () => {
  render(withProviders(<Parent />));
  await screen.findByText("comment 1");

  const parsesOnMount = markdownParses;
  const rendersOnMount = commentRenders;
  expect(parsesOnMount).toBe(comments.length);

  act(() => rerenderParent());
  await screen.findByText("count 1");

  expect(markdownParses).toBe(parsesOnMount);
  expect(commentRenders).toBe(rendersOnMount);
});

it("loads the thread again when the reader asks", async () => {
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("Failed to load comments");
  expect(loadAttempts).toBe(1);

  loadSucceeds = true;
  await userEvent.click(
    screen.getByRole("button", { name: "Try loading the comments again" }),
  );

  expect(loadAttempts).toBe(2);
  await waitFor(() =>
    expect(screen.queryByText("Failed to load comments")).toBeNull(),
  );
});

it("keeps the retry button under the reader while the load is out", async () => {
  const { container } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  inFlight = [];
  await userEvent.click(retry);

  expect(document.activeElement).toBe(retry);
  expect(retry.getAttribute("aria-busy")).toBe("true");
  expect(within(container).getByRole("status").textContent).toBe(
    "Loading comments",
  );

  await userEvent.click(retry);
  expect(loadAttempts).toBe(3);

  await act(async () => {
    inFlight?.forEach((resolve) => resolve());
  });
  await waitFor(() => expect(retry.getAttribute("aria-busy")).toBe("false"));
  expect(within(container).getByRole("status").textContent).toBe(
    "Loading comments failed",
  );
});

it("says nothing about a load the reader never asked for", async () => {
  const { container } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");

  expect(within(container).getByRole("status").textContent).toBe("");
});

it("tells a reader it left where they were how the load ended", async () => {
  const { container } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");
  const status = within(container).getByRole("status");

  loadSucceeds = true;
  // A press the control never held focus for moves nobody, so the line is all
  // this reader gets.
  fireEvent.click(
    screen.getByRole("button", { name: "Try loading the comments again" }),
  );

  await waitFor(() => expect(status.textContent).toBe("Comments loaded"));
  // The region the reader listens to has to be the one that was already there,
  // since a live region announces a change rather than its arrival.
  expect(within(container).getByRole("status")).toBe(status);
});

it("says nothing over the landing it just made", async () => {
  const { container } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");
  const status = within(container).getByRole("status");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  await userEvent.click(retry);
  await screen.findByText("comment 1");
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments" }),
  );

  // The words are held back by the spin, so they would arrive after the move
  // and talk over it.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });
  expect(status.textContent).toBe("");
});

it("puts the reader on the thread their retry loaded", async () => {
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  await userEvent.click(retry);
  await screen.findByText("comment 1");

  expect(document.activeElement).not.toBe(document.body);
  expect(document.activeElement?.textContent).toContain("comment 1");
});

it("leaves focus alone for a press that was never on the control", async () => {
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("Failed to load comments");

  loadSucceeds = true;
  loadedThread = comments;
  // Safari and Firefox leave the button a mouse press hit unfocused, so the
  // press answers for a reader who is still wherever they were.
  fireEvent.click(
    screen.getByRole("button", { name: "Try loading the comments again" }),
  );
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(document.body);
  // The name goes up with the load, since it has to be there for a move that
  // turns out not to happen, and comes back down once nobody has landed.
  expect(screen.queryByRole("group", { name: "Comments" })).toBeNull();
});

it("leaves focus alone once the retry the reader asked for has failed", async () => {
  const { rerender } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  // The second press fails too, leaving the same words in the row.
  await userEvent.click(retry);
  await waitFor(() => expect(loadAttempts).toBe(2));
  // The reader gives up and moves on.
  retry.blur();

  // A thread the caller hands down answers no press of theirs.
  rerender(
    withProviders(
      <Comments objectId={1} type="post" initialComments={comments} />,
    ),
  );
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(document.body);
});

it("leaves focus alone for a load the reader never asked for", async () => {
  loadSucceeds = true;
  loadedThread = comments;
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(document.body);
});

it("keeps focus where the reader moved it during the load", async () => {
  render(
    withProviders(
      <>
        <button type="button">somewhere else</button>
        <Comments objectId={1} type="post" />
      </>,
    ),
  );
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  inFlight = [];
  await userEvent.click(retry);
  const elsewhere = screen.getByRole("button", { name: "somewhere else" });
  elsewhere.focus();
  await act(async () => {
    inFlight?.forEach((resolve) => resolve());
    inFlight = null;
  });
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(elsewhere);
  expect(screen.queryByRole("group", { name: "Comments" })).toBeNull();
});

it("keeps focus on the body the reader clicked onto during the load", async () => {
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  inFlight = [];
  await userEvent.click(retry);
  // Clicking onto plain page text takes focus off the control and leaves it on
  // the body, which is where the control coming out would have left it too.
  retry.blur();
  await act(async () => {
    inFlight?.forEach((resolve) => resolve());
    inFlight = null;
  });
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(document.body);
  expect(screen.queryByRole("group", { name: "Comments" })).toBeNull();
});

it("lands on the named thread when the retry comes back empty", async () => {
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  await userEvent.click(retry);
  await waitFor(() =>
    expect(screen.queryByText("Failed to load comments")).toBeNull(),
  );

  // Arriving is all that answers the press, so an empty thread has to say so.
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments, none yet" }),
  );
});

it("names no thread for a reader who pressed nothing", async () => {
  loadSucceeds = true;
  loadedThread = comments;
  render(withProviders(<Comments objectId={1} type="post" />));
  await screen.findByText("comment 1");

  expect(screen.queryByRole("group", { name: "Comments" })).toBeNull();
});

it("puts the reader on the thread a hand-down landed over their press", async () => {
  const { rerender } = render(
    withProviders(<Comments objectId={1} type="post" />),
  );
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  inFlight = [];
  await userEvent.click(retry);

  // The feed hands its card down while the press is still out, which takes the
  // row the control sits in away and leaves the reader on the body.
  rerender(
    withProviders(
      <Comments objectId={1} type="post" initialComments={comments} />,
    ),
  );
  await screen.findByText("comment 1");

  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments" }),
  );

  await act(async () => {
    inFlight?.forEach((resolve) => resolve());
    inFlight = null;
  });

  expect(screen.queryByText("Failed to load comments")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments" }),
  );
});

it("takes the thread's name back down once the reader moves off it", async () => {
  render(
    withProviders(
      <>
        <button type="button">somewhere else</button>
        <Comments objectId={1} type="post" />
      </>,
    ),
  );
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  await userEvent.click(retry);
  await screen.findByText("comment 1");
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments" }),
  );

  // A feed carries one of these under every card, so the name outliving the
  // reader standing on it is a stop no press of theirs opened.
  act(() => screen.getByRole("button", { name: "somewhere else" }).focus());
  expect(screen.queryByRole("group", { name: "Comments" })).toBeNull();
});

it("says a filter emptied the thread it landed the reader on", async () => {
  const tags = [{ id: 9, name: "Ideas", sortOrder: 0 }];
  const { rerender } = render(
    withProviders(
      <Comments
        objectId={1}
        type="post"
        initialComments={comments}
        tags={tags}
      />,
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Ideas (0)" }));

  // Taking the hand-down away sends the card back to a load of its own, which
  // fails with the filter the reader set still on.
  rerender(withProviders(<Comments objectId={1} type="post" tags={tags} />));
  await screen.findByText("Failed to load comments");
  const retry = screen.getByRole("button", {
    name: "Try loading the comments again",
  });
  retry.focus();

  loadSucceeds = true;
  loadedThread = comments;
  await userEvent.click(retry);
  await waitFor(() =>
    expect(screen.queryByText("Failed to load comments")).toBeNull(),
  );

  // A thread the reader's own filter is holding back has not come back empty.
  expect(document.activeElement).toBe(
    screen.getByRole("group", { name: "Comments, none match the filter" }),
  );
});
