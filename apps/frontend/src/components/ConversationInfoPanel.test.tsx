import { ConversationDto, ParticipantRole } from "@alliance/shared/client";
import { isConversationAdmin } from "@alliance/shared/lib/messages";
import {
  makeConversation,
  makeParticipant,
} from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ConversationInfoPanel from "./ConversationInfoPanel";

afterEach(cleanup);

const panel = (convo: ConversationDto) => (
  <MemoryRouter>
    <AuthContext.Provider value={authValue({ user: testAuthUser })}>
      <ConversationInfoPanel
        selectedConvo={convo}
        isAdmin={isConversationAdmin(convo, testAuthUser.id)}
        handleConversationUpdated={() => {}}
        friends={[]}
        onLeave={() => {}}
        onClose={() => {}}
      />
    </AuthContext.Provider>
  </MemoryRouter>
);

const renderPanel = (viewerRole: ParticipantRole) => {
  const convo = makeConversation([
    makeParticipant(testAuthUser.id, viewerRole),
    makeParticipant(testAuthUser.id + 1, "owner"),
  ]);
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
