import { milliseconds } from "date-fns";
import { EllipsisVertical } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface CommentActionsMenuProps {
  replyId: number;
  isOwner: boolean;
  isAdmin: boolean;
  isPinned: boolean;
  onEdit: () => void;
  onDelete: (id: number) => void;
  onPin: (id: number) => void;
}

const CommentActionsMenu: React.FC<CommentActionsMenuProps> = ({
  replyId,
  isOwner,
  isAdmin,
  isPinned,
  onEdit,
  onDelete,
  onPin,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("replyId", replyId.toString());
    navigator.clipboard.writeText(url.toString());
    setShowDropdown(false);
    setCopied(true);
    setTimeout(
      () => {
        setCopied(false);
      },
      milliseconds({ seconds: 1 }),
    );
  }, [replyId]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-gray-500 hover:text-gray-700 p-1 flex items-center gap-1"
        aria-label="More options"
      >
        {copied && (
          <span className="text-green text-sm -my-1 font-medium">Copied!</span>
        )}
        <EllipsisVertical size={16} />
      </button>
      {showDropdown && (
        <div className="absolute right-0 bottom-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[140px]">
          <button
            onClick={handleCopyLink}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
          >
            Copy link
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                onPin(replyId);
                setShowDropdown(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {isPinned ? "Unpin comment" : "Pin comment"}
            </button>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => {
                  onEdit();
                  setShowDropdown(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(replyId);
                  setShowDropdown(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentActionsMenu;
