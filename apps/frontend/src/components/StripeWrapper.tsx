import { paymentsCreatePaymentIntent } from "@alliance/shared/client";
import { Elements } from "@stripe/react-stripe-js";
import {
  Appearance,
  loadStripe,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import "../index.css";
import Card, { CardStyle } from "./system/Card";

export const stripePromise = loadStripe(
  "pk_test_51RcteKQ3i6almwvvqvNwXcL1mZik72XFgovP6SzDeP7WDVfC0mXXbxpxbJWmY2kGIy5l1SYAQNmyznRfFP5lKt6O00EeWgC6mr"
);

export const StripeWrapper = ({ children }: { children: React.ReactNode }) => {
  const [clientSecret, setClientSecret] = useState<string | undefined>();

  useEffect(() => {
    paymentsCreatePaymentIntent({
      body: {
        actionId: 1,
      },
    }).then((res) => {
      if (!res.data?.clientSecret) {
        throw new Error("No client secret");
      }
      setClientSecret(res.data.clientSecret);
    });
  }, []);

  if (!clientSecret) {
    return (
      <Card style={CardStyle.White} className="animate-pulse">
        <p>Loading payment</p>
      </Card>
    );
  }

  const appearance: Appearance = {
    theme: "flat",
    variables: {
      logoColor: "dark",
      tabIconColor: "#000",
      borderRadius: "4px",
      fontSizeBase: "15px",
    },
    rules: {
      ".AccordionItem": {
        border: "none",
      },
      ".Input": {
        padding: "8px 12px",
      },
    },
    labels: "floating",
  };

  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};
