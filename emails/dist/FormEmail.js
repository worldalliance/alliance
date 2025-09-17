import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { marked } from "marked";
function FieldRow({ label, valueHTML }) {
    return (_jsxs("tr", { children: [_jsx("td", { style: {
                    padding: "8px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    verticalAlign: "top",
                    width: "35%",
                    fontWeight: 600,
                }, children: label }), _jsx("td", { style: {
                    padding: "8px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    verticalAlign: "top",
                }, dangerouslySetInnerHTML: { __html: valueHTML } })] }));
}
// Convert a single field + value to a human friendly HTML string, email-safe
function renderFieldValue(field) {
    return "field: " + field.kind;
}
function Layout({ title, children, }) {
    return (_jsxs("html", { children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { name: "x-apple-disable-message-reformatting" }), _jsx("meta", { httpEquiv: "x-ua-compatible", content: "ie=edge" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }), _jsx("title", { children: title }), _jsx("style", { children: `
          body{margin:0;padding:0;background:#f6f9fc;}
          .container{max-width:640px;margin:0 auto;background:#ffffff}
          .h1{font-weight:700;font-size:20px;margin:0;padding:16px 24px}
          .section{padding:0 24px 24px}
          .muted{color:#6b7280;font-size:12px;padding:12px 24px;text-align:center}
          table{border-collapse:collapse;width:100%}
        ` })] }), _jsx("body", { children: _jsx("table", { role: "presentation", width: "100%", cellPadding: 0, cellSpacing: 0, style: { background: "#f6f9fc", padding: "24px" }, children: _jsx("tbody", { children: _jsx("tr", { children: _jsx("td", { children: _jsx("table", { role: "presentation", width: "100%", className: "container", cellPadding: 0, cellSpacing: 0, style: { borderRadius: 12, overflow: "hidden" }, children: _jsxs("tbody", { children: [_jsx("tr", { children: _jsx("td", { children: _jsx("h1", { className: "h1", children: "Form Submission" }) }) }), _jsx("tr", { children: _jsx("td", { className: "section", children: children }) }), _jsx("tr", { children: _jsx("td", { className: "muted", children: "\u2014 The Alliance Team" }) })] }) }) }) }) }) }) })] }));
}
export const FormSummaryEmail = ({ schema, }) => {
    // one page or many pages → list all fields in order, respecting visibleIf
    return (_jsx(Layout, { title: `Form: ${schema.title ?? schema.slug}`, children: schema.pages.map((page, pageIdx) => (_jsx("table", { role: "presentation", children: _jsx("tbody", { children: page.fields.map((el, idx) => {
                    // skip display blocks; only handle form fields
                    if (!("label" in el))
                        return null;
                    const rawLabel = el.kind === "checkbox" ? el.label : el.label; // markdown allowed on web
                    const labelHTML = marked.parseInline(rawLabel); // simple inline MD (bold, links)
                    const valueHTML = renderFieldValue(el);
                    // If label used Markdown, render it safely
                    return (_jsx(FieldRow, { label: (_jsx("span", { dangerouslySetInnerHTML: { __html: labelHTML } })), valueHTML: valueHTML }, idx));
                }) }) }, pageIdx))) }));
};
