import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { communiquesFindAll, communiquesGetRead } from "../client/sdk.gen";
import { CommuniqueDto } from "../client/types.gen";
import AnnouncementCard from "../components/AnnoucementCard";
import Button, { ButtonColor } from "../components/system/Button";
import { AdminOnly } from "../context/AdminOnly";
import { useAuth } from "../context/AuthContext";

const AnnouncementsListPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<CommuniqueDto[]>([]);
  const [unreadStatus, setUnreadStatus] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        console.log("fetching announcements");

        const response = await communiquesFindAll();

        if (response.error) {
          throw new Error("Failed to fetch announcements");
        }

        const fetchedAnnouncements = response.data || [];
        setAnnouncements(fetchedAnnouncements);

        // If user is authenticated, check read status for each announcement
        if (isAuthenticated && fetchedAnnouncements.length > 0) {
          const readStatusMap: Record<number, boolean> = {};

          // Check read status for each announcement
          await Promise.all(
            fetchedAnnouncements.map(async (announcement) => {
              try {
                const readResponse = await communiquesGetRead({
                  path: { id: announcement.id.toString() },
                });

                // If read response is true, the announcement has been read
                // We want to track if it's unread, so we invert the value
                readStatusMap[announcement.id] = !(readResponse.data ?? false);
              } catch (error) {
                console.error(
                  `Error checking read status for announcement ${announcement.id}:`,
                  error
                );
                // Default to showing as unread if there's an error
                readStatusMap[announcement.id] = true;
              }
            })
          );

          setUnreadStatus(readStatusMap);
        }

        setLoading(false);
      } catch (err) {
        setError("Failed to load announcements. Please try again later.");
        setLoading(false);
        console.error("Error fetching announcements:", err);
      }
    };

    fetchAnnouncements();
  }, [isAuthenticated]);

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 items-center">
      <div className="px-4 py-5 flex flex-col items-center w-[calc(min(600px,100%))] gap-y-3">
        <div className="w-full flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Announcements</h1>
          <AdminOnly>
            <Button
              label="New Announcement"
              color={ButtonColor.Blue}
              onClick={() => navigate("/announcements/new")}
            />
          </AdminOnly>
        </div>

        {loading && (
          <p className="text-center py-4">Loading announcements...</p>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {announcements.map((announcement) => (
          <AnnouncementCard
            key={announcement.id}
            data={announcement}
            unread={unreadStatus[announcement.id] ?? false}
            className="w-full"
          />
        ))}

        {announcements.length === 0 && !loading && (
          <p className="text-center py-4">No announcements</p>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsListPage;
