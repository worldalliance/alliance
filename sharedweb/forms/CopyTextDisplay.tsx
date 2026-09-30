import { milliseconds } from "date-fns";
import { Check, Copy } from "lucide-react";
import React, { useEffect, useState } from "react";
import { copyOutcome, CopyOutcome } from "../lib/clipboard";

const copyBadges: Record<CopyOutcome, React.ReactNode> = {
  [CopyOutcome.Copied]: (
    <>
      <p className="text-sm text-green">Copied!</p>
      <Check size={14} className="text-green" />
    </>
  ),
  [CopyOutcome.Failed]: <p className="text-sm text-red-600">Copy failed</p>,
};

export default function CopyTextDisplay({
  text,
  title,
}: {
  text: string;
  title?: string;
}) {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(
      () => setOutcome(null),
      milliseconds({ seconds: 2 }),
    );
    return () => clearTimeout(timer);
  }, [outcome]);

  const handleCopy = async () => {
    setOutcome(await copyOutcome(text));
  };

  return (
    <div>
      {title && <span className="text-zinc-500 mb-1 block">{title}</span>}
      <div
        className="relative rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
        onClick={() => void handleCopy()}
      >
        <span className="text-black whitespace-pre-wrap">{text}</span>
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-zinc-50 border border-gray-200 px-1.5 py-0.5 rounded">
          {outcome ? (
            copyBadges[outcome]
          ) : (
            <Copy size={14} className="text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
}
