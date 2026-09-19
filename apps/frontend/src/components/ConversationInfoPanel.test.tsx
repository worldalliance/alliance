import { CONVERSATION_TITLE_MAX_LENGTH } from "@alliance/common/conversation";
import {
  ConversationDto,
  ConversationType,
  ParticipantRole,
} from "@alliance/shared/client";
import {
  makeConversation,
  makeParticipant,
  makeProfile,
} from "@alliance/shared/lib/testFixtures";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ConversationInfoPanel, {
  ConversationInfoPanelProps,
} from "./ConversationInfoPanel";

afterEach(cleanup);

let updateResponse: () => Response;
let leaveResponse: () => Response | Promise<Response>;
let addResponse: () => Response;
let removeResponse: () => Response;
let memberChangesSent: number;
let savesSent: number;
beforeEach(() => {
  updateResponse = () => new Response(null, { status: 500 });
  leaveResponse = () =>
    Response.json(
      { message: "You are not part of this conversation.", statusCode: 403 },
      { status: 403 },
    );
  addResponse = () => new Response(null, { status: 500 });
  removeResponse = () => new Response(null, { status: 500 });
  memberChangesSent = 0;
  savesSent = 0;
});
serveApi(
  routes({
    "POST /messaging/conversations/:conversationId/update": () => {
      savesSent++;
      return updateResponse();
    },
    "POST /messaging/conversations/:conversationId/leave": () => {
      memberChangesSent++;
      return leaveResponse();
    },
    "POST /messaging/conversations/:conversationId/participants": () => {
      memberChangesSent++;
      return addResponse();
    },
    "DELETE /messaging/conversations/:conversationId/participants/:userId":
      () => {
        memberChangesSent++;
        return removeResponse();
      },
  }),
);

const panel = (
  convo: ConversationDto,
  props: Partial<ConversationInfoPanelProps> = {},
) => (
  <MemoryRouter>
    <AuthContext.Provider value={authValue({ user: testAuthUser })}>
      <ConversationInfoPanel
        selectedConvo={convo}
        handleConversationUpdated={() => {}}
        friends={[]}
        onLeave={() => {}}
        onClose={() => {}}
        {...props}
      />
    </AuthContext.Provider>
  </MemoryRouter>
);

const groupWith = (
  viewerRole: ParticipantRole,
  type: ConversationType = "multiple",
) =>
  makeConversation(
    [
      makeParticipant(testAuthUser.id, viewerRole),
      makeParticipant(testAuthUser.id + 1, "owner"),
    ],
    type,
  );

const renderPanel = (
  viewerRole: ParticipantRole,
  type: ConversationType = "multiple",
) => {
  const convo = groupWith(viewerRole, type);
  return { convo, ...render(panel(convo)) };
};

it("offers a group admin the editor for the name and photo", () => {
  renderPanel("admin");

  expect(screen.getByRole("button", { name: "Edit group" })).toBeTruthy();
});

it("keeps the editor from a group member who is not an admin", () => {
  renderPanel("member");

  expect(screen.queryByRole("button", { name: "Edit group" })).toBeNull();
});

it("starts the editor from the group's current name and photo", () => {
  const { convo, rerender } = renderPanel("admin");
  rerender(
    panel({
      ...convo,
      title: "Renamed elsewhere",
      photo: "https://example.com/new.png",
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));

  expect(screen.getByDisplayValue("Renamed elsewhere")).toBeTruthy();
  expect(screen.getByAltText("Profile preview").getAttribute("src")).toBe(
    "https://example.com/new.png",
  );
});

it("stops the group name at the server's limit", () => {
  const { convo } = renderPanel("admin");

  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));

  expect(screen.getByDisplayValue(convo.title).getAttribute("maxLength")).toBe(
    String(CONVERSATION_TITLE_MAX_LENGTH),
  );
  expect(
    screen.getByText(`Maximum ${CONVERSATION_TITLE_MAX_LENGTH} characters`),
  ).toBeTruthy();
});

it("closes the editor when the viewer stops being an admin", () => {
  const { convo, rerender } = renderPanel("admin");
  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));

  rerender(
    panel({
      ...convo,
      participants: convo.participants.map((participant) =>
        participant.user.id === testAuthUser.id
          ? { ...participant, role: "member" }
          : participant,
      ),
    }),
  );

  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

it("offers a group admin the field to add members", () => {
  renderPanel("admin");

  expect(screen.getByPlaceholderText("Add member...")).toBeTruthy();
});

it("keeps the field to add members from a community chat admin", () => {
  renderPanel("admin", "community");

  expect(screen.queryByPlaceholderText("Add member...")).toBeNull();
});

it("offers a group admin a labeled button to remove a member", () => {
  renderPanel("admin");

  const name = `User ${testAuthUser.id + 1}`;
  const remove = screen.getByRole("button", { name: `Remove ${name}` });
  const profile = screen.getByRole("link", { name });

  expect(profile.getAttribute("href")).toBe(`/member/${testAuthUser.id + 1}`);
  expect(remove.closest("a")).toBeNull();
});

it("keeps the remove buttons from a community chat admin", () => {
  renderPanel("admin", "community");

  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
});

