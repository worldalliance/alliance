import { useMemo } from "react";
import { href, Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useFormulasAdmin } from "../../lib/useFormulasAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";

const NEW_FORMULA_HREF = href("/tasks/formulas/:formulaId", {
  formulaId: "new",
});

const NUMBER_COLUMN = "text-right tabular-nums";
const COLUMN_CLASSES = [undefined, undefined, NUMBER_COLUMN, undefined];

export default function FormulasPage() {
  const formulas = useFormulasAdmin();
  const [q, setQ] = useListSearch();
  const rows = useMemo(() => {
    const all = formulas.data ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((formula) => formula.name.toLowerCase().includes(needle))
      .map((formula) => ({
        formula,
        usedBy: all.filter((other) => other.reads.includes(formula.id)).length,
      }));
  }, [formulas.data, q]);

  return (
    <Page
      fill
      place={PlaceId.Formulas}
      description="Named conditions and values that other rules can reuse. A change that would break a formula reading this one is refused until you fix both."
      actions={
        <Button variant={ButtonVariant.Primary} to={NEW_FORMULA_HREF}>
          New formula
        </Button>
      }
      banner={<RefreshFailedBanner things="formulas" query={formulas} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: formulas.data?.length,
          noun: "formula",
        })}
      >
        <SearchField label="Filter formulas" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={formulas.isPending}
          skeleton={
            <TableSkeleton
              bleed
              columns={COLUMN_CLASSES.length}
              columnClassNames={COLUMN_CLASSES}
            />
          }
          error={
            formulas.isLoadingError
              ? adminRefusalMessage(formulas.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load formulas"
          onRetry={() => void formulas.refetch()}
          retrying={formulas.isFetching}
          empty={rows.length === 0}
          filtered={q.trim() !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No formulas yet"
          emptyDescription="Create one to reuse a condition or value across rules."
          emptyAction={
            <Button variant={ButtonVariant.Default} to={NEW_FORMULA_HREF}>
              New formula
            </Button>
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead className={NUMBER_COLUMN}>
                  Used by (formulas)
                </TableHead>
                <TableHead>Last saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ formula, usedBy }) => (
                <TableRow key={formula.id}>
                  <TableCell truncate className="max-w-96" title={formula.name}>
                    <Link
                      to={href("/tasks/formulas/:formulaId", {
                        formulaId: formula.id,
                      })}
                      className={cn(nameLinkClass, "font-mono")}
                    >
                      {formula.name}
                    </Link>
                  </TableCell>
                  <TableCell truncate className="font-mono text-xs">
                    {formula.text}
                  </TableCell>
                  <TableCell className={NUMBER_COLUMN}>
                    {formatCount(usedBy)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(formula.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}
