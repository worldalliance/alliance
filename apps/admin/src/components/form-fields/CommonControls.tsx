/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  CustomExpressionUserDto,
  CustomValidatorType,
  CustomValidatorTypeDto,
  tasksCustomValidatorsAdmin,
  tasksTestCustomExpressionAdmin,
} from "@alliance/shared/client";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";

type RequiredToggleProps = {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
};

export function RequiredToggle({
  checked,
  onChange,
  className = "",
  label = "Required",
}: RequiredToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-2"
      />
      {label}
    </label>
  );
}

type RequiredAsteriskProps = {
  required?: boolean;
  className?: string;
};

export function RequiredAsterisk({
  required,
  className = "text-red-500 ml-1",
}: RequiredAsteriskProps) {
  if (!required) return null;
  return <span className={className}>*</span>;
}

/** Option values that appear more than once in the list (schema rejects these on save). */
export function duplicateOptionValues(
  options: readonly { value: string }[],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { value } of options) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

type DuplicateOptionsWarningProps = {
  duplicates: Set<string>;
};

export function DuplicateOptionsWarning({
  duplicates,
}: DuplicateOptionsWarningProps) {
  if (duplicates.size === 0) return null;
  return (
    <p className="mt-1 text-[11px] text-red-500">
      Duplicate option values ({Array.from(duplicates).join(", ")}): each option
      needs a unique value or the form won&apos;t save.
    </p>
  );
}

type OutputFieldToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputFieldToggle({
  checked,
  onChange,
  className = "",
}: OutputFieldToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Set as output field
    </label>
  );
}

type OutputPrivateByDefaultToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputPrivateByDefaultToggle({
  checked,
  onChange,
  className = "",
}: OutputPrivateByDefaultToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Private by default
    </label>
  );
}

// ---------------- Custom Validators ----------------

let cachedValidators: CustomValidatorTypeDto[] | null = null;
let cachedValidatorsError: string | null = null;
let pendingValidatorsRequest: Promise<CustomValidatorTypeDto[]> | null = null;

async function fetchCustomValidators(): Promise<CustomValidatorTypeDto[]> {
  const response = await tasksCustomValidatorsAdmin();
  if (response.data) {
    return response.data;
  }

  if (response.error) {
    throw response.error;
  }

  throw new Error("Unknown error loading custom validators");
}

export function resetCustomValidatorsCache(): void {
  cachedValidators = null;
  cachedValidatorsError = null;
}

