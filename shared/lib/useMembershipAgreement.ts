import { useEffect, useState } from "react";
import type { ContractEventDto } from "../client";
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
import { useContractSignature } from "./useContractSignature";
import { useCurrentContract } from "./useCurrentContract";

export function useMembershipAgreement(params: {
  user: { lastContractEvent?: ContractEventDto } | null | undefined;
  showError: (message: string) => void;
}) {
  const { user, showError } = params;
  const currentContract = useCurrentContract();
  const latestContract = currentContract.data;
  const contractSignature = useContractSignature();
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
    const signed = await contractSignature.sign({
      contractId: latestContract.id,
      signedName,
    });
    if (signed.ok) {
      setLastContractEvent(
        signedContractEvent({
          contractId: latestContract.id,
          date: signed.value.date,
        }),
      );
      setConfirmation("");
    } else {
      console.error("Error signing contract:", signed.error);
      showError(
        thrownRefusalMessage({
          error: signed.error,
          fallback: membershipAgreement.signFailed,
          sessionExpired: membershipAgreement.signSessionExpired,
        }),
      );
    }
    setIsSubmitting(false);
  };

  /** Call once the member has confirmed. */
  const suspend = async () => {
    setIsSubmitting(true);
    const suspended = await contractSignature.suspend();
    if (suspended.ok) {
      setLastContractEvent(suspendedContractEvent(suspended.value.date));
    } else {
      console.error("Error suspending contract:", suspended.error);
      showError(
        thrownRefusalMessage({
          error: suspended.error,
          fallback: membershipAgreement.suspendFailed,
          sessionExpired: membershipAgreement.suspendSessionExpired,
        }),
      );
    }
    setIsSubmitting(false);
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
