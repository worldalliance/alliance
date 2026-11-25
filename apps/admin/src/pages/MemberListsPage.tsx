import React from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useMemberListsAdmin } from "../lib/useMemberListsAdmin";
import Button, { ButtonColor } from "../ui/Button";

const MemberListsPage: React.FC = () => {
  const lists = useMemberListsAdmin();
  return (
    <div className="p-5 space-y-4">
      <title>Member lists - Admin</title>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Member lists</h1>
          <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
            Members you pick by hand. A formula checks whether a member is on
            one with <code>isOnList(&quot;List name&quot;)</code>.
          </p>
        </div>
        <Button to="/members/lists/new" color={ButtonColor.Black} size="small">
          New list
        </Button>
      </div>
      {lists.isPending ? (
        <p className="text-sm text-zinc-600" role="status">
          Loading lists…
        </p>
      ) : lists.isError ? (
        <p className="text-sm text-red-700" role="alert">
          {adminRefusalMessage(lists.error, "Couldn't load lists.")}
        </p>
      ) : lists.data.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No lists yet. Create one to pick members by hand for a formula.
        </p>
      ) : (
        <table className="text-sm w-full max-w-2xl">
          <thead>
            <tr className="text-left text-zinc-600 border-b border-zinc-200">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 font-medium">Members</th>
            </tr>
          </thead>
          <tbody>
            {lists.data.map((list) => (
              <tr key={list.id} className="border-b border-zinc-100">
                <td className="py-2 pr-4">
                  <Link
                    to={`/members/lists/${list.id}`}
                    className="underline text-zinc-900"
                  >
                    {list.name}
                  </Link>
                </td>
                <td className="py-2 text-zinc-700">{list.userIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MemberListsPage;
