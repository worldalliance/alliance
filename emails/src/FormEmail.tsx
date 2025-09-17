import type { FormSchema } from "@alliance/shared/forms/formschema";
import React from "react";
import { RenderField } from "@alliance/shared/forms/RenderField";
import RenderDisplayBlock from "@alliance/shared/forms/RenderDisplayBlock";
import { Tailwind } from "@react-email/tailwind";

function Layout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style>{`
          body{margin:0;padding:0;background:#f6f9fc;}
          .container{max-width:640px;margin:0 auto;background:#ffffff}
          .h1{font-weight:700;font-size:20px;margin:0;padding:16px 24px}
          .section{padding:0 24px 24px}
          .muted{color:#6b7280;font-size:12px;padding:12px 24px;text-align:center}
          table{border-collapse:collapse;width:100%}
        `}</style>
      </head>
      <body>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ background: "#ffffff", padding: "24px" }}
        >
          <tbody>
            <tr>
              <td>
                <table
                  role="presentation"
                  width="100%"
                  className="container"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ borderRadius: 12, overflow: "hidden" }}
                >
                  <tbody>
                    <tr></tr>
                    <tr>
                      <td className="section">{children}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

type FormSummaryEmailProps = {
  schema: FormSchema;
};

export const FormSummaryEmail: React.FC<FormSummaryEmailProps> = ({
  schema,
}: FormSummaryEmailProps) => {
  // one page or many pages → list all fields in order, respecting visibleIf
  return (
    <Layout title={`Form: ${schema.title ?? schema.slug}`}>
      <Tailwind
        config={{
          theme: { extend: {} },
          corePlugins: { preflight: false }, // emails: avoid global resets
        }}
      >
        {schema.pages.map((page, pageIdx) => (
          <table key={pageIdx} role="presentation">
            <tbody>
              {page.fields.map((el) => {
                // skip display blocks; only handle form fields
                if ("label" in el) {
                  return <RenderField field={el} disabled key={el.id} />;
                } else {
                  return <RenderDisplayBlock block={el} key={el.id} />;
                }
              })}
            </tbody>
          </table>
        ))}
      </Tailwind>
    </Layout>
  );
};
