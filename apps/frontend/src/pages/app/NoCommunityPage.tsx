import { useSearchParams } from "react-router";
import { useAuth } from "../../lib/AuthContext";
import { useCallback } from "react";
import { Tab } from "./CommunityPage";
import CommunityCreateForm from "../../components/CommunityCreateForm";
import MyGroupsPage from "./MyGroupsPage";

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

  return (
    <div className="p-5 xl:p-10 xl:pr-5 max-w-[900px] mx-auto px-0 md:px-3">
      <div className="flex flex-col gap-y-2 my-8 px-5 md:px-0">
        <p className="font-serif font-semibold text-3xl md:text-4xl">
          Manage groups
        </p>
        {tab === "create" ? (
          <CommunityCreateForm
            name={user?.name}
            onCancel={() => setParams({ tab: "groups" })}
            onSuccess={(community) => {
              setParams({ communityId: community.id, tab: "groups" });
              refreshUser();
            }}
          />
        ) : (
          <MyGroupsPage
            onSelectCommunity={(communityId) => setParams({ communityId })}
            communities={[]}
            isOnboardingGroupMember={user?.isIntroductoryGroupMember ?? true}
          />
        )}
      </div>
    </div>
  );
};

export default NoCommunityPage;
