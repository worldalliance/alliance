import type { OnetimeInviteDto } from "@alliance/shared/client";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import OnetimeInviteListItem from "./OnetimeInviteListItem";

afterEach(cleanup);

const invite: OnetimeInviteDto = {
  id: 7,
  invitee: "Sam",
  code: "abc123",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "link_unused",
  invitedUserId: null,
};

it.each([
  [true, [[7]]],
  [false, []],
])(
  "reports the invite copied only once the copy lands, landed=%p",
  async (landed, calls) => {
    const onCopy = jest.fn(() => Promise.resolve(landed));
    const onCopied = jest.fn();
    render(
      <MemoryRouter>
        <OnetimeInviteListItem
          invite={invite}
          selfInvited
          onCopy={onCopy}
          onCopied={onCopied}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("Share invite link"));

    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("abc123"));
    await Promise.resolve();
    expect(onCopied.mock.calls).toEqual(calls);
  },
);
