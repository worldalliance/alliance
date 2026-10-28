import { fireEvent, render, screen } from "@testing-library/react";
import { ChatbotSignup } from "./ChatbotSignup";
import { SIGNUP_BUTTON, SIGNUP_CLOSED, SIGNUP_NOTE } from "./copy";

const contactInput = () => screen.getByLabelText("Email or mobile number");
const submitContact = (value: string) => {
  fireEvent.change(contactInput(), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: SIGNUP_BUTTON }));
};

test("an invalid contact stays on the first step with an error", () => {
  render(<ChatbotSignup />);
  submitContact("not-an-email");
  expect(screen.getByRole("alert").textContent).toContain("valid email");
  expect(screen.queryByLabelText("Verification code")).toBeNull();
});

test("a valid email moves to the code step, and verifying shows the closed message", () => {
  render(<ChatbotSignup />);
  submitContact("volunteer@example.com");
  expect(screen.getByText("volunteer@example.com")).toBeTruthy();
  const verify = screen.getByRole("button", { name: "Verify" });
  expect(verify.hasAttribute("disabled")).toBe(true);

  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: "123456" },
  });
  expect(screen.getByRole("status").textContent).toBe(SIGNUP_CLOSED);
});

test("changing the contact returns to the first step", () => {
  render(<ChatbotSignup />);
  submitContact("volunteer@example.com");
  fireEvent.click(
    screen.getByRole("button", { name: "Change email or mobile number" }),
  );
  expect(contactInput()).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe(SIGNUP_NOTE);
});

test("a provider button shows the closed message instead of navigating", () => {
  render(<ChatbotSignup />);
  const google = screen.getByRole("link", { name: /Sign up with Google/ });
  expect(fireEvent.click(google)).toBe(false);
  expect(screen.getByRole("status").textContent).toBe(SIGNUP_CLOSED);
});
