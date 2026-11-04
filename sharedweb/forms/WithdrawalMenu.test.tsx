import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { flushSync } from "react-dom";
import { MemoryRouter, Route, Routes } from "react-router";
import WithdrawalMenu from "./WithdrawalMenu";

const renderMenu = ({ disabled = false } = {}) => {
  const onWithdraw = jest.fn();
  const { container } = render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <WithdrawalMenu disabled={disabled} onWithdraw={onWithdraw} />
          }
        />
        <Route path="/membership" element={<p>Membership page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  const menu = container.querySelector(".lucide-ellipsis")?.closest("button");
  if (!menu) throw new Error("no withdrawal menu");
  fireEvent.click(menu);
  return onWithdraw;
};

const withdrawButton = () => screen.getByRole("button", { name: "Withdraw" });

const typeReason = (reason: string) =>
  fireEvent.change(screen.getByPlaceholderText("Explain in more detail..."), {
    target: { value: reason },
  });

it("hands back the chosen option's flags and the trimmed reason", () => {
  const onWithdraw = renderMenu();

  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );
  typeReason("  busy  ");
  fireEvent.click(withdrawButton());

  expect(onWithdraw).toHaveBeenCalledWith({
    outOfTime: true,
    isMoral: false,
    reason: "busy",
  });
});

it("holds Withdraw until an option that needs a reason has one", () => {
  const onWithdraw = renderMenu();

  fireEvent.click(screen.getByRole("button", { name: "Moral objection" }));
  expect(withdrawButton()).toHaveProperty("disabled", true);

  typeReason("disagree");
  fireEvent.click(withdrawButton());

  expect(onWithdraw).toHaveBeenCalledWith({
    outOfTime: false,
    isMoral: true,
    reason: "disagree",
  });
});

it("keeps Withdraw disabled while the form is submitting", () => {
  renderMenu({ disabled: true });

  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );

  expect(withdrawButton()).toHaveProperty("disabled", true);
});

it("hides the reason and Withdraw when the chosen option is clicked again", () => {
  renderMenu();
  const option = screen.getByRole("button", { name: "Other reason" });

  fireEvent.click(option);
  expect(withdrawButton()).toBeTruthy();
  fireEvent.click(option);

  expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  expect(screen.queryByPlaceholderText("Explain in more detail...")).toBeNull();
});

it("sends a member on vacation to their away periods", () => {
  renderMenu();

  fireEvent.click(screen.getByRole("button", { name: "On vacation" }));

  expect(screen.getByText("Membership page")).toBeTruthy();
});

it("opens when React renders the click's update before the document sees it", () => {
  const { container } = render(
    <MemoryRouter>
      <WithdrawalMenu disabled={false} onWithdraw={jest.fn()} />
    </MemoryRouter>,
  );
  const trigger = container
    .querySelector(".lucide-ellipsis")
    ?.closest("button");
  if (!trigger) throw new Error("no withdrawal menu");
  // A browser renders the update before the click bubbles to document; jsdom
  // only does when something flushes it on the way up.
  const flush = () => flushSync(() => {});
  document.body.addEventListener("click", flush);
  fireEvent.click(trigger);
  document.body.removeEventListener("click", flush);

  expect(screen.queryByText("Withdrawal options")).not.toBeNull();
});

it("opens from a trigger the caller supplies, and closes from its own button", async () => {
  const { container } = render(
    <MemoryRouter>
      <WithdrawalMenu
        disabled={false}
        onWithdraw={jest.fn()}
        renderTrigger={(show) => <button onClick={show}>Custom</button>}
      />
    </MemoryRouter>,
  );
  expect(container.querySelector(".lucide-ellipsis")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  expect(
    screen.getByRole("dialog", { name: "Withdrawal options" }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(screen.queryByText("Withdrawal options")).toBeNull(),
  );
});

it("closes on Escape and returns focus to the trigger", async () => {
  const { container } = render(
    <MemoryRouter>
      <WithdrawalMenu disabled={false} onWithdraw={jest.fn()} />
    </MemoryRouter>,
  );
  const trigger = container
    .querySelector(".lucide-ellipsis")
    ?.closest("button");
  if (!trigger) throw new Error("no withdrawal menu");
  trigger.focus();
  fireEvent.click(trigger);

  fireEvent.keyDown(screen.getByRole("button", { name: "Moral objection" }), {
    key: "Escape",
  });

  await waitFor(() =>
    expect(screen.queryByText("Withdrawal options")).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("leaves Escape to its container while closed", () => {
  const { container } = render(
    <MemoryRouter>
      <WithdrawalMenu disabled={false} onWithdraw={jest.fn()} />
    </MemoryRouter>,
  );
  const trigger = container
    .querySelector(".lucide-ellipsis")
    ?.closest("button");
  if (!trigger) throw new Error("no withdrawal menu");

  expect(fireEvent.keyDown(trigger, { key: "Escape" })).toBe(true);
});
