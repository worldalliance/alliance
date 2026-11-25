import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { describe, expect, it, mock, spyOn } from "bun:test";
import { User } from "src/user/entities/user.entity";
import { UserVisibilityContextService } from "src/user/user-visibility-context.service";
import { CustomValidatorService } from "./customvalidator.service";
import { FormResponse } from "./entities/formresponse.entity";
import { MemberVisibilityService } from "./member-visibility.service";

const gatedBy = (validatorIds: number[]): FormSchema => ({
  pages: validatorIds.map((validatorId) => ({
    id: `p${validatorId}`,
    title: "Page",
    fields: [],
    visibleIfFormula: {
      formula: "c1",
      conditions: { c1: { kind: "validator", validatorId } },
    },
  })),
  outputViews: [],
  aggregateViews: [],
});

const service = async ({
  findResponse = async (): Promise<FormResponse | null> => null,
} = {}) => {
  const validatorService = {
    findValidators: mock(
      async (ids: number[]) => new Map(ids.map((id) => [id, { id }])),
    ),
    validatedUser: mock(async (id: number) => ({ id })),
    checkValidator: mock(async () => {
      throw new Error("misconfigured");
    }),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      MemberVisibilityService,
      { provide: CustomValidatorService, useValue: validatorService },
      {
        provide: getRepositoryToken(FormResponse),
        useValue: { findOne: findResponse },
      },
      {
        provide: getRepositoryToken(User),
        useValue: { find: async () => [1, 2, 3].map((id) => ({ id })) },
      },
      {
        provide: UserVisibilityContextService,
        useValue: {
          getVisibilityContext: async () => ({
            userHasCity: false,
            userPropertyHasValue: {},
            firstContractSignedAt: null,
            completedActionCount: 0,
          }),
        },
      },
    ],
  }).compile();
  const visibility = moduleRef.get(MemberVisibilityService);
  const logged = spyOn(visibility["logger"], "error").mockImplementation(
    () => {},
  );
  return { visibility, validatorService, logged };
};

describe("MemberVisibilityService.profiles", () => {
  it("logs a failing validator once per request, not once per member", async () => {
    const { visibility, logged } = await service();
    const profiles = await visibility.profiles({
      schema: gatedBy([4]),
      userIds: [1, 2, 3],
    });
    expect(profiles).toEqual(
      R.success([{ results: [false], userIds: [1, 2, 3] }]),
    );
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("loads each validator once per request and each member once", async () => {
    const { visibility, validatorService } = await service();
    await visibility.profiles({ schema: gatedBy([4, 5]), userIds: [1, 2, 3] });
    expect(validatorService.findValidators).toHaveBeenCalledTimes(1);
    expect(validatorService.validatedUser).toHaveBeenCalledTimes(3);
    expect(validatorService.checkValidator).toHaveBeenCalledTimes(6);
  });

  it("fails an unsaved validator without running it", async () => {
    const { visibility, validatorService, logged } = await service();
    expect(
      await visibility.profiles({ schema: gatedBy([-1]), userIds: [1, 2] }),
    ).toEqual(R.success([{ results: [false], userIds: [1, 2] }]));
    expect(validatorService.checkValidator).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });
});

describe("MemberVisibilityService.memberExtras", () => {
  it("fails when a validator throws for a member's own form, logging the cause without sending it", async () => {
    const { visibility, logged } = await service();
    const failure = visibility.memberExtras({
      schema: gatedBy([4]),
      userId: 1,
    });
    await expect(failure).rejects.toThrow("Visibility validator 4 failed");
    await expect(failure).rejects.toMatchObject({
      response: expect.not.objectContaining({
        message: expect.stringContaining("misconfigured"),
      }),
    });
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("misconfigured"),
    );
  });

  it.each([-1, 4])(
    "fails when a member's own form names validator %i that doesn't exist",
    async (validatorId) => {
      const { visibility } = await service();
      await expect(
        visibility.memberExtras({
          schema: gatedBy([validatorId]),
          userId: 1,
          validators: new Map(),
        }),
      ).rejects.toThrow(`Visibility validator ${validatorId} failed`);
    },
  );

  it("fails when a member's answers to another form can't be read", async () => {
    const { visibility } = await service({
      findResponse: async () => {
        throw new Error("connection lost");
      },
    });
    const readsForm7: FormSchema = {
      pages: [
        {
          id: "p1",
          title: "Page",
          fields: [],
          visibleIfFormula: {
            formula: "c1",
            conditions: {
              c1: {
                kind: "hasValue",
                when: "x",
                hasValue: true,
                sourceFormId: 7,
              },
            },
          },
        },
      ],
      outputViews: [],
      aggregateViews: [],
    };
    await expect(
      visibility.memberExtras({ schema: readsForm7, userId: 1 }),
    ).rejects.toThrow("connection lost");
  });
});
