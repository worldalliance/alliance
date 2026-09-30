import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  api,
  emailPreview,
  renderPage,
  serveWaitlistApi,
} from "./WaitlistPage.testHarness";

serveWaitlistApi();

const compose = async (subject: string, body: string) => {
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 1"));
  fireEvent.click(screen.getByLabelText("Select Person 2"));
  fireEvent.click(screen.getByRole("button", { name: "Compose email" }));
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: subject },
  });
  fireEvent.change(screen.getByLabelText("Body"), { target: { value: body } });
};

const confirmDialog = () => screen.getByRole("dialog");

it("previews the email for the selection and sends it after confirming", async () => {
  api.previewServed = emailPreview({ unsubscribed: 1, selected: 3 });
  await compose("Hi #{name}", "Welcome");

  expect(
    await screen.findByText(
      "2 of 3 selected would get this email, skipping 1 unsubscribed.",
    ),
  ).toBeTruthy();
  expect(api.previews.at(-1)).toEqual({
    subject: "Hi #{name}",
    body: "Welcome",
    entryIds: [1, 2],
    includeClaimed: false,
  });
  expect(screen.getByTitle("Email preview").getAttribute("srcdoc")).toBe(
    "<p>Welcome</p>",
  );

  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  expect(
    within(confirmDialog()).getByText(
      /Email “Hi #\{name\}” to 2 recipients now/,
    ),
  ).toBeTruthy();
  expect(
    within(confirmDialog()).getByText(/Skips 1 unsubscribed/),
  ).toBeTruthy();
  expect(
    within(confirmDialog()).getByText(/Mobilized status stays as it is/),
  ).toBeTruthy();
  expect(api.posts).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/emails",
        body: {
          subject: "Hi #{name}",
          body: "Welcome",
          entryIds: [1, 2],
          includeClaimed: false,
          mobilize: false,
          requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        },
      },
    ]),
  );
  expect(
    await screen.findByText(
      "Sending to 2 recipients. Follow it under Waitlist emails.",
    ),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Subject")).toBeNull();
  expect(screen.queryByText(/selected$/)).toBeNull();
});

