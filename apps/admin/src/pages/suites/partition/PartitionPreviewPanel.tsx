import type {
  PartitionPartDraftDto,
  PartitionPreviewDto,
} from "@alliance/shared/client";
import { countOf, formatCount } from "../../../lib/formatNumber";
import Button, { ButtonVariant } from "../../../ui/Button";
import InlineError from "../../../ui/InlineError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { Panel, PanelStat } from "../../../ui/templates/Overview";
import { partName } from "./PartFields";

export function PartitionPreviewPanel({
  preview,
  running,
  error,
  onRun,
}: {
  preview:
    | {
        result: PartitionPreviewDto;
        parts: PartitionPartDraftDto[];
        outOfDate: boolean;
      }
    | undefined;
  running: boolean;
  error: string | null;
  onRun: () => void;
}) {
  return (
    <Panel
      title="Preview"
      action={
        <Button
          size="small"
          variant={ButtonVariant.Default}
          busy={running}
          onClick={onRun}
        >
          Run preview
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <InlineError message={error} />
        {preview === undefined ? (
          <p className="text-fg-muted">
            Counts where today&apos;s members with an agreement would land under
            the parts as they are here, saved or not.
          </p>
        ) : (
          <PreviewResult {...preview} />
        )}
      </div>
    </Panel>
  );
}

function PreviewResult({
  result,
  parts,
  outOfDate,
}: {
  result: PartitionPreviewDto;
  parts: PartitionPartDraftDto[];
  outOfDate: boolean;
}) {
  const name = (partId: string) =>
    partName(parts.find((part) => part.id === partId) ?? { name: "" });
  return (
    <>
      {outOfDate && (
        <Banner tone={BannerTone.Warning} inline>
          The parts changed since this preview. Run it again to update it.
        </Banner>
      )}
      <p className="font-medium">
        Preview of {countOf(result.population, "member")} with an agreement
      </p>
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
        <PanelStat
          label="Required work"
          value={formatCount(result.byWork.required)}
        />
        <PanelStat
          label="Optional work only"
          value={formatCount(result.byWork.optionalOnly)}
        />
        <PanelStat
          label="Nothing assigned"
          value={formatCount(result.byWork.nothing)}
        />
        <PanelStat
          label="Couldn't decide"
          value={formatCount(result.couldNotDecide)}
        />
      </div>
      <p className="text-fg-muted">
        Members with only optional work neither miss the suite nor reset their
        streak.
      </p>
      <div className="max-w-full self-start overflow-x-auto rounded-md border border-line">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Members</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.parts.map(({ partId, count }) => (
              <TableRow key={partId}>
                <TableCell truncate className="min-w-48 font-medium">
                  {name(partId)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(count)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {result.errors.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">Errors members hit</h3>
          <ul className="list-disc pl-5">
            {result.errors.map(({ message, count }) => (
              <li key={message}>
                {message} ({countOf(count, "member")})
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.untakenBranches.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">Parts no member reached</h3>
          <ul className="list-disc pl-5">
            {result.untakenBranches.map(({ where, text }, index) => (
              <li key={`${where}:${index}`}>
                In {where}: <code className="font-mono text-xs">{text}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
