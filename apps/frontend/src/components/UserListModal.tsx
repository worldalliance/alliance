import { ProfileDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, href } from "react-router";
import LoadMoreButton from "./LoadMoreButton";

export interface UserListModalProps {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}

/** Portal shell for user-list modals. */
const UserListModal = ({
  open,
  onClose,
  icon,
  title,
  children,
}: UserListModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        zIndex.modal,
        "fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-zinc-100 px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            {icon}
            <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="absolute right-2 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
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

export const SkeletonRows = ({ count = 6 }: { count?: number }) => (
  <div className="py-1">
    {Array.from({ length: count }).map((_, i) => (
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
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onNavigate,
  emptyIcon,
  emptyLabel,
}: UserListContentProps) => {
  if (initialLoading) return <SkeletonRows />;

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
