import { useSearchParams } from "react-router";
import CommunitySelect from "../../components/CommunitySelect";
import { useAuth } from "../../lib/AuthContext";
import { useCallback } from "react";
import { Tab } from "./CommunityPage";
import CommunityCreateForm from "../../components/CommunityCreateForm";

const NoCommunityPage = () => {
  const { user, refreshUser } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") as Tab | undefined) ?? "groups";

  const setParams = useCallback(
    (params: { tab?: Tab; communityId?: number | null }) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(params)) {
          if (value === null || value === undefined) {
            next.delete(key);
          } else {
            next.set(key, value.toString());
          }
        }
        return next;
      });
    },
    [setSearchParams]
  );

  return tab === "create" ? (
    <CommunityCreateForm
      name={user?.name}
      onCancel={() => setParams({ tab: "groups" })}
      onSuccess={(community) => {
        setParams({ communityId: community.id, tab: "groups" });
        refreshUser();
      }}
    />
  ) : (
    <CommunitySelect
      onSelectCommunity={(communityId) => setParams({ communityId })}
      communities={[]}
      isOnboardingGroupMember={user?.isIntroductoryGroupMember ?? true}
      onCreateCommunity={() => setParams({ tab: "create" })}
    />
  );
};

export default NoCommunityPage;
