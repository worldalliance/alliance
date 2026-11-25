import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminRefusalMessage, rowRefusalMessage } from "../../lib/adminRefusal";
import { useCampaignsAdmin } from "../../lib/useCampaignsAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useExternalShareTargetsAdmin } from "../../lib/useExternalShareTargetsAdmin";
import { useShareLinksAdmin } from "../../lib/useShareLinksAdmin";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { useSelectableUsers } from "../../ui/UserSelect";
import { EditShareLinkLabelDialog } from "./EditShareLinkLabelDialog";
import { FailureBanner } from "./FailureBanner";
import { NewCampaignDialog } from "./NewCampaignDialog";
import { NewDuplicateLinkForm } from "./NewDuplicateLinkForm";
import { ShareLinkOwnerBar } from "./ShareLinkOwnerBar";
import {
  shareLinkName,
  ShareLinksTable,
  SIGNUPS_COLUMN,
} from "./ShareLinksTable";
import {
  groupShareLinks,
  type Target,
  targetColumns,
  targetName,
} from "./shareLinkTargets";
import { useCopyLink } from "./useCopyLink";
import { OwnerKind, useShareLinkOwner } from "./useShareLinkOwner";

const matches = (link: ShareUrlAdminDto, target: Target, needle: string) =>
  [link.label ?? "", link.url, link.sid ?? "", targetName(target)].some(
    (text) => text.toLowerCase().includes(needle),
  );

