import {
  FormResponseDto,
  tasksGetForm,
  tasksGetFormResponses,
  type FormDto,
} from "@alliance/shared/client";
import FormRenderer from "@alliance/shared/forms/FormRenderer";
import type {
  FieldKind,
  FormSchema,
  Page,
} from "@alliance/shared/forms/formschema";
import Button from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

type FormWithSchema = Pick<FormDto, "id" | "title"> & {
  schema: FormSchema;
  pages?: Page[];
};

const PAGE_SIZE = 1; // show one response per page (step-through)

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
  "file",
]);

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

  const numericFormId = useMemo(
    () => (formId ? Number(formId) : NaN),
    [formId]
  );

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
    const totalPages = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [responses, page]);

  const total = responses.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const pageItems = responses.slice(startIdx, startIdx + PAGE_SIZE);

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
    const metaHeaders = ["Response ID", "User ID", "User Name"];
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
      const user = resp?.user ?? {};
      const userName = [user?.name].filter(Boolean).join(" ");
      const values = [
        String(resp.id ?? ""),
        String(user.id ?? ""),
        userName,
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

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {form?.title ? `Responses: ${form.title}` : "Form Responses"}
          </h2>
          <p className="text-sm text-gray-500">
            {total} total response{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/forms")}
            className="px-3 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
          >
            Back to Forms
          </Button>
          <Button onClick={handleExportCsv} disabled={responses.length === 0}>
            Export CSV
          </Button>
          <Button onClick={loadData}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <p>Loading responses...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : total === 0 ? (
        <Card style={CardStyle.White}>
          <p className="text-gray-600">No responses yet for this form.</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className={`px-3 py-2 rounded-md text-sm ${
                  page <= 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                First
              </button>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`px-3 py-2 rounded-md text-sm ${
                  page <= 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={`px-3 py-2 rounded-md text-sm ${
                  page >= totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Next
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className={`px-3 py-2 rounded-md text-sm ${
                  page >= totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                Last
              </button>
              <div className="flex items-center gap-2 mx-2 justify-center">
                <span className="text-sm">
                  Response {page} / {totalPages}:
                </span>
                {pageItems[0] && (
                  <div className="text-black flex items-center gap-3">
                    <span>{pageItems[0].user.name}</span>
                    <span className="text-gray-500 text-sm">
                      {new Date(pageItems[0].createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          {form !== null && (
            <div className="max-w-[600px] mx-auto pt-10 space-y-4">
              {(() => {
                const responseSchema =
                  (pageItems[0].schemaSnapshot as unknown as FormSchema) ??
                  form.schema;
                return (
                  <div className="bg-white p-6 border border-gray-200 rounded-lg">
                    <FormRenderer
                      id={form.id}
                      actionId={0}
                      form={responseSchema}
                      completedFormResponse={pageItems[0]}
                      renderFormAsCompleted
                      onSubmit={null}
                      userId={pageItems[0]?.user?.id}
                      user={pageItems[0]?.user ?? undefined}
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
  );
};

export default FormResponses;
