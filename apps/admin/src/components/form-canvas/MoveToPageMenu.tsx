import type { Page } from "@alliance/common/forms/form-schema";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { pageTitle } from "./canvasSelection";

export function MoveToPageMenu({
  pages,
  pageIndex,
  onMove,
}: {
  pages: readonly Page[];
  pageIndex: number;
  onMove: (pageIndex: number) => void;
}) {
  if (pages.length < 2) return null;
  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        Move to page
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="max-w-64">
        {pages.map(
          (page, index) =>
            index !== pageIndex && (
              <DropdownMenuItem key={page.id} onClick={() => onMove(index)}>
                <span className="truncate">{`${index + 1}. ${pageTitle(page)}`}</span>
              </DropdownMenuItem>
            ),
        )}
      </DropdownMenuContent>
    </Menu.Root>
  );
}
