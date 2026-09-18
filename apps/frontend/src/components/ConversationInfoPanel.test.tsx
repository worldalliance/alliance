import {
  ConversationDto,
  ConversationType,
  ParticipantRole,
} from "@alliance/shared/client";
import {
  makeConversation,
  makeParticipant,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ConversationInfoPanel from "./ConversationInfoPanel";

afterEach(cleanup);

let updateResponse: () => Response;
beforeEach(() => {
  updateResponse = () => new Response(null, { status: 500 });
});
serveApi(
  routes({
    "POST /messaging/conversations/:conversationId/update": () =>
      updateResponse(),
  }),
);

const panel = (convo: ConversationDto) => (
  <MemoryRouter>
    <AuthContext.Provider value={authValue({ user: testAuthUser })}>
      <ConversationInfoPanel
        selectedConvo={convo}
        handleConversationUpdated={() => {}}
        friends={[]}
        onLeave={() => {}}
        onClose={() => {}}
      />
    </AuthContext.Provider>
  </MemoryRouter>
);

const renderPanel = (
  viewerRole: ParticipantRole,
  type: ConversationType = "multiple",
) => {
  const convo = makeConversation(
    [
      makeParticipant(testAuthUser.id, viewerRole),
      makeParticipant(testAuthUser.id + 1, "owner"),
    ],
    type,
  );
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
