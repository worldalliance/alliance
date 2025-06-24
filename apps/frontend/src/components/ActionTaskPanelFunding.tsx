import { ActionDto, paymentsSetPartialProfile } from "@alliance/shared/client";
import Card, { CardStyle } from "./system/Card";
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Button from "./system/Button";
import { useCallback, useState } from "react";
import { usePaymentStatus } from "./PaymentStatus";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";
import { useAuth } from "../lib/AuthContext";
import StripeStyleFormInput from "./StripeStyleFormInput";
import { useStripeToken } from "./StripeWrapper";

export interface ActionTaskPanelFundingProps {
  action: ActionDto;
}

const ActionTaskPanelFunding = ({ action }: ActionTaskPanelFundingProps) => {
  const stripe = useStripe();
  const elements = useElements();

  const { status } = usePaymentStatus();
  const { isAuthenticated } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { token } = useStripeToken();

  console.log("token", token);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      // For unauthenticated users, create partial profile before payment
      if (!isAuthenticated) {
        const formData = new FormData(event.currentTarget);
        const firstName = formData.get("firstName") as string;
        const lastName = formData.get("lastName") as string;
        const email = formData.get("email") as string;

        if (!firstName || !lastName || !email) {
          setErrorMessage("Please fill in all required fields");
          return;
        }

        if (token) {
          try {
            await paymentsSetPartialProfile({
              body: {
                email,
                firstName,
                lastName,
                id: token,
              },
            });
          } catch (error) {
            console.error("Failed to create partial profile:", error);
            setErrorMessage("Failed to submit data");
            return;
          }
        } else {
          setErrorMessage("Payment setup error. Please try again.");
          return;
        }
      }

      const res = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (res.error) {
        setErrorMessage(res.error.message ?? null);
      }
    },
    [stripe, elements, isAuthenticated, token]
  );

  if (status === "succeeded") {
    return <ActionTaskPanelCompleted />;
  }

  const titleText = "Join this action by giving $5";

  if (!expanded) {
    return (
      <Card style={CardStyle.White} className="flex flex-row justify-between">
        <h2 className="">{titleText}</h2>
        <Button onClick={() => setExpanded(true)}>Contribute</Button>
      </Card>
    );
  }

  return (
    <Card style={CardStyle.White} className="!px-[1px] !py-4">
      <h2 className="z-20 px-5 bg-white">{titleText}</h2>
      <form onSubmit={handleSubmit}>
        {!isAuthenticated ? (
          <div className="flex flex-col bg-white -mb-10 z-20 mx-4 gap-2">
            <div className="z-2 flex gap-4 mt-1 w-full">
              <StripeStyleFormInput
                name="firstName"
                placeholder="First Name"
                type="text"
              />
              <StripeStyleFormInput
                name="lastName"
                placeholder="Last Name"
                type="text"
              />
            </div>
            <div className="z-2 flex gap-4 mt-1 w-full bg-white">
              <StripeStyleFormInput
                name="email"
                placeholder="Email Address"
                type="email"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white -mb-12"></div>
        )}
        <PaymentElement />
        <div className="flex flex-row justify-end items-center pl-5">
          {!isAuthenticated && (
            <p className="text-sm text-gray-500 flex-1">
              We&apos;ll send you an email with instructions for setting up your
              account after.
            </p>
          )}
          <Button
            type="submit"
            disabled={!stripe || !elements}
            className="justify-self-end mx-[15px] my-0 mt-1 rounded-md !py-3 !px-4"
          >
            Confirm payment
          </Button>
        </div>
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
      </form>
    </Card>
  );
};

export default ActionTaskPanelFunding;
