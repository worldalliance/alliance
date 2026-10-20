import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import CommunityMemberTableRow from "./CommunityMemberTableRow";
import { ToastProvider } from "./ToastProvider";

const removeMember = async (onRemoveMember: () => Promise<unknown>) => {
  render(
    <ToastProvider>
      <MemoryRouter>
        <table>
          <tbody>
            <CommunityMemberTableRow
              profile={makeProfile(2)}
              canExpand
              amLeader
              canRemove
              communityId={1}
              onRemoveMember={onRemoveMember}
              actions={[]}
              actionRelations={[]}
              maxActionsPerWeek={null}
              memberHref={(id) => `/member/${id}`}
            />
          </tbody>
        </table>
      </MemoryRouter>
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText("User 2").closest("tr")!);
  fireEvent.click(screen.getByText("Remove"));
  fireEvent.click(await screen.findByText("Yes, remove"));
};

it("removes the member once confirmed", async () => {
  const onRemoveMember = jest.fn(() => Promise.resolve());

  await removeMember(onRemoveMember);

  await waitFor(() => expect(onRemoveMember).toHaveBeenCalledWith(2));
});

it.each([
  { status: 403, shown: "Not your group" },
  { status: 500, shown: "Couldn't remove User 2." },
])("a removal refused with $status shows $shown", async ({ status, shown }) => {
  const onRemoveMember = () =>
    Promise.reject({ message: "Not your group", statusCode: status });

  await removeMember(onRemoveMember);

  await screen.findByText(shown);
});
