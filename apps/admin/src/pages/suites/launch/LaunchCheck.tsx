import type { ReactNode } from "react";
import type { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import Badge, { BadgeTone } from "../../../ui/Badge";
import { Panel } from "../../../ui/templates/Overview";

/** One check of the launch: a panel whose badge says whether it passes. */
export function LaunchCheck({
  id,
  title,
  passed,
  summary,
  flush = false,
  children,
}: {
  /** The anchor a blocker links to. */
  id?: LaunchSection;
  title: string;
  passed: boolean;
  summary?: string;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-6">
      <Panel
        title={title}
        description={summary}
        flush={flush}
        action={
          passed ? (
            <Badge tone={BadgeTone.Success}>Passes</Badge>
          ) : (
            <Badge tone={BadgeTone.Warning}>Needs attention</Badge>
          )
        }
      >
        {children}
      </Panel>
    </div>
  );
}
