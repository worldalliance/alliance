import {
  emptyUserPropertyPresence,
  type UserPropertyPresence,
  userValuePropertyPresence,
} from "@alliance/common/forms/user-properties";
import type { AccountDerivedConditionKind } from "@alliance/common/forms/visible-if-formula";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PrerequisiteProgressService } from "src/actions/prerequisite-progress.service";
import { type Repository } from "typeorm";
import { MyVisibilityContext } from "./dto/user.dto";
import {
  ContractEvent,
  ContractEventType,
} from "./entities/contract-event.entity";
import { User } from "./entities/user.entity";

@Injectable()
export class UserVisibilityContextService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ContractEvent)
    private readonly contractEventRepository: Repository<ContractEvent>,
    private readonly prerequisiteProgressService: PrerequisiteProgressService,
  ) {}

  /**
   * Whether the user has a location set — either a structured city or a custom
   * city string. Mirrors the location shown by the `userLocation` display block
   * and drives `userHasCity` visibility conditions.
   */
  async userHasCitySet(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { city: true },
    });
    if (!user) {
      return false;
    }
    return user.city != null || (user.customCityString?.trim().length ?? 0) > 0;
  }

  /**
   * Date of the user's earliest `signed` contract event, or null when they
   * have never signed. Drives `firstContractSigned` visibility conditions.
   */
  async getFirstContractSignedAt(userId: number): Promise<Date | null> {
    const firstSigned = await this.contractEventRepository.findOne({
      where: { user: { id: userId }, type: ContractEventType.SIGNED },
      order: { date: "ASC", id: "ASC" },
    });
    return firstSigned?.date ?? null;
  }

  async getCompletedActionCount(userId: number): Promise<number> {
    return (await this.prerequisiteProgressService.loadCompletions({ userId }))
      .length;
  }

  /**
   * Whether each listed user-table property currently has a value. City matches
   * `userHasCitySet`: a structured city or a non-empty custom city string.
   */
  async userPropertyPresence(userId: number): Promise<UserPropertyPresence> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { city: true },
    });
    if (!user) {
      return emptyUserPropertyPresence();
    }
    return userValuePropertyPresence({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      preferredReminderTime: user.preferredReminderTime,
      timeZone: user.timeZone,
      profilePicture: user.profilePicture,
      profileDescription: user.profileDescription,
      city: user.city,
      customCityString: user.customCityString,
      over18: user.over18,
      clusterId: user.clusterId,
      staffTitle: user.staffTitle,
      switchedDomainAt: user.switchedDomainAt,
      referredById: user.referredById,
      shareInfoPublicly: user.shareInfoPublicly,
    });
  }

  /**
   * User-account-derived values for form visibility conditions. Keep in sync
   * with the condition kinds evaluated in `common/src/forms/visibility.ts`.
   *
   * Each value costs a query, so `kinds` narrows the fetch to the condition
   * kinds a schema actually uses; anything omitted comes back as the same
   * default an unauthenticated viewer would get. Pass nothing to fetch all of
   * it (the `/user/myvisibilitycontext` endpoint doesn't know the schema).
   */
  async getVisibilityContext(
    userId: number,
    kinds?: ReadonlySet<AccountDerivedConditionKind>,
  ): Promise<MyVisibilityContext> {
    let presence: UserPropertyPresence | undefined;
    const loadPresence = async () => {
      presence ??= await this.userPropertyPresence(userId);
      return presence;
    };

    const fetchers: Record<
      AccountDerivedConditionKind,
      () => Promise<Partial<MyVisibilityContext>>
    > = {
      userHasCity: async () => ({
        userHasCity: (await loadPresence()).city,
      }),
      userPropertyHasValue: async () => ({
        userPropertyHasValue: await loadPresence(),
      }),
      firstContractSigned: async () => ({
        firstContractSignedAt: await this.getFirstContractSignedAt(userId),
      }),
      completedActionCount: async () => ({
        completedActionCount: await this.getCompletedActionCount(userId),
      }),
    };

    const requested = kinds
      ? [...kinds].map((kind) => fetchers[kind])
      : Object.values(fetchers);
    const slices = await Promise.all(requested.map((fetch) => fetch()));

    // Unfetched kinds keep the default an unauthenticated viewer would get.
    // Typing the seed as MyVisibilityContext makes a new *field* an error too.
    return slices.reduce<MyVisibilityContext>(
      (context, slice) => ({ ...context, ...slice }),
      {
        userHasCity: false,
        userPropertyHasValue: emptyUserPropertyPresence(),
        firstContractSignedAt: null,
        completedActionCount: 0,
      },
    );
  }
}
