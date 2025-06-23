import {
  Controller,
  Post,
  Get,
  Body,
  Query,
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
import { AuthGuard, JwtRequest } from 'src/auth/guards/auth.guard';
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
    let customerId: string | undefined;
    if (req.user) {
      customerId = await this.paymentsService.getOrCreateCustomer(
        req.user.sub,
        req.user.email,
      );
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: 500,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: false,
      },
      setup_future_usage: 'on_session',
      payment_method_types: ['card'],
      customer: customerId,
      metadata: {
        actionId: body.actionId.toString(),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new HttpException(
        'Failed to create payment intent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { clientSecret: paymentIntent.client_secret };
  }

  @Get('session-status')
  @UseGuards(AuthGuard)
  async getSessionStatus(@Query('session_id') sessionId: string): Promise<{
    status: Stripe.Checkout.Session.Status | null;
    customer_email: string;
  }> {
    if (!sessionId) {
      throw new HttpException(
        'Missing session_id query parameter',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    return {
      status: session.status,
      customer_email: session.customer_details?.email ?? '',
    };
  }

  @Post('create-partial-profile')
  async createPartialProfile(@Body() body: CreatePartialProfileDto) {
    return this.paymentsService.createPartialProfile(body);
  }

  @Post('webhook')
  async webhook(@RawBody() event: string, @Req() request: Request) {
    let parsedEvent: Stripe.Event;
    if (process.env.STRIPE_ENDPOINT_SECRET) {
      // Get the signature sent by Stripe
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

          await this.paymentsService.handleSuccessfulPayment(
            paymentIntent.customer as string,
            paymentIntent,
          );
          break;
        default:
          // Unexpected event type
          console.log(`Unhandled event type ${parsedEvent.type}.`);
      }
    } else {
      console.log('No endpoint secret set');
    }
  }
}
