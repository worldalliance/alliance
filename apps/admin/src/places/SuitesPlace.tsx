import { href, Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";
import { PlaceId, placeTitle } from "../places";
import Button, { ButtonVariant } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/Table";

/**
 * The suites list had no page before the redesign: this is the least that
 * makes the place reachable until the tasks area builds it.
 */
export default function SuitesPlace() {
  const { suites } = useActionSuitesAdmin();
  return (
    <div className="flex flex-col gap-section px-page pt-page-top pb-page">
      <title>{placeTitle(PlaceId.Suites)}</title>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title font-semibold">Suites</h1>
        <Button to={href("/tasks/suites/new")} variant={ButtonVariant.Primary}>
          New suite
        </Button>
      </div>
      {suites.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading">
          <Skeleton className="h-row" />
          <Skeleton className="h-row" />
          <Skeleton className="h-row" />
        </div>
      ) : suites.isError ? (
        <p role="alert" className="text-danger">
          {adminRefusalMessage(suites.error, "Suites couldn't load.")}
        </p>
      ) : suites.data.length === 0 ? (
        <EmptyState
          title="No suites yet"
          description="A suite is one launch: its tasks share a start and a deadline."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suites.data.map((suite) => (
              <TableRow key={suite.id}>
                <TableCell>
                  <Link
                    to={href("/tasks/suites/:suiteId", {
                      suiteId: String(suite.id),
                    })}
                    className="font-medium underline-offset-2 hover:underline focus-ring"
                  >
                    {suite.name}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
