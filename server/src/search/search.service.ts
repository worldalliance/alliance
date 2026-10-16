import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { formatDistanceToNow } from "date-fns";
import { uniqBy } from "es-toolkit";
import { ActionsService } from "src/actions/actions.service";
import { readableActionStatus } from "src/actions/entities/action-event.entity";
import { Action } from "src/actions/entities/action.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumService } from "src/forum/forum.service";
import { ProfileDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { FriendService } from "src/user/friend.service";
import { UserService } from "src/user/user.service";
import type { Repository } from "src/utils/Repository";
import { actionUrl, postUrl, profileUrl } from "./approutes";
import { infoPageSearchItems } from "./informationpages";
import { RecentSearch } from "./recentsearch.entity";
import {
  SaveSearchSelectionDto,
  SearchItem,
  SearchItemType,
} from "./searchitem.dto";

const nullIfNotFound = <T>(lookup: Promise<T>): Promise<T | null> =>
  lookup.catch((error: unknown) => {
    if (error instanceof NotFoundException) return null;
    throw error;
  });

const maxRecentSearchesScanned = 50;

@Injectable()
export class SearchService {
  constructor(
    private usersService: UserService,
    private readonly friendService: FriendService,
    private actionsService: ActionsService,
    private forumService: ForumService,
    @InjectRepository(RecentSearch)
    private searchRepository: Repository<RecentSearch>,
  ) {}

  async search(query: string, userId: number): Promise<SearchItem[]> {
    const maxItemsPerType = 5;

    if (!query.length) {
      const recentSearches = await this.searchRepository.find({
        where: { userId },
        order: { createdAt: "DESC" },
        take: maxRecentSearchesScanned,
      });

      const unique = uniqBy(
        recentSearches,
        (search) => `${search.objectType}${search.objectId}`,
      );

      const items: SearchItem[] = [];
      for (
        let i = 0;
        i < unique.length && items.length < maxItemsPerType;
        i += maxItemsPerType
      ) {
        const resolved = await Promise.all(
          unique
            .slice(i, i + maxItemsPerType)
            .map((search) => this.recentSearchToItem(search, userId)),
        );
        items.push(...resolved.filter((item) => item !== null));
      }
      return items.slice(0, maxItemsPerType);
    }

    const users = await this.usersService.findByUsername(query);
    const friends = await this.friendService.findFriends(userId);
    const userItems = users.slice(0, maxItemsPerType).map((user) =>
      this.userToSearchItem(
        user,
        friends.some((f) => f.id === user.id),
        user.id === userId,
      ),
    );

    const actions = await this.actionsService.findByName(query, userId);
    const actionItems = actions
      .slice(0, maxItemsPerType)
      .map((action) => this.actionToSearchItem(action));

    const posts = await this.forumService.findPostsByTitle({
      title: query,
      requestingUserId: userId,
    });
    const postItems = posts
      .slice(0, maxItemsPerType)
      .map((post) => this.postToSearchItem(post));

    const infoPageItems = infoPageSearchItems
      .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, maxItemsPerType);

    return [...userItems, ...actionItems, ...postItems, ...infoPageItems];
  }

  private async recentSearchToItem(
    search: RecentSearch,
    userId: number,
  ): Promise<SearchItem | null> {
    switch (search.objectType) {
      case SearchItemType.User: {
        const user = await this.usersService.findOne(search.objectId);
        if (!user) {
          return null;
        }
        return this.userToSearchItem(user, false, false);
      }
      case SearchItemType.Action: {
        const action = await nullIfNotFound(
          this.actionsService.findOneOrFail({
            id: search.objectId,
            userId,
          }),
        );
        return action && this.actionToSearchItem(action);
      }
      case SearchItemType.Post: {
        const post = await nullIfNotFound(
          this.forumService.findOnePostFull(search.objectId, userId),
        );
        return post && this.postToSearchItem(post);
      }
      case SearchItemType.Recent:
      case SearchItemType.Page:
      case SearchItemType.Other:
        return null;
      default:
        search.objectType satisfies never;
        return null;
    }
  }

  userToSearchItem(user: User, friends: boolean, self: boolean): SearchItem {
    const profile = new ProfileDto(user);
    return {
      id: "u" + user.id,
      name: profile.displayName,
      type: SearchItemType.User,
      webAppLocation: profileUrl(user.id),
      image: profile.profilePicture ?? undefined,
      secondaryData: friends ? ["Friend"] : self ? ["This is you!"] : [],
    };
  }
  actionToSearchItem(action: Action): SearchItem {
    return {
      id: "a" + action.id,
      name: action.name,
      type: SearchItemType.Action,
      webAppLocation: actionUrl(action.id),
      secondaryData: [readableActionStatus[action.status]],
    };
  }
  postToSearchItem(
    post: Pick<Post, "id" | "title" | "createdAt" | "likesIds">,
  ): SearchItem {
    return {
      id: "p" + post.id,
      name: post.title,
      type: SearchItemType.Post,
      webAppLocation: postUrl(post.id),
      secondaryData: [formatDistanceToNow(post.createdAt, { addSuffix: true })],
    };
  }

  async saveSelected(
    item: SaveSearchSelectionDto,
    userId: number,
  ): Promise<void> {
    if (
      item.type === SearchItemType.Other ||
      item.type === SearchItemType.Page
    ) {
      return; //TODO
    }
    const existing = await this.searchRepository.findOne({
      where: {
        objectId: parseInt(item.id.slice(1)),
        objectType: item.type,
        userId,
      },
    });
    if (existing) {
      await this.searchRepository.delete(existing.id);
    }
    await this.searchRepository.save({
      objectId: parseInt(item.id.slice(1)),
      objectType: item.type,
      userId,
    });
  }
}
