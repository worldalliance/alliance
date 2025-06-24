import { paymentsCreatePaymentIntent } from "@alliance/shared/client";
import { Elements } from "@stripe/react-stripe-js";
import {
  Appearance,
  loadStripe,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import "../index.css";
import Card, { CardStyle } from "./system/Card";

export const stripePromise = loadStripe(
  "pk_test_51RcteKQ3i6almwvvqvNwXcL1mZik72XFgovP6SzDeP7WDVfC0mXXbxpxbJWmY2kGIy5l1SYAQNmyznRfFP5lKt6O00EeWgC6mr"
);

export interface StripeWrapperContextType {
  token: string | undefined;
}

const StripeWrapperContext = createContext<
  StripeWrapperContextType | undefined
>(undefined);

export const StripeWrapper = ({ children }: { children: React.ReactNode }) => {
  const [clientSecret, setClientSecret] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();

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
      if (res.data.userToken) {
        const token: string = res.data.userToken;
        setToken(token);
      }
    });
  }, []);

  const value = useMemo<StripeWrapperContextType>(
    () => ({
      token,
    }),
    [token]
  );

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
      <StripeWrapperContext.Provider value={value}>
        {children}
      </StripeWrapperContext.Provider>
    </Elements>
  );
};

export const useStripeToken = (): StripeWrapperContextType => {
  const ctx = useContext(StripeWrapperContext);
  if (!ctx) {
    throw new Error("useStripeToken must be used within an StripeWrapper");
  }
  return ctx;
};
