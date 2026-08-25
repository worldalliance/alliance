import {
  ARRAY_METHOD_NAMES,
  MATH_FUNCTION_NAMES,
  MATH_OBJECT_NAME,
  NUMBER_METHOD_NAMES,
  STRING_METHOD_NAMES,
} from "@alliance/common/forms/variable-expression";
import {
  FIELD_KIND_VARIABLE_INPUT_MODE,
  VARIABLE_INPUT_TYPE,
  VariableInputMode,
} from "@alliance/common/forms/variables";
import Modal, {
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { Fragment, type ReactNode } from "react";

const MDN = "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference";

const OPERATOR_DOCS: { symbols: string; href: string }[] = [
  { symbols: "+ - * / % **", href: `${MDN}/Operators#arithmetic_operators` },
  {
    symbols: "< > <= >= === !==",
    href: `${MDN}/Operators#relational_operators`,
  },
  { symbols: "? :", href: `${MDN}/Operators/Conditional_operator` },
  { symbols: "&&", href: `${MDN}/Operators/Logical_AND` },
  { symbols: "||", href: `${MDN}/Operators/Logical_OR` },
  { symbols: "??", href: `${MDN}/Operators/Nullish_coalescing` },
];

export type InputModeHelp = {
  notes: string;
  example: (input: string) => string;
};

export const INPUT_MODE_HELP: Record<VariableInputMode, InputModeHelp> = {
  [VariableInputMode.Number]: {
    notes: `Arithmetic and ${MATH_OBJECT_NAME} functions read it directly.`,
    example: (input) => `Math.round(${input} / 3)`,
  },
  [VariableInputMode.Text]: {
    notes: "The text as the respondent typed it.",
    example: (input) => `${input}.trim().toUpperCase()`,
  },
  [VariableInputMode.Boolean]: {
    notes: "Ticked or not.",
    example: (input) => `${input} ? 'yes' : 'no'`,
  },
  [VariableInputMode.Choice]: {
    notes:
      "The option chosen. Compare against .value, which is what the form stored; .label is the wording the respondent saw.",
    example: (input) =>
      `${input}.value === 'weekly' ? 'Every week' : ${input}.label`,
  },
  [VariableInputMode.Choices]: {
    notes: "Every option chosen, in the order answered.",
    example: (input) => `${input}.map(choice => choice.label).join(', ')`,
  },
  [VariableInputMode.City]: {
    notes: 'The city chosen. .label reads "Paris, Île-de-France, France".',
    example: (input) => `${input}.countryName`,
  },
  [VariableInputMode.None]: {
    notes: "This field holds nothing a formula can read.",
    example: () => "",
  },
};

const MODE_IS_DOCUMENTED: Record<VariableInputMode, boolean> = {
  [VariableInputMode.Number]: true,
  [VariableInputMode.Text]: true,
  [VariableInputMode.Boolean]: true,
  [VariableInputMode.Choice]: true,
  [VariableInputMode.Choices]: true,
  [VariableInputMode.City]: true,
  [VariableInputMode.None]: false,
};

const DOCUMENTED_MODES = Object.values(VariableInputMode).filter(
  (mode) => MODE_IS_DOCUMENTED[mode],
);

const kindsForMode = (mode: VariableInputMode): string[] =>
  Object.entries(FIELD_KIND_VARIABLE_INPUT_MODE).flatMap(([kind, each]) =>
    each === mode ? [kind] : [],
  );

export const inputModeType = (mode: VariableInputMode): string =>
  mode === VariableInputMode.None
    ? VARIABLE_INPUT_TYPE[mode]
    : `${VARIABLE_INPUT_TYPE[mode]} | undefined`;

const Code = ({ children }: { children: ReactNode }) => (
  <span className="font-mono text-[11px]">{children}</span>
);

const DocLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="underline decoration-dotted underline-offset-2 hover:text-gray-900"
  >
    {children}
  </a>
);

const MemberLinks = ({
  owner,
  names,
}: {
  owner: string;
  names: readonly string[];
}) => (
  <>
    {names.map((name, index) => (
      <Fragment key={name}>
        {index > 0 && ", "}
        <Code>
          <DocLink href={`${MDN}/Global_Objects/${owner}/${name}`}>
            {name}
          </DocLink>
        </Code>
      </Fragment>
    ))}
  </>
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ReferenceRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 font-medium text-gray-500">{label}</span>
      <p className="flex-1">{children}</p>
    </div>
  );
}

