import { errorMessage } from "@alliance/common/errorMessage";
import type {
  ActionFormAssignmentDto,
  ActionFormVariantDto,
} from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useFormAssignmentsAdmin } from "../lib/useFormAssignmentsAdmin";
import MoveFormMemberModal from "./MoveFormMemberModal";

export default function ActionFormMembersPanel(props: {
  actionId: number;
  variants: ActionFormVariantDto[];
  /** The task form's label for members on no variant, or null when there is none. */
  defaultLabel: string | null;
}) {
  const { actionId, variants, defaultLabel } = props;
  const [search, setSearch] = useState("");
  const [moving, setMoving] = useState<ActionFormAssignmentDto | null>(null);
  const { assignments } = useFormAssignmentsAdmin(actionId);
  const nameOf = (variantId: number | null) =>
    variantId === null
      ? (defaultLabel ?? "None")
      : (variants.find((v) => v.id === variantId)?.name ?? "Deleted variant");

  if (assignments.isPending) return <Spinner />;
  if (assignments.isError) {
    return (
      <InlineError
        message={errorMessage({
          error: assignments.error,
          fallback: "Could not load members",
        })}
      />
    );
  }

  const query = search.trim().toLowerCase();
  const rows = query
    ? assignments.data.filter((row) =>
        row.userName.toLowerCase().includes(query),
      )
    : assignments.data;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Members ({assignments.data.length})</h3>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="rounded border border-gray-2 px-3 py-1.5 text-sm"
        />
      </div>
      {assignments.data.length === 0 ? (
        <p className="text-sm text-zinc-500">No member is on a variant yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2">Member</th>
              <th>On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.userId}
                className="border-t border-gray-2 align-top [&>td]:py-2"
              >
                <td>
                  <Link
                    to={`/member/${row.userId}`}
                    className="hover:underline"
                  >
                    {row.userName}
                  </Link>
                </td>
                <td>
                  {nameOf(row.variantId)}
                  {row.overriddenAt && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Moved by {row.overriddenByName ?? "a deleted user"},{" "}
                      {formatDateTime(new Date(row.overriddenAt))}
                    </p>
                  )}
                </td>
                <td className="text-right">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`Move ${row.userName}`}
                          onClick={() => setMoving(row)}
                          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100"
                        />
                      }
                    >
                      <ArrowLeftRight size={16} />
                    </TooltipTrigger>
                    <TooltipContent>Move to another variant</TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {moving && (
        <MoveFormMemberModal
          actionId={actionId}
          assignment={moving}
          variants={variants.filter((v) => v.id !== moving.variantId)}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}
