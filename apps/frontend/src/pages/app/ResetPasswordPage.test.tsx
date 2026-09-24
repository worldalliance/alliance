import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import ResetPasswordPage from "./ResetPasswordPage";

let resetStatus = 201;

// The page reads the token from window.location, which MemoryRouter doesn't set.
declare const happyDOM: { setURL: (url: string) => void };

serveApi(
  routes({
    "POST /auth/reset-password": () =>
      new Response(null, { status: resetStatus }),
  }),
);

afterEach(() => {
  cleanup();
  resetStatus = 201;
  happyDOM.setURL("http://localhost/");
});

const LoginStub = () => <p>{useLocation().state?.message}</p>;

const submitPassword = () => {
  happyDOM.setURL("http://localhost/resetpassword?token=good");
  render(
    <MemoryRouter initialEntries={["/resetpassword"]}>
      <Routes>
        <Route path="/resetpassword" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
  for (const label of ["Enter a new password:", "Confirm password:"]) {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: "hunter22" },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
};

it("confirms the password on the login page without saying reset, since the member may never have had one", async () => {
  submitPassword();

  expect(
    await screen.findByText("Your password is saved. Please log in."),
  ).toBeDefined();
});

it("reports a failed save without saying reset", async () => {
  resetStatus = 401;
  submitPassword();

  expect(
    await screen.findByText(
      "Couldn't save your password. Try again, or request a new link.",
    ),
  ).toBeDefined();
});
