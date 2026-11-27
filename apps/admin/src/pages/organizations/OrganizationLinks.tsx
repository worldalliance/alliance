import { waitlistLinkUrl } from "@alliance/common/waitlist";
import type {
  AdminWaitlistLinkDto,
  UpdateWaitlistLinkDto,
} from "@alliance/shared/client/types.gen";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { Copy } from "lucide-react";
import { useState } from "react";
import InlineTextInput from "../../components/InlineTextInput";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { fromDateInput, toDateInput } from "../../lib/dateInput";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useCreateWaitlistLinkAdmin,
  useUpdateWaitlistLinkAdmin,
} from "../../lib/useWaitlistLinksAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { cn } from "../../ui/cn";
import { DateField } from "../../ui/DateField";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import { controlClass } from "../../ui/styles";
import { Switch } from "../../ui/Switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

function AddLinkForm({ organizationId }: { organizationId: number }) {
  const [channel, setChannel] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const [showReferralMessage, setShowReferralMessage] = useState(true);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const create = useCreateWaitlistLinkAdmin({
    onSuccess: () => {
      setChannel("");
      setPublishedOn("");
      setShowReferralMessage(true);
    },
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't add the link.")),
  });

  return (
    <form
      noValidate
      className="flex flex-wrap items-start gap-x-4 gap-y-3 border-t border-line p-card"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = channel.trim();
        const publishedAt = fromDateInput(publishedOn);
        setChannelError(trimmed ? null : "Enter the channel the link is for");
        setDateError(publishedAt.ok ? null : publishedAt.error);
        if (!trimmed || !publishedAt.ok) return;
        setRefusal(null);
        create.mutate({
          organizationId,
          channel: trimmed,
          publishedAt: publishedAt.value,
          showReferralMessage,
        });
      }}
    >
      <Field label="New link's channel" error={channelError} className="w-64">
        {(control) => (
          <Input
            {...control}
            value={channel}
            maxLength={200}
            placeholder="Newsletter"
            readOnly={create.isPending}
            onChange={(event) => {
              setChannel(event.target.value);
              setChannelError(null);
            }}
          />
        )}
      </Field>
      <Field label="Published" mark="optional" error={dateError}>
        {(control) => (
          <DateField
            {...control}
            value={publishedOn}
            readOnly={create.isPending}
            onChange={(value) => {
              setPublishedOn(value);
              setDateError(null);
            }}
          />
        )}
      </Field>
      <label className="flex h-control items-center gap-2 self-end">
        <Checkbox
          checked={showReferralMessage}
          disabled={create.isPending}
          onChange={(event) => setShowReferralMessage(event.target.checked)}
        />
        Show referral message
      </label>
      <div className="flex items-center gap-3 self-end">
        <Button
          variant={ButtonVariant.Default}
          type="submit"
          busy={create.isPending}
        >
          Add link
        </Button>
        <InlineError message={refusal} />
      </div>
    </form>
  );
}

