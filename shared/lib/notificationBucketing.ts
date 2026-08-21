import { NotificationDto } from "@alliance/shared/client";
import { getNotificationIdentityKey } from "./notificationIdentity";

export type LikesBucket = {
  dayKeys: string[];
  key: string;
  time: number;
  likes: NotificationDto[];
};

export type NotificationRenderItem =
  | {
      type: "notification";
      key: string;
      time: number;
      notification: NotificationDto;
    }
  | {
      type: "likes-group";
      key: string;
      time: number;
      bucket: LikesBucket;
    };

export function getNotificationTime(notification: {
  sendTime?: string | null;
  createdAt: string;
}) {
  return new Date(notification.sendTime || notification.createdAt);
}

export function getUnreadLikesCount(bucket: LikesBucket) {
  return bucket.likes.filter((notification) => !notification.readAt).length;
}

function getDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLikesBucketKey(likes: NotificationDto[]) {
  return `likes-${likes
    .map((notification) => getNotificationIdentityKey(notification))
    .join("-")}`;
}

function createLikesBucket(
  likes: NotificationDto[],
  dayKeys: string[],
): LikesBucket {
  return {
    dayKeys,
    key: getLikesBucketKey(likes),
    time: likes.reduce(
      (latest, notification) =>
        Math.max(latest, getNotificationTime(notification).getTime()),
      0,
    ),
    likes,
  };
}

export function buildNotificationRenderItems(
  notifications: NotificationDto[],
): NotificationRenderItem[] {
  const bucketMap = new Map<string, LikesBucket>();
  const items: NotificationRenderItem[] = [];

  for (const notification of notifications) {
    if (notification.category !== "likes") {
      items.push({
        type: "notification",
        key: `notification-${getNotificationIdentityKey(notification)}`,
        time: getNotificationTime(notification).getTime(),
        notification,
      });
      continue;
    }

    const dayKey = getDayKey(getNotificationTime(notification));
    const existingBucket = bucketMap.get(dayKey);

    if (existingBucket) {
      existingBucket.likes.push(notification);
      existingBucket.time = Math.max(
        existingBucket.time,
        getNotificationTime(notification).getTime(),
      );
      existingBucket.key = getLikesBucketKey(existingBucket.likes);
      continue;
    }

    bucketMap.set(dayKey, createLikesBucket([notification], [dayKey]));
  }

  for (const bucket of bucketMap.values()) {
    items.push({
      type: "likes-group",
      key: bucket.key,
      time: bucket.time,
      bucket,
    });
  }

  items.sort((left, right) => right.time - left.time);

  const mergedItems: NotificationRenderItem[] = [];
  for (const item of items) {
    const previousItem = mergedItems[mergedItems.length - 1];
    if (item.type !== "likes-group" || previousItem?.type !== "likes-group") {
      mergedItems.push(item);
      continue;
    }

    const combinedBucket = createLikesBucket(
      [...previousItem.bucket.likes, ...item.bucket.likes],
      [...previousItem.bucket.dayKeys, ...item.bucket.dayKeys],
    );

    mergedItems[mergedItems.length - 1] = {
      type: "likes-group",
      key: combinedBucket.key,
      time: combinedBucket.time,
      bucket: combinedBucket,
    };
  }

  return mergedItems.map((item) => {
    if (item.type !== "likes-group" || item.bucket.likes.length !== 1) {
      return item;
    }

    const [notification] = item.bucket.likes;
    return {
      type: "notification",
      key: `notification-${getNotificationIdentityKey(notification)}`,
      time: getNotificationTime(notification).getTime(),
      notification,
    };
  });
}
