import { href, Link } from "react-router";

/**
 * The lede the founding documents share, linking the approval back to the
 * write-up of the governance round it came out of.
 */
export function ApprovedBy({ what }: { what: string }) {
  return (
    <>
      {`The following ${what} were `}
      <Link
        to={href("/progress/:slug", { slug: "early-governance" })}
        className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
      >
        developed and approved
      </Link>
      {" by 25 founding members of the Alliance."}
    </>
  );
}
