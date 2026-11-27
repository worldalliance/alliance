import type { FormSchema } from "@alliance/common/forms/form-schema";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useEffect, useRef, useState } from "react";
import {
  JsonScopeKind,
  jsonScopeValue,
  prepareJsonApply,
  type JsonScope,
  type PreparedJsonApply,
} from "../../../../lib/formJson";
import { useCustomValidatorAdmin } from "../../../../lib/useCustomValidatorAdmin";
import Button, { ButtonVariant } from "../../../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../../ui/Modal";
import { Banner, BannerTone } from "../../../../ui/templates/Banner";
import { Textarea } from "../../../../ui/Textarea";
import { useCustomValidatorDrafts } from "../questions/customValidatorDrafts";

const NAMES: Record<JsonScopeKind, string> = {
  [JsonScopeKind.Element]: "Element JSON",
  [JsonScopeKind.Page]: "Page JSON",
  [JsonScopeKind.Form]: "Form JSON",
};

const TITLES: Record<JsonScopeKind, string> = {
  [JsonScopeKind.Element]: "Edit element JSON",
  [JsonScopeKind.Page]: "Edit page JSON",
  [JsonScopeKind.Form]: "Edit form JSON",
};

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
  const validatorExists = useCustomValidatorAdmin(null).exists;
  const [text, setText] = useState(() =>
    JSON.stringify(jsonScopeValue(schema, scope), null, 2),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    const ok = await copyToClipboard(text);
    setCopied(ok);
    setCopyError(
      ok ? null : "Couldn't copy the JSON. Select it and copy it yourself.",
    );
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
      panelClassName="flex w-full max-w-3xl flex-col"
    >
      <ModalHeader>
        <ModalTitle render={<h3 />}>
          {pending ? "Apply id and kind changes?" : TITLES[scope.kind]}
        </ModalTitle>
      </ModalHeader>

      <ModalBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {pending ? (
          <Banner tone={BannerTone.Warning} inline>
            <p>
              This JSON changes ids or kinds. Anything that refers to the old id
              or relies on the old kind may stop working.
            </p>
            <ul className="mt-2 list-disc pl-5">
              {pending.identityChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </Banner>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setCopied(false);
              }}
              readOnly={isChecking}
              spellCheck={false}
              aria-label={NAMES[scope.kind]}
              className="h-108 min-h-48 resize-y font-mono text-caption"
            />
            {errors.length > 0 && (
              <div role="alert" className="text-body text-danger">
                <p className="font-medium">
                  This JSON can&apos;t be applied yet:
                </p>
                <ul className="mt-1 list-disc pl-5 font-mono text-caption">
                  {errors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter error={copyError}>
        <ModalActions className="justify-between">
          {pending ? (
            <span />
          ) : (
            <Button
              variant={ButtonVariant.Ghost}
              onClick={() => void handleCopy()}
            >
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {pending ? (
              <>
                <Button
                  variant={ButtonVariant.Default}
                  onClick={() => setPending(null)}
                >
                  Back
                </Button>
                <Button
                  variant={ButtonVariant.Primary}
                  onClick={() => onApply(pending.schema)}
                >
                  Apply id and kind changes
                </Button>
              </>
            ) : (
              <>
                <Button variant={ButtonVariant.Default} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant={ButtonVariant.Primary}
                  onClick={() => void handleApply()}
                  busy={isChecking}
                >
                  Apply
                </Button>
              </>
            )}
          </div>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
