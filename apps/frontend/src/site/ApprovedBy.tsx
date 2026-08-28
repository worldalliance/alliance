import { href, Link } from "react-router";

/**
 * The subtitle the founding documents share, linking the approval back to the
 * write-up of the governance round it came out of.
 */
export function ApprovedBy({ what }: { what: string }) {
  return (
    <>
      {`The following ${what} were `}
      <Link
        to={href("/progress/:slug", { slug: "early-governance" })}
        className="underline decoration-[var(--site-primary)]/35 underline-offset-2 hover:decoration-[var(--site-primary)]"
      >
        developed and approved
      </Link>
      {" by 25 founding members of the Alliance."}
    </>
  );
}
