import { OtpError } from "@alliance/common/otp";
import type { UserDto, VerifyPhoneCodeDto } from "@alliance/shared/client";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../../lib/AuthContext";
import PhoneConfirm from "./PhoneConfirm";

const NUMBER = "+14155552671";

let me: UserDto;
let sends: string[];
let send: () => Response;
let verifies: VerifyPhoneCodeDto[];
let confirmed: string[];
let reloadFails: boolean;

const codeSent = (resendAvailableAt: Date) =>
  Response.json({
    challengeToken: `token-${sends.length}`,
    maskedDestination: "•••• 2671",
    resendAvailableAt: resendAvailableAt.toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });

const refusal = (status: number, error: OtpError, message: string) =>
  Response.json({ statusCode: status, message, error }, { status });

serveApi(
  routes({
    "GET /auth/me": () =>
      reloadFails
        ? new Response(null, { status: 500 })
        : Response.json({ user: me }),
    "POST /user/phone/code": async ({ request }) => {
      sends.push((await request.json()).phoneNumber);
      return send();
    },
    "POST /user/phone/code/verify": async ({ request }) => {
      const body: VerifyPhoneCodeDto = await request.json();
      verifies.push(body);
      if (body.code !== "123456") {
        return refusal(
          400,
          OtpError.WrongCode,
          "That code isn’t correct. Try again.",
        );
      }
      me = { ...me, phoneNumber: NUMBER, phoneNumberVerified: true };
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  me = makeUser({
    phoneNumber: NUMBER,
    phoneNumberVerified: false,
    timeZone: "Europe/London",
  });
  sends = [];
  send = () => codeSent(new Date(Date.now() + 30_000));
  verifies = [];
  confirmed = [];
  reloadFails = false;
});

const renderConfirm = () => {
  const { wrapper } = queryWrapper();
  return render(
    <PhoneConfirm
      phoneNumber={NUMBER}
      unconfirmedNote="Not confirmed"
      onConfirmed={(number) => confirmed.push(number)}
    />,
    {
      wrapper: ({ children }) =>
        wrapper({ children: <AuthProvider>{children}</AuthProvider> }),
    },
  );
};

const description = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");

const sendCode = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Send code" }));
  return screen.findByRole("textbox", { name: "Code" });
};

it("confirms the number with the texted code", async () => {
  renderConfirm();
  expect(await screen.findByText("Not confirmed")).toBeTruthy();

  const code = await sendCode();
  expect(sends).toEqual([NUMBER]);
  expect(document.activeElement).toBe(code);
  expect(description(code)).toBe("Enter the code we sent to •••• 2671.");

  // A browser cuts pasted text to maxlength before onChange strips the separators.
  expect(code.hasAttribute("maxlength")).toBe(false);
  fireEvent.change(code, { target: { value: "12 34 56" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));

  expect(await screen.findByText("Confirmed")).toBeTruthy();
  expect(verifies).toEqual([{ challengeToken: "token-1", code: "123456" }]);
  expect(confirmed).toEqual([NUMBER]);
});

it("shows the number confirmed when reloading the member fails", async () => {
  renderConfirm();
  const code = await sendCode();
  reloadFails = true;
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));

  expect(await screen.findByText("Confirmed")).toBeTruthy();
  expect(confirmed).toEqual([NUMBER]);
});

it("moves focus to a confirm only once", async () => {
  const OTHER = "+14155550123";
  const { wrapper } = queryWrapper();
  const confirmAt = (phoneNumber: string) => (
    <>
      <input aria-label="Phone" />
      <PhoneConfirm phoneNumber={phoneNumber} unconfirmedNote="Not confirmed" />
    </>
  );
  const { rerender } = render(confirmAt(NUMBER), {
    wrapper: ({ children }) =>
      wrapper({ children: <AuthProvider>{children}</AuthProvider> }),
  });
  const code = await sendCode();
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
  const status = await screen.findByText("Confirmed");
  await waitFor(() => expect(document.activeElement).toBe(status));

  const phone = screen.getByRole("textbox", { name: "Phone" });
  phone.focus();
  rerender(confirmAt(OTHER));
  await screen.findByRole("button", { name: "Send code" });
  rerender(confirmAt(NUMBER));

  await screen.findByText("Confirmed");
  expect(document.activeElement).toBe(phone);
});

