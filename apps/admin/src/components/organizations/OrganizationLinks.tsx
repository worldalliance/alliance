import { waitlistLinkUrl } from "@alliance/common/waitlist";
import {
  waitlistAdminCreateLinkAdmin,
  waitlistAdminUpdateLinkAdmin,
} from "@alliance/shared/client";
import type {
  AdminWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "@alliance/shared/client/types.gen";
import { formatMediumDateEnUS } from "@alliance/shared/lib/dateFormatters";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import React, { useState } from "react";
import { fromDateInput, toDateInput } from "../../lib/dateInput";
import { useRefusalToast } from "../../lib/useRefusalToast";
import ConfirmDialog from "../ConfirmDialog";
import InlineTextInput from "../InlineTextInput";

type OrganizationLinksProps = {
  organizationId: number;
  links: AdminWaitlistLinkDto[];
};

const OrganizationLinks: React.FC<OrganizationLinksProps> = ({
  organizationId,
  links,
}) => {
  const queryClient = useQueryClient();
  const refusalToast = useRefusalToast();
  const { success, error: toastError } = useToast();
  const [channel, setChannel] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const [archiving, setArchiving] = useState<AdminWaitlistLinkDto | null>(null);

  const invalidateLinks = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlistLinksAdmin() });

  const create = useMutation({
    mutationFn: (publishedAt: string | null) =>
      waitlistAdminCreateLinkAdmin({
        body: { organizationId, channel: channel.trim(), publishedAt },
        throwOnError: true,
      }),
    onSuccess: async () => {
      setChannel("");
      setPublishedOn("");
      await invalidateLinks();
    },
    onError: (err) => refusalToast(err, "Could not create the link."),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateWaitlistLinkDto }) =>
      waitlistAdminUpdateLinkAdmin({ path: { id }, body, throwOnError: true }),
    onSettled: async () => {
      setArchiving(null);
      await invalidateLinks();
    },
    onError: (err) => refusalToast(err, "Could not update the link."),
  });

  const copy = async (code: string) => {
    const copied = await copyToClipboard(
      waitlistLinkUrl(getInviteBaseUrl(), code),
    );
    if (copied) success("Link copied");
    else toastError("Could not copy the link.");
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-800">Waitlist links</h3>
      {links.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-600">Channel</th>
                <th className="px-3 py-2 font-medium text-zinc-600">Link</th>
                <th className="px-3 py-2 font-medium text-zinc-600">
                  Published
                </th>
                <th className="px-3 py-2 font-medium text-zinc-600">Created</th>
                <th className="px-3 py-2 font-medium text-zinc-600">Entries</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  onCopy={() => void copy(link.code)}
                  onUpdate={(body, onSettled) =>
                    update.mutate({ id: link.id, body }, { onSettled })
                  }
                  onArchive={() => setArchiving(link)}
                  disabled={update.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const publishedAt = fromDateInput(publishedOn);
          if (!publishedAt.ok) toastError(publishedAt.error);
          else if (channel.trim()) create.mutate(publishedAt.value);
        }}
      >
        <input
          aria-label="New link's channel"
          className="border border-zinc-300 rounded px-2 py-1 text-sm"
          value={channel}
          maxLength={200}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Channel, e.g. Newsletter"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          Published
          <input
            type="date"
            className="border border-zinc-300 rounded px-2 py-1"
            value={publishedOn}
            onChange={(e) => setPublishedOn(e.target.value)}
          />
        </label>
        <Button
          color={ButtonColor.White}
          size="small"
          type="submit"
          disabled={!channel.trim() || create.isPending}
        >
          Add link
        </Button>
      </form>
      <ConfirmDialog
        isOpen={archiving !== null}
        title="Archive this link?"
        message={`People who open the "${archiving?.channel}" link will be told it is no longer active, and can join without it. Entries already attributed to it keep their attribution.`}
        onConfirm={() =>
          archiving &&
          update.mutate({ id: archiving.id, body: { archived: true } })
        }
        onCancel={() => setArchiving(null)}
        isLoading={update.isPending}
      />
    </div>
  );
};

type LinkRowProps = {
  link: AdminWaitlistLinkDto;
  onCopy: () => void;
  onUpdate: (body: UpdateWaitlistLinkDto, onSettled?: () => void) => void;
  onArchive: () => void;
  disabled: boolean;
};

const LinkRow: React.FC<LinkRowProps> = ({
  link,
  onCopy,
  onUpdate,
  onArchive,
  disabled,
}) => {
  const { error: toastError } = useToast();
  const [draftPublished, setDraftPublished] = useState<string | null>(null);
  const archived = link.archivedAt !== null;

  const savePublished = () => {
    if (draftPublished === null) return;
    const done = () => setDraftPublished(null);
    const publishedAt = fromDateInput(draftPublished);
    if (!publishedAt.ok) toastError(publishedAt.error);
    else if (draftPublished !== toDateInput(link.publishedAt)) {
      onUpdate({ publishedAt: publishedAt.value }, done);
    } else done();
  };

  return (
    <tr className={archived ? "text-zinc-400" : undefined}>
      <td className="px-3 py-2">
        <InlineTextInput
          aria-label="Channel"
          className="border border-transparent hover:border-zinc-300 focus:border-zinc-400 rounded px-1 py-0.5"
          value={link.channel}
          maxLength={200}
          disabled={disabled}
          onSave={(channel, done) => onUpdate({ channel }, done)}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy link"
          title="Copy link"
          className="inline-flex items-center gap-1 font-mono text-xs hover:text-black"
        >
          {link.code}
          <Copy size={14} />
        </button>
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          aria-label="Publication date"
          className="border border-zinc-200 rounded px-1 py-0.5"
          value={draftPublished ?? toDateInput(link.publishedAt)}
          disabled={disabled}
          onChange={(e) => setDraftPublished(e.target.value)}
          onBlur={savePublished}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </td>
      <td className="px-3 py-2">
        {formatMediumDateEnUS(new Date(link.createdAt))}
      </td>
      <td className="px-3 py-2">{link.entryCount}</td>
      <td className="px-3 py-2 text-right">
        <Button
          color={ButtonColor.Transparent}
          size="small"
          disabled={disabled}
          onClick={() =>
            archived ? onUpdate({ archived: false }) : onArchive()
          }
        >
          {archived ? "Restore" : "Archive"}
        </Button>
      </td>
    </tr>
  );
};

export default OrganizationLinks;
