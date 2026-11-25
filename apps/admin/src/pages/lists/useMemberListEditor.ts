import type {
  FormulaDto,
  FormulaEditDto,
  FormulaProblemDto,
  MemberListDto,
  UserDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { isEqual } from "es-toolkit";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  partFixChanged,
  type PartFixDraft,
} from "../../components/formulas/PartFixFields";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { asDraft } from "../../lib/formulaDraft";
import { MEMBER_LISTS_HREF, memberListHref } from "../../lib/hrefs";
import { matchMemberEntries } from "../../lib/memberEntries";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useInvalidateFormulasAdmin,
  useSaveFormulasAdmin,
} from "../../lib/useFormulasAdmin";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import {
  useForgetMemberListAdmin,
  useSaveMemberListAdmin,
} from "../../lib/useMemberListsAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  SAVE_FAILED_FALLBACK,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { unmatchedMessage } from "./memberListRules";

/** A write the page reports in its banner, rather than in the save bar. */
export type PageRefusal = { message: string; outdated: boolean };

const sameMembers = (a: readonly number[], b: readonly number[]) =>
  isEqual([...a].sort(), [...b].sort());

/**
 * The list's form, its save, and its delete with the formula fixes a refused
 * delete asks for. `opened` is the list as fetched fresh for this page, or
 * undefined for a new one; `formulas` likewise.
 */
