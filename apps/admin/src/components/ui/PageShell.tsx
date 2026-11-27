import { cn } from "@alliance/shared/styles/util";
import { ArrowLeft } from "lucide-react";
import type React from "react";
import { Link } from "react-router";
import PageMenu, { type PageMenuItem } from "./PageMenu";

export enum PageWidth {
  Narrow = "narrow",
  Default = "default",
  Full = "full",
}

const WIDTH_CLASS: Record<PageWidth, string> = {
  [PageWidth.Narrow]: "max-w-3xl",
  [PageWidth.Default]: "max-w-6xl",
  [PageWidth.Full]: "",
};

type PageShellProps = {
  title: string;
  /** Sits beside the title, such as a status pill or count. */
  meta?: React.ReactNode;
  description?: React.ReactNode;
  back?: { to: string; label: string };
  /** The page's one or two main buttons. */
  actions?: React.ReactNode;
  /** Secondary and destructive commands, behind a "More" button. */
  menu?: PageMenuItem[];
  width?: PageWidth;
  children: React.ReactNode;
};

const PageShell = ({
  title,
  meta,
  description,
  back,
  actions,
  menu,
  width = PageWidth.Default,
  children,
}: PageShellProps) => (
  <div className="flex min-h-full flex-col">
    <title>{`${title} - Admin`}</title>
    <header className="border-b border-zinc-200 bg-white px-6 py-4">
      <div className={cn("mx-auto flex flex-col gap-1", WIDTH_CLASS[width])}>
        {back && (
          <Link
            to={back.to}
            className="flex w-fit items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft size={14} aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 break-words text-xl font-semibold text-zinc-900">
              {title}
            </h1>
            {meta}
          </div>
          {(actions || (menu && menu.length > 0)) && (
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              {menu && menu.length > 0 && <PageMenu items={menu} />}
            </div>
          )}
        </div>
        {description && (
          <div className="max-w-prose text-sm text-zinc-600">{description}</div>
        )}
      </div>
    </header>
    <div className="flex-1 px-6 py-6">
      <div className={cn("mx-auto", WIDTH_CLASS[width])}>{children}</div>
    </div>
  </div>
);

export default PageShell;
