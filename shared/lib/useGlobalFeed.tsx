import { useEffect, useState } from "react";
import { actionsGetGlobalFeed, GlobalFeedItemDto } from "../client";


const useGlobalFeed = ({ limit = 15 }) => {
  const [items, setItems] = useState<GlobalFeedItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    actionsGetGlobalFeed({
      query: { limit },
    })
      .then((response) => {
        if (response.data) {
          setItems(response.data);
        }
      })
      .catch((err) => {
        setError(err);
        console.error("Error fetching global feed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [limit]);

  return {
    items,
    loading,
    error,
  };
};

export default useGlobalFeed;
