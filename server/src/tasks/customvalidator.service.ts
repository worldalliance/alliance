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
import { In, IsNull, type Repository } from "typeorm";
import {
  CustomValidatorResponse,
  CustomValidatorTypeDtoArgs,
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
  }): Promise<CustomValidator> {
    const { type, idArgument } = params;
    let validator = await this.customValidatorRepository.findOne({
      where: {
        type,
        idArgument: idArgument ?? IsNull(),
      },
    });
    if (!validator) {
      validator = this.customValidatorRepository.create({
        type,
        idArgument,
      });
      await this.customValidatorRepository.save(validator);
    }
    return validator;
  }

  async findOneCustomValidator(id: number): Promise<CustomValidator> {
    return this.customValidatorRepository.findOneOrFail({ where: { id } });
  }

  async runValidator(
    id: number,
    userId: number,
    fieldValue?: string,
  ): Promise<CustomValidatorResponse> {
    const validator = await this.customValidatorRepository.findOneOrFail({
      where: { id },
    });
    return this.checkValidator({
      validator,
      user: await this.validatedUser(userId),
      fieldValue,
    });
  }

  /** An id that matches no validator is left out. */
  async findValidators(ids: number[]): Promise<Map<number, CustomValidator>> {
    if (ids.length === 0) return new Map();
    const validators = await this.customValidatorRepository.find({
      where: { id: In(ids) },
    });
    return new Map(validators.map((validator) => [validator.id, validator]));
  }

  /** The member with the relations `checkValidator` reads. */
  validatedUser(userId: number): Promise<User> {
    return this.userService.findOneOrFail(userId, {
      tags: true,
      communities: true,
      contractEvents: true,
    });
  }

  async checkValidator(params: {
    validator: CustomValidator;
    user: User;
    fieldValue?: string;
  }): Promise<CustomValidatorResponse> {
    const { validator, user, fieldValue } = params;
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
      default:
        throw new Error(
          `Unknown validator type: ${validator.type satisfies never}`,
        );
    }
    return { isValid: true };
  }
}
