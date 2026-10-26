import { FormResponseDto } from "@alliance/shared/client/types.gen";
import { Link } from "react-router";

export default function UserFormSubmissionsSection({
  formResponses,
}: {
  formResponses: FormResponseDto[];
}) {
  const sortedFormResponses = [...formResponses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">
        Invited Submissions ({sortedFormResponses.length})
      </h2>
      {sortedFormResponses.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sortedFormResponses.map((response) => (
            <div
              key={response.id}
              className="text-xs p-2 rounded bg-zinc-50 border border-zinc-100"
            >
              <div className="flex items-center justify-between">
                <Link
                  to={`/forms/${response.formId}/responses`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Form #{response.formId}
                </Link>
                <span className="text-zinc-400">
                  {new Date(response.createdAt).toLocaleDateString()}
                </span>
              </div>
              {response.deviceType && (
                <p className="text-zinc-500 mt-0.5">{response.deviceType}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No form submissions.</p>
      )}
    </section>
  );
}
