import {
  FeedMemberSource,
  useFeedMembers,
} from "@alliance/shared/lib/useFeedMembers";
import { getUserListTitle } from "@alliance/shared/lib/userList";
import { Users } from "lucide-react";
import UserListModal, { UserListContent } from "./UserListModal";

export interface MembersModalProps {
  open: boolean;
  onClose: () => void;
  source: FeedMemberSource;
  noun: string;
  membersCount: number;
}

/** Paged member list for a global-feed item. */
const MembersModal = ({
  open,
  onClose,
  source,
  noun,
  membersCount,
}: MembersModalProps) => {
  const { users, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFeedMembers({ source, enabled: open });

  const initialLoading = loading && users.length === 0;
  const title = getUserListTitle({
    noun,
    expectedCount: membersCount,
    loadedCount: users.length,
    initialLoading,
    hasNextPage,
  });

  return (
    <UserListModal
      open={open}
      onClose={onClose}
      icon={<Users size={16} className="text-green" strokeWidth={2} />}
      title={title}
    >
      <UserListContent
        users={users}
        initialLoading={initialLoading}
        expectedCount={membersCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onNavigate={onClose}
        emptyIcon={
          <Users size={28} className="text-zinc-300" strokeWidth={1.5} />
        }
        emptyLabel="No members yet"
      />
    </UserListModal>
  );
};

export default MembersModal;
