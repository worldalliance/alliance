import { authLogout, userSwitchDomain } from "@alliance/shared/client";
import {
  isLegacyDomain,
  isSnoozed,
  newDomainUrl,
  snooze,
} from "@alliance/sharedweb/lib/domainMigration";
import Modal, {
  ModalActions,
  ModalAlign,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";

const DomainMigrationModal: React.FC = () => {
  const { user } = useAuth();
  const { error: errorToast } = useToast();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Gated in an effect rather than during render: hostname and the snooze both
  // read browser-only state, and this tree server-renders.
  useEffect(() => {
    if (!user || !isLegacyDomain(window.location.hostname)) {
      return;
    }

    // The session does not cross domains, so they land signed out and sign in
    // again on the other side. That second sign-in is accepted, not a bug.
    if (user.switchedDomainAt !== null) {
      window.location.href = newDomainUrl(window.location);
      return;
    }

    setOpen(!isSnoozed(new Date()));
  }, [user]);

  const handleSnooze = useCallback(() => {
    snooze(new Date());
    setOpen(false);
  }, []);

  const handleSwitch = useCallback(async () => {
    setSwitching(true);

    const { error } = await userSwitchDomain();
    if (error) {
      setSwitching(false);
      errorToast(
        "We couldn't move your account over. Try again in a moment.",
        "Something went wrong",
      );
      return;
    }

    await authLogout();
    window.location.href = newDomainUrl({
      hostname: window.location.hostname,
      pathname: "/login",
      search: `?redirect=${encodeURIComponent(window.location.pathname)}`,
      hash: "",
    });
  }, [errorToast]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      onClose={handleSnooze}
      align={ModalAlign.BottomSheetOnMobile}
      panelClassName="rounded-xl"
      showClose={false}
      dismissDisabled={switching}
    >
      <ModalHeader>
        <ModalTitle className="text-lg font-serif font-bold text-zinc-900">
          We&apos;re moving to <strong>thealliance.org</strong>
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-4 text-sm text-zinc-600">
        <p>
          The Alliance is moving from worldalliance.org to a shorter home at{" "}
          <strong className="font-semibold text-zinc-900">
            thealliance.org
          </strong>
          . You can switch your account over now, or keep using the old address
          until we move everyone on September 15th.
        </p>
        <div className="flex gap-3 rounded-lg bg-amber-50 p-4">
          <span aria-hidden="true">⚠️</span>
          <div>
            <p className="font-medium text-zinc-900">
              Switching will sign you out
            </p>
            <p className="mt-1">
              Your current session ends and you&apos;ll sign in again at the new
              address. Your password itself doesn&apos;t change, but passwords
              your browser saved for worldalliance.org won&apos;t fill in on{" "}
              <strong className="font-semibold text-zinc-900">
                thealliance.org
              </strong>
              . Save them again when you sign in.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalActions>
          <NewButton
            color={ButtonColor.Light}
            onClick={handleSnooze}
            disabled={switching}
          >
            Not right now
          </NewButton>
          <NewButton
            color={ButtonColor.Green}
            onClick={handleSwitch}
            disabled={switching}
          >
            Switch to thealliance.org
          </NewButton>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

export default DomainMigrationModal;
