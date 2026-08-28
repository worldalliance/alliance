import { rdHref, RedesignPage } from "./links";
import { redesignVersions, type RedesignVersion } from "./theme";

export function VersionConsole({
  active,
  activePage,
  onSelect,
}: {
  active: RedesignVersion;
  activePage: RedesignPage;
  onSelect: (version: RedesignVersion) => void;
}) {
  const onSystem = activePage === RedesignPage.System;

  return (
    <div className="rd-console pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-neutral-900/85 py-1.5 pr-1.5 pl-3.5 text-neutral-300 shadow-lg backdrop-blur">
        <span className="mr-1 text-[11px] tracking-widest uppercase opacity-50">
          {/* The inventory is drawn from mockup 6 alone, so it names its subject. */}
          {onSystem ? "mockup 6" : "mockup"}
        </span>
        {!onSystem && (
          <>
            {redesignVersions.map((version) => (
              <button
                key={version}
                type="button"
                onClick={() => onSelect(version)}
                aria-pressed={version === active}
                className={
                  version === active
                    ? "rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-900"
                    : "rounded-full px-3 py-1 text-xs text-neutral-400 hover:bg-white/10 hover:text-white"
                }
              >
                {version}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
          </>
        )}
        <a
          href={
            onSystem
              ? rdHref(active, RedesignPage.Home)
              : rdHref(active, RedesignPage.System)
          }
          className={
            onSystem
              ? "rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-900"
              : "rounded-full px-3 py-1 text-xs text-neutral-400 hover:bg-white/10 hover:text-white"
          }
        >
          {onSystem ? "back" : "system"}
        </a>
      </div>
    </div>
  );
}
