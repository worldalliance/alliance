import { ProfileDto } from "@alliance/shared/client";
import { href, Link } from "react-router";
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
  return (
    <Link
      key={member.id}
      to={href("/member/:id", { id: member.id.toString() })}
      className="p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50"
    >
      <div
        className={`flex flex-col md:flex-row ${
          showDescription ? "items-start" : "items-center"
        } gap-2`}
      >
        <ProfileImage pfp={member.profilePicture ?? null} size="medium" />
        <div className="flex-1 min-w-0">
          <p className="text-zinc-900 text-base">{member.displayName}</p>
          {showDescription && (
            <div className="text-zinc-500 text-sm">
              <AppMarkdownWrapper
                markdownContent={member.profileDescription ?? ""}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default PublicMemberDirectoryCard;
