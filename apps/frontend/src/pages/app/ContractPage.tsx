import { href, Navigate } from "react-router";

const ContractPage = () => {
  return <Navigate to={href("/membership")} replace />;
};

export default ContractPage;
