import type {
  UserAdminDetailDto,
  UserAwayRangeDto,
} from "@alliance/shared/client/types.gen";
import { Link } from "react-router";
import { groupHref } from "../../lib/hrefs";
import Badge, { BadgeTone } from "../../ui/Badge";
import { cn } from "../../ui/cn";
import { linkClass } from "../../ui/styles";
import { Fact, FactList, SidePanelSection } from "../../ui/templates/Record";
import { formatAwayRange } from "./awayRange";
import {
  CONTRACT_STANDING,
  contractStanding,
  memberLocation,
  memberRoles,
  ROLE_LABEL,
} from "./memberRules";

/** The member's current away range: `undefined` while it loads or when it couldn't. */
export type CurrentAway = UserAwayRangeDto | null | undefined;

export function MemberStatusBadges({
  user,
  away,
}: {
  user: UserAdminDetailDto;
  away: CurrentAway;
}) {
  const standing = CONTRACT_STANDING[contractStanding(user)];
  return (
    <>
      <Badge tone={standing.tone}>{standing.label}</Badge>
      {away && <Badge tone={BadgeTone.Warning}>Away</Badge>}
    </>
  );
}

/** Where the member stands: contract, time away, roles, groups, tags and details. */
export function MemberStandingFacts({
  user,
  away,
}: {
  user: UserAdminDetailDto;
  away: CurrentAway;
}) {
  const standing = CONTRACT_STANDING[contractStanding(user)];
  const leads = new Set(user.leaderOfIds ?? []);
  const groups = [...(user.communities ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const tags = [...(user.tags ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const roles = memberRoles(user);
  return (
    <>
      <SidePanelSection title="Standing">
        <FactList>
          <Fact label="Contract">
            <Badge tone={standing.tone}>{standing.label}</Badge>
          </Fact>
          <Fact label="Away">
            {away === undefined
              ? "—"
              : away === null
                ? "No"
                : formatAwayRange(away)}
          </Fact>
          <Fact label="Roles">
            {roles.length > 0
              ? roles.map((role) => ROLE_LABEL[role]).join(", ")
              : "None"}
          </Fact>
        </FactList>
      </SidePanelSection>
      <SidePanelSection title="Groups">
        {groups.length === 0 ? (
          <p className="flex min-h-9 items-center text-fg-muted">
            Not in a group
          </p>
        ) : (
          <ul className="flex flex-col">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex min-h-9 min-w-0 items-center gap-1.5"
              >
                <Link
                  to={groupHref(group.id)}
                  title={group.name}
                  className={cn(linkClass, "truncate")}
                >
                  {group.name}
                </Link>
                {leads.has(group.id) && <Badge>Leader</Badge>}
              </li>
            ))}
          </ul>
        )}
      </SidePanelSection>
      <SidePanelSection title="Tags">
        {tags.length === 0 ? (
          <p className="flex min-h-9 items-center text-fg-muted">No tags</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5 py-2">
            {tags.map((tag) => (
              <li key={tag.id} className="flex">
                <Badge>{tag.name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SidePanelSection>
      <SidePanelSection title="Details">
        <FactList>
          <Fact label="Location">{memberLocation(user) ?? "—"}</Fact>
          <Fact label="Time zone">{user.timeZone ?? "—"}</Fact>
          <Fact label="Member ID">
            <span className="font-mono text-xs text-fg-muted">{user.id}</span>
          </Fact>
        </FactList>
      </SidePanelSection>
    </>
  );
}
