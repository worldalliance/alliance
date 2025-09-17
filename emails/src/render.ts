// packages/emails/src/render.ts (or .tsx if you enabled JSX)
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import juice from "juice";
import { htmlToText } from "html-to-text";
import { FormSchema } from "@alliance/shared/forms/formschema";
import { FormSummaryEmail } from "./FormEmail";

// Accept ANY React component type with props P
export function renderEmail(schema: FormSchema) {
  const element = React.createElement(FormSummaryEmail, { schema });
  const html = "<!doctype html>" + renderToStaticMarkup(element);
  const inlined = juice(html);
  const text = htmlToText(inlined, { wordwrap: 100 });
  return { html: inlined, text };
}
