import { CopyTextFormat } from "@alliance/common/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { RenderField } from "@alliance/sharedweb/forms/RenderField";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { linkCheckedText } from "./linkCheckedText";
import { stringsIn } from "./useContentConfirm";

serveApi(routes({}));

beforeAll(async () => {
  await import("@alliance/sharedweb/forms/RankingFieldInput");
  await import("@alliance/sharedweb/forms/PhoneNumberInputWithCountry");
});

const PROBE = /(?:^|thealliance\.org)\/p\/([\w-]+)/g;
const probe = (id: string) => `[p](https://thealliance.org/p/${id})`;
const probeIds = (strings: string[]): Set<string> =>
  new Set(
    strings.flatMap((text) => [...text.matchAll(PROBE)].map(([, id]) => id)),
  );

const options = (id: string) => [
  { label: probe(`${id}-option`), value: probe(`${id}-value`) },
];
const base = (id: string) => ({
  id,
  type: "input" as const,
  label: probe(`${id}-label`),
  description: probe(`${id}-description`),
});

const fields: AnyField[] = [
  { ...base("text"), kind: "text", placeholder: probe("text-placeholder") },
  {
    ...base("textarea"),
    kind: "textarea",
    placeholder: probe("textarea-placeholder"),
  },
  { ...base("email"), kind: "email" },
  { ...base("phone"), kind: "phone", placeholder: probe("phone-placeholder") },
  { ...base("number"), kind: "number" },
  {
    ...base("range"),
    kind: "range",
    startLabel: probe("range-start"),
    endLabel: probe("range-end"),
  },
  { ...base("checkbox"), kind: "checkbox" },
  { ...base("radio"), kind: "radio", options: options("radio") },
  { ...base("select"), kind: "select", options: options("select") },
  {
    ...base("multiselect"),
    kind: "multiselect",
    options: options("multiselect"),
  },
  { ...base("date"), kind: "date" },
  { ...base("time"), kind: "time" },
  { ...base("timezone"), kind: "timezone" },
  { ...base("city"), kind: "city", placeholder: probe("city-placeholder") },
  { ...base("file"), kind: "file" },
  {
    ...base("contract"),
    kind: "contract",
    contractId: 1,
    contract: { id: 1, markdown: probe("contract-markdown") },
    signQuestion: probe("contract-sign"),
    yesLabel: probe("contract-yes"),
    noLabel: probe("contract-no"),
  },
  {
    ...base("custom"),
    kind: "custom",
    componentId: "share-info-publicly-toggle",
  },
  { ...base("ranking"), kind: "ranking", options: options("ranking") },
  {
    ...base("list"),
    kind: "list",
    addButtonLabel: probe("list-add"),
    defaultNumber: 1,
    fields: [
      { ...base("list-sub"), kind: "text" },
      { ...base("list-subr"), kind: "radio", options: options("list-sub") },
    ],
  },
];

