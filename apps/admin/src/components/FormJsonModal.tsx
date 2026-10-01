import type { FormSchema } from "@alliance/common/forms/form-schema";
import { tasksFindOneCustomValidatorAdmin } from "@alliance/shared/client";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  JsonScopeKind,
  jsonScopeValue,
  prepareJsonApply,
  type JsonScope,
  type PreparedJsonApply,
} from "../lib/formJson";
import { useCustomValidatorDrafts } from "./form-fields/customValidatorDrafts";

const TITLES: Record<JsonScopeKind, string> = {
  [JsonScopeKind.Element]: "Element JSON",
  [JsonScopeKind.Page]: "Page JSON",
  [JsonScopeKind.Form]: "Form JSON",
};

const validatorExists = async (id: number) =>
  (await tasksFindOneCustomValidatorAdmin({ path: { id } })).data !== undefined;

export function FormJsonModal({
  scope,
  schema,
  displayOnly,
  onApply,
  onClose,
}: {
  scope: JsonScope;
  schema: FormSchema;
  displayOnly: boolean;
  onApply: (next: FormSchema) => void;
  onClose: () => void;
}) {
  const { drafts } = useCustomValidatorDrafts();
  const { success, error: showError } = useToast();
  const [text, setText] = useState(() =>
    JSON.stringify(jsonScopeValue(schema, scope), null, 2),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PreparedJsonApply | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const isClosed = useRef(false);
  useEffect(() => {
    isClosed.current = false;
    return () => {
      isClosed.current = true;
    };
  }, []);

  const handleCopy = async () => {
    if (await copyToClipboard(text)) {
      success("Copied JSON to the clipboard");
    } else {
      showError("Could not copy JSON to the clipboard");
    }
  };

  const handleApply = async () => {
    setIsChecking(true);
    const result = await prepareJsonApply({
      schema,
      scope,
      text,
      displayOnly,
      draftValidatorIds: new Set(Object.keys(drafts).map(Number)),
      validatorExists,
    });
    // Closing while a validator lookup is pending cancels the Apply.
    if (isClosed.current) return;
    setIsChecking(false);
    if (!result.ok) {
      setErrors(result.error);
      return;
    }
    setErrors([]);
    if (result.value.identityChanges.length > 0) {
      setPending(result.value);
      return;
    }
    onApply(result.value.schema);
  };

  return (
    <Modal
      onClose={onClose}
      dismissOnBackdrop={false}
      panelClassName="max-w-3xl w-full max-h-[90vh] flex flex-col"
    >
      <ModalHeader className="flex items-center gap-3">
        <ModalTitle render={<h3 />} className="text-lg font-medium">
          {TITLES[scope.kind]}
        </ModalTitle>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          title="Copy JSON"
          aria-label="Copy JSON"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
      </ModalHeader>

      <ModalBody className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPending(null);
          }}
          readOnly={pending !== null || isChecking}
          spellCheck={false}
          aria-label={TITLES[scope.kind]}
          className="min-h-[50vh] w-full flex-1 resize-y rounded border border-gray-300 p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded border border-red-300 bg-red-50 p-3 font-mono text-xs text-red-700"
          >
            {errors.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        )}
        {pending && (
          <div
            role="alert"
            className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
          >
            <p className="font-medium">
              This JSON changes ids or kinds. Anything that refers to the old id
              or relies on the old kind may stop working.
            </p>
            <ul className="mt-2 list-disc pl-5">
              {pending.identityChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <ModalActions>
          {pending ? (
            <>
              <Button
                color={ButtonColor.White}
                size="small"
                onClick={() => setPending(null)}
              >
                Back
              </Button>
              <Button
                color={ButtonColor.Blue}
                size="small"
                onClick={() => onApply(pending.schema)}
              >
                Apply id and kind changes
              </Button>
            </>
          ) : (
            <>
              <Button color={ButtonColor.White} size="small" onClick={onClose}>
                Cancel
              </Button>
              <Button
                color={ButtonColor.Blue}
                size="small"
                onClick={() => void handleApply()}
                disabled={isChecking}
              >
                {isChecking ? "Checking..." : "Apply"}
              </Button>
            </>
          )}
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
