import { Link } from "react-router";
import { memberHref } from "../lib/hrefs";
import { AvatarProfile } from "./Avatar";
import { cn } from "./cn";
import { linkClass, nameLinkClass } from "./styles";
import { TableCell } from "./Table";

type Person = {
  userId: number;
  /** A member with no name shows as "User #12". */
  name: string | null | undefined;
  profilePicture: string | null;
};

export const personName = ({ userId, name }: Pick<Person, "userId" | "name">) =>
  name?.trim() || `User #${userId}`;

/**
 * A table cell naming a member: avatar, then the name as a link to their
 * record, on one line. A long name truncates, whole in its tooltip.
 */
export function PersonCell({
  userId,
  name,
  profilePicture,
  firstColumn = false,
  className,
}: Person & {
  /** The member is what the row is: the name reads as the row's name, not as a link among values. */
  firstColumn?: boolean;
  className?: string;
}) {
  const shown = personName({ userId, name });
  return (
    <TableCell className={cn("max-w-64", className)}>
      <span className="flex min-w-0 items-center gap-2.5">
        <AvatarProfile pfp={profilePicture} size="small" alt="" />
        <Link
          to={memberHref(userId)}
          title={shown}
          className={cn(firstColumn ? nameLinkClass : linkClass, "truncate")}
        >
          {shown}
        </Link>
      </span>
    </TableCell>
  );
}

/** A member named in a sentence or as a picked value: avatar and name, no link. */
export function PersonChip({
  userId,
  name,
  profilePicture,
  className,
}: Person & { className?: string }) {
  const shown = personName({ userId, name });
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1.5 align-bottom",
        className,
      )}
    >
      <AvatarProfile pfp={profilePicture} size="mini" alt="" />
      <span className="truncate font-medium" title={shown}>
        {shown}
      </span>
    </span>
  );
}
