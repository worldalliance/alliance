import { X } from "lucide-react";
import React, { useCallback } from "react";
import type { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import FormSection from "../FormSection";
import {
  usesSuiteSchedule,
  withSuite,
  type GeneralUpdateFieldsProps,
} from "./generalUpdateForm";

type Props = GeneralUpdateFieldsProps & {
  suites: ReturnType<typeof useActionSuitesAdmin>["suites"];
};

const GeneralUpdateScheduleFields: React.FC<Props> = ({
  form,
  setForm,
  suites,
}) => {
  const availableSuites = suites.data ?? [];
  const hasSuites = usesSuiteSchedule(form);

  const handleAddSuite = useCallback(
    (suiteId: number) => {
      setForm((prev) => withSuite(prev, suiteId));
    },
    [setForm],
  );

  const handleRemoveSuite = useCallback(
    (suiteId: number) => {
      setForm((prev) => ({
        ...prev,
        suiteIds: prev.suiteIds.filter((s) => s !== suiteId),
      }));
    },
    [setForm],
  );

  return (
    <>
      <FormSection
        title="Suites"
        description="Assign this general update to one or more suites. When assigned to a suite, the start and end dates are inherited from some action in the suite."
      >
        <div className="space-y-3">
          {form.suiteIds.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {form.suiteIds.map((suiteId) => {
                const suite = availableSuites.find((s) => s.id === suiteId);
                const name = suite?.name ?? `Suite #${suiteId}`;
                return (
                  <li key={suiteId}>
                    <button
                      type="button"
                      onClick={() => handleRemoveSuite(suiteId)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
                      aria-label={`Remove ${name}`}
                    >
                      {name}
                      <span aria-hidden className="text-gray-500">
                        <X className="w-4 h-4" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {suites.isPending ? (
            <p className="text-sm text-gray-500">Loading suites...</p>
          ) : suites.isLoadingError ? (
            <p className="text-sm text-red-600">Failed to load suites.</p>
          ) : availableSuites.length ? (
            <div className="flex items-center gap-2">
              <label htmlFor="add-suite" className="sr-only">
                Add suite
              </label>
              <select
                id="add-suite"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    handleAddSuite(Number(v));
                  }
                }}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Add a suite...</option>
                {availableSuites
                  .filter((s) => !form.suiteIds.includes(s.id))
                  .map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No suites available.</p>
          )}
        </div>
      </FormSection>

      {!hasSuites && (
        <FormSection
          title="Schedule"
          description="Set start and end dates manually when not using a suite."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date
              </label>
              <input
                type="datetime-local"
                id="startDate"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date
              </label>
              <input
                type="datetime-local"
                id="endDate"
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
              />
            </div>
          </div>
        </FormSection>
      )}
    </>
  );
};

export default GeneralUpdateScheduleFields;
