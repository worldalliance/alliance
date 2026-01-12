import {
  searchAll,
  SearchItemDto,
  SearchItemType,
  searchSaveSelected,
} from "@alliance/shared/client";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

const categories: SearchItemType[] = [
  "recent",
  "user",
  "action",
  "post",
  "other",
];

const categoryNames: Record<SearchItemType, string> = {
  user: "Users",
  action: "Actions",
  post: "Posts",
  recent: "Recent Searches",
  other: "Other",
};

const SearchBar = ({ autofocus }: { autofocus: boolean }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const [items, setItems] = useState<SearchItemDto[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<
    Record<SearchItemType, SearchItemDto[]>
  >({ user: [], action: [], post: [], recent: [], other: [] });
  const [selectedItem, setSelectedItem] = useState<SearchItemDto | null>(null);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOpen(true);
    setSearch(e.target.value);
  };

  const fetchItems = useCallback(async () => {
    if (search.length === 0) {
      setItems([]);
      return;
    }
    const res = await searchAll({ query: { query: search } });
    if (res.data) {
      const itemsByCategory: Record<SearchItemType, SearchItemDto[]> =
        search.length > 0
          ? res.data.reduce(
              (acc, item) => {
                acc[item.type] = [...(acc[item.type] || []), item];
                return acc;
              },
              categories.reduce((acc, category) => {
                acc[category] = [];
                return acc;
              }, {} as Record<SearchItemType, SearchItemDto[]>)
            )
          : { user: [], action: [], post: [], recent: res.data, other: [] };

      const itemsInOrder = [
        ...itemsByCategory.recent,
        ...itemsByCategory.user,
        ...itemsByCategory.action,
        ...itemsByCategory.post,
        ...itemsByCategory.other,
      ];

      setItems(itemsInOrder);
      setItemsByCategory(itemsByCategory);

      if (itemsInOrder.length > 0) {
        setSelectedItem(itemsInOrder[0]);
      } else {
        setSelectedItem(null);
      }
    }
  }, [search]);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchItems();
    }, 50);
    return () => clearTimeout(id);
  }, [search, fetchItems]);

  const categoriesWithItems = categories.filter(
    (category) => itemsByCategory[category]?.length > 0
  );

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setSelectedItem(null);
  }, []);

  const divRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChooseItem = useCallback(
    (item: SearchItemDto) => {
      searchSaveSelected({ body: item });
      inputRef.current?.blur();
      navigate(item.webAppLocation);
      close();
    },
    [navigate, close]
  );

  useEffect(() => {
    if (autofocus) {
      inputRef.current?.focus();
    }

    window.addEventListener("click", (event) => {
      if (divRef.current && !divRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    });
    return () => {
      window.removeEventListener("click", () => {});
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
    [close, selectedItem, items, handleChooseItem]
  );

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && e.metaKey) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        setSelectedItem(items[0]);
      }
    },
    [items]
  );

  const handleFocus = useCallback(() => {
    setOpen(true);
    if (items.length > 0 && !selectedItem) {
      setSelectedItem(items[0]);
    }
  }, [items, selectedItem]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown); //TODO: dont add a new listener each time items changes?
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [open, handleGlobalKeyDown]);

  return (
    <div
      ref={divRef}
      className="relative flex-1 flex flex-col overflow-visible h-[37.5px] rounded"
    >
      <input
        type="text"
        placeholder="Search for members, actions, posts..."
        className="w-full border bg-white border-zinc-200 py-2 px-4 rounded focus:outline-none text-[16px]"
        value={search}
        onChange={onChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      />
      {open && items.length === 0 && search.length > 0 && (
        <div className="w-full bg-white border border-zinc-200 -mt-[3px] shrink-0 rounded-b-md py-2 px-2 flex flex-col max-h-[min(calc(100vh-50px),400px)] overflow-y-auto">
          <p className="text-black text-sm font-medium pl-3 pb-1 w-full">
            No results found
          </p>
        </div>
      )}
      {open && items.length > 0 && (
        <div className="w-full bg-white border border-zinc-200 -mt-[3px] shrink-0 rounded-b-md px-2 flex flex-col overflow-y-auto divide-y divide-zinc-200">
          {categoriesWithItems.map((category) => (
            <div key={category} className=" w-full py-3">
              <p className="text-black text-sm font-medium pl-3 pb-1 w-full">
                {categoryNames[category]}
              </p>
              {itemsByCategory[category]?.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleChooseItem(item)}
                  ref={(el) => {
                    itemRefs.current[item.id] = el;
                  }}
                  className={`text-black hover:bg-zinc-50 p-3 rounded-md flex flex-row justify-start cursor-pointer items-center ${
                    selectedItem?.id === item.id ? "bg-zinc-50" : ""
                  }`}
                >
                  {item.type === "user" ? (
                    <ProfileImage
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
                    {item.secondaryData && (
                      <span className="text-xs text-zinc-500">
                        {item.secondaryData.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
