import request from "supertest";
import { CreateActionDto } from "../src/actions/dto/action.dto";
import { VisibilityMode } from "../src/actions/entities/action.entity";
import { TestContext } from "./e2e-test-utils";

export const createActionDefaults = {
  body: "Body",
  category: [],
  shortDescription: "Short",
  visibilityMode: VisibilityMode.Public,
  isContractSigningAction: false,
  shouldCompleteAfterDeadline: false,
  isForumParticipationAction: false,
  optional: false,
  preventCompletion: false,
  publicOnly: false,
  onboarding: false,
} satisfies Omit<CreateActionDto, "name">;

export const createActionAsAdmin = (
  ctx: TestContext,
  body: Partial<CreateActionDto> & Pick<CreateActionDto, "name">,
) =>
  request(ctx.app.getHttpServer())
    .post("/actions/create")
    .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
    .send({ ...createActionDefaults, ...body } satisfies CreateActionDto);

export const patchActionAsAdmin = (
  ctx: TestContext,
  id: number,
  body: Record<string, unknown>,
) =>
  request(ctx.app.getHttpServer())
    .patch(`/actions/${id}`)
    .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
    .send(body);

export const getActionAsAdmin = (ctx: TestContext, id: number) =>
  request(ctx.app.getHttpServer())
    .get(`/actions/adminslug/${id}`)
    .set("Authorization", `Bearer ${ctx.adminAccessToken}`);
