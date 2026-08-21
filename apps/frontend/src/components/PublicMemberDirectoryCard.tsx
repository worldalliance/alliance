import { ProfileDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useState } from "react";

interface PublicMemberDirectoryCardProps {
  member: ProfileDto;
  showDescription?: boolean;
}

const PublicMemberDirectoryCard: React.FC<PublicMemberDirectoryCardProps> = ({
  member,
  showDescription = false,
}: PublicMemberDirectoryCardProps) => {
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const handleDescriptionOpen = () => {
    setDescriptionOpen(!descriptionOpen);
  };

  return (
    <div
      key={member.id}
      onClick={handleDescriptionOpen}
      className="cursor-pointer"
    >
      <div
        className={cn(
          "flex flex-col md:flex-row gap-2 items-center",
          showDescription || descriptionOpen
            ? "md:items-start"
            : "md:items-center",
        )}
      >
        <AvatarProfile pfp={member.profilePicture ?? null} size="medium" />
        <div className="flex-1 min-w-0 text-center md:text-left">
          <p className="text-zinc-900 text-base">{member.displayName}</p>
          {(showDescription || descriptionOpen) && (
            <div className="text-zinc-500 text-sm">
              <AppMarkdownWrapper
                markdownContent={member.profileDescription ?? ""}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicMemberDirectoryCard;
