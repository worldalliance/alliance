import { useCallback } from "react";
import { Alert } from "react-native";

/** Approve, reject and delete handlers that alert when the write fails. */
export function useOnetimeInviteAlerts(mutations: {
  approveInvite: (inviteId: number) => Promise<unknown>;
  rejectInvite: (inviteId: number) => Promise<unknown>;
  deleteInvite: (inviteId: number) => Promise<unknown>;
}) {
  const { approveInvite, rejectInvite, deleteInvite } = mutations;

  const handleApprove = useCallback(
    (inviteId: number) => {
      void approveInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to approve invite");
      });
    },
    [approveInvite],
  );

  const handleReject = useCallback(
    (inviteId: number) => {
      void rejectInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to reject invite");
      });
    },
    [rejectInvite],
  );

  const handleDelete = useCallback(
    (inviteId: number) => {
      void deleteInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to delete invite");
      });
    },
    [deleteInvite],
  );

  return { handleApprove, handleReject, handleDelete };
}