export function ShareLinksTab() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const ownerParam = useShareLinkOwner();
  const users = useSelectableUsers();
  const campaigns = useCampaignsAdmin();
  const tasks = useActionsAdmin();
  const shareTargets = useExternalShareTargetsAdmin();
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const ownerName =
    ownerParam.id === null
      ? null
      : ownerParam.kind === OwnerKind.Member
        ? (users.users.find((u) => u.id === ownerParam.id)?.name ??
          `Member ${ownerParam.id}`)
        : (campaigns.data?.find((c) => c.id === ownerParam.id)?.name ??
          `Campaign ${ownerParam.id}`);
  const owner =
    ownerParam.id === null
      ? null
      : { type: ownerParam.kind, id: ownerParam.id };
  const ownerKey = owner ? `${owner.type}-${owner.id}` : null;
  // A write's outcome is said only while its owner is still the one shown.
  const ownerKeyRef = useRef(ownerKey);
  useEffect(() => {
    ownerKeyRef.current = ownerKey;
  }, [ownerKey]);

  const { links, updateLabel, remove, createDuplicate } =
    useShareLinksAdmin(owner);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groupShareLinks(links.data ?? [])
      .map((group) => ({
        ...group,
        rows: group.rows.filter((link) => matches(link, group.target, needle)),
      }))
      .filter((group) => group.rows.length > 0);
  }, [links.data, q]);
  const shown = groups.reduce((sum, group) => sum + group.rows.length, 0);

  const [failure, setFailure] = useState<string | null>(null);
  const copy = useCopyLink(setFailure);
  const [createRefusal, setCreateRefusal] = useState<string | null>(null);
  useEffect(() => {
    setFailure(null);
    setCreateRefusal(null);
  }, [ownerKey]);

  const create = async (input: { target: Target; label: string }) => {
    if (!owner) return false;
    const requestKey = ownerKey;
    setCreateRefusal(null);
    try {
      await createDuplicate.mutateAsync({
        owner,
        target: {
          ...targetColumns(input.target),
          label: input.label.trim() || undefined,
        },
      });
      if (ownerKeyRef.current !== requestKey) return false;
      success("Duplicate link created");
      return true;
    } catch (error) {
      if (ownerKeyRef.current === requestKey) {
        setCreateRefusal(
          adminRefusalMessage(error, "Couldn't create the duplicate link."),
        );
      }
      return false;
    }
  };

  const [labelling, setLabelling] = useState<ShareUrlAdminDto | null>(null);
  const [labelRefusal, setLabelRefusal] = useState<string | null>(null);
  const saveLabel = async (link: ShareUrlAdminDto, label: string) => {
    if (!owner) return;
    const requestKey = ownerKey;
    setLabelRefusal(null);
    try {
      await updateLabel.mutateAsync({ owner, id: link.id, label });
      if (ownerKeyRef.current !== requestKey) return;
      success("Label updated");
      setLabelling(null);
    } catch (error) {
      if (ownerKeyRef.current === requestKey) {
        setLabelRefusal(adminRefusalMessage(error, "Couldn't save the label."));
      }
    }
  };

  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: groups.flatMap((group) => group.rows.map((link) => link.id)),
    fallback: searchRef,
  });
  const deleteLink = async (link: ShareUrlAdminDto) => {
    if (!owner || !ownerName) return;
    const confirmed = await confirm({
      title: `Delete the share link “${shareLinkName(link)}”?`,
      message: link.externalTarget
        ? `Anyone who has this link still reaches the partner's page as before, but its code stops pointing to ${ownerName}: signups that carry it are no longer credited to them. This can't be undone.`
        : `Anyone who has this link can still open it, but its code stops pointing to ${ownerName}: the page no longer names them, and signups through it are no longer credited to them. This can't be undone.`,
      confirmLabel: "Delete link",
      destructive: true,
    });
    if (!confirmed) return;
    const requestKey = ownerKey;
    setFailure(null);
    const focusNeighbour = focus.removing(link.id);
    try {
      await remove.mutateAsync({ owner, id: link.id });
      if (ownerKeyRef.current !== requestKey) return;
      success("Share link deleted");
      focusNeighbour();
    } catch (error) {
      if (ownerKeyRef.current === requestKey) {
        setFailure(
          rowRefusalMessage(
            error,
            `Couldn't delete the share link “${shareLinkName(link)}”`,
          ),
        );
      }
    }
  };

  return (
    <>
      <RefreshFailedBanner
        parts={[
          { things: "share links", query: links },
          { things: "campaigns", query: campaigns },
          { things: "tasks", query: tasks },
          { things: "share targets", query: shareTargets },
        ]}
      />
      <FailureBanner message={failure} onDismiss={() => setFailure(null)} />
      <ShareLinkOwnerBar
        kind={ownerParam.kind}
        id={ownerParam.id}
        onKindChange={ownerParam.setKind}
        onIdChange={ownerParam.setId}
        users={users}
        campaigns={campaigns}
        onNewCampaign={() => setCreatingCampaign(true)}
      />
      {ownerName && (
        <NewDuplicateLinkForm
          key={ownerKey}
          ownerName={ownerName}
          tasks={tasks}
          shareTargets={shareTargets}
          busy={createDuplicate.isPending}
          refusal={createRefusal}
          onCreate={create}
        />
      )}
      <FilterBar
        count={listCount({
          shown,
          total: links.data?.length,
          noun: "share link",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter share links"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={owner !== null && links.isPending}
          skeleton={
            <TableSkeleton
              bleed
              columns={6}
              columnClassNames={[
                undefined,
                undefined,
                undefined,
                undefined,
                SIGNUPS_COLUMN,
              ]}
            />
          }
          error={
            links.isLoadingError
              ? adminRefusalMessage(links.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load share links"
          onRetry={() => void links.refetch()}
          retrying={links.isFetching}
          empty={shown === 0}
          filtered={owner !== null && q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle={
            ownerName
              ? `${ownerName} has no share links yet`
              : "Choose a member or campaign"
          }
          emptyDescription={
            ownerName
              ? undefined
              : "Their share links appear here, grouped by what each links to."
          }
        >
          <ShareLinksTable
            groups={groups}
            rowProps={focus.row}
            deletingId={
              remove.isPending ? (remove.variables?.id ?? null) : null
            }
            onCopy={(url) => void copy(url)}
            onEditLabel={(link) => {
              setLabelRefusal(null);
              setLabelling(link);
            }}
            onDelete={(link) => void deleteLink(link)}
          />
        </ContentState>
      </ListContent>
      {labelling && (
        <EditShareLinkLabelDialog
          link={labelling}
          busy={updateLabel.isPending}
          refusal={labelRefusal}
          onSave={(label) => void saveLabel(labelling, label)}
          onClose={() => setLabelling(null)}
        />
      )}
      {creatingCampaign && (
        <NewCampaignDialog
          onClose={() => setCreatingCampaign(false)}
          onCreated={(campaign) => {
            setCreatingCampaign(false);
            ownerParam.setId(campaign.id);
          }}
        />
      )}
    </>
  );
}
