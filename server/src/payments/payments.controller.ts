import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
  RawBody,
  Request,
  Get,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { AuthGuard, JwtRequest } from 'src/auth/guards/auth.guard';
import {
  ApiBody,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthOptionalGuard } from 'src/auth/guards/authoptional.guard';
import { CreatePartialProfileDto } from './dto/partial-profile.dto';
import { IsNotEmpty } from 'class-validator';
import { PaymentMethodDto } from './dto/payment-method.dto';
import { ActionsService } from 'src/actions/actions.service';

class CreatePaymentIntentDto {
  @ApiProperty()
  @IsNotEmpty()
  actionId: number;
}

class ClientSecretDto {
  @ApiProperty()
  clientSecret: string;

  @ApiPropertyOptional()
  userToken?: string;

  @ApiPropertyOptional()
  savedPaymentMethodId?: string;

  @ApiPropertyOptional()
  savedPaymentMethodLast4?: string;

  @ApiPropertyOptional()
  amount?: number;
}

@Controller('payments')
export class PaymentsController {
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly actionsService: ActionsService,
  ) {
    if (!process.env.STRIPE_API_KEY) {
      throw new Error('STRIPE_API_KEY must be set');
    }
    this.stripe = new Stripe(process.env.STRIPE_API_KEY, {
      apiVersion: '2025-03-31.basil',
    });
  }

  @UseGuards(AuthOptionalGuard)
  @Post('create-payment-intent')
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiOkResponse({ type: ClientSecretDto })
  async createPaymentIntent(
    @Request() req: JwtRequest,
    @Body() body: CreatePaymentIntentDto,
  ): Promise<ClientSecretDto> {
    let customer: Stripe.Customer | undefined;
    console.log('body', body);
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

    const amount = await this.actionsService.getPaymentAmountForAction(
      body.actionId,
    );

    const paymentMethod = customer
      ? await this.paymentsService.getSavedPaymentForCustomer(customer)
      : undefined;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amount,
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

    if (!paymentIntent.client_secret) {
      throw new HttpException(
        'Failed to create payment intent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      clientSecret: paymentIntent.client_secret,
      amount,
      userToken: token,
      ...(paymentMethod && {
        savedPaymentMethodId: paymentMethod.id,
        savedPaymentMethodLast4: paymentMethod.card?.last4,
      }),
    };
  }

  @Post('set-partial-profile')
  @ApiOkResponse()
  async setPartialProfile(@Body() body: CreatePartialProfileDto) {
    console.log('setting partial profile', body);
    return this.paymentsService.updatePaymentUserDataToken(body.id, body);
  }

  @Post('webhook')
  @ApiOkResponse()
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
        throw new BadRequestException('Webhook signature verification failed');
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

  @Get('payment-method')
  @ApiOkResponse({ type: PaymentMethodDto })
  @UseGuards(AuthGuard)
  async paymentMethod(@Request() req: JwtRequest): Promise<PaymentMethodDto> {
    const customer = await this.paymentsService.getOrCreateCustomer(
      req.user.sub,
      req.user.email,
    );
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const paymentMethod =
      await this.paymentsService.getSavedPaymentForCustomer(customer);
    if (!paymentMethod || !paymentMethod.card) {
      throw new NotFoundException('Payment method not found');
    }
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      ...paymentMethod.card,
    };
  }

  @Post('clear-payment-method')
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async clearPaymentMethods(@Request() req: JwtRequest) {
    const customer = await this.paymentsService.getOrCreateCustomer(
      req.user.sub,
      req.user.email,
    );
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    const paymentMethod =
      await this.paymentsService.getSavedPaymentForCustomer(customer);
    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }
    await this.stripe.paymentMethods.detach(paymentMethod.id);
  }
}
