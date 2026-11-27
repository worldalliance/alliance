import type { ActionFormVariantStatsDto } from "@alliance/shared/client/types.gen";
import {
  formLabel,
  useFormDisplaySlugs,
} from "@alliance/shared/lib/useFormsAdmin";
import { Link } from "react-router";
import { countOf, formatCount } from "../../../lib/formatNumber";
import { formatPct } from "../../../lib/formatPct";
import { linkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Panel } from "../../../ui/templates/Overview";
import { formHref } from "./variantRules";

/** Who was assigned each form, and how many of them submitted it. */
export function VariantCoverage({
  stats,
  splitTotal,
  hasVariants,
}: {
  stats: ActionFormVariantStatsDto[];
  splitTotal: number;
  hasVariants: boolean;
}) {
  const displaySlugs = useFormDisplaySlugs();
  const totalAssigned = stats.reduce((sum, s) => sum + s.assigned, 0);
  const totalSubmitted = stats.reduce((sum, s) => sum + s.submitted, 0);

  return (
    <Panel
      flush
      title="Coverage"
      description={`${countOf(totalAssigned, "member")} assigned`}
    >
      <p className="border-b border-line px-card py-3 text-fg-muted">
        {hasVariants
          ? `A member is assigned the first time they load the task. The default form covers the remaining ${formatPct(Math.max(0, 100 - splitTotal))}.`
          : "No variants: every member sees the default form."}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Form</TableHead>
            <TableHead className="text-right">Split</TableHead>
            <TableHead className="text-right">Assigned</TableHead>
            <TableHead className="text-right">Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow key={s.variantId ?? "default"}>
              <TableCell truncate>
                {s.variantId === null ? `Default form: ${s.name}` : s.name}
              </TableCell>
              <TableCell>
                {s.formId != null ? (
                  <Link to={formHref(s.formId)} className={linkClass}>
                    {formLabel(displaySlugs, s.formId)}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {s.splitValue != null ? formatPct(s.splitValue) : "Remainder"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(s.assigned)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(s.submitted)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3} className="text-right text-fg-muted">
              Total
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatCount(totalAssigned)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {formatCount(totalSubmitted)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Panel>
  );
}
