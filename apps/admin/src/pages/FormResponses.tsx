import {
  actionsShareLinksForForm,
  FormResponseDto,
  ProfileDto,
  tasksGetForm,
  tasksGetFormResponses,
  type FormDto,
} from "@alliance/shared/client";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import type {
  FieldKind,
  FormSchema,
  Page,
} from "@alliance/shared/forms/formschema";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CirclePlay } from "lucide-react";
import { CardStyle } from "@alliance/shared/styles/card";
import FormResponseStatistics from "../components/FormResponseStatistics";

export type FormWithSchema = Pick<FormDto, "id" | "title"> & {
  schema: FormSchema;
  pages?: Page[];
};

// Runtime guard: distinguish answer fields from display blocks
const ANSWER_FIELD_KINDS = new Set<FieldKind>([
  "text",
  "textarea",
  "email",
  "number",
  "range",
  "phone",
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "date",
  "time",
  "timezone",
  "city",
  "file",
]);

type Tab = "responses" | "stats";

const isAnswerField = (
  node: unknown
): node is { id: string; label: string } => {
  if (!node || typeof node !== "object") return false;
  const anyNode = node as { kind: string; id: string; label: string };
  return (
    typeof anyNode.kind === "string" &&
    ANSWER_FIELD_KINDS.has(anyNode.kind as FieldKind) &&
    typeof anyNode.id === "string" &&
    typeof anyNode.label === "string"
  );
};

const sortResponsesByCreatedAtDesc = (
  list: FormResponseDto[]
): FormResponseDto[] => {
  return [...list].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};
