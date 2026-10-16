import { errorMessage } from "@alliance/common/errorMessage";
import { userUpdateUserRolesAdmin } from "@alliance/shared/client";
import { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useState } from "react";
import { useAuth } from "../../lib/AuthContext";

export default function UserRolesSection({
  user,
  onUserUpdated,
}: {
  user: UserAdminDetailDto;
  onUserUpdated: (user: UserAdminDetailDto) => void;
}) {
  const [isAmbassadorPending, setIsAmbassadorPending] = useState(false);
  const [isStaffPending, setIsStaffPending] = useState(false);
  const [isAdminPending, setIsAdminPending] = useState(false);
  const [roleMutationError, setRoleMutationError] = useState<string | null>(
    null,
  );
  const { user: viewer } = useAuth();
  const isSelf = viewer?.id === user.id;

  const handleAmbassadorToggle = useCallback(
    async (nextChecked: boolean) => {
      setIsAmbassadorPending(true);
      setRoleMutationError(null);
      try {
        const res = await userUpdateUserRolesAdmin({
          path: { id: user.id },
          body: { ambassador: nextChecked },
        });
        if (res.data) {
          onUserUpdated(res.data);
        }
      } catch (error) {
        console.error("Failed to update user role", error);
        setRoleMutationError("Failed to update role. Try again.");
      } finally {
        setIsAmbassadorPending(false);
      }
    },
    [onUserUpdated, user.id],
  );

  const handleStaffToggle = useCallback(
    async (nextChecked: boolean) => {
      setIsStaffPending(true);
      setRoleMutationError(null);
      try {
        const res = await userUpdateUserRolesAdmin({
          path: { id: user.id },
          body: { staff: nextChecked },
        });
        if (res.data) {
          onUserUpdated(res.data);
        }
      } catch (error) {
        console.error("Failed to update user role", error);
        setRoleMutationError("Failed to update role. Try again.");
      } finally {
        setIsStaffPending(false);
      }
    },
    [onUserUpdated, user.id],
  );

  const handleAdminToggle = useCallback(
    async (nextChecked: boolean) => {
      setIsAdminPending(true);
      setRoleMutationError(null);
      try {
        const res = await userUpdateUserRolesAdmin({
          path: { id: user.id },
          body: { admin: nextChecked },
          throwOnError: true,
        });
        onUserUpdated(res.data);
      } catch (error) {
        setRoleMutationError(
          errorMessage({ error, fallback: "Could not update admin status." }),
        );
      } finally {
        setIsAdminPending(false);
      }
    },
    [onUserUpdated, user.id],
  );

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Roles</h2>
      {roleMutationError && (
        <p className="text-xs text-red-500 mb-2">{roleMutationError}</p>
      )}
      <div className="space-y-1">
        <label
          className={cn(
            "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
            isStaffPending && "opacity-50",
          )}
        >
          <input
            type="checkbox"
            checked={user.staff}
            disabled={isStaffPending}
            onChange={(e) => handleStaffToggle(e.target.checked)}
            className="rounded"
          />
          <span className={user.staff ? "text-zinc-900" : "text-zinc-500"}>
            Staff
          </span>
        </label>
        <label
          className={cn(
            "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
            isAmbassadorPending && "opacity-50",
          )}
        >
          <input
            type="checkbox"
            checked={user.ambassador}
            disabled={isAmbassadorPending}
            onChange={(e) => handleAmbassadorToggle(e.target.checked)}
            className="rounded"
          />
          <span className={user.ambassador ? "text-zinc-900" : "text-zinc-500"}>
            Ambassador
          </span>
        </label>
        <label
          className={cn(
            "flex items-center gap-2 text-sm px-1 py-0.5 rounded",
            isSelf ? "cursor-not-allowed" : "cursor-pointer hover:bg-zinc-50",
            isAdminPending && "opacity-50",
          )}
          title={isSelf ? "You cannot change your own admin status" : undefined}
        >
          <input
            type="checkbox"
            checked={user.admin}
            disabled={isAdminPending || isSelf}
            onChange={(e) => handleAdminToggle(e.target.checked)}
            className="rounded"
          />
          <span className={user.admin ? "text-zinc-900" : "text-zinc-500"}>
            Admin
          </span>
        </label>
      </div>
    </section>
  );
}
