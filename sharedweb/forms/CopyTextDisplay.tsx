import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import {
  copyTextClipboardContent,
  copyTextFormat,
} from "@alliance/shared/forms/copyText";
import { milliseconds } from "date-fns";
import { Check, Copy } from "lucide-react";
import React, { useEffect, useState } from "react";
import { copyOutcome, CopyOutcome } from "../lib/clipboard";
import { getApiUrl, getInviteBaseUrl } from "../lib/config";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";

const copyBadges: Record<CopyOutcome, React.ReactNode> = {
  [CopyOutcome.Copied]: (
    <>
      <p className="text-sm text-green">Copied!</p>
      <Check size={14} className="text-green" />
    </>
  ),
  [CopyOutcome.Failed]: <p className="text-sm text-red-600">Copy failed</p>,
};

function CopyTextBody({ block }: { block: CopyTextBlock }) {
  const format = copyTextFormat(block);
  switch (format) {
    case CopyTextFormat.Plain:
      return (
        <span className="text-black whitespace-pre-wrap">{block.text}</span>
      );
    case CopyTextFormat.Markdown:
      return (
        <div className="prose prose-sm max-w-none">
          <FormMarkdownWrapper markdownContent={block.text} />
        </div>
      );
    default:
      throw new Error(`unknown copy text format: ${format satisfies never}`);
  }
}

export default function CopyTextDisplay({ block }: { block: CopyTextBlock }) {
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
    const content = copyTextClipboardContent(block, {
      apiUrl: getApiUrl(),
      origin: getInviteBaseUrl(),
    });
    setOutcome(await copyOutcome(content));
  };

  return (
    <div>
      {block.title && (
        <span className="text-zinc-500 mb-1 block">{block.title}</span>
      )}
      <div
        className="relative rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
        onClick={(e) => {
          // A link's hover card is portaled, so its clicks bubble here from
          // outside the box.
          const target = e.target;
          if (!(target instanceof Element)) return;
          if (!e.currentTarget.contains(target) || target.closest("a")) return;
          void handleCopy();
        }}
      >
        <CopyTextBody block={block} />
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
