import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  api,
  pickMenuItem,
  renderPage,
  serveWaitlistApi,
} from "./WaitlistPage.testHarness";

serveWaitlistApi();

const openComposer = async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Compose email" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: /Use template/ })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
};

const field = (label: string) => screen.getByLabelText(label);

it("starts from a template and updates it with the edited draft", async () => {
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  expect(field("Subject")).toHaveProperty("value", "You're invited, #{name}");
  expect(field("Body")).toHaveProperty("value", "Join: #{signupLink}");
  expect(screen.queryByRole("button", { name: /^Update/ })).toBeNull();

  fireEvent.change(field("Body"), {
    target: { value: "Sign up: #{signupLink}" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Update template Invitation" }),
  );
  expect(api.posts).toEqual([]);
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/email-templates/8",
        body: {
          name: "Invitation",
          subject: "You're invited, #{name}",
          body: "Sign up: #{signupLink}",
        },
      },
    ]),
  );
  expect(await screen.findByText("Updated template “Invitation”")).toBeTruthy();
});

it("asks before a template replaces what staff wrote", async () => {
  await openComposer();
  fireEvent.change(field("Subject"), { target: { value: "Draft" } });
  await pickMenuItem("Use template", "Invitation");
  expect(
    await screen.findByText("Replaces the subject and body you have written."),
  ).toBeTruthy();
  expect(field("Subject")).toHaveProperty("value", "Draft");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(field("Subject")).toHaveProperty("value", "You're invited, #{name}");
});

it("switches templates without asking while the draft is unedited", async () => {
  api.templatesServed = [
    ...api.templatesServed,
    {
      id: 10,
      name: "Reminder",
      subject: "Still there?",
      body: "Reply",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ];
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  await pickMenuItem("Template: Invitation", "Reminder");
  expect(field("Subject")).toHaveProperty("value", "Still there?");
  expect(screen.queryByText(/Replaces the subject and body/)).toBeNull();
});

it("loads a template over a cleared draft without asking", async () => {
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  fireEvent.change(field("Subject"), { target: { value: "" } });
  fireEvent.change(field("Body"), { target: { value: " " } });
  await pickMenuItem("Template: Invitation", "Invitation");
  expect(field("Subject")).toHaveProperty("value", "You're invited, #{name}");
  expect(screen.queryByText(/Replaces the subject and body/)).toBeNull();
});

it("won't save a blank draft or one with an unknown placeholder", async () => {
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  fireEvent.change(field("Body"), { target: { value: " " } });
  expect(
    screen
      .getByRole("button", { name: "Update template Invitation" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Save draft as template" })
      .hasAttribute("disabled"),
  ).toBe(true);

  fireEvent.change(field("Body"), { target: { value: "Hi #{nmae}" } });
  expect(
    screen
      .getByRole("button", { name: "Save draft as template" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("won't save from the name form once the draft goes blank", async () => {
  await openComposer();
  fireEvent.change(field("Subject"), { target: { value: "Followup" } });
  fireEvent.change(field("Body"), { target: { value: "Still waiting?" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save draft as template" }),
  );
  fireEvent.change(screen.getByLabelText("Template name"), {
    target: { value: "Nudge" },
  });
  fireEvent.change(field("Body"), { target: { value: " " } });
  expect(
    screen
      .getByRole("button", { name: "Save template" })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("offers Update for a body change, not for subject spacing", async () => {
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  fireEvent.change(field("Subject"), {
    target: { value: "You're invited, #{name} " },
  });
  expect(
    screen.queryByRole("button", { name: "Update template Invitation" }),
  ).toBeNull();
  fireEvent.change(field("Body"), {
    target: { value: "Join: #{signupLink} " },
  });
  expect(
    screen.getByRole("button", { name: "Update template Invitation" }),
  ).toBeTruthy();
});

it("keeps the name and says why when a save is refused", async () => {
  api.templateSaveStatus = 409;
  await openComposer();
  fireEvent.change(field("Subject"), { target: { value: "Followup" } });
  fireEvent.change(field("Body"), { target: { value: "Still waiting?" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save draft as template" }),
  );
  fireEvent.change(screen.getByLabelText("Template name"), {
    target: { value: "Invitation" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));

  expect(
    await screen.findByText("An email template with that name already exists"),
  ).toBeTruthy();
  expect(screen.getByLabelText("Template name")).toHaveProperty(
    "value",
    "Invitation",
  );
});

it("saves the draft as a new template", async () => {
  await openComposer();
  fireEvent.change(field("Subject"), { target: { value: "Followup" } });
  fireEvent.change(field("Body"), { target: { value: "Still waiting?" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Save draft as template" }),
  );
  fireEvent.change(screen.getByLabelText("Template name"), {
    target: { value: "Nudge" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));

  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/email-templates",
        body: { name: "Nudge", subject: "Followup", body: "Still waiting?" },
      },
    ]),
  );
  expect(await screen.findByText("Template: Nudge")).toBeTruthy();
});

it("deletes the loaded template after confirming", async () => {
  await openComposer();
  await pickMenuItem("Use template", "Invitation");
  fireEvent.click(
    screen.getByRole("button", { name: "Delete template Invitation" }),
  );
  expect(await screen.findByText(/keep their content/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      { path: "/waitlist/admin/email-templates/8", body: null },
    ]),
  );
  expect(await screen.findByText("Deleted template “Invitation”")).toBeTruthy();
});
