import type { PartitionProblemDto } from "@alliance/shared/client";
import MarkedDiagnostics from "../../../components/MarkedDiagnostics";

export function PartitionProblems({
  problems,
}: {
  problems: PartitionProblemDto[];
}) {
  return problems.map((problem, index) => {
    if (problem.message !== undefined)
      return (
        <p key={index} className="text-danger">
          {problem.message}
        </p>
      );
    if (problem.text === undefined || problem.diagnostics === undefined)
      throw new Error(
        `partition problem with neither a message nor diagnostics: ${JSON.stringify(problem)}`,
      );
    return (
      <MarkedDiagnostics
        key={index}
        text={problem.text}
        diagnostics={problem.diagnostics}
      />
    );
  });
}
