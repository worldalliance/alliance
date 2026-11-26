import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

export const MEMBER_PARAM = "member";

/** Marks an entry this hook pushed, so closing can step back over it. */
const PEEK_STATE = { memberPeek: true };

/**
 * The member open in the People side peek, held in `?member=<id>`. Opening
 * pushes an entry so Back closes it; the other params are carried over. The
 * list's in-place URL writes keep the entry's state, so a peek opened here
 * still closes by stepping back.
 */
export function useMemberPeek() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const raw = Number(searchParams.get(MEMBER_PARAM));
  const memberId = Number.isInteger(raw) && raw > 0 ? raw : null;
  const pushed = location.state?.memberPeek === true;
  const searchAfterClose = useRef<string | null>(null);

  // Closing steps back to the entry before the peek, then carries over the
  // params the list changed while it was open.
  useEffect(() => {
    const search = searchAfterClose.current;
    if (search === null) return;
    searchAfterClose.current = null;
    if (search !== searchParams.toString())
      setSearchParams(new URLSearchParams(search), {
        replace: true,
        state: location.state,
      });
  }, [location, searchParams, setSearchParams]);

  const show = useCallback(
    (userId: number, { replace }: { replace: boolean }) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(MEMBER_PARAM, String(userId));
          return next;
        },
        replace
          ? { replace, state: pushed ? PEEK_STATE : undefined }
          : { state: PEEK_STATE },
      ),
    [pushed, setSearchParams],
  );
  // With the peek open, another member replaces it, so Back still closes it.
  const open = useCallback(
    (userId: number) => show(userId, { replace: memberId !== null }),
    [memberId, show],
  );
  // Replaces, so stepping through rows leaves one entry for Back to close.
  const step = useCallback(
    (userId: number) => show(userId, { replace: true }),
    [show],
  );
  const close = useCallback(() => {
    if (pushed) {
      const next = new URLSearchParams(searchParams);
      next.delete(MEMBER_PARAM);
      searchAfterClose.current = next.toString();
      void navigate(-1);
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(MEMBER_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [navigate, pushed, searchParams, setSearchParams]);
  return { memberId, open, step, close };
}
