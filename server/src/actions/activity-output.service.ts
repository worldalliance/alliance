import { ExceptionEvent } from "@alliance/common/analytics";
import { type FormSchema } from "@alliance/common/forms/form-schema";
import {
  schemaWithSavedChoices,
  selectedFormulaChoices,
} from "@alliance/common/forms/formula-choices";
import {
  schemaWithResolvedOptions,
  type ResolvedOptions,
} from "@alliance/common/forms/formula-options";
import {
  collectOutputFieldMap,
  isMalformedListAnswer,
  isOutputAnswerShown,
  redactToOutput,
  savedOutputAnswers,
  type OutputAnswer,
} from "@alliance/common/forms/output-resolution";
import { Injectable, Logger } from "@nestjs/common";
import { PosthogService } from "src/posthog/posthog.service";
import {
  FormResponse,
  loadedFormResponseSnapshot,
  parseFormResponse,
  type ParsedFormResponse,
} from "src/tasks/entities/formresponse.entity";
import { formSchemaOf } from "src/tasks/form-snapshot-schema";
import { ActionActivity } from "./entities/action-activity.entity";

@Injectable()
export class ActivityOutputService {
  private readonly logger = new Logger(ActivityOutputService.name);

  constructor(private readonly posthogService: PosthogService) {}

  private outputAnswers(
    schema: FormSchema,
    response: ParsedFormResponse,
  ): OutputAnswer[] {
    const fieldLookup = collectOutputFieldMap(schema);

    const { visibleAnswers: answers } = savedOutputAnswers({
      schema,
      answers: response.answers,
      validatorResults: response.visibilityValidatorResults,
      deviceType: response.deviceType ?? undefined,
    });
    const publicAnswers = response.publicAnswers ?? {};

    return Object.entries(answers)
      .map(([key, value]) => ({
        isPublic: publicAnswers[key],
        field: fieldLookup.get(key),
        value,
      }))
      .filter((answer) => answer.field?.output?.output === true);
  }

  buildOutputFormResponse(
    activity: ActionActivity,
  ): ParsedFormResponse | undefined {
    if (!activity.taskFormResponse) {
      return undefined;
    }

    const answers = activity.taskFormResponse.answers;
    const publicAnswers = activity.taskFormResponse.publicAnswers ?? {};
    const response = parseFormResponse(
      Object.assign(new FormResponse(), {
        ...activity.taskFormResponse,
        answers,
      }),
    );
    const savedChoices: ResolvedOptions = new Map(
      Object.entries(response.formulaChoices),
    );
    const snapshot = loadedFormResponseSnapshot(activity.taskFormResponse);
    const schema = schemaWithResolvedOptions(
      formSchemaOf(snapshot),
      savedChoices,
    );
    const outputAnswers = this.outputAnswers(schema, response);
    const isAnswerShown = outputAnswers.some(isOutputAnswerShown);
    // A malformed list alone still builds the output, so it gets reported.
    if (!isAnswerShown && !outputAnswers.some(isMalformedListAnswer)) {
      return undefined;
    }
    const output = redactToOutput({
      schema,
      answers: response.answers,
      validatorResults: response.visibilityValidatorResults,
      deviceType: response.deviceType ?? undefined,
      publicAnswers,
    });
    for (const fieldId of output.malformedListFieldIds) {
      const message = `Form response ${response.id}: stored answer for list field ${fieldId} is not a list of rows`;
      this.logger.error(message);
      this.posthogService.captureException({
        event: ExceptionEvent.MalformedListAnswer,
        error: new Error(message),
        properties: { formResponseId: response.id, fieldId },
      });
    }
    if (!isAnswerShown) {
      return undefined;
    }
    const [view] = output.schema.outputViews;
    if (!view?.blocks.length) {
      return undefined;
    }
    const shownChoices = selectedFormulaChoices({
      schema: output.schema,
      answers: output.answers,
      options: savedChoices,
    });
    return Object.assign(response, {
      answers: output.answers,
      // The web and mobile cards, released app builds included, draw the
      // output only when publicAnswers has an entry. The view id gives it one
      // when only display blocks show, without naming any answer.
      publicAnswers: {
        [view.id]: true,
        ...Object.fromEntries(
          Object.keys(output.answers).map((fieldId) => [fieldId, true]),
        ),
      },
      visibilityValidatorResults: {},
      formulaChoices: shownChoices,
      formSnapshot: {
        ...snapshot,
        schema: schemaWithSavedChoices(output.schema, shownChoices),
      },
    });
  }
}