it("sends to the entries selected when the confirmation opened", async () => {
  let release = () => {};
  api.holdIds = new Promise((resolve) => {
    release = resolve;
  });
  renderPage();
  fireEvent.click(await screen.findByLabelText("Select Person 2"));
  fireEvent.click(
    screen.getByRole("button", { name: "Select all 2 matching" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Compose email" }));
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "Hi" },
  });
  fireEvent.change(screen.getByLabelText("Body"), {
    target: { value: "Welcome" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send email" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  release();
  expect(await screen.findByText("3 entries are selected")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(api.posts.at(-1)).toMatchObject({
      path: "/waitlist/admin/emails",
      body: { entryIds: [2] },
    }),
  );
});

it("resends a failed send with its request id, so it can't send twice", async () => {
  api.sendStatus = 502;
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  const confirmSend = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send email" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  };

  await confirmSend();
  expect(await screen.findByText("Could not send the email.")).toBeTruthy();
  api.sendStatus = 200;
  await confirmSend();

  await waitFor(() => expect(api.posts).toHaveLength(2));
  const [first, second] = api.posts.map(
    (post) => (post.body as { requestId: string }).requestId,
  );
  expect(second).toBe(first);
});

it("keeps a failed send's request id after another send is opened and cancelled", async () => {
  api.sendStatus = 502;
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(await screen.findByText("Could not send the email.")).toBeTruthy();

  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Send email and mark as mobilized" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Send email and mark as mobilized" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  api.sendStatus = 200;
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  await waitFor(() => expect(api.posts).toHaveLength(2));
  const [first, second] = api.posts.map(
    (post) => (post.body as { requestId: string }).requestId,
  );
  expect(second).toBe(first);
});

it("waits for a preview of the current draft before sending", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  const sendButton = () => screen.getByRole("button", { name: "Send email" });
  expect(sendButton().hasAttribute("disabled")).toBe(false);

  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "Hello" },
  });
  expect(sendButton().hasAttribute("disabled")).toBe(true);
  await waitFor(() =>
    expect(api.previews.at(-1)).toMatchObject({ subject: "Hello" }),
  );
  await waitFor(() =>
    expect(sendButton().hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(sendButton());
  expect(
    within(confirmDialog()).getByText(/Email “Hello” to 2 recipients now/),
  ).toBeTruthy();
});

it("waits for a preview of a changed selection before sending", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  const sendButton = () => screen.getByRole("button", { name: "Send email" });

  fireEvent.click(screen.getByLabelText("Select Person 2"));
  expect(sendButton().hasAttribute("disabled")).toBe(true);
  await waitFor(() =>
    expect(api.previews.at(-1)).toMatchObject({ entryIds: [1] }),
  );
  await waitFor(() =>
    expect(sendButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(screen.getByLabelText("Select Person 1"));
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(sendButton().hasAttribute("disabled")).toBe(true);
});

it("previews and sends to people who claimed an invite once included", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  fireEvent.click(
    screen.getByLabelText("Include people who already claimed an invite"),
  );
  await waitFor(() =>
    expect(api.previews.at(-1)).toMatchObject({ includeClaimed: true }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Send email" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts.at(-1)?.body).toMatchObject({ includeClaimed: true }),
  );
});

it("refreshes the repeat-send count after a failed send", async () => {
  api.sendStatus = 502;
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  api.previewServed = emailPreview({ alreadySent: 2 });
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(
    await screen.findByText(
      "2 recipients already got, or are getting, an email with this subject.",
    ),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Send email and mark as mobilized" }),
  );
  expect(
    within(confirmDialog()).getByText(/already got, or are getting/),
  ).toBeTruthy();
});

it("keeps sending off while a preview after a failed send fails", async () => {
  api.sendStatus = 502;
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  fireEvent.click(screen.getByRole("button", { name: "Send email" }));
  api.previewStatus = 500;
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("Unable to preview the email.")).toBeTruthy();
  for (const name of ["Send email", "Send email and mark as mobilized"]) {
    expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(
      true,
    );
  }
});

it("asks before discarding a written draft", async () => {
  await compose("Hi", "Welcome");
  fireEvent.click(screen.getByRole("button", { name: "Discard email" }));
  expect(
    await screen.findByText(/discards this subject and body/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("Subject")).toHaveProperty("value", "Hi");

  fireEvent.click(screen.getByRole("button", { name: "Discard email" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(screen.queryByLabelText("Subject")).toBeNull());
});

it("mentions a sample signup link only when the email has one", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  expect(screen.queryByText(/sample signup link/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send test to me" }));
  expect(
    within(confirmDialog()).getByText(
      "Sends this email to your own address, filled in with Person 1's details and a sample unsubscribe link.",
    ),
  ).toBeTruthy();
});

it("warns when mobilizing with an email that has no signup link", async () => {
  await compose("You're in", "Welcome");
  await screen.findByText(/would get this email/);

  fireEvent.click(
    screen.getByRole("button", { name: "Send email and mark as mobilized" }),
  );
  expect(
    within(confirmDialog()).getByText(/accepts people without inviting them/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts[0]?.body).toMatchObject({ mobilize: true }),
  );
});

it("won't send #{organizationName} to recipients without an organization", async () => {
  api.previewServed = emailPreview({ withoutOrganization: 1 });
  await compose("From #{organizationName}", "Hi");

  expect(
    await screen.findByText(
      "1 recipient has no organization for #{organizationName}. Change the text or the selection.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Send email" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("lists warnings and says which values a recipient lacks", async () => {
  api.previewServed = emailPreview({
    alreadySent: 1,
    sample: {
      entryId: 1,
      name: "Person 1",
      email: "person1@example.com",
      subject: null,
      html: null,
      missing: ["organizationName"],
    },
  });
  await compose("Hi", "From #{organizationName}");

  expect(
    await screen.findByText(
      "1 recipient already got, or is getting, an email with this subject.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByText("This recipient has no value for #{organizationName}."),
  ).toBeTruthy();
});

it("flags unknown placeholders without previewing", async () => {
  await compose("Hi #{firstname}", "Welcome");
  expect(
    await screen.findByText("Unknown placeholders: #{firstname}"),
  ).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(api.previews).toEqual([]);
});

it("inserts a placeholder at the cursor", async () => {
  await compose("Hi", "Join here: ");
  fireEvent.click(screen.getByRole("button", { name: "#{signupLink}" }));
  expect(screen.getByLabelText("Body")).toHaveProperty(
    "value",
    "Join here: #{signupLink}",
  );
});

it("keeps inserting placeholders where the last one went", async () => {
  await compose("Hi", "Hello  there");
  const body = screen.getByLabelText<HTMLTextAreaElement>("Body");
  body.setSelectionRange(6, 6);
  fireEvent.click(screen.getByRole("button", { name: "#{name}" }));
  fireEvent.click(screen.getByRole("button", { name: "#{organizationName}" }));
  expect(body.value).toBe("Hello #{name}#{organizationName} there");
});

it("steps the preview through recipients", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/Person 1 <person1@example.com> · 1 of 2/);
  fireEvent.click(screen.getByRole("button", { name: "Next recipient" }));
  await waitFor(() =>
    expect(api.previews.at(-1)).toMatchObject({ sampleEntryId: 2 }),
  );
});

it("sends a test to the staff member after confirming", async () => {
  await compose("Hi", "Welcome");
  await screen.findByText(/would get this email/);
  fireEvent.click(screen.getByRole("button", { name: "Send test to me" }));
  expect(
    within(confirmDialog()).getByText(/filled in with Person 1's details/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(api.posts).toEqual([
      {
        path: "/waitlist/admin/emails/test",
        body: { subject: "Hi", body: "Welcome", entryId: 1 },
      },
    ]),
  );
  expect(await screen.findByText("Test email sent to you")).toBeTruthy();
});
