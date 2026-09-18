import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { describe, expect, test } from "bun:test";
import { buildResponsesHtml } from "./responsesHtmlExport";

const schema: FormSchema = {
  outputViews: [],
  pages: [
    {
      id: "page-1",
      title: "Opinions",
      fields: [
        { type: "display", kind: "header", text: "Why we ask" },
        {
          type: "input",
          kind: "radio",
          id: "q_familiar",
          label: "How familiar are you?",
          options: [
            { value: "option1", label: "Not at all" },
            { value: "option2", label: "Somewhat" },
          ],
        },
        {
          type: "input",
          kind: "multiselect",
          id: "q_topics",
          label: "Which topics?",
          options: [
            { value: "ai", label: "AI data use" },
            { value: "waste", label: "E-waste" },
          ],
        },
        {
          type: "input",
          kind: "city",
          id: "q_city",
          label: "Where do you live?",
        },
        { type: "input", kind: "textarea", id: "q_notes", label: "Anything?" },
      ],
    },
  ],
};

const response = (
  overrides: Partial<FormResponseDto> & Pick<FormResponseDto, "id">,
): FormResponseDto => ({
  formId: 7,
  formSnapshotId: 81,
  createdAt: "2026-03-02T15:11:09.000Z",
  answers: {},
  publicAnswers: {},
  schemaSnapshot: { ...schema },
  visibilityValidatorResults: {},
  ...overrides,
});

const build = (responses: FormResponseDto[], title = "Governance") =>
  buildResponsesHtml({
    title,
    form: { id: 7, title, formSnapshotId: 81, schema },
    responses,
    withdrawnUserMap: new Map(),
    sidsToUserMap: {},
    exportedAt: "2026-09-17T18:04:00.000Z",
    csvFileName: "governance-responses.csv",
  });

describe("buildResponsesHtml", () => {
  test("renders both raw and pretty values per answer", () => {
    const html = build([
      response({
        id: 1,
        answers: {
          q_familiar: "option2",
          q_topics: ["ai", "waste"],
          q_city: {
            id: 5391959,
            name: "San Francisco",
            admin1: "CA",
            countryCode: "US",
            countryName: "United States",
          },
        },
      }),
    ]);

    expect(html).toContain("<raw>option2</raw><pretty>Somewhat</pretty>");
    expect(html).toContain(
      "<pretty><item>AI data use</item><item>E-waste</item></pretty>",
    );
    expect(html).toContain("<pretty>San Francisco, CA, United States</pretty>");
  });

  test("marks unanswered questions and keeps answers the schema dropped", () => {
    const html = build([
      response({ id: 2, answers: { retired_field: "still here" } }),
    ]);

    expect(html).toContain('field="q_notes"');
    expect(html).toContain('unanswered="true"');
    expect(html).toContain('field="retired_field"');
    expect(html).toContain('orphan="true"');
  });

  test("escapes markup in answers, labels and the document title", () => {
    const html = build(
      [
        response({
          id: 3,
          answers: { q_notes: '<script>alert("x")</script>' },
        }),
      ],
      "A & B <test>",
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("A &amp; B &lt;test&gt;");
  });

  test("groups responses by snapshot, oldest first, current schema last", () => {
    const html = build([
      response({
        id: 4,
        formSnapshotId: 90,
        createdAt: "2026-05-01T00:00:00.000Z",
      }),
      response({
        id: 5,
        formSnapshotId: 88,
        createdAt: "2026-04-01T00:00:00.000Z",
      }),
    ]);

    const order = [...html.matchAll(/<snapshot id="(\d+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["88", "90", "81"]);
    expect(html).toContain('<snapshot id="81" current="true"');
  });

  test("fetches nothing and loads no external file", () => {
    const html = build([response({ id: 6 })]);

    expect(html).not.toContain("<script src");
    expect(html).not.toContain("<link href");
    expect(html).not.toContain("fetch(");
  });
});
