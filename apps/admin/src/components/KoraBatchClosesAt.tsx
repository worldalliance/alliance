import type { KoraBatchDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState, type FormEvent } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  closingInstant,
  dateInputValue,
  formatKoraDate,
} from "../lib/koraParticipants";
import { useSetKoraBatchClosesAt } from "../lib/useKoraBatchesAdmin";

const FIELD = "rounded border border-zinc-300 bg-white px-2 py-1";

export function KoraBatchClosesAt({ batch }: { batch: KoraBatchDto }) {
  const toast = useToast();
  const saved = batch.closesAt ? dateInputValue(new Date(batch.closesAt)) : "";
  const [date, setDate] = useState(saved);
  const set = useSetKoraBatchClosesAt({
    onSuccess: () => toast.success("Closing date saved"),
    onError: (error) =>
      toast.error(
        adminRefusalMessage(
          error,
          "Couldn't save the closing date. Try again.",
        ),
      ),
  });
  const uploaded = formatKoraDate(batch.createdAt);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    set.mutate({ batchId: batch.id, closesAt: closingInstant(date) });
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="date"
        required
        value={date}
        min={dateInputValue(new Date())}
        onChange={(e) => setDate(e.target.value)}
        aria-label={`Closing date of the batch uploaded ${uploaded}`}
        className={FIELD}
      />
      {!saved && date === "" && <span className="text-zinc-500">Not set</span>}
      {date !== saved && date !== "" && (
        <Button
          type="submit"
          color={ButtonColor.Black}
          size="small"
          disabled={set.isPending}
        >
          {set.isPending ? "Saving…" : "Save"}
        </Button>
      )}
    </form>
  );
}
