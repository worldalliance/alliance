import { useMutation } from "@tanstack/react-query";
import {
  userGroupAssignmentJoinGroupAssignment,
  userGroupAssignmentLeaveGroupAssignment,
} from "../client";

/** Joins or leaves group assignment. The flag lives on the signed-in user, so
 * `onChanged` reloads it once a request succeeds. */
export function useGroupAssignment(params: { onChanged: () => Promise<void> }) {
  const join = useMutation({
    mutationFn: () =>
      userGroupAssignmentJoinGroupAssignment({ throwOnError: true }),
    onSuccess: params.onChanged,
  });
  const leave = useMutation({
    mutationFn: () =>
      userGroupAssignmentLeaveGroupAssignment({ throwOnError: true }),
    onSuccess: params.onChanged,
  });
  return { join, leave };
}
