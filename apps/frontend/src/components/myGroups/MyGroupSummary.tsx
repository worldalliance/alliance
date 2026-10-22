import { getMemberCount } from "@alliance/common/community";
import { withCount } from "@alliance/common/plural";
import { CommunityDto } from "@alliance/shared/client";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";

const MyGroupSummary = ({ community }: { community: CommunityDto }) => (
  <div className="flex flex-row gap-x-3">
    <AvatarProfile pfp={community.photo ?? null} size="huge" />
    <div className="flex flex-col text-left">
      <p className="text-lg font-semibold">{community.name}</p>
      <p className="text-zinc-500">{community.description}</p>
      <span className="text-zinc-500">
        {withCount(getMemberCount(community), "member")}
      </span>
    </div>
  </div>
);

export default MyGroupSummary;