const schema: FormSchema = {
  description: probe("form-description"),
  shareableTextTemplate: probe("share"),
  submit: { label: probe("submit") },
  pages: [
    {
      id: "page",
      title: probe("page-title"),
      description: probe("page-description"),
      fields: [
        { type: "display", kind: "header", text: probe("header") },
        { type: "display", kind: "text", text: probe("text") },
        {
          type: "display",
          kind: "quote",
          text: probe("quote"),
          userName: probe("quote-name"),
        },
        { type: "display", kind: "label", text: probe("label") },
        { type: "display", kind: "html", html: probe("html") },
        { type: "display", kind: "divider" },
        { type: "display", kind: "spacer" },
        {
          type: "display",
          kind: "video",
          src: "https://thealliance.org/p/video-src",
          caption: probe("video-caption"),
        },
        {
          type: "display",
          kind: "previousAnswer",
          sourceFormId: 1,
          sourceFieldId: "text",
          title: probe("previous-title"),
          emptyText: probe("previous-empty"),
          showLabel: true,
        },
        {
          type: "display",
          kind: "images",
          images: [
            {
              src: "https://thealliance.org/p/image-src",
              alt: probe("image-alt"),
              caption: probe("image-caption"),
            },
          ],
        },
        {
          type: "display",
          kind: "biglink",
          text: probe("biglink-text"),
          body: probe("biglink-body"),
          url: "https://thealliance.org/p/biglink-url",
        },
        {
          type: "display",
          kind: "copytext",
          title: probe("copy-title"),
          text: probe("copy-plain"),
        },
        {
          type: "display",
          kind: "copytext",
          format: CopyTextFormat.Markdown,
          text: probe("copy-markdown"),
        },
        {
          type: "display",
          kind: "userLocation",
          title: probe("location-title"),
          emptyText: probe("location-empty"),
        },
        {
          type: "display",
          kind: "chatTranscript",
          leftName: probe("chat-left"),
          rightName: probe("chat-right"),
          messages: [{ side: "left", text: probe("chat-message") }],
        },
        {
          type: "display",
          kind: "accordion",
          sections: [
            {
              title: probe("accordion-title"),
              blocks: [
                {
                  type: "display",
                  kind: "text",
                  text: probe("accordion-text"),
                },
              ],
            },
          ],
        },
        {
          type: "display",
          kind: "text",
          text: "Everyone",
          manualPerUser: true,
          manualUserContent: { "7": { text: probe("member-text") } },
        },
        ...fields,
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

const renderedLinkIds = async (): Promise<Set<string>> => {
  const { container } = render(
    <MemoryRouter>
      <SiteAppProvider>
        {schema.pages[0].fields.map((item, index) =>
          item.type === "display" ? (
            <RenderDisplayBlock
              key={index}
              block={resolveDisplayBlockForUser(item, "7")}
            />
          ) : (
            <RenderField
              key={index}
              fieldContext={staticFieldContext}
              field={item}
            />
          ),
        )}
      </SiteAppProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  await act(async () => {});
  fireEvent.click(screen.getByText(probe("accordion-title")));
  return probeIds(
    [...container.querySelectorAll("a[href]")].map(
      (link) => link.getAttribute("href") ?? "",
    ),
  );
};

it("checks exactly the page strings the web form renders as links", async () => {
  const rendered = await renderedLinkIds();
  // A contract field's contract is edited on the contracts page, not here.
  rendered.delete("contract-markdown");
  expect([...probeIds(stringsIn(linkCheckedText(schema)))].sort()).toEqual(
    [...rendered].sort(),
  );
});

it("checks an output view field's label only where its field renders it as markdown", () => {
  const label = (block: Partial<OutputFieldBlock>): OutputFieldBlock => ({
    id: "out",
    fieldId: "text",
    labelOverride: probe(block.format ?? "default"),
    ...block,
  });
  const checked = linkCheckedText({
    ...schema,
    pages: [
      {
        id: "page",
        fields: [
          { id: "text", type: "input", kind: "text", label: "Text" },
          {
            id: "terms",
            type: "input",
            kind: "contract",
            label: "Terms",
            contractId: 1,
            signQuestion: "Sign?",
            yesLabel: "Yes",
            noLabel: "No",
          },
          {
            id: "toggle",
            type: "input",
            kind: "custom",
            label: "Toggle",
            componentId: "share-info-publicly-toggle",
          },
        ],
      },
    ],
    outputViews: [
      {
        id: "view",
        type: "default",
        blocks: [
          label({ showLabel: true }),
          label({ showLabel: true, format: "field" }),
          label({ showLabel: true, format: "card" }),
          label({ showLabel: true, format: "textonly" }),
          label({
            showLabel: false,
            format: "field",
            labelOverride: probe("hidden"),
          }),
          label({
            showLabel: true,
            fieldId: "terms",
            labelOverride: probe("contract"),
          }),
          label({
            showLabel: true,
            fieldId: "toggle",
            labelOverride: probe("custom"),
          }),
        ],
      },
    ],
  });
  expect([...probeIds(stringsIn(checked))].sort()).toEqual([
    "default",
    "field",
  ]);
});

it("checks bare urls only in the strings the mobile app links them in", () => {
  const { siteLinksIn, siteLinksInCommonMark } = linkCheckedText(schema);
  const ids = (strings: string[]) => [...probeIds(strings)];

  expect(ids(siteLinksIn)).toEqual(
    expect.arrayContaining(["text", "chat-message", "ranking-option"]),
  );
  expect(ids(siteLinksIn)).not.toContain("radio-option");
  expect(ids(siteLinksIn)).not.toContain("ranking-label");
  expect(ids(siteLinksInCommonMark)).toEqual(
    expect.arrayContaining([
      "copy-markdown",
      "text-label",
      "ranking-label",
      "radio-option",
      "list-sub-option",
    ]),
  );
  expect(ids(siteLinksInCommonMark)).not.toContain("ranking-option");
});
