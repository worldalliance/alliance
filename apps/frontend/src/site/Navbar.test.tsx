import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { Navbar } from "./Navbar";

afterEach(cleanup);
afterEach(() => localStorage.clear());

const noop = () => Promise.resolve();

const auth = (over: Partial<AuthContextType>): AuthContextType => ({
  isAuthenticated: false,
  user: undefined,
  isImpersonation: false,
  refreshUser: noop,
  login: noop,
  onLogin: noop,
  logout: noop,
  loading: false,
  ...over,
});

const renderNavbar = (over: Partial<AuthContextType>) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={auth(over)}>
        <Navbar />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("Navbar", () => {
  it("offers a working log-in button while auth is still loading", () => {
    renderNavbar({ loading: true });

    // getByRole reads the accessibility tree, so an aria-hidden wrapper fails here.
    const login = screen.getByRole("link", { name: /Log In/ });
    expect(login.getAttribute("href")).toBe("/login");

    login.focus();
    expect(document.activeElement).toBe(login);
  });

  it("keeps the partner button up while auth is still loading", () => {
    renderNavbar({ loading: true });

    expect(
      screen.getByRole("link", { name: "Partner" }).getAttribute("href"),
    ).toBe("/outreach-partner");
  });

  it("paints the signed-in button from the device hint before auth answers", () => {
    localStorage.setItem("was-logged-in", "true");
    renderNavbar({ loading: true });

    expect(
      screen.getByRole("link", { name: /My tasks/ }).getAttribute("href"),
    ).toBe("/tasks");
    expect(screen.queryByRole("link", { name: /Log In/ })).toBeNull();
  });

  it("falls back to log in once a stale hint is contradicted", () => {
    localStorage.setItem("was-logged-in", "true");
    renderNavbar({ loading: false, isAuthenticated: false });

    expect(
      screen.getByRole("link", { name: /Log In/ }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.queryByRole("link", { name: /My tasks/ })).toBeNull();
  });
});
