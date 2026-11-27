import { useCallback } from "react";
import { useSearchParams } from "react-router";

export enum OwnerKind {
  Member = "user",
  Campaign = "campaign",
}

const ID_PARAM: Record<OwnerKind, string> = {
  [OwnerKind.Member]: "member",
  [OwnerKind.Campaign]: "campaign",
};

const parseId = (value: string | null): number | null => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Whose links the tab shows, in the URL so a pasted link and Back show the
 * same owner: `?owner=campaign&campaign=7`, or `?member=5` for the default kind.
 */
export function useShareLinkOwner() {
  const [params, setParams] = useSearchParams();
  const kind =
    params.get("owner") === OwnerKind.Campaign
      ? OwnerKind.Campaign
      : OwnerKind.Member;
  const id = parseId(params.get(ID_PARAM[kind]));

  const write = useCallback(
    (next: { kind: OwnerKind; id: number | null }) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next.kind === OwnerKind.Campaign) out.set("owner", next.kind);
          else out.delete("owner");
          for (const name of Object.values(ID_PARAM)) out.delete(name);
          if (next.id !== null) out.set(ID_PARAM[next.kind], String(next.id));
          return out;
        },
        { replace: true },
      ),
    [setParams],
  );
  const setKind = useCallback(
    (next: OwnerKind) => write({ kind: next, id: null }),
    [write],
  );
  const setId = useCallback(
    (next: number | null) => write({ kind, id: next }),
    [write, kind],
  );
  return { kind, id, setKind, setId };
}
