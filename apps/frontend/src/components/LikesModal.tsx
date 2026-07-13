import { LikeTargetType, useLikers } from "@alliance/shared/lib/useLikers";
import { getUserListTitle } from "@alliance/shared/lib/userList";
import { Heart } from "lucide-react";
import UserListModal, { UserListContent } from "./UserListModal";

export interface LikesModalProps {
  open: boolean;
  onClose: () => void;
  targetType: LikeTargetType;
  targetId: number;
  likesCount: number;
}

const LikesModal = ({
  open,
  onClose,
  targetType,
  targetId,
  likesCount,
}: LikesModalProps) => {
  const { users, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLikers({ targetType, targetId, enabled: open });

  const initialLoading = loading && users.length === 0;
  const countLabel = getUserListTitle({
    noun: "like",
    expectedCount: likesCount,
    loadedCount: users.length,
    initialLoading,
    hasNextPage,
  });

  return (
    <UserListModal
      open={open}
      onClose={onClose}
      icon={<Heart size={16} fill="#ff3e24" color="#ff3e24" strokeWidth={0} />}
      title={countLabel}
    >
      <UserListContent
        users={users}
        initialLoading={initialLoading}
        expectedCount={likesCount}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onNavigate={onClose}
        emptyIcon={
          <Heart size={28} className="text-zinc-300" strokeWidth={1.5} />
        }
        emptyLabel="No likes yet"
      />
    </UserListModal>
  );
};

export default LikesModal;
