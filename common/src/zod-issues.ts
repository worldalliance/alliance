import type z from "zod";

export function issuePath(issue: z.core.$ZodIssue): string {
  return issue.path.join(".") || "<root>";
}

export function describeSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issuePath(issue)}: ${issue.message}`);
}
