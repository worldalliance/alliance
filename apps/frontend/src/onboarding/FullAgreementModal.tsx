import Modal, { ModalHeader, ModalTitle } from "@alliance/sharedweb/ui/Modal";
import { X } from "lucide-react";
import { DocProseSize } from "../site/DocProse";
import { GovernanceBody } from "../site/GovernanceBody";
import { useScrollFeather } from "./useScrollFeather";

/**
 * The governance page, read without leaving the flow. The member is part way
 * through signing, so the page's own subtitle is left out: its only content is
 * a link to a write-up elsewhere on the site.
 */
export function FullAgreementModal({ onClose }: { onClose: () => void }) {
  const body = useScrollFeather<HTMLDivElement>();

  return (
    <Modal
      onClose={onClose}
      showClose={false}
      panelClassName="flex max-h-[85vh] w-full max-w-2xl flex-col border-2 border-[var(--color-green)]"
    >
      <ModalHeader className="flex shrink-0 items-center justify-between gap-4 p-4">
        <ModalTitle className="text-lg font-medium text-[var(--site-ink)]">
          Full agreement
        </ModalTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-black transition-colors hover:border-zinc-400 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X className="size-5 stroke-[2.5]" aria-hidden />
        </button>
      </ModalHeader>

      <div
        ref={body.ref}
        style={body.style}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5"
      >
        <GovernanceBody size={DocProseSize.Compact} />
      </div>
    </Modal>
  );
}
