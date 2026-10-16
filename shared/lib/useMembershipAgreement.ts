import { useEffect, useState } from "react";
import {
  contractSignContract,
  contractSuspendContract,
  type ContractEventDto,
} from "../client";
import {
  canSignAgreement,
  signedContractEvent,
  signedContractId,
  suspendedContractEvent,
  type ContractEventState,
} from "./contract";
import { membershipAgreement } from "./copy";
import { failedToLoad } from "./failedToLoad";
import { thrownRefusalMessage } from "./hey-api";
import { useContractById } from "./useContractById";
import { useCurrentContract } from "./useCurrentContract";
import { useInvalidateVisibilityContext } from "./useVisibilityContext";

export function useMembershipAgreement(params: {
  user: { lastContractEvent?: ContractEventDto } | null | undefined;
  refreshUser: () => Promise<void>;
  showError: (message: string) => void;
}) {
  const { user, refreshUser, showError } = params;
  const currentContract = useCurrentContract();
  const latestContract = currentContract.data;
  const invalidateVisibilityContext = useInvalidateVisibilityContext();
  const [signedName, setSignedName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSign =
    latestContract != null &&
    canSignAgreement({ signedName, confirmation, isSubmitting });
  // The server always has a current contract, so an empty response failed too.
  const contractLoadFailed =
    failedToLoad(currentContract) || latestContract === null;
  // `undefined` only while loading: a failed load still shows what was signed.
  const settledContract = contractLoadFailed ? null : latestContract;
  const signedId = signedContractId(lastContractEvent);
  const previousContract = useContractById(
    settledContract !== undefined && signedId !== settledContract?.id
      ? signedId
      : null,
  );

  useEffect(() => {
    if (user) {
      setLastContractEvent(user.lastContractEvent ?? null);
    }
  }, [user]);

  const sign = async () => {
    if (!latestContract || !canSign) return;
    setIsSubmitting(true);
    try {
      const { data } = await contractSignContract({
        path: { id: latestContract.id },
        body: { signedName },
        throwOnError: true,
      });
      setLastContractEvent(
        signedContractEvent({ contractId: latestContract.id, date: data.date }),
      );
      setConfirmation("");
      invalidateVisibilityContext();
      await refreshUser();
    } catch (error) {
      console.error("Error signing contract:", error);
      showError(
        thrownRefusalMessage({
          error,
          fallback: membershipAgreement.signFailed,
          sessionExpired: membershipAgreement.signSessionExpired,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Call once the member has confirmed. */
  const suspend = async () => {
    setIsSubmitting(true);
    try {
      const { data } = await contractSuspendContract({ throwOnError: true });
      setLastContractEvent(suspendedContractEvent(data.date));
      await refreshUser();
    } catch (error) {
      console.error("Error suspending contract:", error);
      showError(
        thrownRefusalMessage({
          error,
          fallback: membershipAgreement.suspendFailed,
          sessionExpired: membershipAgreement.suspendSessionExpired,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    latestContract,
    contractLoadFailed,
    retryContractLoad: () => void currentContract.refetch(),
    retryingContractLoad: currentContract.isFetching,
    lastContractEvent,
    signedName,
    setSignedName,
    confirmation,
    setConfirmation,
    isSubmitting,
    canSign,
    sign,
    suspend,
    previousSignedContract: previousContract.data ?? null,
    previousContractLoadFailed: failedToLoad(previousContract),
    retryPreviousContractLoad: () => void previousContract.refetch(),
    retryingPreviousContractLoad: previousContract.isFetching,
    latestSigned: latestContract != null && signedId === latestContract.id,
    updateAvailable:
      latestContract != null &&
      signedId !== null &&
      signedId !== latestContract.id,
  };
}
