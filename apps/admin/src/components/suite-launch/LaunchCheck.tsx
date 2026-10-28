import Card from "@alliance/sharedweb/ui/Card";
import { AlertTriangle, CheckIcon } from "lucide-react";
import type React from "react";

const LaunchCheck: React.FC<
  React.PropsWithChildren<{ title: string; passed: boolean; summary?: string }>
> = ({ title, passed, summary, children }) => (
  <Card className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      {passed ? (
        <CheckIcon
          className="size-5 text-green"
          strokeWidth={3}
          aria-label="Passed"
        />
      ) : (
        <AlertTriangle
          className="size-5 text-yellow-600"
          aria-label="Needs attention"
        />
      )}
      <h3 className="font-semibold">{title}</h3>
      {summary && <span className="text-sm text-zinc-500">{summary}</span>}
    </div>
    {children}
  </Card>
);

export default LaunchCheck;