export type FormulaHelpInput = {
  name: string;
  type: string;
  example: string | null;
};

type VariableHelpModalProps = {
  inputs: FormulaHelpInput[];
  onInsert: (snippet: string) => void;
  onClose: () => void;
};

export function VariableHelpModal({
  inputs,
  onInsert,
  onClose,
}: VariableHelpModalProps) {
  return (
    <Modal onClose={onClose} showClose panelClassName="max-w-2xl">
      <ModalHeader>
        <ModalTitle className="text-lg font-semibold">
          Writing formulas
        </ModalTitle>
        <ModalDescription className="text-sm text-zinc-600">
          A formula is one JavaScript expression. It reads the inputs you pick,
          and whatever it returns is written wherever the variable is
          referenced.
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="max-h-[70vh] space-y-5 overflow-y-auto text-sm text-gray-700">
        <Section title="Your inputs">
          {inputs.length === 0 ? (
            <p className="text-xs text-gray-500">
              This variable reads no inputs yet.
            </p>
          ) : (
            <table className="w-full border-collapse text-left align-top text-xs">
              <tbody>
                {inputs.map(({ name, type, example }) => (
                  <tr key={name} className="border-t border-gray-100">
                    <td className="w-14 py-1.5 pr-3 align-top font-mono text-gray-900">
                      {name}
                    </td>
                    <td className="py-1.5 pr-3 align-top font-mono text-gray-500">
                      {type}
                    </td>
                    <td className="w-64 py-1.5 align-top">
                      {example && (
                        <button
                          type="button"
                          onClick={() => onInsert(example)}
                          title="Insert into the formula"
                          className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-left font-mono text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900"
                        >
                          {example}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Reference">
          <div className="space-y-1.5 text-xs leading-5">
            <ReferenceRow label="Operators">
              {OPERATOR_DOCS.map((operator, index) => (
                <Fragment key={operator.href}>
                  {index > 0 && ", "}
                  <Code>
                    <DocLink href={operator.href}>{operator.symbols}</DocLink>
                  </Code>
                </Fragment>
              ))}
            </ReferenceRow>
            <ReferenceRow label="Text">
              <MemberLinks
                owner="String"
                names={[...STRING_METHOD_NAMES, "length"]}
              />
            </ReferenceRow>
            <ReferenceRow label="Lists">
              <MemberLinks
                owner="Array"
                names={[...ARRAY_METHOD_NAMES, "length"]}
              />
            </ReferenceRow>
            <ReferenceRow label="Numbers">
              <MemberLinks owner="Number" names={NUMBER_METHOD_NAMES} />
            </ReferenceRow>
            <ReferenceRow label={MATH_OBJECT_NAME}>
              <MemberLinks
                owner={MATH_OBJECT_NAME}
                names={MATH_FUNCTION_NAMES}
              />
            </ReferenceRow>
            <ReferenceRow label="Syntax">
              <DocLink href={`${MDN}/Global_Objects/Array`}>lists</DocLink>,{" "}
              <DocLink href={`${MDN}/Operators/Object_initializer`}>
                records
              </DocLink>
              ,{" "}
              <DocLink href={`${MDN}/Functions/Arrow_functions`}>
                arrow functions
              </DocLink>
            </ReferenceRow>
          </div>
        </Section>

        <Section title="What each field kind reads">
          <table className="w-full border-collapse text-left align-top">
            <tbody>
              {DOCUMENTED_MODES.map((mode) => {
                const help = INPUT_MODE_HELP[mode];
                return (
                  <tr key={mode} className="border-t border-gray-100 text-xs">
                    <td className="w-32 py-2 pr-4 align-top font-mono text-gray-600">
                      {kindsForMode(mode).join(", ")}
                    </td>
                    <td className="py-2 align-top text-gray-600">
                      <p className="font-mono text-gray-900">
                        {inputModeType(mode)}
                      </p>
                      <p>{help.notes}</p>
                      <p className="font-mono text-gray-500">
                        {help.example("input1")}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section title="Unanswered fields">
          <p>
            An input whose field the respondent skipped is{" "}
            <Code>
              <DocLink href={`${MDN}/Global_Objects/undefined`}>
                undefined
              </DocLink>
            </Code>
            , and a formula with no value to show renders as nothing. To show
            something else, say so in the formula:{" "}
            <Code>input1 ?? &apos;n/a&apos;</Code>.
          </p>
        </Section>
      </ModalBody>
    </Modal>
  );
}
