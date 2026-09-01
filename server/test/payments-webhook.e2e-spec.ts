import { PaymentsModule } from "src/payments/payments.module";
import Stripe from "stripe";
import supertest from "supertest";
import { createTestApp, TestContext } from "./e2e-test-utils";

const SECRET = "whsec_payments_webhook_e2e_secret";

let ctx: TestContext;
let stripe: Stripe;

beforeAll(async () => {
  process.env.STRIPE_API_KEY = "sk_test_payments_webhook_e2e";
  process.env.STRIPE_ENDPOINT_SECRET = SECRET;
  stripe = new Stripe(process.env.STRIPE_API_KEY, {
    apiVersion: "2025-03-31.basil",
  });
  ctx = await createTestApp([PaymentsModule]);
});

afterAll(async () => {
  await ctx.app.close();
});

// The worker build of stripe refuses synchronous HMAC, so the sync
// generateTestHeaderString throws the way constructEvent did.
const sign = (payload: string): Promise<string> =>
  stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: SECRET });

const deliver = (payload: string, signature: string) =>
  supertest(ctx.app.getHttpServer())
    .post("/payments/webhook")
    .set("content-type", "application/json")
    .set("stripe-signature", signature)
    .send(payload);

// A type the handler's switch ignores, so the test covers verification without
// reaching handleSuccessfulPayment and the Stripe API behind it.
const ignoredEvent = (): string =>
  JSON.stringify({
    id: "evt_e2e",
    object: "event",
    type: "payment_intent.created",
    data: { object: { id: "pi_e2e", object: "payment_intent" } },
  });

describe("Stripe webhook signatures", () => {
  it("accepts a body signed with the endpoint secret", async () => {
    const payload = ignoredEvent();
    await deliver(payload, await sign(payload)).expect(201);
  });

  it("rejects a body edited after signing", async () => {
    const payload = ignoredEvent();
    const signature = await sign(payload);
    await deliver(payload.replace("pi_e2e", "pi_xxx"), signature).expect(400);
  });
});
