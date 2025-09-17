import { FormSchema } from '@alliance/shared/forms/formschema';
import React from 'react';

declare function renderEmail(schema: FormSchema): {
    html: string;
    text: string;
};

type FormSummaryEmailProps = {
    schema: FormSchema;
};
declare const FormSummaryEmail: React.FC<FormSummaryEmailProps>;

export { FormSummaryEmail, renderEmail };
