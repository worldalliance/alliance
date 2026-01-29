import type { CommunityDto } from "@alliance/shared/client";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import { useMemo } from "react";
import { useAuth } from "../lib/AuthContext";
import { Settings } from "lucide-react";

const MANAGE_GROUPS_KEY = "manage";

export type CommunitySelectDropdownProps = {
  titleOverride: string;
  communities: CommunityDto[] | null;
  currentCommunityId?: number | null;
  notifCount: number;
  onSelectCommunity: (communityId: number | null | undefined) => void;
  onManageGroups: () => void;
};

const CommunitySelectDropdown = ({
  titleOverride,
  communities,
  currentCommunityId,
  notifCount,
  onSelectCommunity,
  onManageGroups,
}: CommunitySelectDropdownProps) => {
  const { user } = useAuth();

  const notifSuffix = notifCount > 0 ? ` (${notifCount})` : "";

  const { options, value, buttonOptionKeys } = useMemo(() => {
    const list = communities ?? [];
    const leaderCommunities = list.filter((c) =>
      c.leaders.some((leader) => leader.id === user?.id)
    );
    const nonLeaderCommunities = list.filter(
      (c) => !c.leaders.some((leader) => leader.id === user?.id)
    );
    const ordered = [...leaderCommunities, ...nonLeaderCommunities];

    const options: Record<string, string> = {};
    for (const c of ordered) {
      options[String(c.id)] = c.name;
    }
    options[MANAGE_GROUPS_KEY] = "Manage my groups" + notifSuffix;

    const current = ordered.find((c) => c.id === currentCommunityId);
    const value = current?.name ?? ordered[0]?.name ?? "";

    return {
      options,
      value,
      buttonOptionKeys: [MANAGE_GROUPS_KEY],
    };
  }, [communities, currentCommunityId, user?.id, notifSuffix]);

  const handleChange = (args: [key: string, value: string]) => {
    const [key] = args;
    if (key === MANAGE_GROUPS_KEY) {
      onManageGroups();
      return;
    }
    const id = Number(key);
    if (!Number.isNaN(id)) {
      onSelectCommunity(id);
    }
  };

  if (!options || Object.keys(options).length <= 1) {
    return null;
  }

  return (
    <DropdownSelect
      options={options}
      value={value}
      onChange={handleChange}
      buttonOptionKeys={buttonOptionKeys}
      titleOverride={titleOverride + notifSuffix}
      keyIcons={{
        [MANAGE_GROUPS_KEY]: <Settings />,
      }}
    />
  );
};

export default CommunitySelectDropdown;
