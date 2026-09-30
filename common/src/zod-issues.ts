import type z from "zod";

export function issuePath(issue: z.core.$ZodIssue): string {
  return issue.path.join(".") || "<root>";
}

type UnionIssue = Extract<z.core.$ZodIssue, { code: "invalid_union" }>;

// A branch names a shape the input wasn't going for when it rejects the
// input's type outright, when one of its own tag literals doesn't match, when
// its own discriminator matched no option (an empty `errors`), or when it is
// itself a union none of whose branches fit. Deeper mismatches are ordinary
// errors inside the branch the input meant.
function isShapeMismatch(issue: z.core.$ZodIssue): boolean {
  switch (issue.code) {
    case "invalid_type":
      return issue.path.length === 0;
    case "invalid_value":
      return issue.values.length === 1 && issue.path.length <= 1;
    case "invalid_union":
      return (
        (issue.errors.length === 0 && issue.path.length <= 1) ||
        (issue.path.length === 0 && fittingBranches(issue).length === 0)
      );
    default:
      return false;
  }
}

function fittingBranches(issue: UnionIssue): z.core.$ZodIssue[][] {
  const branches: z.core.$ZodIssue[][] = issue.errors;
  return branches.filter((branch) => !branch.some(isShapeMismatch));
}

const unrecognizedKeyCount = (branch: z.core.$ZodIssue[]) =>
  branch.reduce(
    (total, issue) =>
      total + (issue.code === "unrecognized_keys" ? issue.keys.length : 0),
    0,
  );

// zod reports all of a strict object's extra keys as one issue, so each key
// counts on its own. On a tie, the branch that recognizes more of the input's
// keys is the likelier one.
const branchDistance = (branch: z.core.$ZodIssue[]) => {
  const unrecognized = unrecognizedKeyCount(branch);
  const others = branch.filter((i) => i.code !== "unrecognized_keys").length;
  return [others + unrecognized, unrecognized];
};

const isCloser = (a: number[], b: number[]) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

// A failed union reports only "Invalid input"; the closest fitting branch is
// the one the input most likely meant, so its issues stand in. With no fitting
// branch, naming any one shape would mislead.
function closestIssues(issue: z.core.$ZodIssue): z.core.$ZodIssue[] {
  if (issue.code !== "invalid_union") return [issue];
  const fitting = fittingBranches(issue);
  if (fitting.length === 0) return [issue];
  const closest = fitting.reduce((best, branch) =>
    isCloser(branchDistance(branch), branchDistance(best)) ? branch : best,
  );
  return closest.flatMap((inner) =>
    closestIssues({ ...inner, path: [...issue.path, ...inner.path] }),
  );
}

export function describeSchemaIssues(error: z.ZodError): string[] {
  return error.issues
    .flatMap(closestIssues)
    .map((issue) => `${issuePath(issue)}: ${issue.message}`);
}
