import type {
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useAuth } from "../../lib/AuthContext";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import InlineError from "../../ui/InlineError";
import { Switch } from "../../ui/Switch";
import { Panel } from "../../ui/templates/Overview";
import { MEMBER_ROLES, MemberRole, ROLE_LABEL } from "./memberRules";

const ROLE_HELP: Record<MemberRole, string | null> = {
  [MemberRole.Staff]: null,
  [MemberRole.Ambassador]: null,
  [MemberRole.Admin]: "Can use this admin panel.",
};

/** Staff, ambassador and admin, each saved as it is switched. */
export function MemberRolesPanel({
  user,
  updateRoles,
}: {
  user: UserAdminDetailDto;
  updateRoles: (body: UpdateUserRolesAdminDto) => Promise<unknown>;
}) {
  const { user: viewer } = useAuth();
  const confirm = useConfirmOnPage();
  const [pending, setPending] = useState<ReadonlySet<MemberRole>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const isSelf = viewer?.id === user.id;

  // From the server's updateRolesAdmin: an admin grant or revocation is
  // written to the event log, and a revocation drops their live texting
  // connection.
  const confirmAdmin = (next: boolean) =>
    confirm(
      next
        ? {
            title: `Make ${user.name} an admin?`,
            message:
              "Admins can do everything in this admin panel, for every member. The change is recorded in the event log.",
            confirmLabel: "Make admin",
          }
        : {
            title: `Remove ${user.name}'s admin access?`,
            message:
              "They can no longer use this admin panel. The change is recorded in the event log.",
            confirmLabel: "Remove admin",
            destructive: true,
          },
    );

  const toggle = async (role: MemberRole, next: boolean) => {
    if (role === MemberRole.Admin && !(await confirmAdmin(next))) return;
    setError(null);
    setPending((current) => new Set(current).add(role));
    try {
      await updateRoles({ [role]: next });
    } catch (caught) {
      setError(adminRefusalMessage(caught, "Couldn't change the role."));
    } finally {
      setPending((current) => {
        const rest = new Set(current);
        rest.delete(role);
        return rest;
      });
    }
  };

  return (
    <Panel title="Roles">
      <ul className="flex flex-col gap-3">
        {MEMBER_ROLES.map((role) => {
          const lockedSelf = role === MemberRole.Admin && isSelf;
          return (
            <li key={role}>
              <label className="flex items-start gap-3">
                <Switch
                  className="mt-0.5"
                  checked={user[role]}
                  disabled={pending.has(role) || lockedSelf}
                  onCheckedChange={(next) => void toggle(role, next)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{ROLE_LABEL[role]}</span>
                  {(lockedSelf || ROLE_HELP[role]) && (
                    <span className="text-caption text-fg-muted">
                      {lockedSelf
                        ? "You can't change your own admin status."
                        : ROLE_HELP[role]}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <InlineError message={error} className="mt-3" />
    </Panel>
  );
}
