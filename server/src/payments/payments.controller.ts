import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
  UnauthorizedException,
  RawBody,
  Request,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { JwtRequest } from 'src/auth/guards/auth.guard';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { AuthOptionalGuard } from 'src/auth/guards/authoptional.guard';
import { CreatePartialProfileDto } from './dto/partial-profile.dto';

class CreatePaymentIntentDto {
  @ApiProperty()
  actionId: number;
}

class ClientSecretDto {
  @ApiProperty()
  clientSecret: string;

  @ApiProperty()
  userToken?: string;

  @ApiProperty()
  savedPaymentMethodId?: string;

  @ApiProperty()
  savedPaymentMethodLast4?: string;
}

@Controller('payments')
export class PaymentsController {
  private readonly stripe: Stripe;

  constructor(private readonly paymentsService: PaymentsService) {
    if (!process.env.STRIPE_API_KEY) {
      throw new Error('STRIPE_API_KEY must be set');
    }
    this.stripe = new Stripe(process.env.STRIPE_API_KEY, {
      apiVersion: '2025-03-31.basil',
    });
  }

  @UseGuards(AuthOptionalGuard)
  @Post('create-payment-intent')
  @ApiOkResponse({ type: ClientSecretDto })
  async createPaymentIntent(
    @Request() req: JwtRequest,
    @Body() body: CreatePaymentIntentDto,
  ): Promise<ClientSecretDto> {
    let customer: Stripe.Customer | undefined;
    if (req.user) {
      customer = await this.paymentsService.getOrCreateCustomer(
        req.user.sub,
        req.user.email,
      );
    }
    let token: string | undefined;
    if (!customer) {
      token = await this.paymentsService.createPaymentUserDataToken();
    }

    let paymentMethod: Stripe.PaymentMethod | undefined;
    if (customer) {
      const paymentMethods = await this.stripe.customers.listPaymentMethods(
        customer.id,
      );
      if (
        paymentMethods.data.length > 0 &&
        paymentMethods.data[0].type === 'card'
      ) {
        //TODO: support multiple payment methods
        paymentMethod = paymentMethods.data[0];
      }
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: 500,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: false,
      },
      payment_method: paymentMethod?.id,
      setup_future_usage: 'on_session',
      payment_method_types: ['card'],
      customer: customer?.id,
      metadata: {
        actionId: body.actionId.toString(),
        ...(token && { token }),
      },
    });

    if (token) {
      await this.paymentsService.updatePaymentUserDataToken(token, {
        paymentIntentId: paymentIntent.id,
      });
    }

    console.log('paymentIntent created with token', token);

    if (!paymentIntent.client_secret) {
      throw new HttpException(
        'Failed to create payment intent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      clientSecret: paymentIntent.client_secret,
      userToken: token,
      ...(paymentMethod && {
        savedPaymentMethodId: paymentMethod.id,
        savedPaymentMethodLast4: paymentMethod.card?.last4,
      }),
    };
  }

  @Post('set-partial-profile')
  async setPartialProfile(@Body() body: CreatePartialProfileDto) {
    console.log('setting partial profile', body);
    return this.paymentsService.updatePaymentUserDataToken(body.id, body);
  }

  @Post('webhook')
  async webhook(@RawBody() event: string, @Req() request: Request) {
    let parsedEvent: Stripe.Event;
    if (process.env.STRIPE_ENDPOINT_SECRET) {
      const signature = request.headers['stripe-signature'];
      try {
        parsedEvent = this.stripe.webhooks.constructEvent(
          event,
          signature,
          process.env.STRIPE_ENDPOINT_SECRET,
        );
      } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        throw new UnauthorizedException(
          'Webhook signature verification failed',
        );
      }

      switch (parsedEvent.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = parsedEvent.data.object;
          console.log(`PaymentIntent ${paymentIntent.id} was successful!`);

          await this.paymentsService.handleSuccessfulPayment(paymentIntent);
          break;
        default:
          break;
      }
    } else {
      console.log('No endpoint secret set');
    }
  }
}
