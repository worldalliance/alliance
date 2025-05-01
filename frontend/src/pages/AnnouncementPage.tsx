import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { communiquesFindOne } from "../client/sdk.gen";
import { CommuniqueDto } from "../client/types.gen";
import ReactMarkdown from "react-markdown";
import { getApiUrl } from "../lib/config";
import { AdminOnly } from "../context/AdminOnly";
import Button, { ButtonColor } from "../components/system/Button";

const AnnouncementPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<CommuniqueDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      if (!id) {
        setError("Announcement ID is missing");
        setLoading(false);
        return;
      }

      try {
        const response = await communiquesFindOne({
          path: { id },
        });

        if (response.error) {
          throw new Error("Failed to fetch announcement");
        }

        setAnnouncement(response.data || null);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching announcement:", err);
        setError("Failed to load the announcement. Please try again later.");
        setLoading(false);
      }
    };

    fetchAnnouncement();
  }, [id]);

  const handleBackClick = () => {
    navigate("/announcements");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-50 items-center">
        <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
          <p className="text-center py-4">Loading announcement...</p>
        </div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-50 items-center">
        <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 w-full">
            {error || "Announcement not found"}
          </div>
          <button
            onClick={handleBackClick}
            className="mt-4 px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded text-stone-800"
          >
            {"<"} Back to Announcements
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(800px,100%))]">
        <div className="w-full">
          <div className="mb-3 flex flex-row gap-x-3">
            <Button
              label="Back to Announcements"
              color={ButtonColor.Light}
              onClick={handleBackClick}
            />
            <AdminOnly>
              <Button
                label="Edit"
                color={ButtonColor.Blue}
                onClick={() => navigate(`/announcements/edit/${id}`)}
              />
            </AdminOnly>
          </div>

          {announcement.headerImage && (
            <div className="w-full mb-6">
              <img
                src={`${getApiUrl()}/images/${announcement.headerImage}`}
                alt={announcement.title}
                className="w-full h-auto rounded-md object-cover max-h-[200px] border border-gray-300"
              />
            </div>
          )}

          <div className="mb-2 text-stone-500 text-sm">
            {formatDate(announcement.dateCreated)}
          </div>

          <h1 className="text-3xl font-bold mb-6 text-stone-800">
            {announcement.title}
          </h1>

          <div className="prose prose-stone prose-lg max-w-none">
            <ReactMarkdown>{announcement.bodyText}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementPage;
