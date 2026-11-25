import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useRef } from "react";
import { MemoryRouter } from "react-router";
import Button, { ButtonColor, ButtonVariant } from "./Button";
import DateTimePicker from "./DateTimePicker";
import FormInput from "./FormInput";
import InlineError from "./InlineError";
import LargeCheckbox from "./LargeCheckbox";
import Modal, { ModalBody, ModalHeader, ModalTitle } from "./Modal";
import Pagination from "./Pagination";
import Sheet from "./Sheet";
import Spinner from "./Spinner";
import { Switch } from "./Switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "./Tabs";
import UserSelect from "./UserSelect";

afterEach(cleanup);

describe("Button", () => {
  it("forwards aria attributes and the click to a button", () => {
    const onClick = jest.fn();
    render(
      <Button onClick={onClick} aria-pressed aria-label="Bold">
        B
      </Button>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Bold", pressed: true }),
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a link when given `to`", () => {
    render(
      <MemoryRouter>
        <Button to="/tasks">All tasks</Button>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "All tasks" }).getAttribute("href"),
    ).toBe("/tasks");
  });

  it("disables the button", () => {
    render(
      <Button onClick={() => {}} disabled>
        Save
      </Button>,
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save" }).disabled,
    ).toBe(true);
  });

  it("keeps its label and focus while busy, ignoring presses and submits", () => {
    const onClick = jest.fn();
    const onSubmit = jest.fn((event: React.FormEvent) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Button onClick={onClick} busy>
          Remove
        </Button>
        <Button type="submit" busy>
          Save
        </Button>
      </form>,
    );
    const remove = screen.getByRole<HTMLButtonElement>("button", {
      name: "Remove",
    });
    remove.focus();
    fireEvent.click(remove);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(remove.disabled).toBe(false);
    expect(remove.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(remove);
  });

  it("lets `variant` win over the legacy `color`", () => {
    render(
      <Button
        onClick={() => {}}
        color={ButtonColor.Red}
        variant={ButtonVariant.Ghost}
      >
        Skip
      </Button>,
    );
    const { classList } = screen.getByRole("button", { name: "Skip" });
    expect(classList.contains("bg-transparent")).toBe(true);
    expect(classList.contains("bg-danger")).toBe(false);
  });
});

describe("Modal", () => {
  const renderModal = (props: Partial<React.ComponentProps<typeof Modal>>) => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} {...props}>
        <ModalHeader>
          <ModalTitle>Rename suite</ModalTitle>
        </ModalHeader>
        <ModalBody>Body</ModalBody>
      </Modal>,
    );
    return onClose;
  };

  it("is a dialog named by its title, closed by the close button", () => {
    const onClose = renderModal({});
    expect(screen.getByRole("dialog", { name: "Rename suite" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape unless told not to", () => {
    const onClose = renderModal({});
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();

    const kept = renderModal({ dismissOnEscape: false });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(kept).not.toHaveBeenCalled();
  });

  it("keeps the close button but disables it while dismissal is disabled", () => {
    const onClose = renderModal({ dismissDisabled: true });
    const close = screen.getByRole<HTMLButtonElement>("button", {
      name: "Close",
    });
    expect(close.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has no close button with `showClose` off", () => {
    renderModal({ showClose: false });
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
  it("focuses the panel on open, or the control it names", async () => {
    renderModal({});
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("dialog")),
    );
    cleanup();

    function Named() {
      const field = useRef<HTMLInputElement>(null);
      return (
        <Modal onClose={() => {}} initialFocus={field}>
          <ModalTitle>Rename suite</ModalTitle>
          <input ref={field} aria-label="Name" />
        </Modal>
      );
    }
    render(<Named />);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Name")),
    );
  });
});

describe("Sheet", () => {
  it("is a dialog named by its title, closed by the close button", () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose} title="Response from Ada">
        Body
      </Sheet>,
    );
    expect(
      screen.getByRole("dialog", { name: "Response from Ada" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Pagination", () => {
  it("marks the current page and reports the page picked", () => {
    const onPageChange = jest.fn();
    render(<Pagination page={2} totalPages={3} onPageChange={onPageChange} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "2" }).getAttribute("aria-current"),
    ).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders nothing for a single page", () => {
    render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("status and form controls", () => {
  it("names the spinner's status", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading..." })).toBeTruthy();
  });

  it("shows an inline error as an alert, and nothing without a message", () => {
    const { rerender } = render(<InlineError message="Could not save" />);
    expect(screen.getByRole("alert").textContent).toBe("Could not save");
    rerender(<InlineError message={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("labels the checkbox and reports its new state", () => {
    const onChange = jest.fn();
    render(
      <LargeCheckbox label="Events" checked={false} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Events" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("labels the form input and marks it invalid with its error", () => {
    render(
      <FormInput
        name="note"
        label="Note"
        value=""
        onChange={() => {}}
        error="Note required"
      />,
    );
    const input = screen.getByLabelText("Note");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      screen.getByText("Note required").id,
    );
  });

  it("names the user picker's search by its label", () => {
    render(
      <UserSelect
        users={[]}
        selectedUserIds={[]}
        onChange={() => {}}
        label="Preview as"
      />,
    );
    expect(screen.getByLabelText("Preview as").tagName).toBe("INPUT");
  });

  it("reports a picked date and time in UTC", () => {
    const onChange = jest.fn();
    render(<DateTimePicker id="starts" label="Starts" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "2026-11-24T09:30" },
    });
    expect(onChange).toHaveBeenCalledWith({
      utcValue: new Date("2026-11-24T09:30").toISOString(),
      localValue: "2026-11-24T09:30",
      date: new Date("2026-11-24T09:30"),
    });
  });

  it("toggles the switch", () => {
    const onCheckedChange = jest.fn();
    render(<Switch aria-label="Public" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Public" }));
    expect(onCheckedChange.mock.calls[0][0]).toBe(true);
  });

  it("shows the panel of the selected tab", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="events">Events</TabsTab>
        </TabsList>
        <TabsPanel value="overview">Overview panel</TabsPanel>
        <TabsPanel value="events">Events panel</TabsPanel>
      </Tabs>,
    );
    expect(
      screen
        .getByRole("tab", { name: "Overview" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Overview panel");
  });
});
