import { ProfileDto } from "@alliance/shared/client";
import { useState } from "react";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";

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
      className="p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
    >
      <div
        className={`flex flex-col md:flex-row ${(showDescription || descriptionOpen) ? "items-start" : "md:items-center"
          } gap-2`}
      >
        <ProfileImage pfp={member.profilePicture ?? null} size="medium" />
        <div className="flex-1 min-w-0">
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