it.each([
  {
    status: 403,
    body: { message: "Only admins can rename the group.", statusCode: 403 },
    shown: "Couldn't save the group. Only admins can rename the group.",
  },
  {
    status: 401,
    body: { message: "Unauthorized", statusCode: 401 },
    shown:
      "Couldn't save the group. Your session has expired. Sign in again to save the group.",
  },
  {
    status: 500,
    body: { message: "Internal server error", statusCode: 500 },
    shown: "Couldn't save the group. Please try again.",
  },
])(
  "says why a save answered $status failed",
  async ({ status, body, shown }) => {
    updateResponse = () => Response.json(body, { status });
    renderPanel("admin");

    fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(shown)).toBeTruthy();
  },
);

it("says a save that never reached the server failed", async () => {
  updateResponse = () => {
    throw new TypeError("Failed to fetch");
  };
  renderPanel("admin");

  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(
    await screen.findByText("Couldn't save the group. Please try again."),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Save" }).hasAttribute("disabled"),
  ).toBe(false);
});

it("sends one save for two clicks that land before the re-render", async () => {
  renderPanel("admin");
  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
  const saveButton = screen.getByRole("button", { name: "Save" });

  act(() => {
    saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    saveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(
    await screen.findByText("Couldn't save the group. Please try again."),
  ).toBeTruthy();
  expect(savesSent).toBe(1);
});

it("says why leaving the group failed", async () => {
  renderPanel("member");

  fireEvent.click(screen.getByRole("button", { name: "Leave group" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't leave the group. You are not part of this conversation.",
  );
});

it("drops the last failure once the next change is out", async () => {
  renderPanel("admin");
  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Couldn't save the group. Please try again.");
  const leaves: Pending<Response>[] = [];
  leaveResponse = () => pending(leaves);

  fireEvent.click(screen.getByRole("button", { name: "Leave group" }));

  await waitFor(() => expect(leaves.length).toBe(1));
  expect(screen.queryByRole("alert")).toBeNull();
  leaves[0].resolve(new Response(null, { status: 500 }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Couldn't leave the group. Please try again.",
  );
});

it("sends one leave when Leave group is clicked twice", async () => {
  renderPanel("member");
  const leave = screen.getByRole("button", { name: "Leave group" });

  fireEvent.click(leave);
  expect(leave.hasAttribute("disabled")).toBe(true);
  fireEvent.click(leave);

  expect(await screen.findByText(/^Couldn't leave the group/)).toBeTruthy();
  expect(memberChangesSent).toBe(1);
});

it("tells the page the viewer left once leaving works", async () => {
  const convo = groupWith("member");
  leaveResponse = () => Response.json(convo);
  const left = jest.fn();
  render(panel(convo, { onLeave: left }));

  fireEvent.click(screen.getByRole("button", { name: "Leave group" }));

  await waitFor(() => expect(left).toHaveBeenCalled());
});

it("sends one removal when a member's X is clicked twice", async () => {
  renderPanel("admin");
  const remove = screen.getByRole("button", {
    name: `Remove User ${testAuthUser.id + 1}`,
  });

  fireEvent.click(remove);
  expect(remove.hasAttribute("disabled")).toBe(true);
  fireEvent.click(remove);

  expect(await screen.findByText(/^Couldn't remove that member/)).toBeTruthy();
  expect(memberChangesSent).toBe(1);
});

it("passes on the group the server returns after a removal", async () => {
  const convo = groupWith("admin");
  const withoutTheOwner = {
    ...convo,
    participants: convo.participants.slice(0, 1),
  };
  removeResponse = () => Response.json(withoutTheOwner);
  const updated = jest.fn();
  render(panel(convo, { handleConversationUpdated: updated }));
  const remove = screen.getByRole("button", {
    name: `Remove User ${testAuthUser.id + 1}`,
  });

  fireEvent.click(remove);

  await waitFor(() => expect(updated).toHaveBeenCalledWith(withoutTheOwner));
});

it("sends one add when a search result is clicked twice", async () => {
  const friend = makeProfile(testAuthUser.id + 2);
  render(panel(groupWith("admin"), { friends: [friend] }));
  fireEvent.change(screen.getByPlaceholderText("Add member..."), {
    target: { value: friend.displayName },
  });
  const result = screen.getByText(friend.displayName);

  fireEvent.click(result);
  fireEvent.click(result);

  expect(await screen.findByText(/^Couldn't add that member/)).toBeTruthy();
  expect(memberChangesSent).toBe(1);
});

it("passes on the group the server returns after an add, and clears the search", async () => {
  const friend = makeProfile(testAuthUser.id + 2);
  const convo = groupWith("admin");
  const withTheFriend = {
    ...convo,
    participants: [...convo.participants, makeParticipant(friend.id, "member")],
  };
  addResponse = () => Response.json(withTheFriend);
  const updated = jest.fn();
  render(
    panel(convo, { friends: [friend], handleConversationUpdated: updated }),
  );
  const search = screen.getByPlaceholderText("Add member...");
  fireEvent.change(search, { target: { value: friend.displayName } });

  fireEvent.click(screen.getByText(friend.displayName));

  await waitFor(() => expect(updated).toHaveBeenCalledWith(withTheFriend));
  expect(search.getAttribute("value")).toBe("");
});

it("keeps the leave button from a community chat member", () => {
  renderPanel("member", "community");

  expect(screen.queryByRole("button", { name: "Leave group" })).toBeNull();
});