it("confirms on Enter without submitting a surrounding form", async () => {
  let submits = 0;
  const { wrapper } = queryWrapper();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submits += 1;
      }}
    >
      <PhoneConfirm phoneNumber={NUMBER} unconfirmedNote="Not confirmed" />
    </form>,
    {
      wrapper: ({ children }) =>
        wrapper({ children: <AuthProvider>{children}</AuthProvider> }),
    },
  );
  const code = await sendCode();
  fireEvent.change(code, { target: { value: "123456" } });
  fireEvent.keyDown(code, { key: "Enter" });

  expect(await screen.findByText("Confirmed")).toBeTruthy();
  expect(submits).toBe(0);
});

it("says what is wrong with a short or wrong code and keeps the entry", async () => {
  renderConfirm();
  const code = await sendCode();

  fireEvent.change(code, { target: { value: "123" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Enter the 6-digit code.",
  );
  expect(verifies).toEqual([]);

  fireEvent.change(code, { target: { value: "999999" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm number" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "That code isn’t correct. Try again.",
    ),
  );
  expect(description(screen.getByRole("textbox", { name: "Code" }))).toBe(
    "That code isn’t correct. Try again. Enter the code we sent to •••• 2671.",
  );
});

it("moves focus back to the code box, which says where the code went, after a resend", async () => {
  send = () => codeSent(new Date(0));
  renderConfirm();
  await sendCode();
  const resend = screen.getByRole("button", { name: "Send code again" });
  resend.focus();
  fireEvent.click(resend);

  await waitFor(() => expect(sends).toEqual([NUMBER, NUMBER]));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Code" }),
    ),
  );
  expect(description(screen.getByRole("textbox", { name: "Code" }))).toBe(
    "Enter the code we sent to •••• 2671.",
  );
});

it("offers to send again after a send fails", async () => {
  send = () =>
    refusal(
      503,
      OtpError.DeliveryFailed,
      "We couldn’t send a code to this number. Check the number or try again later.",
    );
  renderConfirm();
  fireEvent.click(await screen.findByRole("button", { name: "Send code" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "We couldn’t send a code to this number. Check the number or try again later.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Send code again" }));
  await waitFor(() => expect(sends).toEqual([NUMBER, NUMBER]));
});

it("leaves the code box valid when a resend fails", async () => {
  send = () =>
    sends.length > 1
      ? refusal(429, OtpError.Throttled, "Too many codes. Try again later.")
      : codeSent(new Date(0));
  renderConfirm();
  const code = await sendCode();
  fireEvent.click(screen.getByRole("button", { name: "Send code again" }));

  await screen.findByRole("alert");
  expect(code.getAttribute("aria-invalid")).toBe("false");
});

it("holds a resend until the server allows one", async () => {
  renderConfirm();
  await sendCode();

  const resend = screen.getByRole("button", {
    name: /Send code again in \d+s/,
  });
  expect(resend.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(resend);
  expect(sends).toEqual([NUMBER]);
});

it("holds a resend the server just pushed back", async () => {
  send = () =>
    codeSent(sends.length > 1 ? new Date(Date.now() + 30_000) : new Date(0));
  renderConfirm();
  await sendCode();
  fireEvent.click(screen.getByRole("button", { name: "Send code again" }));

  const resend = await screen.findByRole("button", {
    name: /Send code again in \d+s/,
  });
  expect(resend.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(resend);
  expect(sends).toEqual([NUMBER, NUMBER]);
});

it("shows a number the member already confirmed as confirmed", async () => {
  me = { ...me, phoneNumberVerified: true };
  renderConfirm();

  expect(await screen.findByText("Confirmed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
});
