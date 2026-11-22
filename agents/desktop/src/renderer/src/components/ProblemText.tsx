import type { Problem } from "../../../shared/repository";

export function ProblemText({ problem }: { problem: Problem }) {
  return (
    <div className="error" role="alert">
      <p>{problem.message}</p>
      {problem.details && (
        <details>
          <summary>Details</summary>
          <pre>{problem.details}</pre>
        </details>
      )}
    </div>
  );
}
