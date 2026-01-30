import { useState } from "react";
import { useOutsideClick } from "../../sharedweb/lib/useOutsideClick";
import { ChevronDown } from "lucide-react";

type EnumType = Record<string, string | number>;

type KVPair<T extends EnumType> = {
  [K in keyof T]: [key: K, value: T[K]];
}[keyof T];

type DropdownSelectProps<T extends EnumType> = {
  titleOverride?: string;
  options: T;
  secondaryLabel?: (args: KVPair<T>) => string | undefined;
  value: T[keyof T];
  onChange: (args: KVPair<T>) => void;
  /** Option keys that render as visually distinguished button-style items */
  buttonOptionKeys?: (keyof T)[];
  /** Icons for different keys */
  keyIcons?: Record<keyof T, React.ReactNode>;
};

function DropdownSelect<T extends EnumType>({
  titleOverride,
  options,
  secondaryLabel,
  value,
  onChange,
  buttonOptionKeys,
  keyIcons,
}: DropdownSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const ref = useOutsideClick(() => setIsOpen(false));
  const isButtonOption = (key: keyof T) =>
    Boolean(buttonOptionKeys?.includes(key));

  return (
    <div className="relative">
      <button
        className="text-sm border border-gray-2 text-black bg-white hover:bg-zinc-50 px-3 rounded-sm py-2 flex flex-row gap-x-2 items-center"
        style={{
          fontWeight: 450,
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{titleOverride ?? value}</span> <ChevronDown size="15" />
      </button>
      <div
        className={`absolute z-10 top-[calc(100% - 30px)] mt-0.5 left-0 w-[220px] bg-white border border-gray-2 overflow-hidden rounded ${
          isOpen ? "flex flex-col" : "hidden"
        }`}
        ref={ref}
      >
        {(Object.entries(options) as KVPair<T>[]).map(([key, value]) => {
          const asButton = isButtonOption(key as keyof T);
          return (
            <button
              key={`${String(key)}-${value}`}
              onClick={() => {
                onChange([key, value]);
                setIsOpen(false);
              }}
              className={`px-3 pr-3 py-2 text-left text-sm ${
                asButton
                  ? "text-green bg-zinc-50 hover:bg-zinc-100 font-medium"
                  : "hover:bg-zinc-50"
              }`}
              style={{
                fontWeight: asButton ? 500 : 450,
              }}
            >
              <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row gap-x-2 items-center">
                  {keyIcons?.[key as keyof T] && (
                    <div className="flex items-center justify-center w-4 h-4">
                      {keyIcons[key as keyof T]}
                    </div>
                  )}
                  <span>{value}</span>
                </div>
                {secondaryLabel?.([key, value]) && (
                  <span className="text-zinc-500 !font-mono">
                    {secondaryLabel([key, value])}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DropdownSelect;
