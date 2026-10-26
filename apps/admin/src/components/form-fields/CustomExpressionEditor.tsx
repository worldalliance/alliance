import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCustomExpressionTestAdmin } from "../../lib/useCustomExpressionTestAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";

type CustomExpressionEditorProps = {
  expression: string | null;
  onExpressionChange: (expression: string) => void;
};

export function CustomExpressionEditor({
  expression,
  onExpressionChange,
}: CustomExpressionEditorProps) {
  const usersQuery = useUsersAdmin();
  const usersLoading = usersQuery.isLoading;
  const usersError = usersQuery.isLoadingError ? "Failed to load users" : null;
  const activeUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => user.hasActiveContract),
    [usersQuery.data],
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { query: expressionTestQuery, run: runExpressionTestQuery } =
    useCustomExpressionTestAdmin({
      expression: expression ?? "",
      userId: selectedUserId,
    });
  const isTesting = expressionTestQuery.isFetching;
  const testError =
    validationError ??
    (expressionTestQuery.error
      ? adminRefusalMessage(
          expressionTestQuery.error,
          "Expression failed to run.",
        )
      : null);
  const expressionTest = testError ? undefined : expressionTestQuery.data;

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
    setValidationError(null);
  }, [expression, selectedUserId]);

  useEffect(() => {
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
  }, [selectedUserId, sortedUsers]);

  const runExpressionTest = useCallback(() => {
    if (!expression?.trim()) {
      setValidationError("Expression is empty.");
      return;
    }
    if (!selectedUserId) {
      setValidationError("Select a user to test against.");
      return;
    }
    if (usersLoading) {
      setValidationError("Users are still loading. Try again soon.");
      return;
    }
    if (usersError) {
      setValidationError(usersError);
      return;
    }
    setValidationError(null);
    void runExpressionTestQuery();
  }, [
    expression,
    selectedUserId,
    usersError,
    usersLoading,
    runExpressionTestQuery,
  ]);
  const canTestExpression =
    hasExpression &&
    !isTesting &&
    Boolean(selectedUserId) &&
    !usersLoading &&
    !usersError;

  return (
    <div className="space-y-2">
      <textarea
        value={expression ?? ""}
        onChange={(e) => onExpressionChange(e.target.value)}
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
              usersLoading || Boolean(usersError) || activeUsers.length === 0
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
        {testError && <p className="text-[11px] text-red-500">{testError}</p>}
        {expressionTest && (
          <p
            className={cn(
              "text-[11px]",
              expressionTest.selectedUserResult
                ? "text-green-600"
                : "text-red-600",
            )}
          >
            {selectedUserLabel ? `${selectedUserLabel}: ` : "Selected user: "}
            {String(expressionTest.selectedUserResult)}
          </p>
        )}
        {expressionTest && (
          <p className="text-[11px] text-gray-600">
            Active-contract users: {expressionTest.passCount} pass,{" "}
            {expressionTest.failCount} fail (total {expressionTest.totalCount})
          </p>
        )}
        {expressionTest && (
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
  );
}
