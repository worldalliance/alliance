# Forms: functionality inventory

Read from the code at c722280863, then refreshed at ff886c540b after the rebase onto `main` took in #1028, #1088, #1089 and #1090. Line citations in the entries those PRs touched are to that revision, an entry they added or changed names the PR, and what they removed is marked **Removed** in place with its ID kept. This inventory is the checklist the redesign is verified against, so that nothing staff can do today is lost. It was written against the prototype's page map before the corrections in this directory's `PLACES.md`: a `PLACES.md:<line>` citation refers to that earlier version, and where a note here says the map lacks something or adds something new, `PLACES.md` is the current answer.

Scope: `/forms`, `/forms/:formId` (builder), `/forms/:formId/responses`, `/forms/:formId/snapshots`, plus the action tabs that embed the builder or responses view (Task form, Form variants, Follow-up forms, Responses; sentence case since #1028). Every capability has an ID so the redesign can be checked off against it. Paths are relative to `apps/admin/src/` unless they start with `shared/`, `sharedweb/` or `common/`.

Routes: `routes.ts:41` (`/forms`), `:46` (`/forms/:formId/responses`), `:47` (`/forms/:formId/snapshots`), `:48` (`/forms/:formId`).

There are no feature flags anywhere in `apps/admin/src` (grep for `FeatureFlag|useFlag` finds nothing), no websockets and no polling on these pages. Freshness comes from React Query defaults (refetch on window focus) and explicit Refresh buttons.

---

## 1. `/forms`: forms list

- **New place:** Tasks › Forms › Forms list (`#/tasks/forms`), reached from the rail's Forms entry (PLACES.md:32).
- **Purpose:** list every form with its size and response count, and open, delete, or jump to its responses.
- **Page:** `pages/FormsList.tsx`.

### Capabilities

- **L1** One card per form, in server order (no sort, filter or search). The title is `form.title`, or `Form {id}` when it has none (`FormsList.tsx:113-121`).
- **L2** Each card shows `ID: {id}` (`:124`).
- **L3** Shows "Linked in action: {name}" in green when `form.usedInAction` is set (`:137-141`).
- **L4** Shows "{n} pages • {n} fields" from `schemaCounts`, or a red "Unreadable schema" when the server could not count (`:144-151`).
- **L5** A "Responses ({count})" button per form, with the count loaded in one batch for all ids. It shows "…" (title "Counting responses") while pending, and "?" (title "Could not load the response count") on error or when the batch returned no row for the form (`:17-41`, `:152-156`). Clicking opens `/forms/:id/responses` and doesn't open the card (`stopPropagation`, `:51-53`).
- **L6** Clicking a card opens the builder. A form linked to an action goes to `/actions/:actionId?tab=form` (the action's Task form tab), and any other form goes to `/forms/:id` (`:85-94`, `:116`).
- **L7** Delete: the "×" button on each card asks `confirm("Are you sure you want to delete this form?")`, then calls DELETE. A failure toasts the server's message, or "Failed to delete form" (`:70-83`, `:125-133`). Nothing stops you deleting a form that is linked to an action or has responses.
- **L8** States: "Loading forms...", "Failed to load forms" (red), "No forms found.", and a stale-data banner, "Could not refresh. Showing the list as of the last successful load.", shown when a refetch fails but rows exist (`:98-110`).
- **L9** **There is no "New form" button.** A new standalone form is only reachable by typing `/forms/new` (`pages/FormBuilder.tsx:16` treats `new` as no id). Forms are otherwise created by an action's Task form tab, by a follow-up form, or by variant cloning.

### Data

- `useFormsAdmin()` (`shared/lib/useFormsAdmin.ts:70`): GET `/tasks/listForms`. Its `deleteForm` calls DELETE `/tasks/{id}` and invalidates the list.
- `useFormResponseCountsAdmin(ids)` (`shared/lib/useFormsAdmin.ts:188`): POST `/tasks/responses/counts`.

### Shared code

`sharedweb/ui/Card`, `sharedweb/ui/ToastProvider`, `shared/styles/card`, `common/plural`, `common/errorMessage`.

### Tests

None: there is no `FormsList.test.tsx`.

### Notes

- The delete control is an unlabeled "×" with no `aria-label`, uses native `confirm`, and has no guard for linked forms or forms with responses.
- The response-count and status logic lives only in this file.

---

## 2. `/forms/:formId`: form builder

- **New place:** Tasks › Forms › Form record (`#/form/:id`) › Builder tab (PLACES.md:39, :125).
- **Purpose:** edit a form's schema (pages, questions, display blocks, visibility rules, formulas, output and aggregate views, shareable text, row list), preview it as a member, and save it with conflict handling.
- **Page:** `pages/FormBuilder.tsx`, a thin wrapper around `components/FormBuilder.tsx`.
  - `formId === "new"`, or no id, opens a blank form.
  - The first save of a new form navigates to `/forms/{newId}` (`pages/FormBuilder.tsx:10-12`).

The same component is embedded in the action Task form tab (`pages/ActionDashboard.tsx:303-308`, with `taskFlow`), in `ProjectActionPage.tsx:135-140` (without `taskFlow`), in the follow-up form card (`ActionFollowUpFormsTab.tsx:448-452`), and in display-only mode in `ActionUpdatePage.tsx:350` and `GeneralUpdatePage.tsx:278`. The display-only uses belong to other inventories, but they share every canvas capability below except where marked "not in display-only".

### 2.1 Header, tabs, URL state and keyboard (`FormBuilderHeader.tsx`, `FormBuilder.tsx`)

- **B1** Editor tabs: "Form Builder", "Shareable Text", "Output View", "Aggregate Views", "Formulas" and "Rows" (`FormBuilderHeader.tsx:27-34`).
  - The Formulas tab shows a count badge of variables (`:170-174`).
  - The active tab is held in the URL as `?editor=form|shareable|outputs|aggregates|variables|rows` (`FormBuilder.tsx:161-176`). Display-only builders hide the tabs.
- **B2** Form slug editor, shown when the form has an id (`FormSlugEditor.tsx`, `SlugField.tsx`).
  - Displays the action prefix of `displaySlug`, then the form's own slug.
  - Click the slug to edit it inline. Enter saves via PATCH `/tasks/forms/{formId}/slug`; Escape or blur cancels.
  - A server refusal is shown inline (`role=alert`) and keeps the draft open.
  - A copy button copies the slug, toasting "Slug copied" or "Could not copy the slug." (`SlugField.tsx:39-42`).
- **B3** **There is no form-title editor.** The title is set only at creation: "Untitled Form", or "{actionName} form" when embedded in an action (`FormBuilder.tsx:99`).
- **B4** Issue list button (`form-canvas/IssueList.tsx`):
  - The button shows "N issues" in red, "Checking" with a spinner while source forms load, or "No issues". It is hidden when there is nothing to show.
  - The panel lists each issue's location ("Page › Element › Sub-field", "Output view: X", "Formulas", "Rows", "Form") and its message.
  - Clicking a row goes to where the issue is repaired: the right page, element and sidebar section, the output view, or the Formulas or Rows tab (`IssueList.tsx:79-125`, `FormBuilder.tsx:309-328`).
  - The panel also shows "Loading the questions of N forms that formulas read…", a "Couldn't load… Retry" button, and "The form didn't load" with a retry action.
  - Escape or a click outside closes it, and focus returns to the toggle.
  - When opened by a blocked Save or Preview, its title reads "Fix N issues before saving/previewing" and focus moves into it.
- **B5** Undo and redo buttons with keyboard shortcuts ⌘/Ctrl+Z, ⇧⌘/Ctrl+Z and Ctrl+Y (`HistoryControls.tsx`).
  - The shortcuts work only inside the builder or on an unfocused page, and never in a text field or dialog (where the browser's undo applies).
  - Undo is locked while saving, loading, previewing, or showing a conflict (`FormBuilder.tsx:296-307`).
  - Typing is folded into one step until the field loses focus. Saving ends the current step. Applying JSON is undoable.
  - Undo covers every tab.
- **B6** "Edit form JSON" button, which opens the whole-form JSON modal (see B60). Hidden in preview.
- **B7** "Preview" / "Edit" toggle, shown only on the Form Builder tab. Preview is blocked while issues exist: it opens the issue list gated on Preview instead (`FormBuilder.tsx:277-280`).
- **B8** Save button labelled "Save Form", "Saving..." or "No changes". It is disabled while saving or loading, or when nothing has changed (`FormBuilderHeader.tsx:142-153`).
- **B9** **⌘/Ctrl+S saves** (when there are changes and the builder is neither saving nor loading) and prevents the browser's save dialog (`FormBuilderHeader.tsx:80-97`).
- **B10** Banners: "Loading form...", "Error loading form: {msg}" with a "Retry" button (labelled "Discard edits and retry" when there are unsaved edits), and "Error saving form: {msg}" (`FormBuilderHeader.tsx:184-223`).
- **B11** Deep link `?select={pageOrElementId}`: on load, opens that page or element selected and revealed, including a list's sub-field. If the id doesn't exist it toasts `This form has no page or element "{id}"`.
  - The parameter is removed from the URL straight away (`lib/formEditorLink.ts:9-10,25-36`, `lib/useSavedForm.ts:100-111`).
  - Used by dependency links and the suite launch's action links.
- **B12** Deep link `?previewAs={userId}`: opens straight into Preview as that member once the form and its source forms load. The parameter is removed from the URL (`formEditorLink.ts:12-19,39`, `FormBuilder.tsx:205-209,281-286`).
  - Used by suite-launch task form previews.
  - Says "Member #{id} isn't in the user list." when the member is missing.
- **B13** Leave guard (`lib/useLeaveGuard.ts`, asked by the one `components/LeaveGuard.tsx` that wraps every admin route; `lib/useSavedForm.ts:138-148`; changed in #1028 and #1090, which replaced `lib/useUnsavedChangesPrompt.ts`):
  - With unsaved changes, in-app navigation prompts "You have unsaved changes. Are you sure you want to leave this page?" through `window.confirm`.
  - A browser unload triggers `beforeunload`.
  - The builder's own post-save navigation skips the prompt, for this builder's guard only: another dirty editor on the page (for example the action details beside an embedded task form) is still asked. Once that navigation lands, the page it left no longer blocks the next one (#1090).
- **B14** Embedded builders report their unsaved state through `onUnsavedChangesChange`, which `ProjectActionPage` uses to disable its Release panel (`FormBuilder.tsx:143-145`).

### 2.2 Canvas layout, outline and selection

- **B15** Three panes (`form-canvas/CanvasWorkspace.tsx`):
  - outline (`nav`, 15rem), canvas, and settings sidebar (26rem);
  - below 1024px the outline and settings become drawers, opened by "Open outline" and "Open settings" icon buttons and closed by Escape or ×;
  - drawers restore focus when they close.
- **B16** Outline (`form-canvas/FormOutline.tsx`):
  - lists pages ("Pages" heading), each page's elements, visibility groups ("Shared visibility · N elements", amber) with their members, list sub-fields, and accordion sections with their blocks;
  - pages and groups expand and collapse; the selected page and every group start expanded; containers start collapsed and expand to reveal a selection;
  - each row shows an issue-count marker; empty pages show "No elements";
  - the members of a grey box sit on a grey band (B107).
  - Display-only builders show only the current page's blocks.
- **B17** Add page with the "+" in the outline. The new page is titled "Page {n}", gets a unique id, and opens selected with its title focused (`useCanvasEdits.ts:171-188`).
- **B18** Drag and drop in the outline (`useOutlineDrag.ts`):
  - reorder pages;
  - move an element within its page, to a gap on another page, or onto a page row (which appends it at the end);
  - drag a group by its header, or a multi-element selection, as a whole;
  - drop lines and rings show only where a drop would move something.
- **B19** Outline checkboxes build a consecutive range selection. Shift-click extends the range, and Shift-click on a group header takes in the whole group (`rangeSelection.ts`). Not in display-only.
- **B20** Canvas (`form-canvas/FormCanvas.tsx`):
  - renders the selected page as respondents see it, with page title and description;
  - clicking the title selects the page; Enter or the pencil edits the title inline;
  - shows an issue marker and a conditions indicator ("Edit page conditions: shown when …");
  - empty state: "This page is empty. Add a question or some content to get started." (display-only: "This update is empty…").
- **B21** Task-flow step note (Task form tab only, `taskFlow`): each page shows the task-flow step it becomes, with amber warnings about what to fix (`FormCanvas.tsx:78-96,292`, `shared/forms/flowScreens`). It does not appear in `ProjectActionPage`.
- **B22** Element on the canvas (`CanvasElement.tsx`):
  - click to select, Shift-click to extend a range;
  - drag handle to reorder;
  - issue marker, and a red ring when the element has issues;
  - a conditions indicator that opens its Conditions section;
  - an "Editing content for {user}" badge for per-user content;
  - links and forms inside accordions are inert.
- **B23** Inline text editing on the selected element (`InlineText.tsx`), opened by Enter or the pencil and closed by Enter (single-line), Escape or blur:
  - headers and labels are single-line; text, quote and expert message blocks are multi-line; question labels and list labels can also be edited;
  - variable tokens can be typed, and IME composition is respected.
- **B24** Visibility groups on the canvas: a dashed amber "Shared visibility · N elements" section showing "Shown when {summary}" and "Shared rule has N issues". Clicking it selects the group (`FormCanvas.tsx:311-374`).
- **B25** Insert points (`InsertPoint.tsx`):
  - a hover "+" between every element, and a prominent "Add element" button at the end;
  - the picker searches "questions and content", with Field, Block and Copy badges; Enter picks the first match and Escape closes it;
  - "Copy Existing Element" opens a select grouped by page, with Insert and Cancel;
  - copying isn't offered inside a group;
  - the inserted element is selected and its first control focused (`useCanvasEdits.ts:123-128`);
  - an element inserted into a visibility group inherits the group's condition, and one inserted between two members of a grey box joins the box (B108) (`:93-122`).
- **B26** Addable question kinds (`common/forms/element-descriptors.ts:12-88`): Text Area, Email, Phone, Number, Range, Checkbox, Radio, Select, Multi-select, Ranking, Date, Time, Timezone, City, File, Contract, List, Custom Component, Image Upload, Toggle, Time Picker and Conversation. Legacy `text` exists but can't be added.
- **B27** Addable display blocks (`element-descriptors.ts:38-57`): Header, Text, Label, Divider, Spacer, HTML, Images, Video, Quote, Big Link, Copy Text, Previous Answer, User Location, Chat Transcript, Expert Message and Accordion. Display-only builders offer a subset (`isDisplayOnlyBlockKind`).
- **B28** Element boundary: an element that can't render is flagged on the canvas ("Select it to change its settings or JSON.") and in the sidebar ("Edit its JSON, or delete it, under Advanced.") but stays editable (`ElementBoundary.tsx`).

### 2.3 Settings sidebar: shared structure

- **B29** Sections "Content", "Conditions" and "Advanced", switched with the arrow keys. Each mounts when first opened and stays mounted (`sidebarSections.tsx:26-28,82,150-169`). Display-only builders drop Conditions. For an element or a range, Content ends with the Grey box panel (B106).
- **B30** "Issues here" list above the settings for the selection (`IssueList.tsx:341-359`).
- **B31** Page settings (`PageSettings.tsx`):
  - page title;
  - page-level conditions, which can reference only fields on earlier pages; the first page warns "Conditions on the first page can only reference other forms or validators…";
  - Move page up and down;
  - "Page ID";
  - Edit page JSON, Copy page (inserted after it with unique ids, keeping its visibility groups and giving its grey boxes fresh ids, `lib/copyWithUniqueIds.ts:220`), and Delete page (disabled when it's the only page; guarded, B37).
- **B32** Element settings (`ElementSettings.tsx`):
  - a heading describing the element;
  - Move to page (B35), and Move up/down, which steps past a whole group;
  - "Element ID";
  - "Edit element JSON", "Duplicate" (unique ids, selects the copy, stays in the same visibility group and the same grey box), and "Delete question" or "Delete block" (guarded, B37).
- **B33** Dependency links (`DependencyLinks.tsx`, not in display-only):
  - "Depends on" lists the questions this item's formulas read, with roles. Each is linked: same-form ones select the place; other forms' ones open `/forms/{id}?select=…` in a new tab; a missing source shows "Missing question {id}".
  - "Used by" lists what on this form reads the question, with group members gathered. When nothing does it says "No conditions on this form read this question."
- **B34** Child settings for list sub-fields and accordion sections and blocks (`ChildSettings.tsx`):
  - breadcrumb back to the parent; move up/down; an id label;
  - "Delete question", "Delete section" or "Delete block"; undo restores the deleted child;
  - a sub-field kind with no editor (contract, custom) says "No settings to edit for this kind of question."
- **B35** "Move to page" menu: moves the element, range or group to the end of another page, keeping it selected and in view. It refuses, with a sticky toast, if element ids repeat on the form (`useCanvasEdits.ts:265-326`). Grey boxes settle after the move (B108). Not offered on one-page forms or in display-only.
- **B36** Range selection settings ("N elements selected", `RangeSettings.tsx`):
  - lists the members; Content also holds the Grey box panel for the range (B106);
  - Conditions offers "Share: shown when …" for each existing formula, showing who holds it, and "Always shown now: …";
  - "Or share new rules" with a full rule editor and a "Share new rules" button;
  - refuses with a reason when sharing would create a visibility cycle or names undefined rules;
  - explains when a block without an id can't share;
  - "These elements already share visibility. Open group settings" when the range already is a group.
- **B37** Guarded deletion (`useGuardedDeletion.tsx`):
  - deleting a page, question or sub-field that other conditions read opens a confirm listing them ("Conditions on these read this question: • … Their rules stay as written…") with "Delete question" or "Delete page";
  - if the form changed while the dialog was open, it toasts "The form changed while this was open. Delete again…";
  - unread items delete at once.
- **B38** Visibility group settings (`VisibilityGroupSettings.tsx`, `VisibilityGroupPanel.tsx`):
  - lists the members (click to select one);
  - "Split group before X" (scissors) and "Edit X's visibility separately" (detach);
  - "Ungroup all, keeping each element's visibility" and "Clear visibility" (which dissolves the group);
  - a shared rule editor that writes to every member.
  - A grouped member's own Conditions section points to the group (`SharedVisibilityNotice`).
  - Groups are derived when the form loads, and manual boundaries survive the first save.

### 2.3a Grey boxes (added in #1088)

A grey box is a visual group: consecutive top-level elements on one page that members see inside one grey rounded box. It is stored as a shared `group` id on each element (`common/forms/form-groups.ts`) and is separate from visibility groups (B24, B38), which share a condition. The UI calls it "grey box" throughout.

- **B106** Grey box panel, at the end of the Content section for a selected element or range (`form-canvas/GreyBoxPanel.tsx`; `FormBuilderSettings.tsx:130-153,376,443`). Not in display-only builders.
  - Status line: "In a grey box with N elements.", "Some of these elements are in a grey box." or "Not in a grey box."
  - **Put in a grey box**: boxes the selected element or range (offered unless the selection already lies inside one box).
  - **Remove grey box**: when the selection is exactly one whole box.
  - **Select grey box**: from a single member, selects the whole box as a range (or the element, for a box of one).
  - **Remove from grey box**: takes the selected members out; a box cut through the middle splits in two.
- **B107** The canvas draws a box's members, and the insert points between them, on one grey band with rounded ends, and the outline bands the same rows, so the builder shows the box members will see (`form-canvas/FormCanvas.tsx:134-159`; `form-canvas/FormOutline.tsx:191-199`).
- **B108** Boxes stay whole through edits (`lib/formGroups.ts`; `lib/moveElements.ts:45-70`; `form-canvas/useCanvasEdits.ts:103-110`):
  - an element inserted or dropped between two members of a box joins it; one placed beside a box stays out;
  - a duplicate stays in its source's box;
  - a member moved away from the rest, on its page or to another, leaves the box; a whole box moved together, to another page too, stays a box;
  - a copied page's boxes get fresh ids.
- **B109** What members see (`sharedweb/forms/FormPage.tsx:58-73`, also what Preview shows, B91): each run of consecutive members renders inside one grey rounded box; back-to-back boxes are separate; members hidden by their conditions are left out, and a box whose members are all hidden isn't drawn.

### 2.4 Question editors (`form-fields/*`)

Common to every question (`FieldWrapper.tsx`, `CommonControls.tsx`, `FieldExtraOptions.tsx`):

- **B39** Label, in a multi-line field that supports variable tokens (`FieldLabelEditor.tsx`).
- **B40** Required toggle (all kinds except where noted).
- **B41** Advanced:
  - "Use custom validator" toggle; the validator picker has a None option, and for validators that take an id argument either a text input or, for MemberTag, a select of tags sorted by name (`CustomValidatorSelect.tsx`). Validators are created as drafts and saved on form Save.
  - "Extract response into user data" for phone, time, timezone, city, textarea, file, image and timePicker, labelled with its target (for example "Extracting into: Phone number", `fieldExtraction.ts:38-50`).
  - "Extract response into:" target select for checkbox, toggle and custom (Share info publicly, Text notifications, Email notifications); custom components are limited to their allowed targets.
  - "Set as output field" and, once on, "Private by default" (all kinds except custom).
- **B42** Conditions: see 2.6.

Kind-specific settings:

- **B43** Text (legacy): placeholder, max length (`EditableTextField.tsx`).
- **B44** Text area: rows (1-20, default 3), max length, placeholder.
- **B45** Email, Date, Timezone, File: label and required only. Time adds a "12-hour format" note.
- **B46** Phone and City: placeholder (City's default is "Search for a city").
- **B47** Number: min, max, step; "Allow decimals" with decimal places (1-10, default 2), which clears step (`EditableNumberField.tsx`).
- **B48** Range: number of options (bounded MIN–MAX), default selection, start and end labels (`EditableRangeField.tsx`).
- **B49** Checkbox: checkbox position (left or right of the text), checked by default.
- **B50** Radio: randomize options; options with label (variables allowed) and value; add, remove; a "Default" radio per option and "Clear default"; duplicate-value warning ("…the form won't save") (`EditableRadioField.tsx`). There is no reordering.
- **B51** Select and Multi-select (`EditableChoiceField.tsx`):
  - randomize options;
  - Select: "Dropdown with search";
  - Multi-select: Display (Checkboxes, Dropdown, Searchable dropdown) and max selections;
  - "Options from" Fixed list or Formula. Switching confirms whenever it would lose fixed options, categories, the default, or a written formula (`OptionsSourcePicker.tsx`).
  - Fixed list (`FixedOptionsEditor.tsx`):
    - add, edit (label with variables, value), remove, and move up/down within a section;
    - per-option Default (radio for select, checkbox for multi-select), "Clear default(s)";
    - renaming or removing an option keeps the default consistent;
    - duplicate-value warning.
  - Categories (`OptionCategoriesEditor.tsx`): add, rename, reorder, delete (the options stay); flags blank and duplicate names; per-option category select, including a "(missing category)" option.
  - Formula: the options formula editor (B64), which can't read the field itself or its containing list.
- **B52** Ranking: options with markdown labels; add, edit, remove, reorder; number of items to rank (clamped, defaults to all).
- **B53** Contract (`EditableContractField.tsx`): contract select (defaults to the current contract), sign question, Yes and No labels. The contract markdown is synced into the schema so Preview can show it.
- **B54** List (`EditableListField.tsx`):
  - "Add item" button text; default number of cards; min cards (setting min > 0 makes it required); max cards;
  - "Fields in each card": child rows to select and reorder, and "+ Add field to card" for textarea, number, email, phone, checkbox, radio, select, multiselect, date, time, timezone, city, file and range;
  - "Hide in output view" checkboxes, shown when the list is an output field;
  - "Prefill from previous answer": source form, source list field, source sub-field and target sub-field.
- **B55** Custom component: component select from the registry, with a description; required; component configuration fields (text, number with validation, boolean); a share-target select for the ShareUrl component's `externalTargetId`. If no components are registered it shows an error (`EditableCustomComponentField.tsx`).
- **B56** Image upload: caption (label) and required.
- **B57** Toggle: on by default; "Keep at least one on with" (another toggle; shows "Removed toggle" when the partner is gone).
- **B58** Time picker: a note that it starts at 9:00 AM, which is saved unless the member turns a wheel.
- **B59** Conversation (`EditableConversationField.tsx`):
  - Expert (user picker); label, with the note "Members don't see the label";
  - "Choice required"; the expert's message (markdown);
  - member options, each with label, value, the expert's reply (markdown), and "Show note box" with "Note required", note label and note placeholder;
  - add and remove options; duplicate-value warning.

### 2.5 Display block editors (`display-blocks/*`)

Common wrapper (`DisplayBlockWrapper.tsx`, `PerUserOptions.tsx`, `ManualUserList.tsx`, `useClipboardImport.ts`):

- **B60** "Manual content per user":
  - toggle it on; "Edit default"; Prev and Next to page through users;
  - a status line ("Editing content for X" or "Editing default content"; "Custom content" or "Using default");
  - users with content and users missing it, as chips; "Clear content for this user";
  - "{set} set / {total} total" opens a searchable user list (by name or id) with Set or Unset badges and a contract-status icon;
  - "Load users" and retry on failure.
  - Per-user content is not offered in display-only builders, nested blocks, or accordions.
- **B61** "Import from clipboard…" reads `{"userId": "text"}` JSON and applies it per user to the block's import field. It confirms before overwriting different existing values, and toasts each error case ("Could not read from clipboard.", "Clipboard does not contain valid JSON.", "Expected a JSON object like…", "No string entries…", "…already matches…", "The block was deleted…").
- **B62** "Use conditional visibility" toggle, in the canvas-card form of the editor. In the sidebar the block's conditions are in its Conditions section.

Block-specific settings:

- **B63** Header: text with variables, level H1–H6, and the sidebar hint "Write headers in the active voice…".
- **B64** Text: multi-line text with variables; "Show preview" toggle.
- **B65** Label: single-line text.
- **B66** Divider: thickness (Hairline, Thin, Medium, Thick), with preview.
- **B67** Spacer: size (XS–XL), with preview.
- **B68** HTML: monospace HTML textarea, with preview.
- **B69** Images (`EditableImagesBlock.tsx`):
  - multi-file upload, sent one file at a time as data URIs, with "Uploading..." and a cancel that keeps the images already added;
  - "Show a download button";
  - per image: thumbnail, caption, alt text, download file name (when downloadable), remove;
  - drag to reorder (mouse, touch or keyboard);
  - per-user-aware landing and failure messages;
  - notes that one image renders alone and several become a carousel.
- **B70** Video: upload `.m3u8` (required), `.ts` and `.vtt` files via POST to the video upload endpoint; "Manage video file" links to `/videos/:id`; caption; preview. Errors show the server's message, the status, or session expiry.
- **B71** Quote: member picker (stores the picture's upload key) and quote text.
- **B72** Big link (`EditableBigLinkBlock.tsx`):
  - link label; optional body;
  - link to a URL or a share target (`ExternalShareTargetSelect`), where the target's URL becomes the fallback;
  - "Show the link";
  - icon (Messages, File, File Text, File Check, Signature, No icon); color (Grey, Green); on click Open or Copy the link;
  - preview toggle.
- **B73** Copy text: optional title; rich-text (markdown) toggle, which applies to every user's content; the text to copy; preview when rich.
- **B74** Previous answer: title, empty-state text, source form, source field, "Show field label when rendering", and visible sub-fields for list sources.
- **B75** User location: title, empty-state text, and a static sample preview.
- **B76** Chat transcript: left and right names; size (height cap); messages with a left/right side, markdown text, move up/down and remove; "Add message" (alternates sides); preview.
- **B77** Expert message: expert (user picker) and markdown message.
- **B78** Accordion:
  - "Only one section open at a time";
  - section rows (select, reorder) with nested block rows (select, reorder);
  - "Add block…" offers the nestable kinds;
  - "Add section".
  - Section settings edit the title; nested block settings use the nested editors.

### 2.6 Conditional visibility (`form-fields/conditions/*`)

- **B79** Rule mode: "Always shown. Add a rule…"; "Show when all/any of these rules match" (shown when there are two or more rules); per rule a title, "Remove rule", and a body (`ConditionalVisibility.tsx`).
- **B80** "Add rule" menu (`AddRuleMenu.tsx`). Unavailable items are disabled with the reason.
  - Answer on this form;
  - Answer on another form;
  - Validator;
  - Device;
  - User property;
  - First contract signed;
  - Completed actions;
  - in output views, "Output block visibility" replaces the account rules.
- **B81** Field rule (`FieldRule.tsx`):
  - question select, with "Later in form" options and a warning when one is picked;
  - for another form, a source-form select with retry;
  - comparison: is, is not, includes, does not include, has any selection, has no selection, number selected, is answered, is unanswered (`fieldConditions.ts:104-114`);
  - value input by kind: checkbox checked/unchecked, contract labels, range values, numbers, counts;
  - an unavailable question stays visible with an explanation of what the rule still checks.
- **B82** Validator rule: visibility validator select (only validators usable for visibility), and passes or fails. "None" removes the rule.
- **B83** Device rule: Mobile, Tablet and Desktop checkboxes, with an error when none is ticked.
- **B84** User property: property select, and is set / is not set.
- **B85** First contract signed: before or on/after, and a datetime in local time. Users who never signed match neither.
- **B86** Completed actions: "At least N actions".
- **B87** Output block rule: block select (the current block disabled; a deleted block flagged), and is visible / is hidden in this output view.
- **B88** Expression mode:
  - "Edit as expression" opens a textarea for `condition1 AND (condition2 OR NOT condition3)`; it shows rule names and flags any the expression doesn't use;
  - parse errors show inline; typed text is kept until it parses, across tabs and pages, and undoably;
  - "Use all/any rules" returns to rule mode, or "Replace the expression with: All rules / Any rule";
  - negation is shown as the negative comparison.
- **B89** "Remove all conditions" clears the rules and the expression mode (`VisibilityConditions.tsx`).
- **B90** Summaries in plain language ("shown when …") appear on the canvas, the outline, groups and indicators (`lib/visibilitySummary`).

### 2.7 Preview (`FormBuilderPreview.tsx`)

- **B91** Renders the page currently selected, through the member renderer, as a placeholder preview user. Grey boxes render as members see them (B109).
- **B92** "Preview as" picks any user (`PreviewAsUserBar.tsx`). Users load only when Preview opens, and a failure says "Could not load users".
- **B93** Visibility profile picker: groups contracted members by how they would see the form's conditions (collapsible), and picking a card previews as that member (`VisibilityProfilePicker.tsx`).
- **B94** "Preview as row" select, shown when the form has a row list.
- **B95** Preview waits for the forms that formulas read. The selection survives a trip to Preview.
- **B110** Phone prefill in Preview (added in #1089; `shared/forms/useFormSchemaMaps.ts:20-23,60-74`; `FormBuilderPreview.tsx:103-106`): a Phone question set to "Extract response into user data" (B41) opens prefilled with the previewed member's phone number, over the field's own default, as it does for that member on the site. The site's "confirm this number by code" control under that question is supplied by the member app (`sharedweb/forms/phoneConfirmSlot.ts`) and does not appear in the admin preview.

### 2.8 JSON editing (`FormJsonModal.tsx`, `lib/formJson.ts`)

- **B96** Element, Page and Form JSON modals: an editable textarea, "Copy JSON", Cancel and Apply ("Checking..." while it runs).
  - Apply validates against the schema and lists errors with their paths; it rejects id collisions (including with output-view blocks) and unknown validator ids. Since #1088 the schema also carries each element's grey-box `group`: a box whose members aren't next to each other is rejected ("Elements in a group must be next to each other"), as is a `group` on a list sub-field ("List sub-fields can't be in a group"); nested accordion blocks don't take one (`common/forms/form-schema-validate.ts`, `field-schemas.ts`, `display-blocks.ts`).
  - Changes to ids or kinds need a second confirmation, "Apply id and kind changes", with Back.
  - Display-only builders are held to the display-only schema and one page.
  - Applying form JSON regroups the visibility groups.

### 2.9 Other tabs

- **B97** Shareable Text (`ShareableTextBuilder.tsx`):
  - "Shareable Text for Completed Tasks": a textarea with highlighting; `#{` opens autocomplete (arrow keys, Enter or Tab to pick, Escape to close); click or drag tokens for form fields and the member's first and full name; a referral URL notice.
  - "Default Shareable Text": member-name tokens only; form-field tokens are stripped, with an amber explanation.
- **B98** Output View (`OutputBuilder.tsx`, `output-builder/*`):
  - "Add output view"; the current output fields as chips; "Completion screen subtitle";
  - view tabs with remove (disabled for the last view); view title; layout (Default, Detail page, Activity list card, Personal response view);
  - "Add display block…" (header, text, label, divider, spacer, html, images, quote, userLocation);
  - "Add output field block" (disabled until fields are marked as outputs). Each output field block has an output-field select, "Show label when rendering", "Label override", display format (As form field, Content only) and "Conditional visibility" with output-block rules;
  - drag to reorder blocks; block ids are shown;
  - live "Output preview" with sample answers.
- **B99** Aggregate Views (`AggregateBuilder.tsx`): "Add aggregate view" (a progress bar); tabs "View N" with remove; title; caption; display type (Number, Dollars); numerator and denominator, each a static number or a Number field.
- **B100** Formulas (`VariableBuilder.tsx`, `FormulaEditor.tsx`):
  - "Add formula"; per formula a name (sanitized, with empty and duplicate errors), "Copy #{name}", and delete;
  - inputs: add or remove (renumbering rewrites the formula); mode Answers (this form or another form, a field or a list with properties), Counts (members choosing each option of another form's multiselect), Answered count, or Random; sample values for the live preview;
  - formula textarea with type checking and errors; a help modal with snippets, and undo of a replaced formula;
  - warnings for unresolved `#{}` references, output-view text reading another form, and a form list that failed to load.
- **B101** Rows (`row-list/*`):
  - paste rows as JSON, then "Use these rows" (parse errors shown);
  - "Remove the row list"; row count;
  - "Fields that identify a row" checkboxes;
  - "Show only for some rows": per page and element, Every row or Only when {field} is / is not / has a value / is empty / is one of, with values picked from the rows.

### 2.10 Saving, conflicts and gates

- **B102** Save pipeline (`lib/useFormSave.ts:139-241`):
  1. Refuses while source forms load ("Still loading the questions…").
  2. Syncs list inputs.
  3. Validates; an invalid form opens the issue list gated on Save.
  4. Creates draft custom validators.
  5. PUTs `/tasks/updateForm/{formId}` with `expectedFormSnapshotId`, or creates via POST `/tasks/createForm` with the title.
  6. Toasts "Form saved successfully".
  7. A new form navigates to its id.
- **B103** Save gates (`useSaveGate.tsx`, `useContentConfirm.tsx`):
  - "Save with unmatched formula references?" lists each `#{name}` and where it is;
  - "Save anyway?" for absolute links to the site (they should be paths) and for mentions of "worldalliance";
  - Cancel saves nothing.
- **B104** Conflict modal ("This form was changed by someone else", `FormConflictModal.tsx`):
  - "Your changes" and "Their changes" diffs (`lib/schemaDiff`);
  - an auto-merge status;
  - "Copy my version (JSON)", Cancel, "Take theirs" (`window.confirm`), "Merge changes" (only when there is no overlap; you then review and save), and "Keep mine (overwrite theirs)" (re-checks that their snapshot is still current);
  - cannot be dismissed by clicking the backdrop.
- **B105** History survives a save and Keep mine. Take theirs starts a new history.

### Data

- `useAdminTaskForm` / `useAdminTaskFormActions` (`shared/lib/useTaskForm.ts:63-130`): GET `/tasks/adminForm/{id}` (`fetchLatest`) and PUT `/tasks/updateForm/{formId}`.
- `useCreateFormAdmin`: POST `/tasks/createForm`. `useUpdateFormSlugAdmin`: PATCH `/tasks/forms/{formId}/slug`. `useFormsAdmin`: for the slug's display prefix.
- `useFormOptions`, `useFormQuestionFields` and `useFormQuestionFieldsPeek` (`shared/lib/useFormSchema.ts`): other forms' questions via `/tasks/adminForm/{id}`.
- `useFormulaSourceValidation`, `useInputSources` (`lib/`).
- `useCustomValidatorTypesAdmin`, `useCustomValidatorAdmin` (creates validators on save), `useTagsAdmin`.
- `useContractsAdmin`, `shared/lib/useCurrentContract`, `useUsersAdmin` (preview, per-user content), `useVisibilityProfilesAdmin`.
- `videosUploadVideoAdmin` and `uploadImageDataUri`.
- `lib/useFormDraft` (undo history), `lib/useSavedForm`, `lib/formIssues`, `lib/formSchemaMerge`, `lib/formDependencies`.

### Shared code

- `sharedweb`: `ui/Button`, `ui/Modal`, `ui/ToastProvider` (including `confirm`), `ui/DropdownMenu`, `ui/UserSelect`, `ui/DateTimePicker`, `ui/UploadingWithCancel`, `forms/RenderDisplayBlock`, `forms/OutputRenderer`, `forms/components` (custom component registry), `lib/clipboard`, `lib/useMediaQuery`, `lib/readFileDataUri`, `lib/imageSrc`.
- `shared`: `formrenderer`, `forms/flowScreens`, `forms/visibilityFormula`, `forms/optionSections`, `forms/copyText`, `lib/shareText`, `lib/copy`, `styles/util`.
- `common/forms/*`: schema, element descriptors, conditions, variables, row lists, validation.

### Tests

There are about 30 `FormBuilder*.test.tsx` files plus `form-canvas/*` (including `GreyBoxPanel.test.tsx`), `lib/formGroups.test.ts`, `common/forms/form-groups.test.ts`, `sharedweb/forms/FormPage.test.tsx` (grey boxes as members see them), `lib/useLeaveGuard.test.tsx`, `form-fields/*`, `display-blocks/*`, `conditions/*`, `VariableBuilder*.test.tsx`, `RowListBuilder.test.tsx`, `ShareableTextBuilder.test.tsx`, `FormJson*.test.tsx`, `FormSlugEditor.test.tsx`, and `lib/{formJson,formIssues,formDependencies,formSchemaMerge,useFormDraft}.test.ts`. Assertions the list above might not make explicit:

- An id-less block keeps its selection by position through moves, undo and deletion. With repeated ids, the selection follows the right twin (`FormBuilderRepeatedIdsHistory.test.tsx`, `canvasSelection.test.ts`).
- Focus management: drawers return focus; focus stays in the sidebar or issue list after a delete or retry.
- Splitting, detaching or ungrouping doesn't mark the form unsaved, but clearing a group's visibility does (`FormBuilderVisibilityGroups.test.tsx`).
- Undo restores a turned-off draft validator and creates it on Save. Undo of a contract question restores its default contract (`FormBuilderHistory.test.tsx`).
- Uploads (images, video, nested blocks) land on the block and user they were picked for, even after the admin pages away or edits elsewhere (`EditableImagesBlock.test.tsx`, `builderAddressedWrite.test.tsx`).
- `useContentConfirm` lists exactly which fields count as link-bearing (`FormBuilderContentConfirm.test.tsx`).
- Loading the form fails loudly with the server's reason (`FormBuilder.test.tsx:463-478`).

### Notes

- **Unintended behaviour:**
  - `ProjectActionPage` omits `taskFlow`, so the same task form shows step notes in ActionDashboard but not there (`ProjectActionPage.tsx:145`).
  - The legacy `text` kind still has an editor (B43) but can't be added.
  - The Radio editor has no option reordering while Select and Ranking do (B50).
- **Duplication:** two drag systems (`useDragReorder` in output views versus `useListDrag` / `useOutlineDrag` on the canvas), and two near-identical builders for output and aggregate views.
- **Interaction model:**
  - Display blocks render two different editor shells: the sidebar `SectionPanels`, and the older canvas-card form with its own "…" menu and drag handle, which output views still use.
  - Destructive confirms are a mix of `window.confirm` (Take theirs, leave guard), `ConfirmDialog`, and toast `confirm`.
  - Two kinds of group now share the canvas: visibility groups (dashed amber, a shared condition) and grey boxes (grey band, a shared look). An element can be in both.
- **Missing:** "Publish" doesn't exist for forms. A save is immediately live: the PUT creates a new snapshot, and members get it on next load. Publishing lives on actions, outside this group.

---

## 3. `/forms/:formId/responses`: responses

- **New place:** Tasks › Forms › Form record › Responses tab (PLACES.md:37).
- **Purpose:** browse, search, analyse and export every response to a form, across schema versions.
- **Page:** `pages/FormResponses.tsx` renders `components/FormResponsesView.tsx`. The same view is embedded in the action Responses tab (§5.4), where variants are merged.

### 3.1 Header (`form-responses/FormResponsesHeader.tsx`)

- **R1** Title (the form title, or "Form Responses"); "Released {date}", from the earliest response of all, unaffected by filters; "{n} responses" (within the selected variant); and the referral-load error text.
- **R2** Tabs Responses, Stats, Questions and Replays, held in `?tab=` (default `responses`) (`FormResponsesView.tsx:142-143`).
- **R3** Variant filter "All variants / {name}", held in `?variant=`. Shown only when variant options exist, which means only in the action-embedded view (`FormResponsesHeader.tsx:116-134`).
- **R4** "Refresh" refetches the form, responses and share links. A failure toasts "Failed to refresh form responses" and keeps the rows (`FormResponses.tsx:51-55`, `lib/useFormResponsesAdmin.ts:47-59`).
- **R5** "Reassign snapshots" goes to `/forms/:id/snapshots` with `returnTo` state. When there are several targets (variants) and none is selected, `SnapshotTargetPicker` asks which form (`FormResponsesView.tsx:122-198,390-400,472-481`).
- **R6** "Export CSV" (disabled when the selected variant has no responses): exports the **variant-scoped** responses as `{safeTitle}-responses.csv` with a UTF-8 BOM (`FormResponsesView.tsx:309-330`).
  - Columns, from `lib/responsesCsvExport.ts:22-52`: Response ID, User ID, User Name, SID, [Variant], `row.{field}` for each assigned-row field, then one column per question in the current schema's order with unique header names.
  - Answers are raw `formatAnswerValue`, and newlines become spaces.
- **R7** "Export HTML" (disabled only when there are no responses at all): exports **all** responses as `{safeTitle}-responses.html` (`FormResponsesView.tsx:332-356`, `lib/responsesHtmlExport.ts`). The file is self-contained, with no external fetches.
  - Export metadata: exported-at, response count, snapshot count, first and last response.
  - Responses are grouped by variant (when present), then by snapshot oldest first, with the current schema last even when it has no responses. Each snapshot renders its schema: pages, display blocks, questions with options and sub-fields.
  - Each response has its id, submitted-at and device; the respondent's name and **email**, user id, SID, and withdrawal with its reason; every answer as both raw and pretty values (option labels, saved formula choices, list items with sub-field labels); unanswered questions are marked, and answers the schema dropped are kept as orphans.
  - An in-file toolbar toggles "Showing raw values" / "Showing labels" and has a "Download CSV" button built inside the file, which follows the current mode (`responsesHtmlExport/assets.ts:201-260`).

### 3.2 Responses tab: table (`responses-table/*`)

- **R8** Columns (`rows.tsx:29-82`): Respondent, Submitted, [Variant], Withdrawal, Response ID and User ID (the last two hidden by default), `row.{field}` columns, then a column per question.
  - Respondent names come from `lib/respondent`; anonymous respondents are named after whoever invited them, via share-link SIDs.
  - Withdrawal shows "Withdrew" with `WithdrawalInfo` details.
  - Variant shows a colored identity chip.
- **R9** Question columns across schema versions (`columns.ts`):
  - **Focused** mode shows the current version's questions only; **Expanded** adds retired questions after them, the most recently retired first.
  - The mode is picked automatically: Expanded when a response answered a question the current version dropped (`:143-150`).
  - Headers show a colored swatch per field id; a tooltip with the field id, "Retired, last in vN" and wording by version; a pencil icon when the wording changed; retired columns are grey italic.
  - Each cell renders through the response's own snapshot, with saved formula choices, so option labels read as they did when answered.
- **R10** Toolbar (`ResponsesToolbar.tsx`):
  - search box, held in `?q=` with a 200 ms debounce (`ResponsesTable.tsx:57,139-147`). It searches the visible columns plus User ID even when hidden, case-insensitively, matching the displayed labels; matches are highlighted.
  - "Expand rows" toggle;
  - "Columns" menu (R11);
  - "Versions N" button;
  - "All versions" / "Current version" mode toggle;
  - "Copy view link" ("Copied");
  - "{shown} of {total} responses".
- **R11** Columns menu (`ColumnVisibilityMenu.tsx`): find a column, Show all, Hide all, a checkbox per column, and a "N hidden" count.
- **R12** View persistence: hidden columns, expanded rows and snapshot mode are saved in localStorage under `alliance.responsesTable.v1.{formId}` (`persistence.ts`). `?hidden=a,b` overrides and rewrites the stored view; "Copy view link" puts `hidden=` in the URL it copies.
- **R13** Sorting: click a header for ascending then descending, held in `?sort={col}:{asc|desc}`, one column at a time (`ResponsesTable.tsx:255-272`). Comparators by kind (`sorting.ts`):
  - numeric for number and range;
  - chronological for dates and Submitted;
  - boolean for checkbox, toggle and contract;
  - labels for choices;
  - unanswered cells always last.
- **R14** Rows: click a row to open the response drawer, held in `?response={id}`. The chevron expands or collapses a row; clicking a clipped cell (over 48 characters or multi-line) expands its row without opening it. The first column and header are sticky; empty cells show "—".
- **R15** Version filter `?version={snapshotId}` narrows the rows, shown as a "Version vN" chip with a clear button (`ResponsesTable.tsx:219-221,403-419`).
- **R16** Unreadable-snapshot warning: "N schema versions could not be read, so their questions have no columns", listed by version (`:421-435`).
- **R17** Versions drawer (`SnapshotNavigator.tsx`):
  - "N versions in these responses. Pick two to compare."; a "Reassign snapshots" link;
  - each version shows vN, a Current badge, its created date (loaded only while the drawer is open; "Could not load version dates" on failure), its response count and date range, and a change list (Added, Removed, Reworded "a" to "b", Options changed on);
  - clicking a version filters to it (R15); the compare toggle on two versions shows a side-by-side word diff.
- **R18** Response drawer (`ResponseDrawer.tsx`), titled with the respondent's name:
  - "i of n" with previous and next buttons that follow the current sort and filter;
  - metadata: Submitted, Version chip, Response ID, User ID, SID, Device, Withdrawal, and "AI detection" per text answer (percentages above 0, in red);
  - "Watch replay" opens the PostHog session recording in a new tab;
  - the response is rendered as completed in `FormRenderer`, through its own snapshot (with a fallback warning when it doesn't parse), with AI scores inline next to labels.
- **R19** Empty and error states: "Loading responses...", the error message, "No responses yet for this form.", "No response matches this search." (`ResponsesTable.tsx:364-378,437-441`, `ResponsesGrid.tsx:239-243`).

### 3.3 Stats tab (`FormResponseStatistics.tsx`, `lib/fieldStatistics.ts`)

- **R20** One card per question of a stat kind: number, range, checkbox, radio, select, multiselect, toggle or conversation (`fieldStatistics.ts:36-60`).
  - Each card shows the label (markdown) and a note.
  - Number and range add Min, Median, Average, Max and Total.
  - Each option or value gets a bar with count and percentage. Options saved by formula choices are counted under the label saved first; there are rows for unknown and no-response answers.
- **R21** Clicking a bar applies that filter and jumps to the Replays tab: `?filterField`, `?filterOp=equals|includes|no-response` and `?filterValue` (`FormResponsesView.tsx:288-299`, `lib/responseFilter.ts`).
- **R22** States: "Loading form statistics...", "No statistics available for this form.", "No responses yet for this form."

### 3.4 Questions tab (`form-responses/QuestionResponses.tsx`)

- **R23** Question select, held in `?questionField=` (default the first answerable question in page order).
- **R24** Lists the non-empty answers to that question: respondent, variant chip, withdrawal badge, date, the answer (choices shown by option label), and an "AI Score" column for text and textarea questions.
- **R25** States: loading, error, "No answerable questions found.", "No users responded to this question."

### 3.5 Replays tab (`ResponseReplay.tsx`, `ResponseReplayNavigator.tsx`, `useRespondentSearch.ts`)

- **R26** One response at a time, rendered as completed through its own snapshot, with inline AI scores.
- **R27** Pagination, one page per response (local state; the page is **not** kept in the URL).
- **R28** "Search by name..." finds a respondent; names that start with the query sort first. Enter picks the first match; a click outside closes the results; "No matching responses".
- **R29** The current respondent's name, variant chip, withdrawal info and date, and a "Replay" button that opens the PostHog recording.
- **R30** Active filter banner: "Filtered: {field} — {description} ({n} of {total})" with "Clear filter". The empty state offers "Clear filter" too.

### Data

- `useFormResponsesAdmin(formId)` (`lib/useFormResponsesAdmin.ts`):
  - GET `/tasks/adminForm/{id}` for the form;
  - GET `/tasks/responses/{id}`, sorted by createdAt ascending;
  - `useFormShareLinksAdmin` for the SID-to-inviter map.
- `useFormWithdrawalsAdmin(formId)`: GET `/actions/withdrawals/byForm/{formId}`.
- `useResponseSnapshotMigrationsAdmin(formIds)`: GET `/tasks/forms/{formId}/snapshotMigration`, for the version dates in the Versions drawer.
- Client-side builders: `lib/responsesCsvExport.ts`, `lib/responsesHtmlExport/*`, `lib/fieldStatistics.ts`, `lib/responseFilter.ts`, `lib/answerValues.ts`, `lib/questionAnswer.ts`, `lib/aiScore.ts`, `lib/respondent.ts`, `lib/responseFields.ts`.

### Shared code

- `sharedweb`: `forms/FormRenderer`, `ui/Button`, `ui/Card`, `ui/Pagination`, `ui/FormMarkdownWrapper`, `ui/ToastProvider`, `lib/downloadBlob`, `lib/clipboard`.
- `shared`: `parsed-dtos` (`parseAssignedRow`, `parseFormulaChoices`), `client` DTOs.
- `common/forms/{output-resolution,formula-choices,row-list,form-schema}`.
- Third-party: `@tanstack/react-table`, `react-diff-viewer-continued`.

### Tests

`pages/FormResponses.test.tsx`, `FormResponsesView.test.tsx`, `form-responses/*.test.tsx`, `responses-table/{ResponsesTable,SnapshotNavigator}.test.tsx`, `responses-table/{columns,rows,search,sorting}.test.ts`, `FormResponseStatistics.test.tsx`, `lib/{responsesCsvExport,responsesHtmlExport,responseFilter,responseFields,useFormResponsesAdmin}.test.ts`. They also assert:

- An invalid form id says so instead of loading forever.
- A share-link failure keeps the responses up and clears on refresh.
- CSV is disabled for an empty variant but HTML is not.
- The search writes to the URL after the keystroke, not during it.
- The HTML export "fetches nothing and loads no external file" and escapes markup.

### Notes

- **Inconsistent export scope:** CSV follows the variant filter, but HTML exports every response regardless (`FormResponsesView.tsx:312` vs `:338`). Neither export honours the table's search, version filter or hidden columns.
- **CSV gaps:**
  - It has **no Submitted date column**.
  - It uses only the current schema's questions, so answers to retired questions are dropped (the HTML export keeps them as orphans).
  - Its "User Name" falls back to the response id (`responsesCsvExport.ts:41`), and choice answers are raw values, not labels.
- **Personal data:** the HTML export embeds respondent emails.
- **Hardcoded PostHog URL, twice:** `https://us.posthog.com/project/188181/replay/…` appears in `ResponseDrawer.tsx:27-28` and `ResponseReplayNavigator.tsx:148`.
- **Duplicated AI-score code:** `ResponseDrawer.tsx:25,30` redefines `AI_SCORE_FIELD_KINDS` and `formatAiScore` instead of importing `lib/aiScore.ts`, which the other tabs use.
- **Two response viewers with overlapping jobs:** the Replays tab (paginated, name search, filter from Stats) and the table's drawer (prev/next in table order). Only Replays receives Stats filters; only the drawer keeps its position in the URL.

---

## 4. `/forms/:formId/snapshots`: reassign snapshot pointer

- **New place:** Tasks › Forms › Form record › Versions tab (PLACES.md:38).
- **Purpose:** repoint existing responses at the form's current schema snapshot, without transforming their answers.
- **Page:** `pages/FormSnapshotMigration.tsx`.

### Capabilities

- **S1** Header "Reassign snapshot pointer: {form title}", with an explanation (answers are not transformed; keys for removed fields are orphaned; newly required fields stay blank; up to `MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH` per request) (`:211-225`).
- **S2** "Back to responses" returns to the `returnTo` location state, or `/forms/:id/responses` (`:135-138,226-232`). This preserves the responses view's URL state.
- **S3** "Current snapshot: #{id} ({created})" with the first 12 characters of its hash (full hash in the tooltip) (`:243-257`).
- **S4** One card per older snapshot group (`:23-126`):
  - "Snapshot #{id}", created, "{n} responses · {k} selected", short hash;
  - "Diff vs latest (#{id})" through `SchemaDiffView`;
  - "Show / Hide responses" lists `#{responseId}`, the respondent ("user #id" or "anonymous" as fallbacks) and the date, each with a checkbox.
- **S5** Selection: a group checkbox that can be indeterminate; per-response checkboxes; "Clear"; a sticky bar "{selected} of {total} responses selected across N snapshots" (`:267-297`).
- **S6** Reassign:
  - the button reads "Reassign {n} selected"; it is disabled at 0, and above the batch limit it reads "Too many selected (max N)";
  - a native `confirm` warns that answer data won't be transformed;
  - PATCH `/tasks/forms/{formId}/responseSnapshots` with `{responseIds, targetSnapshotId}`;
  - success shows "Reassigned N responses." and clears the selection; failure shows "Failed to reassign snapshots" (`:180-205,299-306`).
- **S7** States: "Loading…", "Failed to load snapshot migration data", "No data.", "All responses are already on the current snapshot."

### Data

`useResponseSnapshotMigrationAdmin(formId)` (`shared/lib/useResponseSnapshotMigrationAdmin.ts:35`): GET `/tasks/forms/{formId}/snapshotMigration`, plus the migrate mutation, which reloads.

### Shared code

`sharedweb/ui/{Button,Card}`, `shared/styles/card`, `common/forms/snapshot-migration`, `common/plural`, `lib/schemaDiff` (also used by `FormConflictModal`), `lib/navigation` (`getReturnTo`).

### Tests

`pages/FormSnapshotMigration.test.tsx` covers reassigning and reloading; a refusal keeps the groups and reloads them; a load failure.

### Notes

- There is no in-app link to this page except from the responses header (R5) and the Versions drawer (R17).
- The Versions drawer (R17) and this page both show versions with diffs, in different ways. The redesign's single "Versions" tab should combine both: compare any two versions, and reassign.

---

## 5. Form tabs inside an action (`/actions/:actionId`)

- **New place:** the task record (`#/task/:id`), whose tabs are Overview, Form, Variants, Messages, Responses and Activity (PLACES.md:25, :125).
- The action's own tabs (`pages/ActionDashboard.tsx:128-144`): "Task form", "Form variants", "Follow-up forms" and "Responses" (title case before #1028).

### 5.1 Task form tab (`ActionDashboard.tsx:302-309`)

- **A1** The full builder (all B-items) on `action.taskFormId`, with `taskFlow` step notes (B21).
- **A2** The first save of a new form calls `editor.setTaskFormId`, which links it to the action. The title is "{action name} form".
- **A3** `/forms` sends linked forms here (`?tab=form`, L6).

### 5.2 Form variants tab (`ActionFormVariantsTab.tsx`, `ActionFormVariantCoverage.tsx`)

This tab doesn't use the builder or responses components, but links to both.

- **A4** "View responses" opens `/actions/:id?tab=responses`.
- **A5** "Add variant" stages a draft named "Variant A/B/…" with a default split of min(remaining, 50)%. It is disabled without a task form, and an alert explains why.
- **A6** Staged drafts: name, percentage, Remove; an alert that staged variants aren't sent until publishing and are lost on refresh.
- **A7** "Publish drafts (N)": blocked when the splits sum to over 100%; publishes one by one, cloning the task form; a refused draft stays staged along with the ones after it; toasts "Published N variants".
- **A8** Published variants: name and split edits with Save (enabled when dirty); "Edit form" opens `/forms/{variantFormId}` (the standalone builder); Delete, with a `confirm` explaining its pre- and post-launch behaviour.
- **A9** Coverage card:
  - "{n} users assigned across N groups";
  - an over-100% warning, or "Default form covers the remaining X%";
  - a table with Group (Default first), Form (display slug, linking to `/forms/{id}`), Split ("remainder" for the default), Assigned, Submitted, and a Total row.

### 5.3 Follow-up forms tab (`ActionFollowUpFormsTab.tsx`)

- **A10** Follow-up form select (label from `followUpFormLabel`), and "View responses", which opens the standalone `/forms/{formId}/responses`.
- **A11** "Create follow-up form" creates a form titled "{action} - follow-up" with an empty one-page schema, then links it (`:94-110`).
- **A12** Settings card:
  - Name (placeholder "Follow-up form #{id}");
  - Instructions (markdown);
  - Target cohort (`CohortExpressionBuilder` with tags, actions and users; an unparseable stored expression shows a warning and disables saving);
  - Start date and End date (`DateTimePicker`);
  - "Save fields" and "Delete follow-up form" (with `confirm`; responses remain) (`:313-444`).
- **A13** An embedded full builder for the follow-up's form (`:446-453`). A save that creates a form relinks it (`onSetFormId`).

### 5.4 Responses tab (`ActionMergedResponsesTab.tsx`)

- **A14** The whole responses view (R1–R30) over the merged responses of the default form and every variant form, with search params namespaced `resp_` (for example `resp_tab` and `resp_q`) so they don't collide with the action's `tab` (`ActionDashboard.tsx:341-346`, `FormResponsesView.tsx:94-99,137-140`).
- **A15** With more than one variant: the title "{title} — all variants", the variant filter (R3), a Variant column, CSV variant column and HTML variant grouping, and per-response variant chips. Reassign snapshots asks which variant's form (R5).
- **A16** Withdrawals and share links are loaded through the default form. Refresh reloads the variants, responses and withdrawals.

**Data:** `useActionMergedResponsesAdmin(actionId)` (`lib/useActionMergedResponsesAdmin.ts:121`) uses `useFormVariantsAdmin`, `tasksGetFormResponsesByFormsAdmin`, `useFormShareLinksAdmin` and `useFormWithdrawalsAdmin`. The variants tab uses `useFormVariantsAdmin` (publish, update, delete). Follow-up forms use `useActionAdmin(...).create/update/deleteFollowUpForm` and `useCreateFormAdmin`.

**Tests:** `ActionMergedResponsesTab.test.tsx` covers withdrawals through the default form, refresh, load failures, share-link failures, and stale reloads. `ActionFormVariantsTab.test.tsx` covers a refused draft staying staged and refusals of edits and deletes. `ActionFormVariantCoverage.test.tsx` covers totals, over 100%, and the no-variants state. There is no test for `ActionFollowUpFormsTab`.

**Notes:**

- **The task record's tabs in PLACES.md have no Follow-up forms tab**, so A10–A13 have no new home yet.
- Follow-up forms' responses only open in the standalone responses page (A10), never merged into the task's Responses tab.
- Variant forms are edited through the standalone builder (A8), not inside the task.

---

## Summary

The inventory covers four routes (`/forms`, `/forms/:formId`, `/forms/:formId/responses`, `/forms/:formId/snapshots`) and the four action tabs that embed or link the builder and responses view. It lists 172 capabilities: L1–L9 (9), B1–B110 (110), R1–R30 (30), S1–S7 (7), A1–A16 (16). The refresh at ff886c540b added B106–B109 (grey boxes, #1088) and B110 (phone prefill in Preview, #1089), and removed no ID.

What a redesign is most likely to lose:

- **Unlinked entry points:** the `?select=` and `?previewAs=` deep links (B11, B12) and ⌘S (B9).
- **Easily overlooked:** the second confirmation for JSON id and kind changes (B96), the save gates for site links, "worldalliance" and unmatched references (B103), and the conflict merge flow (B104).
- **Per-user display-block content** and clipboard import (B60, B61).
- **Visibility groups and range sharing** (B36, B38), outline drag between pages (B18), and the expression editor (B88).
- **Grey boxes** (B106–B109): the panel, the band on the canvas and outline, and the rules that keep a box whole through inserts, moves, duplicates and page copies.
- **The less-visited builder tabs:** Rows, Aggregate Views and Shareable Text (B97, B99, B101).
- **On the responses side:**
  - the self-contained HTML export with its raw/labels toggle and in-file CSV (R7);
  - column state persisted per form in localStorage, and "Copy view link" (R12);
  - version-aware columns, with retired questions, wording history and compare (R9, R17);
  - Stats bars that filter the Replays tab (R21);
  - the AI-detection scores (R18, R24).
- **Follow-up forms**, which have no tab in PLACES.md's task record.

The redesign also needs a deliberate decision on whether to keep the current gaps (no "New form" button, no form-title editor, CSV without dates or labels, CSV and HTML export scopes that differ) or fix them.
