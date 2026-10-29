import { KORA_PROJECT_PATH, KoraError } from "@alliance/common/kora";
import { OtpError } from "@alliance/common/otp";
import type {
  KoraParticipantStateDto,
  PendingKoraCodeDto,
  StartKoraCodeDto,
} from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, mock, onTestFinished, test } from "bun:test";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../../../lib/AuthContext";
import { testAuthUser } from "../../../stories/testData";
import { KoraSignIn } from "./KoraSignIn";

declare const happyDOM: { setURL: (url: string) => void };

const pendingCode = (resendInMs = 60_000): PendingKoraCodeDto => ({
  channel: "email",
  maskedDestination: "p•••@example.com",
  resendAvailableAt: new Date(Date.now() + resendInMs).toISOString(),
  expiresAt: new Date(Date.now() + 600_000 + resendInMs).toISOString(),
});

const refusal = (status: number, error: string, message: string) =>
  Response.json({ statusCode: status, message, error }, { status });

let state: KoraParticipantStateDto | null;
let stateFails: boolean;
let sends: StartKoraCodeDto[];
let send: () => Response;
let verify: (code: string) => Response | Promise<Response>;
let signup: (name: string) => Response;
let signOut: () => Response;
let abandoned: number;
let abandon: () => Response | Promise<Response>;
let timeZones: unknown[];

serveApi(
  routes({
    "GET /kora/me": () =>
      stateFails ? new Response(null, { status: 500 }) : Response.json(state),
    "POST /kora/code": async ({ request }) => {
      sends.push(await request.json());
      return send();
    },
    "DELETE /kora/code": () => {
      abandoned += 1;
      return abandon();
    },
    "POST /kora/code/verify": async ({ request }) => {
      const body = await request.json();
      timeZones.push(body.timeZone);
      return verify(body.code);
    },
    "POST /kora/signup": async ({ request }) => {
      const body = await request.json();
      timeZones.push(body.timeZone);
      return signup(body.name);
    },
    "POST /kora/sign-out": () => signOut(),
  }),
);

beforeEach(() => {
  happyDOM.setURL(`https://worldalliance.org${KORA_PROJECT_PATH}`);
  state = { participant: null, pendingCode: null, signupPending: false };
  stateFails = false;
  sends = [];
  send = () => Response.json(pendingCode());
  verify = () => Response.json({ participant: null });
  signup = (name) => Response.json({ id: "p1", name });
  signOut = () => new Response(null, { status: 204 });
  abandoned = 0;
  abandon = () => new Response(null, { status: 204 });
  timeZones = [];
});

const signedOutMember: AuthContextType = {
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: () => Promise.resolve(),
  login: () => Promise.resolve(),
  onLogin: () => Promise.resolve(),
  logout: () => Promise.resolve(),
  loading: false,
};

const renderCard = (member: Partial<AuthContextType> = {}, search = "") =>
  render(
    <MemoryRouter initialEntries={[`${KORA_PROJECT_PATH}${search}`]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ ...signedOutMember, ...member }}>
          <KoraSignIn note="Starts soon" />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

const contactInput = () =>
  screen.getByLabelText<HTMLInputElement>("Email or mobile number");

