import { cn } from "@alliance/shared/styles/util";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { secondaryButtonClass } from "./controlStyles";

export type PageMenuItem = {
  label: string;
  onSelect: () => void;
  /** Listed last, apart from the others, in red. */
  destructive?: boolean;
  /** Why the item is disabled, shown under its label. */
  disabledReason?: string;
};

const MenuItem = ({ item }: { item: PageMenuItem }) => (
  <DropdownMenuItem
    disabled={item.disabledReason !== undefined}
    onClick={item.onSelect}
    className={cn(
      "flex-col items-start gap-0 data-[disabled]:opacity-100",
      item.destructive && "text-red-700",
    )}
  >
    <span className="in-data-[disabled]:text-zinc-500">{item.label}</span>
    {item.disabledReason && (
      <span className="text-xs text-zinc-600">{item.disabledReason}</span>
    )}
  </DropdownMenuItem>
);

const PageMenu = ({ items }: { items: PageMenuItem[] }) => {
  const safe = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);
  return (
    <Menu.Root>
      <Menu.Trigger className={secondaryButtonClass}>
        More
        <ChevronDown size={14} aria-hidden />
      </Menu.Trigger>
      <DropdownMenuContent align="end" className="min-w-48 max-w-72">
        {safe.map((item) => (
          <MenuItem key={item.label} item={item} />
        ))}
        {safe.length > 0 && destructive.length > 0 && (
          <Menu.Separator className="my-1 h-px bg-zinc-200" />
        )}
        {destructive.map((item) => (
          <MenuItem key={item.label} item={item} />
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  );
};

export default PageMenu;
