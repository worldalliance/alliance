import { ProfileDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import {
  AvatarGroup,
  AvatarGroupCount,
  AvatarProfile,
} from "@alliance/sharedweb/ui/Avatar";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { useState } from "react";
import { href } from "react-router";

const UserProfilePicRow = ({ users }: { users: ProfileDto[] }) => {
  const unique = users
    .filter(function (item, pos, self) {
      return self.findIndex((t) => t.id === item.id) === pos;
    })
    .sort((a, b) => (b.profilePicture ? 1 : 0) - (a.profilePicture ? 1 : 0));

  const [expanded, setExpanded] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setExpanded(!expanded);
    e.stopPropagation();
  };

  return (
    <AvatarGroup
      className={cn("relative flex-wrap cursor-pointer", zIndex.raised)}
      onClick={handleClick}
    >
      {(expanded ? unique : unique.slice(0, 5)).map((user) => (
        <a
          href={href("/member/:id", { id: user.id.toString() })}
          onClick={(e) => e.stopPropagation()}
          key={user.id}
          className="flex items-center"
        >
          <AvatarProfile pfp={user.profilePicture ?? null} size="small" />
        </a>
      ))}
      {unique.length > 5 && !expanded && (
        <AvatarGroupCount size="small">+{unique.length - 5}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
};

export default UserProfilePicRow;
