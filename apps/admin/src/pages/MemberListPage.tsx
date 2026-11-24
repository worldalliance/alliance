import type {
  FormulaDto,
  FormulaEditDto,
  FormulaProblemDto,
  MemberListDto,
  UserDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import { isEqual } from "es-toolkit";
import React, { useId, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import ConfirmDialog from "../components/ConfirmDialog";
import FormulaFixes from "../components/formulas/FormulaFixes";
import {
  groupFixChanged,
  type GroupFixDraft,
} from "../components/formulas/GroupFixFields";
import SaveRefusal, { type Refusal } from "../components/formulas/SaveRefusal";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { asDraft } from "../lib/formulaDraft";
import { matchMemberEntries } from "../lib/memberEntries";
import {
  useFormulasAdmin,
  useInvalidateFormulasAdmin,
  useSaveFormulasAdmin,
} from "../lib/useFormulasAdmin";
import {
  useForgetMemberListAdmin,
  useMemberListsAdmin,
  useSaveMemberListAdmin,
} from "../lib/useMemberListsAdmin";
import { useUnsavedChangesPrompt } from "../lib/useUnsavedChangesPrompt";
import { useUsersAdmin } from "../lib/useUsersAdmin";

const NEW = "new";

const MemberListPage: React.FC = () => {
  const { listId = NEW } = useParams();
  // A link to another list keeps this route mounted; the key opens it afresh.
  return <LoadedList key={listId} listId={listId} />;
};

const LoadedList: React.FC<{ listId: string }> = ({ listId }) => {
  const lists = useMemberListsAdmin();
  const formulas = useFormulasAdmin();
  // The editor opens on its own fetches, not a cached list or formula with an
  // older version, which would make the first save a conflict. It keeps what
  // it opened with, so a refetch or its own delete never unmounts it.
  const [opened, setOpened] = useState<{
    stored: MemberListDto | undefined;
    formulas: FormulaDto[];
  } | null>(null);
  if (
    opened === null &&
    lists.isSuccess &&
    lists.isFetchedAfterMount &&
    formulas.isSuccess &&
    formulas.isFetchedAfterMount
  ) {
    setOpened({
      stored: lists.data.find((list) => list.id === listId),
      formulas: formulas.data,
    });
  }
  if (opened !== null) {
    if (listId !== NEW && opened.stored === undefined) {
      return (
        <div className="p-5 space-y-2">
          <p className="text-sm text-zinc-700">
            This list doesn&apos;t exist, or was deleted.
          </p>
          <Link to="/member-lists" className="text-sm underline">
            Back to member lists
          </Link>
        </div>
      );
    }
    return <ListEditor {...opened} />;
  }
  const failed = lists.isError ? lists.error : formulas.error;
  return failed !== null ? (
    <p className="p-5 text-sm text-red-700" role="alert">
      {adminRefusalMessage(failed, "Couldn't load the list.")}
    </p>
  ) : (
    <p className="p-5 text-sm text-zinc-600" role="status">
      Loading list…
    </p>
  );
};

const sameMembers = (a: readonly number[], b: readonly number[]) =>
  isEqual([...a].sort(), [...b].sort());

const ListEditor: React.FC<{
  stored: MemberListDto | undefined;
  /** The formulas as the page opened them, for fixing what a delete breaks. */
  formulas: FormulaDto[];
}> = ({ stored: opened, formulas }) => {
  const id = useId();
  const navigate = useNavigate();
  const { success } = useToast();
  const users = useUsersAdmin();
  const saveList = useSaveMemberListAdmin();
  const saveFormulas = useSaveFormulasAdmin();
  const invalidateFormulas = useInvalidateFormulasAdmin();
  const forget = useForgetMemberListAdmin();
  /** The list as last saved, which unsaved changes are measured against. */
  const [stored, setStored] = useState(opened);
  const [name, setName] = useState(stored?.name ?? "");
  const [userIds, setUserIds] = useState(stored?.userIds ?? []);
  const [pasted, setPasted] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /** Why the last delete was refused, by formula. */
  const [problems, setProblems] = useState<FormulaProblemDto[]>([]);
  const [fixes, setFixes] = useState<FormulaEditDto[]>([]);
  const [groupFixes, setGroupFixes] = useState<GroupFixDraft[]>([]);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const busy = saveList.isPending || saveFormulas.isPending;

  const fixChanged = (fix: FormulaEditDto) => {
    const before = formulas.find((formula) => formula.id === fix.id);
    return before === undefined || !isEqual(fix, asDraft(before));
  };
  const hasUnsavedChanges =
    name !== (stored?.name ?? "") ||
    !sameMembers(userIds, stored?.userIds ?? []) ||
    pasted.trim() !== "" ||
    fixes.some(fixChanged) ||
    groupFixes.some(groupFixChanged);
  const navigateUnprompted = useUnsavedChangesPrompt({ hasUnsavedChanges });

  const refuse = (error: unknown, fallback: string) =>
    setRefusal({
      message: adminRefusalMessage(error, fallback),
      outdated: thrownStatus(error) === 409,
    });

  const save = () => {
    setRefusal(null);
    let members = userIds;
    // Entries left in the paste box join the save, or stop it if any match no
    // member.
    if (pasted.trim() !== "") {
      if (users.isError) {
        setRefusal({
          message:
            "Members couldn't load, so the pasted entries can't be matched. Reload the page to try again.",
          outdated: false,
        });
        return;
      }
      if (users.data === undefined) {
        setRefusal({
          message:
            "Members are still loading, so the pasted entries can't be matched yet. Save again in a moment.",
          outdated: false,
        });
        return;
      }
      const added = addPasted(users.data);
      if (added === undefined) return;
      members = added;
    }
    saveList.mutate(
      stored === undefined
        ? { id: undefined, body: { name, userIds: members } }
        : {
            id: stored.id,
            body: {
              name,
              userIds: members,
              baseVersionId: stored.versionId,
              baseName: stored.name,
            },
          },
      {
        onSuccess: (saved) => {
          success("Saved.");
          if (stored === undefined) {
            navigateUnprompted(() => navigate(`/member-lists/${saved.id}`));
            return;
          }
          setStored(saved);
          setName(saved.name);
          // The member picker stays editable during a save; members picked
          // meanwhile are kept, and count as unsaved.
          setUserIds((current) =>
            current === members ? saved.userIds : current,
          );
        },
        onError: (error) => refuse(error, "Couldn't save."),
      },
    );
  };

  const remove = (list: MemberListDto) => {
    setRefusal(null);
    saveFormulas.mutate(
      {
        edits: fixes,
        deletions: [],
        deletedLists: [{ id: list.id, baseVersionId: list.versionId }],
        groupFixes: groupFixes.map((draft) => draft.fix),
      },
      {
        onSuccess: async (refused) => {
          setConfirmingDelete(false);
          setProblems(refused);
          if (refused.length > 0) return;
          success(`Deleted ${list.name}.`);
          forget(list.id);
          navigateUnprompted(() => navigate("/member-lists"));
          await invalidateFormulas();
        },
        onError: (error) => {
          setConfirmingDelete(false);
          refuse(error, "Couldn't delete.");
        },
      },
    );
  };

  /** The members with the pasted ones added, unless an entry matched none. */
  const addPasted = (everyone: UserDto[]): number[] | undefined => {
    const matched = matchMemberEntries({ text: pasted, users: everyone });
    const next = [
      ...userIds,
      ...matched.userIds.filter((each) => !userIds.includes(each)),
    ];
    setUserIds(next);
    setUnmatched(matched.unmatched);
    setPasted(matched.unmatched.join("\n"));
    return matched.unmatched.length === 0 ? next : undefined;
  };

  return (
    <div className="p-5 space-y-6">
      <title>{`${stored?.name ?? "New list"} - Admin`}</title>
      <div className="space-y-1">
        <Link to="/member-lists" className="text-sm underline text-zinc-600">
          Member lists
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">
          {stored?.name ?? "New list"}
        </h1>
      </div>

      <SaveRefusal
        refusal={refusal}
        onReload={() => window.location.reload()}
      />

      <form
        className="space-y-5 max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) save();
        }}
      >
        <label className="block text-sm text-zinc-700">
          Name
          <span className="block text-xs text-zinc-500">
            Formulas read it as{" "}
            <code>isOnList({JSON.stringify(name || "List name")})</code>.
            Renaming it updates them.
          </span>
          <input
            className="w-full border border-zinc-300 rounded px-2 py-1 mt-1 text-sm"
            value={name}
            maxLength={100}
            autoComplete="off"
            readOnly={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <div className="space-y-1">
          <UserSelect
            users={users.data ?? []}
            selectedUserIds={userIds}
            onChange={setUserIds}
            loading={users.isPending}
            loadFailed={users.isError}
            label={`Members (${userIds.length})`}
          />
        </div>

        <div className="space-y-2">
          <label
            className="block text-sm text-zinc-700"
            htmlFor={`${id}-paste`}
          >
            Add by id or email
            <span className="block text-xs text-zinc-500">
              Paste member ids or emails, separated by commas, spaces or new
              lines.
            </span>
          </label>
          <textarea
            id={`${id}-paste`}
            className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono min-h-20"
            value={pasted}
            spellCheck={false}
            readOnly={busy}
            aria-describedby={
              unmatched.length > 0 ? `${id}-unmatched` : undefined
            }
            onChange={(event) => {
              setPasted(event.target.value);
              if (event.target.value.trim() === "") setUnmatched([]);
            }}
          />
          {unmatched.length > 0 && (
            <p
              id={`${id}-unmatched`}
              role="alert"
              className="text-sm text-red-700"
            >
              {unmatched.length === 1
                ? "This matched no member, so it wasn't added: "
                : `These ${unmatched.length} matched no member, so they weren't added: `}
              {unmatched.join(", ")}
            </p>
          )}
          <Button
            size="small"
            color={ButtonColor.White}
            aria-disabled={users.data === undefined}
            className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
            onClick={() => {
              if (users.data !== undefined) addPasted(users.data);
            }}
          >
            {users.isPending ? "Loading members…" : "Add members"}
          </Button>
        </div>

        <Button
          type="submit"
          color={ButtonColor.Black}
          aria-disabled={busy}
          className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
        >
          {saveList.isPending ? "Saving…" : "Save"}
        </Button>
      </form>

      {stored !== undefined && (
        <section className="space-y-4 max-w-3xl border-t border-zinc-200 pt-4">
          {problems.length > 0 && (
            <p
              role="alert"
              className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-800"
            >
              Nothing was deleted. Fix the problems below, then delete again.
            </p>
          )}
          <FormulaFixes
            fixes={fixes}
            onFixesChange={setFixes}
            groupFixes={groupFixes}
            onGroupFixesChange={setGroupFixes}
            problems={problems}
            formulas={formulas}
            readOnly={busy}
            heading="What reads this list"
            onStopped={(fixId) => {
              setProblems(problems.filter((problem) => problem.id !== fixId));
              deleteButton.current?.focus();
            }}
          />
          <Button
            ref={deleteButton}
            color={ButtonColor.RedOutline}
            aria-disabled={busy}
            className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
            onClick={() => {
              if (!busy) setConfirmingDelete(true);
            }}
          >
            Delete list
          </Button>
          <ConfirmDialog
            isOpen={confirmingDelete}
            title={`Delete ${stored.name}?`}
            message={
              fixes.length > 0
                ? `The list is deleted together with your changes to ${fixes.length === 1 ? "the formula" : `${fixes.length} formulas`} above. Its saved versions are kept.`
                : "The list is deleted and its name is free to reuse. Its saved versions are kept. If a formula reads it, the delete is refused until you fix that formula in the same save."
            }
            confirmLabel="Delete list"
            destructive
            isLoading={saveFormulas.isPending}
            onConfirm={() => remove(stored)}
            onCancel={() => setConfirmingDelete(false)}
          />
        </section>
      )}
    </div>
  );
};

export default MemberListPage;