export function useCustomValidators(): {
  validators: CustomValidatorTypeDto[];
  loading: boolean;
  error: string | null;
} {
  const [validators, setValidators] = useState<CustomValidatorTypeDto[]>(
    () => cachedValidators ?? [],
  );
  const [loading, setLoading] = useState<boolean>(
    () => !cachedValidators && !cachedValidatorsError,
  );
  const [error, setError] = useState<string | null>(
    () => cachedValidatorsError,
  );

  useEffect(() => {
    if (cachedValidators) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    if (!pendingValidatorsRequest) {
      pendingValidatorsRequest = fetchCustomValidators();
    }

    setLoading(true);

    pendingValidatorsRequest
      .then((data) => {
        if (isCancelled) return;
        cachedValidators = data;
        cachedValidatorsError = null;
        setValidators(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load validators";
        cachedValidatorsError = message;
        setError(message);
        setLoading(false);
      })
      .finally(() => {
        pendingValidatorsRequest = null;
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    validators,
    loading,
    error,
  };
}

type CustomValidatorSelectProps = {
  type?: CustomValidatorType;
  idArgument: string | null;
  expression: string | null;
  onChange: (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
    expression: string | null;
  }) => void;
  className?: string;
  label?: string;
  filter?: (validator: CustomValidatorTypeDto) => boolean;
  /** False disables "None", for a validator the caller can't clear. */
  allowNone?: boolean;
};

export function CustomValidatorSelect({
  type,
  idArgument,
  expression,
  onChange,
  className = "",
  label = "Custom validator",
  filter,
  allowNone = true,
}: CustomValidatorSelectProps) {
  const { validators, loading, error } = useCustomValidators();
  const isMemberTag = type === "MemberTag";
  const isCustomExpression = type === "CustomExpression";
  const { tags, isLoading: tagsLoading } = useTagsAdmin({
    enabled: isMemberTag,
  });
  const usersQuery = useUsersAdmin({ enabled: isCustomExpression });
  const usersLoading = usersQuery.isLoading;
  const usersError = usersQuery.isLoadingError ? "Failed to load users" : null;
  const activeUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => user.hasActiveContract),
    [usersQuery.data],
  );
  const [expressionTest, setExpressionTest] = useState<{
    result?: boolean;
    error?: string;
    totals?: {
      pass: number;
      fail: number;
      total: number;
    };
    passUsers?: Array<CustomExpressionUserDto>;
    failUsers?: Array<CustomExpressionUserDto>;
    selectedUserLabel?: string;
  } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const availableValidators = useMemo(() => {
    if (!filter) {
      return validators;
    }
    const filtered = validators.filter(filter);
    if (!type) {
      return filtered;
    }
    const selected = validators.find((validator) => validator.id === type);
    if (
      selected &&
      !filtered.some((validator) => validator.id === selected.id)
    ) {
      return [...filtered, selected];
    }
    return filtered;
  }, [validators, filter, type]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (!nextValue) {
      onChange({ validatorType: undefined, idArgument, expression });
      return;
    }
    onChange({
      validatorType: nextValue as CustomValidatorType,
      idArgument,
      expression,
    });
  };

  const hasValidators = availableValidators.length > 0;
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );
  const hasExpression = Boolean(expression?.trim());
  const sortedUsers = useMemo(
    () => [...activeUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [activeUsers],
  );
  const selectedUser = useMemo(
    () => activeUsers.find((user) => user.id === selectedUserId),
    [selectedUserId, activeUsers],
  );
  const selectedUserLabel = useMemo(() => {
    if (!selectedUser) {
      return undefined;
    }
    return selectedUser.anonymous
      ? `Anonymous (${selectedUser.id})`
      : `${selectedUser.name} (${selectedUser.id})`;
  }, [selectedUser]);
  const passUsers = useMemo(() => {
    if (!expressionTest?.passUsers) {
      return [];
    }
    return [...expressionTest.passUsers].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [expressionTest?.passUsers]);
  const failUsers = useMemo(() => {
    if (!expressionTest?.failUsers) {
      return [];
    }
    return [...expressionTest.failUsers].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [expressionTest?.failUsers]);

  useEffect(() => {
    setExpressionTest(null);
  }, [expression, type, selectedUserId]);

  useEffect(() => {
    if (!isCustomExpression) {
      return;
    }
    if (sortedUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (
      !selectedUserId ||
      !sortedUsers.some((user) => user.id === selectedUserId)
    ) {
      setSelectedUserId(sortedUsers[0]?.id ?? null);
    }
  }, [isCustomExpression, selectedUserId, sortedUsers]);

  const runExpressionTest = useCallback(async () => {
    if (!isCustomExpression) {
      return;
    }
    if (!expression?.trim()) {
      setExpressionTest({ error: "Expression is empty." });
      return;
    }
    if (!selectedUserId) {
      setExpressionTest({ error: "Select a user to test against." });
      return;
    }
    if (usersLoading) {
      setExpressionTest({ error: "Users are still loading. Try again soon." });
      return;
    }
    if (usersError) {
      setExpressionTest({ error: usersError });
      return;
    }

    setIsTesting(true);
    try {
      const response = await tasksTestCustomExpressionAdmin({
        body: {
          expression,
          userId: selectedUserId,
        },
      });

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        throw new Error("Missing custom expression results.");
      }

      const selectedResult = response.data.selectedUserResult;
      if (typeof selectedResult !== "boolean") {
        throw new Error("Missing selected user result.");
      }

      setExpressionTest({
        result: selectedResult,
        selectedUserLabel,
        totals: {
          pass: response.data.passCount,
          fail: response.data.failCount,
          total: response.data.totalCount,
        },
        passUsers: response.data.passUsers ?? [],
        failUsers: response.data.failUsers ?? [],
      });
    } catch (err) {
      const message =
        (err as { message: string } | undefined)?.message ??
        "Expression failed to run.";
      setExpressionTest({ error: message });
    } finally {
      setIsTesting(false);
    }
  }, [
    expression,
    isCustomExpression,
    selectedUserId,
    selectedUserLabel,
    usersError,
    usersLoading,
  ]);
  const canTestExpression =
    hasExpression &&
    !isTesting &&
    Boolean(selectedUserId) &&
    !usersLoading &&
    !usersError;

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          value={type ?? ""}
          onChange={handleChange}
          disabled={loading || (!hasValidators && !type)}
        >
          <option value="" disabled={!allowNone}>
            None
          </option>
          {availableValidators.map((validator) => (
            <option key={validator.id} value={validator.id}>
              {validator.name}
            </option>
          ))}
        </select>
        {!!validators.find((validator) => validator.id === type)?.withIdField &&
          (isMemberTag ? (
            <select
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-32"
              disabled={tagsLoading}
            >
              <option value="">
                {tagsLoading ? "Loading..." : "Select a tag"}
              </option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-24"
            />
          ))}
      </div>
      {type === "CustomExpression" && (
        <div className="space-y-2">
          <textarea
            value={expression ?? ""}
            onChange={(e) =>
              onChange({
                validatorType: type,
                idArgument,
                expression: e.target.value,
              })
            }
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-full font-mono"
          />
          <Card style={CardStyle.Grey} className="p-2! gap-y-2">
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-700">
                Test user (active contracts)
              </label>
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedUserId ?? ""}
                onChange={(event) =>
                  setSelectedUserId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                disabled={
                  usersLoading ||
                  Boolean(usersError) ||
                  activeUsers.length === 0
                }
              >
                <option value="">Select a user</option>
                {sortedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.anonymous ? "Anonymous" : user.name} ({user.id})
                  </option>
                ))}
              </select>
              {usersLoading && (
                <p className="text-[11px] text-gray-500">Loading users…</p>
              )}
              {usersError && !usersLoading && (
                <p className="text-[11px] text-red-500">{usersError}</p>
              )}
              {!usersLoading && !usersError && activeUsers.length === 0 && (
                <p className="text-[11px] text-gray-400">
                  No active-contract users available to test.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={runExpressionTest}
                disabled={!canTestExpression}
                className="text-[11px] text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {isTesting ? "Testing…" : "Test expression"}
              </button>
              <span className="text-[10px] text-gray-400">
                Runs against selected user and all users
              </span>
            </div>
            {expressionTest?.error && (
              <p className="text-[11px] text-red-500">{expressionTest.error}</p>
            )}
            {expressionTest &&
              expressionTest.result !== undefined &&
              !expressionTest.error && (
                <p
                  className={cn(
                    "text-[11px]",
                    expressionTest.result ? "text-green-600" : "text-red-600",
                  )}
                >
                  {expressionTest.selectedUserLabel
                    ? `${expressionTest.selectedUserLabel}: `
                    : "Selected user: "}
                  {String(expressionTest.result)}
                </p>
              )}
            {expressionTest?.totals && !expressionTest.error && (
              <p className="text-[11px] text-gray-600">
                Active-contract users: {expressionTest.totals.pass} pass,{" "}
                {expressionTest.totals.fail} fail (total{" "}
                {expressionTest.totals.total})
              </p>
            )}
            {expressionTest?.passUsers &&
              expressionTest?.failUsers &&
              !expressionTest.error && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <details className="rounded border border-gray-200 bg-white p-2">
                    <summary className="cursor-pointer text-[11px] text-gray-700">
                      Passing users ({passUsers.length})
                    </summary>
                    {passUsers.length === 0 ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        No users passed.
                      </p>
                    ) : (
                      <ul className="mt-1 max-h-40 overflow-auto text-[11px] text-gray-700">
                        {passUsers.map((user) => (
                          <li key={user.id}>
                            {user.anonymous ? "Anonymous" : user.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  <details className="rounded border border-gray-200 bg-white p-2">
                    <summary className="cursor-pointer text-[11px] text-gray-700">
                      Failing users ({failUsers.length})
                    </summary>
                    {failUsers.length === 0 ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        No users failed.
                      </p>
                    ) : (
                      <ul className="mt-1 max-h-40 overflow-auto text-[11px] text-gray-700">
                        {failUsers.map((user) => (
                          <li key={user.id}>
                            {user.anonymous ? "Anonymous" : user.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </div>
              )}
          </Card>
        </div>
      )}
      {loading && (
        <p className="text-[11px] text-gray-500">Loading validators…</p>
      )}
      {error && !loading && <p className="text-[11px] text-red-500">{error}</p>}
      {!loading && !hasValidators && !error && (
        <p className="text-[11px] text-gray-500">No custom validators found.</p>
      )}
    </div>
  );
}

export function AutoExtractUserDataToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center text-xs text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-1"
      />
      Automatically extract into user data
    </label>
  );
}
