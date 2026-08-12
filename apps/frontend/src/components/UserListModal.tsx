import { ProfileDto } from "@alliance/shared/client";
import { getSkeletonCount } from "@alliance/shared/lib/userList";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Modal, {
  ModalBody,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { type ReactNode } from "react";
import { Link, href } from "react-router";
import LoadMoreButton from "./LoadMoreButton";

export interface UserListModalProps {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}

const UserListModal = ({
  open,
  onClose,
  icon,
  title,
  children,
}: UserListModalProps) => {
  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      panelClassName="flex max-h-[80vh] max-w-sm flex-col overflow-hidden shadow-2xl"
    >
      <ModalHeader className="flex shrink-0 items-center gap-1.5">
        {icon}
        <ModalTitle className="text-[15px] font-semibold text-zinc-900">
          {title}
        </ModalTitle>
      </ModalHeader>

      <ModalBody className="flex-1 overflow-y-auto p-0">{children}</ModalBody>
    </Modal>
  );
};

export interface UserListRowProps {
  user: ProfileDto;
  onNavigate?: () => void;
}

export const UserListRow = ({ user, onNavigate }: UserListRowProps) => (
  <li>
    <Link
      to={href("/member/:id", { id: user.id.toString() })}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50"
    >
      <AvatarProfile
        pfp={user.profilePicture ?? null}
        size="large"
        className="h-11 w-11"
      />
      <UserDisplayName
        staff={user.staff}
        ambassador={user.ambassador}
        grouplead={user.isCommunityLeader}
        underline={false}
      >
        <span className="font-semibold text-zinc-900">{user.displayName}</span>
      </UserDisplayName>
    </Link>
  </li>
);

/** `count` is the expected row count; rendering is clamped to one page. */
export const SkeletonRows = ({ count }: { count: number }) => (
  <div className="py-1">
    {Array.from({ length: getSkeletonCount(count) }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
        <div className="h-11 w-11 animate-pulse rounded bg-zinc-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
    ))}
  </div>
);

export interface UserListContentProps {
  users: ProfileDto[];
  initialLoading: boolean;
  /** Expected total users, for sizing the loading skeleton. */
  expectedCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onNavigate?: () => void;
  emptyIcon: ReactNode;
  emptyLabel: string;
}

/** User-list body with loading, empty, rows, and paging states. */
export const UserListContent = ({
  users,
  initialLoading,
  expectedCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onNavigate,
  emptyIcon,
  emptyLabel,
}: UserListContentProps) => {
  if (initialLoading) return <SkeletonRows count={expectedCount} />;

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
        {emptyIcon}
        <p className="text-sm text-zinc-500">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="py-1">
        {users.map((user) => (
          <UserListRow key={user.id} user={user} onNavigate={onNavigate} />
        ))}
      </ul>
      {hasNextPage && (
        <LoadMoreButton onClick={onLoadMore} loading={isFetchingNextPage} />
      )}
    </>
  );
};

export default UserListModal;
