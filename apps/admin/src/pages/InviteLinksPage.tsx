import { inviteLinkAdminSearch } from "@alliance/shared/client";
import type {
  InviteLinkKind,
  InviteLinkSort,
} from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const KINDS: Record<InviteLinkKind, string> = {
  individual: "Individual",
  multi_use: "Multi-use",
};
const SORTS: Record<InviteLinkSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  most_used: "Most accounts first",
  least_used: "Fewest accounts first",
};
const kindSchema = z.enum(["individual", "multi_use"]);
const sortSchema = z.enum(["newest", "oldest", "most_used", "least_used"]);
const PAGE_SIZE = 50;

export default function InviteLinksPage() {
  const [kind, setKind] = useState<InviteLinkKind>();
  const [sort, setSort] = useState<InviteLinkSort>("newest");
  const { success, error } = useToast();
  const {
    data,
    page,
    setPage,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
  } = usePaginatedQuery({
    queryKey: (page) => ["inviteLinksAdmin", kind, sort, page, PAGE_SIZE],
    queryFn: (page) =>
      inviteLinkAdminSearch({
        query: { kind, sort, page, limit: PAGE_SIZE },
        throwOnError: true,
      }).then((response) => response.data),
  });

  const copy = async (url: string) => {
    if (await copyToClipboard(url)) success("Invite link copied");
    else error("Could not copy invite link");
  };

  return (
    <div className="p-6 space-y-4">
      <title>Invite links - Admin</title>
      <h1 className="text-lg font-bold">Invite links</h1>
      <p className="text-sm text-zinc-500">
        Initial signers counts each account once, even after suspension or
        re-signing. Retention is the percentage of initial signers whose
        contract is active now.
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          Type
          <select
            aria-label="Invite link type"
            className="ml-2 border rounded px-2 py-1"
            value={kind ?? ""}
            onChange={(event) => {
              setKind(
                event.target.value
                  ? kindSchema.parse(event.target.value)
                  : undefined,
              );
              setPage(1);
            }}
          >
            <option value="">All links</option>
            {Object.entries(KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Sort
          <select
            aria-label="Sort invite links"
            className="ml-2 border rounded px-2 py-1"
            value={sort}
            onChange={(event) => {
              setSort(sortSchema.parse(event.target.value));
              setPage(1);
            }}
          >
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          Could not load invite links.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      )}
      {isLoading ? (
        <p>Loading invite links…</p>
      ) : (
        data && (
          <>
            <div className="overflow-x-auto" aria-busy={isPlaceholderData}>
              <table
                className={`w-full text-sm text-left ${isPlaceholderData ? "opacity-60" : ""}`}
              >
                <thead className="bg-zinc-100">
                  <tr>
                    {[
                      "Link",
                      "Type",
                      "Created",
                      "Accounts created",
                      "Initial signers",
                      "Retention",
                    ].map((label) => (
                      <th key={label} className="px-3 py-2 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.items.map((link) => (
                    <tr key={link.id}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{link.label}</p>
                        <div className="flex items-center gap-2">
                          <a
                            href={link.url}
                            className="text-blue-600 break-all"
                          >
                            {link.url}
                          </a>
                          <button
                            type="button"
                            aria-label={`Copy invite link ${link.label}`}
                            title="Copy invite link"
                            onClick={() => void copy(link.url)}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {KINDS[link.kind]}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(new Date(link.createdAt))}
                      </td>
                      <td className="px-3 py-2">{link.accountsCreated}</td>
                      <td className="px-3 py-2">{link.initialSigners}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {link.initialSigners
                          ? `${Math.round((link.retainedSigners / link.initialSigners) * 100)}% (${link.retainedSigners}/${link.initialSigners})`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && (
              <p className="text-sm text-zinc-500">
                No invite links match this filter.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-zinc-500">{data.totalCount} links</p>
              <Pagination
                page={page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )
      )}
    </div>
  );
}
