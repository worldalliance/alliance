import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ActionsService } from 'src/actions/actions.service';
import { ActionTaskType } from 'src/actions/entities/action.entity';
import { UserService } from 'src/user/user.service';
import Stripe from 'stripe';
import { CreatePartialProfileDto } from './dto/partial-profile.dto';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;

  constructor(
    private userService: UserService,
    private actionService: ActionsService,
  ) {
    if (!process.env.STRIPE_API_KEY) {
      throw new Error('STRIPE_API_KEY must be set');
    }
    this.stripe = new Stripe(process.env.STRIPE_API_KEY, {
      apiVersion: '2025-03-31.basil',
    });
  }

  async createPartialProfile(body: CreatePartialProfileDto) {}

  async getOrCreateCustomer(userId: number, email?: string): Promise<string> {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      metadata: { userId: String(userId) },
      email: email ?? user.email ?? undefined,
    });

    user.stripeCustomerId = customer.id;
    await this.userService.update(userId, user);

    return customer.id;
  }

  async handleSuccessfulPayment(
    customerId: string,
    pi: Stripe.PaymentIntent,
  ): Promise<void> {
    const user = await this.userService.findOneByStripeCustomerId(customerId);
    if (!user) {
      throw new NotFoundException(
        `User with stripeCustomerId ${customerId} not found`,
      );
    }
    console.log('got user with id', user.id);

    console.log('metadata: ', pi.metadata);

    if (pi.metadata.actionId) {
      const actionId = parseInt(pi.metadata.actionId);

      console.log('actionId: ', actionId);

      if (
        (await this.actionService.findOne(actionId)).type !==
        ActionTaskType.Funding
      ) {
        throw new InternalServerErrorException(
          "Getting a payment event for a non-funding action shouldn't ever happen",
        );
      }
      await this.actionService.completeAction(actionId, user.id);
      console.log('completed action');
    } else {
      throw new Error('No actionId in payment intent metadata');
    }
  }
}
