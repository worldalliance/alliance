import { acceptsStaffAssignment } from "@alliance/common/community";
import type {
  CommunityDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { groupHref } from "../../lib/hrefs";
import {
  MembershipChange,
  useChangeCommunityMembershipAdmin,
  useCommunitiesAdmin,
  useMoveCommunityMemberAdmin,
} from "../../lib/useCommunitiesAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Select } from "../../ui/Select";
import { nameLinkClass } from "../../ui/styles";
import { Panel } from "../../ui/templates/Overview";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

const NO_GROUPS: CommunityDto[] = [];

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/** The member's groups, and moving or assigning them to another. */
export function MemberGroupsPanel({
  user,
  refreshUser,
}: {
  user: UserAdminDetailDto;
  refreshUser: () => Promise<unknown>;
}) {
  const groups = useCommunitiesAdmin();
  const allGroups = groups.data ?? NO_GROUPS;
  const { mutateAsync: moveMember } = useMoveCommunityMemberAdmin();
  const { mutateAsync: changeMembership } = useChangeCommunityMembershipAdmin();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leads = useMemo(() => new Set(user.leaderOfIds ?? []), [user.leaderOfIds]);
  const theirGroups = useMemo(
    () => [...(user.communities ?? [])].sort(byName),
    [user.communities],
  );
  const memberOf = useMemo(
    () => theirGroups.filter((group) => !leads.has(group.id)),
    [leads, theirGroups],
  );
  const destinations = useMemo(() => {
    const current = new Set(theirGroups.map((group) => group.id));
    return allGroups
      .filter((group) => !current.has(group.id) && acceptsStaffAssignment(group))
      .sort(byName);
  }, [allGroups, theirGroups]);

  useEffect(() => {
    setSourceId((current) =>
      memberOf.some((group) => group.id.toString() === current)
        ? current
        : memberOf.length === 1
          ? memberOf[0].id.toString()
          : "",
    );
  }, [memberOf]);

  useEffect(() => {
    setDestinationId((current) =>
      destinations.some((group) => group.id.toString() === current)
        ? current
        : "",
    );
  }, [destinations]);

  const moves = memberOf.length > 0;
  const verb = moves ? "Move member" : "Assign member";

  // From the server's moveUserBetweenCommunitiesAdmin and
  // placeUserInCommunityAdmin: the member, both groups' leaders and the new
  // group's members are notified.
  const submit = async () => {
    const source = memberOf.find((group) => group.id.toString() === sourceId);
    const destination = destinations.find(
      (group) => group.id.toString() === destinationId,
    );
    if (!destination) {
      setError(`Choose the group to ${moves ? "move" : "assign"} them to.`);
      return;
    }
    if (moves && !source) {
      setError("Choose the group to move them from.");
      return;
    }
    const confirmed = await confirm({
      title: source
        ? `Move ${user.name} to ${destination.name}?`
        : `Assign ${user.name} to ${destination.name}?`,
      message: source
        ? `They leave ${source.name} and join ${destination.name}. ${user.name}, the leaders of both groups and the members of ${destination.name} are notified.`
        : `${user.name}, the leaders of ${destination.name} and its members are notified.`,
      confirmLabel: verb,
    });
    if (!confirmed) return;

    setMoving(true);
    setError(null);
    let updated = false;
    try {
      if (source) {
        await moveMember({
          userId: user.id,
          sourceCommunityId: source.id,
          destinationCommunityId: destination.id,
        });
      } else {
        await changeMembership({
          communityId: destination.id,
          userId: user.id,
          change: MembershipChange.AddMember,
        });
      }
      updated = true;
      await refreshUser();
      success(source ? "Member moved" : "Member assigned", destination.name);
    } catch (caught) {
      setError(
        updated
          ? "Membership was updated, but the page could not refresh. Reload to see their latest groups."
          : adminRefusalMessage(
              caught,
              source
                ? "Couldn't move this member."
                : "Couldn't assign this member.",
            ),
      );
    } finally {
      setMoving(false);
    }
  };

  const noRoom =
    user.hasActiveContract &&
    !groups.isPending &&
    !groups.isLoadingError &&
    destinations.length === 0;

  return (
    <Panel title="Groups">
      <div className="flex flex-col gap-5">
        {theirGroups.length === 0 ? (
          <p className="text-fg-muted">Not in a group.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {theirGroups.map((group) => (
              <li key={group.id} className="flex min-h-10 items-center gap-2">
                <Link to={groupHref(group.id)} className={nameLinkClass}>
                  {group.name}
                </Link>
                {leads.has(group.id) && <Badge>Leader</Badge>}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-4 border-t border-line pt-5">
          {moves && (
            <Field label="Move from">
              {(control) => (
                <Select
                  {...control}
                  value={sourceId}
                  disabled={moving || !user.hasActiveContract}
                  onChange={(event) => setSourceId(event.target.value)}
                >
                  <option value="">Choose their current group</option>
                  {memberOf.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field
            label={moves ? "Move to" : "Assign to"}
            help={
              !user.hasActiveContract
                ? "An active contract is required for group membership."
                : noRoom
                  ? "No groups with staff assignments and available capacity."
                  : "Only groups that take staff assignments and have room."
            }
            error={
              groups.isLoadingError
                ? adminRefusalMessage(groups.error, "Couldn't load groups.")
                : null
            }
          >
            {(control) => (
              <Select
                {...control}
                value={destinationId}
                disabled={moving || !user.hasActiveContract}
                onChange={(event) => setDestinationId(event.target.value)}
              >
                <option value="">
                  {groups.isPending ? "Loading groups…" : "Choose a group"}
                </option>
                {destinations.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {leads.size > 0 && (
            <p className="text-caption text-fg-muted">
              Moving a member doesn't change the groups they lead.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={ButtonVariant.Default}
              busy={moving}
              disabled={!user.hasActiveContract}
              onClick={() => void submit()}
            >
              {verb}
            </Button>
            <InlineError message={error} />
          </div>
        </div>
      </div>
    </Panel>
  );
}
