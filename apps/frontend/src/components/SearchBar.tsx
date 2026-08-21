import { SearchItemDto, searchSaveSelected } from "@alliance/shared/client";
import {
  getSearchCategoriesWithItems,
  getSearchSecondaryText,
  SEARCH_CATEGORY_NAMES,
  useSearchResults,
} from "@alliance/shared/lib/search";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

const SearchBar = ({
  autofocus,
  inputClassName,
  containerClassName,
  onCollapse,
}: {
  autofocus: boolean;
  inputClassName?: string;
  containerClassName?: string;
  onCollapse?: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { items, itemsByCategory, selectedItem, setSelectedItem, loading } =
    useSearchResults(search, { debounceMs: 50, autoselectFirst: true });

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpen(true);
    setSearch(e.target.value);
  };

  const categoriesWithItems = getSearchCategoriesWithItems(itemsByCategory);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setSelectedItem(null);
    onCollapse?.();
  }, [setSelectedItem, onCollapse]);

  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChooseItem = useCallback(
    (item: SearchItemDto) => {
      searchSaveSelected({ body: item });
      inputRef.current?.blur();
      navigate(item.webAppLocation);
      close();
    },
    [navigate, close],
  );

  useEffect(() => {
    if (autofocus) {
      inputRef.current?.focus();
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (divRef.current && !divRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [autofocus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && selectedItem) {
        handleChooseItem(selectedItem);
      }
      if (e.key === "Escape") {
        close();
      }
      if (e.key === "ArrowUp") {
        if (selectedItem) {
          const index = items.findIndex((item) => item.id === selectedItem.id);
          if (index > 0) {
            setSelectedItem(items[index - 1]);
            itemRefs.current[items[index - 1].id]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
        e.preventDefault();
      }
      if (e.key === "ArrowDown") {
        if (selectedItem) {
          const index = items.findIndex((item) => item.id === selectedItem.id);
          if (index < items.length - 1) {
            setSelectedItem(items[index + 1]);
            itemRefs.current[items[index + 1].id]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
        e.preventDefault();
      }
    },
    [close, selectedItem, items, handleChooseItem, setSelectedItem],
  );

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && e.metaKey) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        setSelectedItem(items[0] ?? null);
      }
    },
    [items, setSelectedItem],
  );

  const handleFocus = useCallback(() => {
    setOpen(true);
    if (items.length > 0 && !selectedItem) {
      setSelectedItem(items[0] ?? null);
    }
  }, [items, selectedItem, setSelectedItem]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown); //TODO: dont add a new listener each time items changes?
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [open, handleGlobalKeyDown]);

  return (
    <div
      ref={divRef}
      className={cn(
        "relative flex-1 flex flex-col overflow-visible",
        containerClassName ?? "rounded h-10",
      )}
    >
      <input
        type="text"
        placeholder="Search for members, actions, posts..."
        className={cn(
          "w-full h-full py-2 px-3 rounded-md focus:outline-none text-base",
          inputClassName ?? "bg-white",
        )}
        value={search}
        onChange={onChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      />
      {open && items.length === 0 && search.length > 0 && !loading && (
        <div className="absolute top-full left-0 right-0 z-10 w-full bg-white -mt-[3px] rounded-b-md py-2 px-2 flex flex-col max-h-[min(calc(100vh-50px),400px)] overflow-y-auto shadow-lg">
          <p className="text-black text-sm font-medium pl-3 pb-1 w-full">
            No results found
          </p>
        </div>
      )}
      {open && items.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 w-full bg-white -mt-[3px] rounded-b-md px-2 flex flex-col overflow-y-auto max-h-[min(calc(100vh-120px),400px)] divide-y divide-zinc-200 shadow-lg">
          {categoriesWithItems.map((category) => (
            <div key={category} className=" w-full py-3">
              <p className="text-zinc-500 uppercase tracking-wide text-xs font-medium pl-3 pb-1 w-full">
                {SEARCH_CATEGORY_NAMES[category]}
              </p>
              {itemsByCategory[category]?.map((item) => {
                const secondaryText = getSearchSecondaryText(
                  item.secondaryData,
                );
                return (
                  <div
                    key={item.id}
                    onClick={() => handleChooseItem(item)}
                    ref={(el) => {
                      itemRefs.current[item.id] = el;
                    }}
                    className={cn(
                      "text-black hover:bg-zinc-50 p-3 rounded-md flex flex-row justify-start cursor-pointer items-center",
                      selectedItem?.id === item.id && "bg-zinc-50",
                    )}
                  >
                    {item.type === "user" ? (
                      <AvatarProfile
                        pfp={item.image ?? null}
                        size="small"
                        className="mr-2"
                      />
                    ) : (
                      item.image !== undefined && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="aspect-square h-8 rounded-md object-cover mr-2"
                        />
                      )
                    )}
                    <div className="flex flex-col">
                      <span>{item.name}</span>
                      {secondaryText && (
                        <span className="text-xs text-zinc-500">
                          {secondaryText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