function LinkRow({
  link,
  disabled,
  onUpdate,
  onArchive,
  onCopy,
  onProblem,
}: {
  link: AdminWaitlistLinkDto;
  disabled: boolean;
  onUpdate: (body: UpdateWaitlistLinkDto, onSettled?: () => void) => void;
  onArchive: () => void;
  onCopy: () => void;
  onProblem: (message: string) => void;
}) {
  const [draftPublished, setDraftPublished] = useState<string | null>(null);
  const archived = link.archivedAt !== null;

  const savePublished = () => {
    if (draftPublished === null) return;
    const done = () => setDraftPublished(null);
    const publishedAt = fromDateInput(draftPublished);
    if (!publishedAt.ok) {
      onProblem(publishedAt.error);
      done();
    } else if (draftPublished !== toDateInput(link.publishedAt)) {
      onUpdate({ publishedAt: publishedAt.value }, done);
    } else done();
  };

  return (
    <TableRow className={cn(archived && "text-fg-muted")}>
      <TableCell>
        <span className="flex items-center gap-2">
          <InlineTextInput
            aria-label="Channel"
            className={cn(controlClass, "h-control-sm w-48")}
            value={link.channel}
            maxLength={200}
            disabled={disabled}
            onSave={(channel, done) => onUpdate({ channel }, done)}
          />
          {archived && <Badge tone={BadgeTone.Neutral}>Archived</Badge>}
        </span>
      </TableCell>
      <TableCell>
        <Button
          size="small"
          variant={ButtonVariant.Ghost}
          aria-label={`Copy link: ${link.channel}`}
          title="Copy link"
          onClick={onCopy}
        >
          <span className="font-mono text-xs">{link.code}</span>
          <Copy aria-hidden="true" className="size-3.5" />
        </Button>
      </TableCell>
      <TableCell>
        <DateField
          aria-label="Publication date"
          className="h-control-sm w-40"
          value={draftPublished ?? toDateInput(link.publishedAt)}
          disabled={disabled}
          onChange={setDraftPublished}
          onBlur={savePublished}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </TableCell>
      <TableCell>{formatDate(link.createdAt)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(link.entryCount)}
      </TableCell>
      <TableCell>
        <Switch
          aria-label={`Show referral message for ${link.channel}`}
          checked={link.showReferralMessage}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onUpdate({ showReferralMessage: checked })
          }
        />
      </TableCell>
      <TableCell actions>
        <Button
          size="small"
          variant={ButtonVariant.Default}
          aria-label={`${archived ? "Restore" : "Archive"}: ${link.channel}`}
          disabled={disabled}
          onClick={() =>
            archived ? onUpdate({ archived: false }) : onArchive()
          }
        >
          {archived ? "Restore" : "Archive"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function OrganizationLinks({
  organizationId,
  links,
}: {
  organizationId: number;
  links: readonly AdminWaitlistLinkDto[];
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const [problem, setProblem] = useState<string | null>(null);
  const update = useUpdateWaitlistLinkAdmin({
    onSettled: () => {},
    onError: (error) =>
      setProblem(adminRefusalMessage(error, "Couldn't update the link.")),
  });
  const save = (
    link: AdminWaitlistLinkDto,
    body: UpdateWaitlistLinkDto,
    onSettled?: () => void,
  ) => {
    setProblem(null);
    update.mutate({ id: link.id, body }, { onSettled });
  };

  // From waitlist.service's resolveReferral, which treats an archived link's
  // code as unknown; archiving leaves entries' sourceLinkId alone.
  const archive = async (link: AdminWaitlistLinkDto) => {
    const confirmed = await confirm({
      title: `Archive the link “${link.channel}”?`,
      message:
        "People who open it will be told it is no longer active, and can join without it. Entries already attributed to it keep their attribution.",
      confirmLabel: "Archive link",
    });
    if (confirmed) save(link, { archived: true });
  };

  const copy = async (link: AdminWaitlistLinkDto) => {
    setProblem(null);
    if (await copyToClipboard(waitlistLinkUrl(getInviteBaseUrl(), link.code))) {
      success("Link copied", link.channel);
    } else {
      setProblem("Couldn't copy the link.");
    }
  };

  return (
    <section className="flex flex-col border-t border-line">
      <div className="flex flex-col gap-1 px-card pt-card pb-3">
        <h3 className="font-semibold">Waitlist links</h3>
        <p className="max-w-prose text-fg-muted">
          With the referral message on, a link's page shows the organization's
          invitation, logo and signup count. Off, it shows the standard page;
          signups still count toward the link and the organization.
        </p>
        <InlineError message={problem} />
      </div>
      {links.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Link code</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead>Referral message</TableHead>
              <TableHead actions>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                disabled={update.isPending}
                onUpdate={(body, onSettled) => save(link, body, onSettled)}
                onArchive={() => void archive(link)}
                onCopy={() => void copy(link)}
                onProblem={setProblem}
              />
            ))}
          </TableBody>
        </Table>
      )}
      <AddLinkForm organizationId={organizationId} />
    </section>
  );
}
