import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import { authMe, authRegister, SignUpDto } from "@alliance/shared/client";
import SignupForm from "../../components/SignupForm";

const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: SignUpDto) => {
    setError(null);
    setLoading(true);

    try {
      await authRegister({ body: formData });

      const checkAuth = await authMe();

      if (checkAuth.response.ok) {
        navigate("/home");
      } else {
        setError("please try again");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-pagebg">
      <div className="flex flex-col flex-grow items-center justify-center font-avenir">
        <div className="w-full max-w-md px-8">
          <h2 className="text-2xl font-sabon text-center mb-8">
            Create an account
          </h2>

          {error && (
            <Card
              style={CardStyle.Alert}
              className="border-red-400 bg-red-50 mb-6"
            >
              <span className="text-red-700">{error}</span>
            </Card>
          )}

          <Card className="p-8" style={CardStyle.White}>
            <SignupForm onSubmit={handleSubmit} loading={loading} />
          </Card>

          <div className="mt-6 text-center">
            <p className="text-[11pt] text-stone-600 font-sabon">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
