import { errorMessage } from "@alliance/common/errorMessage";
import { withCount } from "@alliance/common/plural";
import type { RerouteMoveDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { useFormAssignmentsAdmin } from "../lib/useFormAssignmentsAdmin";
import NotifyMemberCheckbox from "./NotifyMemberCheckbox";

export default function RerouteBranchesModal(props: {
  actionId: number;
  moves: RerouteMoveDto[];
  branchNames: ReadonlyMap<number, string>;
  onClose: () => void;
}) {
  const { actionId, moves, branchNames, onClose } = props;
  const toast = useToast();
  const [notify, setNotify] = useState(true);
  const { reroute } = useFormAssignmentsAdmin(actionId);
  const routes = new Map<string, { from: number; to: number; count: number }>();
  for (const { fromVariantId: from, toVariantId: to } of moves) {
    const key = `${from}-${to}`;
    const route = routes.get(key) ?? { from, to, count: 0 };
    routes.set(key, { ...route, count: route.count + 1 });
  }

  const confirm = () =>
    reroute.mutate(notify, {
      onSuccess: ({ moves: moved }) => {
        toast.success(`Moved ${withCount(moved.length, "member")}`);
        onClose();
      },
    });

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={reroute.isPending}
      panelClassName="max-w-lg"
    >
      <ModalHeader className="p-6">
        <ModalTitle render={<h3 />} className="text-lg font-medium">
          Re-route {withCount(moves.length, "member")}?
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3 px-6">
        <ModalDescription className="text-sm text-zinc-600">
          Moves members who haven&apos;t submitted to the first branch they
          match now. Members staff moved by hand, and members matching no
          branch, stay where they are.
        </ModalDescription>
        <ul className="text-sm list-disc pl-5">
          {[...routes].map(([key, { from, to, count }]) => (
            <li key={key}>
              {withCount(count, "member")}: {branchNames.get(from) ?? from} →{" "}
              {branchNames.get(to) ?? to}
            </li>
          ))}
        </ul>
        <NotifyMemberCheckbox
          checked={notify}
          onChange={setNotify}
          label={`Notify the ${withCount(moves.length, "member")}`}
        />
        <InlineError
          message={
            reroute.error
              ? errorMessage({
                  error: reroute.error,
                  fallback: "Could not re-route members",
                })
              : null
          }
        />
      </ModalBody>
      <ModalFooter className="p-6">
        <ModalActions>
          <Button
            color={ButtonColor.White}
            size="small"
            onClick={onClose}
            disabled={reroute.isPending}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            size="small"
            onClick={confirm}
            disabled={reroute.isPending}
          >
            Move {withCount(moves.length, "member")}
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
