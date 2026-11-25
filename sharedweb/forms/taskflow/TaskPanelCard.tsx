import { type HeaderBodyStyles } from "@alliance/shared/lib/actionPageTaskPanel";
import { taskHeaders } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import StackedCard from "@alliance/sharedweb/ui/StackedCard";
import { type ReactNode } from "react";
import { TASK_FLOW_ORIGIN } from "./useExpandingPanel";

/** The task panel: a header card over a body card, together the origin the task flow opens from. */
export function TaskPanelCard({
  header,
  styles,
  children,
}: {
  header: ReactNode;
  styles: HeaderBodyStyles;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative", TASK_FLOW_ORIGIN)}>
      <StackedCard
        top={header}
        topCardStyle={styles.header}
        bottom={children}
        bottomCardStyle={styles.body}
        bottomCardClassName="p-4 sm:p-6"
      />
    </div>
  );
}

/** The panel header once the task is done; `children` sit at its end. */
export function CompletedTaskHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-x-3">
        <CheckIcon size={24} />
        <p>{taskHeaders.actionPage.completed}</p>
      </div>
      {children}
    </div>
  );
}
