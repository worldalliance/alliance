import { fireEvent, render, screen } from "@testing-library/react";
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
