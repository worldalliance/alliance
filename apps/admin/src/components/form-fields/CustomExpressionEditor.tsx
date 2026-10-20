// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import {
  CustomExpressionUserDto,
  tasksTestCustomExpressionAdmin,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const runExpressionTest = useCallback(async () => {
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
  }, [expression, selectedUserId, selectedUserLabel, usersError, usersLoading]);
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
  );
}
