import { Skeleton } from "../../../ui/Skeleton";

const BARS = ["ml-24 w-40", "ml-48 w-56", "ml-10 w-32", "ml-64 w-44"];

/** The timeline's shape while it loads: the header, then rows of a name and a bar. */
export function TimelineSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex h-16 border-b border-line bg-surface-2">
        <div className="w-80 shrink-0 border-r border-line" />
      </div>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex h-14 border-b border-line">
          <div className="flex w-80 shrink-0 flex-col justify-center gap-2 border-r border-line px-page">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-1 items-center">
            <Skeleton className={`h-8 ${BARS[index % BARS.length]}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
