import { thrownMessage } from "@alliance/common/errorMessage";
import { toE164 } from "@alliance/common/phone";
import { hasProfilePicture } from "@alliance/common/profilePicture";
import { R } from "@alliance/common/result";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ForumCommentQueryService } from "src/forum/forum-comment-query.service";
import {
  loadedUserCommunities,
  loadedUserTags,
  User,
} from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import { IsNull, type Repository } from "typeorm";
import {
  CustomValidatorResponse,
  CustomValidatorTypeDtoArgs,
  TestCustomExpressionResponse,
} from "./customvalidator.dto";
import {
  CustomValidator,
  CustomValidatorType,
  typeName,
  typeUsableForVisibility,
  typeUsesIdArgument,
} from "./entities/customvalidator.entity";

@Injectable()
export class CustomValidatorService {
  constructor(
    @InjectRepository(CustomValidator)
    private customValidatorRepository: Repository<CustomValidator>,
    private userService: UserService,
    private forumCommentQueryService: ForumCommentQueryService,
  ) {}

  async customValidators(): Promise<CustomValidatorTypeDtoArgs[]> {
    const types = Object.values(CustomValidatorType);
    return types.map((type) => ({
      name: typeName[type],
      id: type,
      withIdField: typeUsesIdArgument[type],
      usableForVisibility: typeUsableForVisibility[type],
    }));
  }

  async findOrCreateCustomValidator(params: {
    type: CustomValidatorType;
    idArgument: string | null;
    expression: string | null;
  }): Promise<CustomValidator> {
    const { type, idArgument, expression } = params;
    let validator = await this.customValidatorRepository.findOne({
      where: {
        type,
        idArgument: idArgument ?? IsNull(),
        expression: expression ?? IsNull(),
      },
    });
    if (!validator) {
      validator = this.customValidatorRepository.create({
        type,
        idArgument,
        expression,
      });
      await this.customValidatorRepository.save(validator);
    }
    return validator;
  }

  async findOneCustomValidator(id: number): Promise<CustomValidator> {
    return this.customValidatorRepository.findOneOrFail({ where: { id } });
  }

  async testCustomExpression(
    expression: string,
    userId?: number,
  ): Promise<TestCustomExpressionResponse> {
    if (!expression?.trim()) {
      throw new BadRequestException("Expression is empty");
    }

    let expressionFn: (user: User) => unknown;
    try {
      expressionFn = eval(expression) as (user: User) => unknown;
    } catch (error) {
      throw new BadRequestException(
        `Failed to evaluate expression: ${thrownMessage(error)}`,
      );
    }

    if (typeof expressionFn !== "function") {
      throw new BadRequestException("Expression must evaluate to a function");
    }

    const runForUser = (user: User): boolean => {
      let result: unknown;
      try {
        result = expressionFn(user);
      } catch (error) {
        throw new BadRequestException(
          `Expression failed for user ${user.id}: ${thrownMessage(error)}`,
        );
      }
      if (typeof result !== "boolean") {
        throw new BadRequestException(
          `Expression must return a boolean (user ${user.id}).`,
        );
      }
      return result;
    };

    let selectedUserResult: boolean | undefined;
    if (typeof userId === "number") {
      const selectedUser = await this.userService.findOneOrFail(userId, {
        tags: true,
        communities: true,
        contractEvents: true,
      });
      if (!selectedUser.hasActiveContract) {
        throw new BadRequestException(
          "Selected user does not have an active contract",
        );
      }
      selectedUserResult = runForUser(selectedUser);
    }

    const users = (
      await this.userService.findAll({
        tags: true,
        communities: true,
        contractEvents: true,
      })
    ).filter((user) => user.hasActiveContract);

    let passCount = 0;
    let failCount = 0;
    const passUsers: User[] = [];
    const failUsers: User[] = [];
    for (const user of users) {
      const isValid = runForUser(user);
      if (isValid) {
        passCount += 1;
        passUsers.push(user);
      } else {
        failCount += 1;
        failUsers.push(user);
      }
    }

    return {
      passCount,
      failCount,
      totalCount: users.length,
      passUsers,
      failUsers,
      selectedUserId: userId,
      selectedUserResult,
    };
  }