const submitContact = async (contact: string) => {
  fireEvent.change(await screen.findByLabelText("Email or mobile number"), {
    target: { value: contact },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
};

const enterCode = async (code: string) => {
  fireEvent.change(await screen.findByLabelText("Code"), {
    target: { value: code },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
};

test("signs up a new participant by email code, then asks for a name", async () => {
  verify = (code) =>
    code === "012345"
      ? Response.json({ participant: null })
      : refusal(400, OtpError.WrongCode, "That code isn’t correct. Try again.");
  renderCard();

  await submitContact(" person@example.com ");
  await screen.findByText("p•••@example.com");
  expect(sends).toEqual([{ email: "person@example.com" }]);

  await enterCode("999999");
  await screen.findByText("That code isn’t correct. Try again.");
  expect(document.activeElement).toBe(screen.getByLabelText("Code"));

  await enterCode("012345");
  fireEvent.change(await screen.findByLabelText("Full name"), {
    target: { value: "Test Person" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findByText("You’re signed in as Test Person.");
  expect(timeZones).toHaveLength(3);
  expect(timeZones.every((zone) => typeof zone === "string")).toBe(true);
});

test("signs a returning participant in by phone without asking for a name", async () => {
  verify = () =>
    Response.json({ participant: { id: "p1", name: "Returning" } });
  renderCard();

  await submitContact("+44 7400 123456");
  await enterCode("123456");

  await screen.findByText("You’re signed in as Returning.");
  expect(sends).toEqual([{ phoneNumber: "+447400123456" }]);
  expect(screen.queryByLabelText("Full name")).toBeNull();
});

test("keeps only digits from a pasted code", async () => {
  state = {
    participant: null,
    pendingCode: pendingCode(),
    signupPending: false,
  };
  renderCard();
  const input = await screen.findByLabelText<HTMLInputElement>("Code");
  fireEvent.change(input, { target: { value: "12 34-56 7" } });
  expect(input.value).toBe("123456");
});

test("fills a texted code the browser offers", async () => {
  Object.defineProperty(window, "OTPCredential", {
    value: class {},
    configurable: true,
  });
  Object.defineProperty(navigator, "credentials", {
    value: {
      get: mock()
        .mockResolvedValueOnce({ code: "654321" })
        .mockReturnValue(new Promise(() => {})),
    },
    configurable: true,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(window, "OTPCredential");
    Reflect.deleteProperty(navigator, "credentials");
  });
  state = {
    participant: null,
    pendingCode: { ...pendingCode(), channel: "sms" },
    signupPending: false,
  };
  renderCard();
  const input = await screen.findByLabelText<HTMLInputElement>("Code");
  await waitFor(() => expect(input.value).toBe("654321"));
});

test("refuses a malformed contact without sending", async () => {
  renderCard();
  await submitContact("person@example");
  await screen.findByText("Enter a valid email address or mobile number.");
  expect(sends).toEqual([]);
});

test("shows a failed delivery's copy and keeps the contact", async () => {
  const copy =
    "We couldn’t send your code. Try again later or use another sign-in method.";
  send = () => refusal(503, OtpError.DeliveryFailed, copy);
  renderCard();
  await submitContact("person@example.com");
  await screen.findByText(copy);
  expect(contactInput().value).toBe("person@example.com");
});

test("resends to the same contact once the wait is over", async () => {
  send = () => Response.json(pendingCode(-1));
  renderCard();
  await submitContact("person@example.com");
  fireEvent.click(await screen.findByRole("button", { name: "Resend code" }));
  await waitFor(() => expect(sends).toHaveLength(2));
  expect(sends[1]).toEqual({ email: "person@example.com" });
});

test("counts down to resending", async () => {
  renderCard();
  await submitContact("person@example.com");
  const resend = await screen.findByRole<HTMLButtonElement>("button", {
    name: /Resend code in \d+s/,
  });
  expect(resend.disabled).toBe(true);
});

test("changing the contact abandons the code and keeps what was typed", async () => {
  renderCard();
  await submitContact("person@example.com");
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Change email or mobile number",
    }),
  );
  await screen.findByLabelText("Email or mobile number");
  expect(abandoned).toBe(1);
  expect(contactInput().value).toBe("person@example.com");
});

test("a new contact's code step drops the last code's refusal", async () => {
  const wrong = "That code isn’t correct. Try again.";
  verify = () => refusal(400, OtpError.WrongCode, wrong);
  renderCard();
  await submitContact("person@example.com");
  await enterCode("999999");
  await screen.findByText(wrong);
  fireEvent.click(
    screen.getByRole("button", { name: "Change email or mobile number" }),
  );
  await submitContact("other@example.com");
  await screen.findByLabelText("Code");
  expect(sends).toHaveLength(2);
  expect(screen.queryByText(wrong)).toBeNull();
});

test("holds the contact while a code is being checked", async () => {
  const checked = Promise.withResolvers<Response>();
  verify = () => checked.promise;
  renderCard();
  await submitContact("person@example.com");
  await enterCode("123456");
  const change = screen.getByRole<HTMLButtonElement>("button", {
    name: "Change email or mobile number",
  });
  await waitFor(() => expect(change.disabled).toBe(true));
  checked.resolve(Response.json({ participant: null }));
  await screen.findByLabelText("Full name");
  expect(abandoned).toBe(0);
});

test("holds the code while it is being abandoned", async () => {
  const abandonedCode = Promise.withResolvers<Response>();
  abandon = () => abandonedCode.promise;
  renderCard();
  await submitContact("person@example.com");
  fireEvent.change(await screen.findByLabelText("Code"), {
    target: { value: "123456" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Change email or mobile number" }),
  );
  const verifyButton = screen.getByRole<HTMLButtonElement>("button", {
    name: "Verify",
  });
  await waitFor(() => expect(verifyButton.disabled).toBe(true));
  abandonedCode.resolve(new Response(null, { status: 204 }));
  await screen.findByLabelText("Email or mobile number");
});

test("an expired signup returns to contact entry with its copy", async () => {
  const copy = "Your verification has expired. Verify your contact again.";
  signup = () => refusal(400, KoraError.SignupExpired, copy);
  state = { participant: null, pendingCode: null, signupPending: true };
  renderCard();
  fireEvent.change(await screen.findByLabelText("Full name"), {
    target: { value: "Test Person" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText(copy);
  screen.getByLabelText("Email or mobile number");
});

test("a code no longer valid returns to contact entry with its copy", async () => {
  const copy = "That code is no longer valid. Request a new code.";
  verify = () => refusal(400, OtpError.CodeInvalid, copy);
  state = {
    participant: null,
    pendingCode: pendingCode(),
    signupPending: false,
  };
  renderCard();
  await enterCode("123456");
  await screen.findByText(copy);
  await submitContact("person@example.com");
  await screen.findByLabelText("Code");
  expect(sends).toEqual([{ email: "person@example.com" }]);
  expect(screen.queryByText(copy)).toBeNull();
});

test("resumes a pending code after a reload, without a resend it cannot address", async () => {
  state = {
    participant: null,
    pendingCode: pendingCode(-1),
    signupPending: false,
  };
  renderCard();
  await screen.findByText("p•••@example.com");
  expect(screen.queryByRole("button", { name: /Resend code/ })).toBeNull();
  screen.getByRole("button", { name: "Change email or mobile number" });
});

test("offers a retry when the sign-in state cannot load", async () => {
  stateFails = true;
  renderCard();
  const retry = await screen.findByRole(
    "button",
    { name: "Try again" },
    { timeout: 3000 },
  );
  stateFails = false;
  fireEvent.click(retry);
  await screen.findByLabelText("Email or mobile number");
});

test("a signed-in member sees only the member message", async () => {
  state = {
    participant: { id: "p1", name: "Participant" },
    pendingCode: null,
    signupPending: false,
  };
  renderCard({ isAuthenticated: true, user: testAuthUser });
  await screen.findByText("You’re already an Alliance member.");
  expect(screen.queryByText(/signed in as/)).toBeNull();
  expect(screen.queryByLabelText("Email or mobile number")).toBeNull();
});

test("signs out, and keeps the signed-in view when sign-out fails", async () => {
  state = {
    participant: { id: "p1", name: "Participant" },
    pendingCode: null,
    signupPending: false,
  };
  signOut = () => new Response(null, { status: 500 });
  renderCard();
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await screen.findByText("Something went wrong. Please try again.");
  screen.getByText("You’re signed in as Participant.");

  signOut = () => new Response(null, { status: 204 });
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByLabelText("Email or mobile number");
});

test("starts Google and Apple sign-in back to the project page", async () => {
  renderCard();
  for (const [name, provider] of [
    ["Continue with Google", "google"],
    ["Continue with Apple", "apple"],
  ]) {
    const url = new URL(
      (await screen.findByRole("link", { name })).getAttribute("href")!,
    );
    expect(url.pathname).toEndWith(`/kora/${provider}/start`);
    expect(url.searchParams.get("returnTo")).toBe(
      `${window.location.origin}${KORA_PROJECT_PATH}`,
    );
  }
});

test("says why the provider sign-in came back without signing in", async () => {
  renderCard({}, "?googleError=cancelled");
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Google sign-in was cancelled.",
  );
});

test("drops the provider's refusal once the participant uses the form", async () => {
  renderCard({}, "?googleError=cancelled");
  await screen.findByText("Google sign-in was cancelled.");
  await submitContact("person@example.com");
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Change email or mobile number",
    }),
  );
  await screen.findByLabelText("Email or mobile number");
  expect(screen.queryByText("Google sign-in was cancelled.")).toBeNull();
});
