import FormulaFixes from "../../components/formulas/FormulaFixes";
import { formatCount } from "../../lib/formatNumber";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Field, FormSection, SaveBar } from "../../ui/templates/Form";
import { PageBody } from "../../ui/templates/Page";
import { Textarea } from "../../ui/Textarea";
import UserSelect from "../../ui/UserSelect";
import type { MemberListEditor } from "./useMemberListEditor";

/** The list's fields and save, for a new list and a saved one alike. */
export function MemberListForm({
  editor,
  formulas,
}: {
  editor: MemberListEditor;
  formulas: Parameters<typeof FormulaFixes>[0]["formulas"];
}) {
  const isNew = editor.stored === undefined;
  return (
    <PageBody width="form">
      <form
        ref={editor.formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!editor.busy) editor.save();
        }}
      >
        <FormSection
          title="List"
          description="A suite's parts read the list as it stands when the suite goes live, and keep reading that version after."
          footer={
            <SaveBar
              state={editor.state}
              error={editor.saveError}
              saveLabel={isNew ? "Create member list" : "Save changes"}
              onDiscard={editor.discard}
              disabled={editor.deleting}
            />
          }
        >
          <Field
            label="Name"
            error={editor.nameError}
            help={
              <>
                Formulas read it as{" "}
                <code className="font-mono">
                  isOnList({JSON.stringify(editor.name || "List name")})
                </code>
                . Renaming it updates them.
              </>
            }
          >
            {(control) => (
              <Input
                {...control}
                value={editor.name}
                maxLength={100}
                autoComplete="off"
                readOnly={editor.busy}
                onChange={(event) => editor.setName(event.target.value)}
              />
            )}
          </Field>
          <Field label={`Members (${formatCount(editor.userIds.length)})`}>
            {(control) => (
              <UserSelect
                {...control}
                label={null}
                users={editor.users.data ?? []}
                selectedUserIds={editor.userIds}
                onChange={editor.setUserIds}
                loading={editor.users.isPending}
                loadFailed={editor.users.isError}
                disabled={editor.busy}
                hint="Nobody picked yet."
              />
            )}
          </Field>
          <Field
            label="Add by id or email"
            help="Paste member ids or emails, separated by commas, spaces or new lines. Save adds them too."
            error={editor.pasteError}
          >
            {(control) => (
              <Textarea
                {...control}
                className="font-mono"
                value={editor.pasted}
                spellCheck={false}
                readOnly={editor.busy}
                onChange={(event) => editor.setPasted(event.target.value)}
              />
            )}
          </Field>
          <div>
            <Button
              size="small"
              variant={ButtonVariant.Default}
              busy={editor.users.isPending}
              onClick={editor.addMembers}
            >
              Add members
            </Button>
          </div>
        </FormSection>
      </form>
      <FormulaFixes
        fixes={editor.fixes}
        onFixesChange={editor.setFixes}
        partFixes={editor.partFixes}
        onPartFixesChange={editor.setPartFixes}
        problems={editor.problems}
        formulas={formulas}
        readOnly={editor.busy}
        heading="What reads this list"
        onStopped={editor.stopFixing}
      />
    </PageBody>
  );
}