export function useMemberListEditor({
  opened,
  formulas,
}: {
  opened: MemberListDto | undefined;
  formulas: FormulaDto[];
}) {
  const navigate = useNavigate();
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const users = useUsersAdmin();
  const saveList = useSaveMemberListAdmin();
  const saveFormulas = useSaveFormulasAdmin();
  const invalidateFormulas = useInvalidateFormulasAdmin();
  const forget = useForgetMemberListAdmin();
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const deleteButton = useRef<HTMLButtonElement>(null);

  /** The list as last saved, which unsaved changes are measured against. */
  const [stored, setStored] = useState(opened);
  const [name, setName] = useState(stored?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [userIds, setUserIds] = useState(stored?.userIds ?? []);
  const [pasted, setPasted] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  /** Why pasted entries can't be matched: members are loading or failed. */
  const [matchBlocked, setMatchBlocked] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refusal, setRefusal] = useState<PageRefusal | null>(null);
  /** Why the last delete was refused, by formula. */
  const [problems, setProblems] = useState<FormulaProblemDto[]>([]);
  const [fixes, setFixes] = useState<FormulaEditDto[]>([]);
  const [partFixes, setPartFixes] = useState<PartFixDraft[]>([]);
  const busy = saveList.isPending || saveFormulas.isPending;

  const fixChanged = (fix: FormulaEditDto) => {
    const before = formulas.find((formula) => formula.id === fix.id);
    return before === undefined || !isEqual(fix, asDraft(before));
  };
  const formDirty =
    name !== (stored?.name ?? "") ||
    !sameMembers(userIds, stored?.userIds ?? []) ||
    pasted.trim() !== "";
  const navigateUnprompted = useLeaveGuard(
    formDirty || fixes.some(fixChanged) || partFixes.some(partFixChanged),
  );

  const touched = () => {
    setSaved(false);
    setSaveError(null);
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

  /** Matches the paste box, or says why it can't and returns undefined. */
  const matchPasted = (): number[] | undefined => {
    if (users.data !== undefined) {
      setMatchBlocked(null);
      return addPasted(users.data);
    }
    setMatchBlocked(
      users.isError
        ? "Members couldn't load, so the pasted entries can't be matched. Reload the page to try again."
        : "Members are still loading, so the pasted entries can't be matched yet. Save again in a moment.",
    );
    return undefined;
  };

  const save = () => {
    setRefusal(null);
    touched();
    if (name.trim() === "") {
      setNameError("Enter a name");
      focusFirstInvalid();
      return;
    }
    let members = userIds;
    // Entries left in the paste box join the save, or stop it if any match no
    // member.
    if (pasted.trim() !== "") {
      const added = matchPasted();
      if (added === undefined) {
        focusFirstInvalid();
        return;
      }
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
        onSuccess: (list) => {
          if (stored === undefined) {
            success("Member list created", list.name);
            navigateUnprompted(() => void navigate(memberListHref(list.id)));
            return;
          }
          success("Member list saved", list.name);
          setStored(list);
          setName(list.name);
          setSaved(true);
          setUserIds(list.userIds);
        },
        onError: (error) => {
          const message = adminRefusalMessage(error, SAVE_FAILED_FALLBACK);
          if (thrownStatus(error) === 409) {
            setRefusal({ message, outdated: true });
          } else {
            setSaveError(message);
          }
        },
      },
    );
  };

  const discard = () => {
    setName(stored?.name ?? "");
    setNameError(null);
    setUserIds(stored?.userIds ?? []);
    setPasted("");
    setUnmatched([]);
    setMatchBlocked(null);
    touched();
  };

  const remove = async () => {
    if (stored === undefined || busy) return;
    const fixCount = fixes.length + partFixes.length;
    const confirmed = await confirm({
      title: `Delete the member list “${stored.name}”?`,
      message:
        fixCount > 0
          ? `The list is deleted in one save with your ${fixCount === 1 ? "fix" : `${fixCount} fixes`} below. Its saved versions are kept. No member is notified.`
          : "The list is deleted and its name is free to reuse. Its saved versions are kept, so a suite already live keeps reading it. If a formula or a suite's part reads it, the delete is refused until you fix that in the same save. No member is notified.",
      confirmLabel: "Delete list",
      destructive: true,
    });
    if (!confirmed) return;
    setRefusal(null);
    saveFormulas.mutate(
      {
        edits: fixes,
        deletions: [],
        deletedLists: [{ id: stored.id, baseVersionId: stored.versionId }],
        partFixes: partFixes.map((draft) => draft.fix),
      },
      {
        onSuccess: async (refused) => {
          setProblems(refused);
          if (refused.length > 0) return;
          success("Member list deleted", stored.name);
          forget(stored.id);
          navigateUnprompted(() => void navigate(MEMBER_LISTS_HREF));
          await invalidateFormulas();
        },
        onError: (error) =>
          setRefusal({
            message: adminRefusalMessage(error, "Couldn't delete the list."),
            outdated: thrownStatus(error) === 409,
          }),
      },
    );
  };

  const state = saveList.isPending
    ? SaveState.Saving
    : saveError !== null
      ? SaveState.Failed
      : formDirty
        ? SaveState.Dirty
        : saved
          ? SaveState.Saved
          : SaveState.Clean;

  return {
    stored,
    users,
    busy,
    deleting: saveFormulas.isPending,
    formRef,
    deleteButton,
    name,
    setName: (next: string) => {
      setName(next);
      setNameError(null);
      touched();
    },
    nameError,
    userIds,
    setUserIds: (next: number[]) => {
      setUserIds(next);
      touched();
    },
    pasted,
    setPasted: (next: string) => {
      setPasted(next);
      setMatchBlocked(null);
      if (next.trim() === "") setUnmatched([]);
      touched();
    },
    pasteError: matchBlocked ?? unmatchedMessage(unmatched),
    addMembers: () => {
      matchPasted();
    },
    save,
    discard,
    state,
    saveError,
    refusal,
    dismissRefusal: () => setRefusal(null),
    remove,
    problems,
    fixes,
    setFixes,
    partFixes,
    setPartFixes,
    /** "Stop fixing it" dropped `fixId`: its problems go, focus goes to Delete. */
    stopFixing: (fixId: string) => {
      setProblems((current) =>
        current.filter((problem) => problem.id !== fixId),
      );
      deleteButton.current?.focus();
    },
  };
}

export type MemberListEditor = ReturnType<typeof useMemberListEditor>;