  async runValidator(
    id: number,
    userId: number,
    fieldValue?: string,
  ): Promise<CustomValidatorResponse> {
    const validator = await this.customValidatorRepository.findOneOrFail({
      where: { id },
    });
    const user = await this.userService.findOneOrFail(userId, {
      tags: true,
      communities: true,
      contractEvents: true,
    });

    switch (validator.type) {
      case CustomValidatorType.UploadedPhoto:
        if (!hasProfilePicture(user)) {
          return {
            isValid: false,
            message: "You have not uploaded a profile picture yet",
          };
        }
        break;
      case CustomValidatorType.SignedContract:
        if (!user.hasActiveContract) {
          return {
            isValid: false,
            message: "You have not signed the contract yet",
          };
        }
        break;
      case CustomValidatorType.AddedProfileDescription:
        if (!user.profileDescription) {
          return {
            isValid: false,
            message: "You have not added a profile description yet",
          };
        }
        break;
      case CustomValidatorType.RepliedToForumPost:
        if (!validator.idArgument) {
          throw new BadRequestException("Validator has no id argument");
        }
        const replies = await this.forumCommentQueryService.findCommentsForPost(
          Number(validator.idArgument),
        );
        if (
          replies.filter((reply) => reply.authorId === user.id).length === 0
        ) {
          return {
            isValid: false,
            message:
              "You have not replied to the discussion yet - please do that now.",
          };
        }
        break;
      case CustomValidatorType.RepliedToForumPostOrChild:
        if (!validator.idArgument) {
          throw new BadRequestException("Validator has no id argument");
        }
        const replies2 =
          await this.forumCommentQueryService.findCommentsForPostRaw(
            Number(validator.idArgument),
          );
        if (!replies2.some((reply) => reply.authorId === user.id)) {
          return {
            isValid: false,
            message:
              "You have not replied to the discussion yet - please do that now.",
          };
        }
        break;
      case CustomValidatorType.HasPhoneNumber:
        if (!user.phoneNumber) {
          //TODO: check for validation (but inform the user)
          return {
            isValid: false,
            message:
              "You have not added a phone number yet - please do that now.",
          };
        }
        break;
      case CustomValidatorType.IsPhoneNumberValid:
        if (!fieldValue) {
          return {
            isValid: false,
            message:
              "You have not entered a phone number yet - please do that now.",
          };
        }
        return R.isSuccess(toE164(fieldValue))
          ? { isValid: true }
          : {
              isValid: false,
              message:
                "Could not read that as a phone number. If it is not a US number, include the country code, e.g. +44 20 7946 0958.",
            };
      case CustomValidatorType.MemberTag:
        if (!validator.idArgument) {
          throw new BadRequestException("Validator has no id argument");
        }
        if (
          loadedUserTags(user).some((tag) => tag.id === validator.idArgument)
        ) {
          return {
            isValid: true,
          };
        } else {
          return { isValid: false };
        }
      case CustomValidatorType.MemberCommunity:
        if (!validator.idArgument) {
          throw new BadRequestException("Validator has no id argument");
        }
        if (
          loadedUserCommunities(user).some(
            (community) => community.id === Number(validator.idArgument),
          )
        ) {
          return { isValid: true };
        } else {
          return { isValid: false };
        }
      case CustomValidatorType.AnyCommunity:
        if (loadedUserCommunities(user).length === 0) {
          return { isValid: false };
        }
        return { isValid: true };
      case CustomValidatorType.CustomExpression:
        if (!validator.expression) {
          throw new BadRequestException("Validator has no expression");
        }
        const expressionFn = eval(validator.expression) as (
          user: User,
        ) => unknown;
        return { isValid: expressionFn(user) as boolean };
      default:
        console.warn(
          `Unknown validator type: ${validator.type satisfies never}`,
        );
    }
    return { isValid: true };
  }
}
