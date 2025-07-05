import { paymentsCreatePaymentIntent } from "@alliance/shared/client";
import { Elements } from "@stripe/react-stripe-js";
import {
  Appearance,
  loadStripe,
  StripeElementsOptions,
} from "@stripe/stripe-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import "../index.css";

export const stripePromise = loadStripe(
  "pk_test_51RcteKQ3i6almwvvqvNwXcL1mZik72XFgovP6SzDeP7WDVfC0mXXbxpxbJWmY2kGIy5l1SYAQNmyznRfFP5lKt6O00EeWgC6mr"
);

export interface PaymentMethodData {
  stripeId: string;
  last4: string;
}

export interface StripeWrapperContextType {
  token: string | undefined;
  savedPaymentMethod: PaymentMethodData | undefined;
  clientSecret: string | undefined;
}

const StripeWrapperContext = createContext<
  StripeWrapperContextType | undefined
>(undefined);

export interface StripeWrapperProps extends React.PropsWithChildren {
  actionId: number;
}

export const StripeWrapper = ({ children, actionId }: StripeWrapperProps) => {
  const [clientSecret, setClientSecret] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<
    PaymentMethodData | undefined
  >();

  console.log("clientSecret", clientSecret);

  useEffect(() => {
    paymentsCreatePaymentIntent({
      body: {
        actionId,
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
      if (res.data.savedPaymentMethodId) {
        setSavedPaymentMethod({
          stripeId: res.data.savedPaymentMethodId,
          last4: res.data.savedPaymentMethodLast4,
        });
      }
    });
  }, [actionId]);

  const value = useMemo<StripeWrapperContextType>(
    () => ({
      token,
      savedPaymentMethod,
      clientSecret,
    }),
    [token, savedPaymentMethod, clientSecret]
  );

  //   if (!clientSecret) {
  //     return (
  //       <Card style={CardStyle.White} className="animate-pulse">
  //         <p>Loading payment</p>
  //       </Card>
  //     );
  //   }

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

export const usePaymentIntentData = (): StripeWrapperContextType => {
  const ctx = useContext(StripeWrapperContext);
  if (!ctx) {
    throw new Error(
      "usePaymentIntentData must be used within an StripeWrapper"
    );
  }
  return ctx;
};