const FormResponses: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormWithSchema | null>(null);
  const [responses, setResponses] = useState<FormResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [sidsToUserMap, setSidsToUserMap] = useState<
    Record<string, ProfileDto>
  >({});

  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "responses";

  const numericFormId = useMemo(
    () => (formId ? Number(formId) : NaN),
    [formId]
  );

  useEffect(() => {
    if (form) {
      actionsShareLinksForForm({ path: { formId: form.id } }).then((res) => {
        setSidsToUserMap(
          Object.fromEntries(
            res.data?.map((r) => [
              r.sid ?? (r.data as { sid?: string })?.sid,
              r.user,
            ]) ?? []
          )
        );
      });
    }
  }, [form]);

  const loadData = useCallback(async () => {
    if (!numericFormId || Number.isNaN(numericFormId)) return;
    setLoading(true);
    setError(null);
    try {
      const [formRes, respRes] = await Promise.all([
        tasksGetForm({ path: { id: numericFormId } }),
        tasksGetFormResponses({ path: { id: numericFormId } }),
      ]);

      const formData = formRes.data as unknown as FormWithSchema;
      setForm(formData);
      if (respRes.data) {
        setResponses(sortResponsesByCreatedAtDesc(respRes.data));
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load form responses");
    } finally {
      setLoading(false);
    }
  }, [numericFormId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Keep current page in range when responses length changes
    const totalPages = Math.max(1, responses.length);
    if (page > totalPages) setPage(totalPages);
  }, [responses, page]);

  const total = responses.length;
  const totalPages = Math.max(1, responses.length);
  const currentResponse = responses[page - 1];

  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    const schema = form?.schema as unknown as {
      pages?: Array<{
        fields?: Array<{ id?: string; label?: string; kind?: string }>;
      }>;
    };
    schema?.pages?.forEach((p) => {
      p.fields?.forEach((f) => {
        if (isAnswerField(f)) {
          labels[f.id] = f.label;
        }
      });
    });
    return labels;
  }, [form]);

  const orderedFieldIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    const schema = form?.schema as unknown as {
      pages?: Array<{
        fields?: Array<{ id?: string; label?: string; kind?: string }>;
      }>;
    };
    schema?.pages?.forEach((p) => {
      p.fields?.forEach((f) => {
        if (isAnswerField(f) && !seen.has(f.id)) {
          seen.add(f.id);
          ids.push(f.id);
        }
      });
    });
    return ids;
  }, [form]);

  const formatValue = useCallback((v: unknown): string => {
    if (v == null || v === undefined) return "NULL";
    if (Array.isArray(v)) return v.map((x) => formatValue(x)).join(", ");
    if (typeof v === "object") {
      const o = v as { name?: string; key: string };
      if (o && typeof o === "object" && (o.name || o.key)) {
        return o.name || o.key;
      }
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  }, []);

  const csvEscape = (s: string): string => {
    const needsQuotes = /[",\n\r]/.test(s);
    let v = s.replace(/"/g, '""');
    v = v.replace(/\r?\n/g, " ");
    return needsQuotes ? `"${v}"` : v;
  };

  const handleExportCsv = useCallback(() => {
    if (!form) return;
    const metaHeaders = ["Response ID", "User ID", "User Name", "SID"];
    const used = new Set<string>();
    const questionHeaders = orderedFieldIds.map((id) => {
      const base = fieldLabels[id] || id;
      let name = base;
      let i = 2;
      while (used.has(name)) {
        name = `${base} (${i++})`;
      }
      used.add(name);
      return name;
    });
    const headers = [...metaHeaders, ...questionHeaders];

    const rows = responses.map((resp) => {
      const user = resp?.user;
      const userName = [user?.name ?? resp.id].filter(Boolean).join(" ");
      const values = [
        String(resp.id ?? ""),
        String(user?.id ?? ""),
        userName,
        resp.sid ?? "",
        ...orderedFieldIds.map((id) => formatValue(resp.answers?.[id])),
      ];
      return values;
    });

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (form.title || `form-${form.id}`).replace(
      /[^a-z0-9-_]+/gi,
      "-"
    );
    a.href = url;
    a.download = `${safeTitle}-responses.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [form, responses, orderedFieldIds, fieldLabels, formatValue]);

  const respondentName = currentResponse
    ? currentResponse.user?.name ??
      (sidsToUserMap[currentResponse.sid ?? ""]
        ? "anonymous invited by " +
          sidsToUserMap[currentResponse.sid ?? ""]?.displayName
        : "anonymous")
    : "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/forms")}
                color={ButtonColor.Transparent}
                size="small"
              >
                &larr; Forms
              </Button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {form?.title ?? "Form Responses"}
                </h1>
                <p className="text-sm text-gray-500">
                  {total} response{total === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Button
                  onClick={() => setParams({ tab: "responses" })}
                  color={
                    tab === "responses" ? ButtonColor.Black : ButtonColor.White
                  }
                  size="small"
                >
                  Responses
                </Button>
                <Button
                  onClick={() => setParams({ tab: "stats" })}
                  color={
                    tab === "stats" ? ButtonColor.Black : ButtonColor.White
                  }
                  size="small"
                  disabled={tab === "stats"}
                >
                  Stats
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={loadData} color={ButtonColor.White} size="small">
                Refresh
              </Button>
              <Button
                onClick={handleExportCsv}
                disabled={responses.length === 0}
                color={ButtonColor.Black}
                size="small"
              >
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      {tab === "responses" && (
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading responses...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          ) : total === 0 ? (
            <Card style={CardStyle.White}>
              <p className="text-gray-600">No responses yet for this form.</p>
            </Card>
          ) : (
            <>
              {/* Response Navigator */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between flex-wrap md:flex-nowrap">
                  {/* Pagination Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                      color={ButtonColor.Black}
                      size="small"
                    >
                      First
                    </Button>
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      color={ButtonColor.Black}
                      size="small"
                    >
                      &larr; Prev
                    </Button>
                    <div className="px-4 py-1.5 text-sm font-medium text-gray-700 min-w-[100px] text-center">
                      {page} of {totalPages}
                    </div>
                    <Button
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      color={ButtonColor.Black}
                      size="small"
                    >
                      Next &rarr;
                    </Button>
                    <Button
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                      color={ButtonColor.Black}
                      size="small"
                    >
                      Last
                    </Button>
                  </div>

                  {/* Response Info - Fixed width to prevent layout shift */}
                  {currentResponse && (
                    <div className="flex items-center gap-4">
                      <div className="text-right min-w-[200px]">
                        <p className="font-medium text-gray-900 truncate max-w-[700px]">
                          {respondentName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(currentResponse.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {currentResponse.sessionReplayUrl && (
                        <Button
                          size="small"
                          color={ButtonColor.BlueOutline}
                          onClick={() =>
                            window.open(
                              "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=" +
                                currentResponse.sessionReplayUrl!.substring(
                                  currentResponse.sessionReplayUrl!.lastIndexOf(
                                    "/"
                                  ) + 1
                                ),
                              "_blank"
                            )
                          }
                        >
                          <CirclePlay size={14} className="mr-1.5" />
                          Replay
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Response */}
              {form !== null && (
                <div className="max-w-[600px] mx-auto">
                  {(() => {
                    const responseSchema =
                      (currentResponse?.schemaSnapshot as unknown as FormSchema) ??
                      form.schema;
                    return (
                      <div className="bg-white p-6 border border-gray-200 rounded-lg">
                        <FormRenderer
                          id={form.id}
                          actionId={0}
                          form={responseSchema}
                          completedFormResponse={currentResponse}
                          renderFormAsCompleted
                          onSubmit={null}
                          userId={currentResponse?.user?.id}
                          user={currentResponse?.user ?? undefined}
                          disableOptionRandomization
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {tab === "stats" && (
        <FormResponseStatistics form={form} responses={responses} />
      )}
    </div>
  );
};

export default FormResponses;
