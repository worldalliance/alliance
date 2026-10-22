import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

/**
 * Removes one-shot `names` from the URL, so a reload does not replay what they
 * carried. Read them on first render; `names` must keep its identity.
 */
export function useStripSearchParams(names: readonly string[]) {
  const [searchParams] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!names.some((name) => searchParams.has(name))) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    for (const name of names) next.delete(name);
    // Not setSearchParams, which drops the hash.
    navigate(
      { search: next.toString(), hash },
      // Without this, ScrollRestoration answers the strip by scrolling the
      // member to the top of whatever they were reading.
      { replace: true, preventScrollReset: true },
    );
  }, [names, searchParams, hash, navigate]);
}
