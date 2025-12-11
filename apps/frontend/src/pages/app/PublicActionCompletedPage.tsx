import CenterLayout from "@alliance/shared/ui/CenterLayout";
import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";

const PublicActionCompletedPage = () => {
  return (
    <CenterLayout className="h-screen">
      <div className="flex flex-row items-center justify-center flex-1 gap-4">
        <CheckIcon size="xl" />
        <div>
          <p className="text-xl font-bold">Action Completed</p>
          <p>Thanks for participating!</p>
        </div>
      </div>
    </CenterLayout>
  );
};

export default PublicActionCompletedPage;
