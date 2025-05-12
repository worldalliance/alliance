import { type Options as ClientOptions, type TDataShape, type Client } from '@hey-api/client-fetch';
import type { AppHealthCheckData, AuthLoginData, AuthAdminLoginData, AuthRegisterData, AuthRefreshTokensData, AuthMeData, ActionsCreateData, ActionsJoinData, ActionsMyStatusData, ActionsFindAllData, ActionsRemoveData, ActionsFindOneData, ActionsUpdateData, CommuniquesFindAllData, CommuniquesCreateData, CommuniquesRemoveData, CommuniquesFindOneData, CommuniquesUpdateData, CommuniquesGetReadData, CommuniquesReadData, ImagesUploadImageData, ImagesGetImageData, ImagesDeleteImageData, ForumFindAllPostsData, ForumCreatePostData, ForumFindPostsByActionData, ForumRemovePostData, ForumFindOnePostData, ForumUpdatePostData, ForumCreateReplyData, ForumRemoveReplyData, ForumUpdateReplyData } from './types.gen';
export type Options<TData extends TDataShape = TDataShape, ThrowOnError extends boolean = boolean> = ClientOptions<TData, ThrowOnError> & {
    /**
     * You can provide a client instance returned by `createClient()` instead of
     * individual options. This might be also useful if you want to implement a
     * custom client.
     */
    client?: Client;
    /**
     * You can pass arbitrary values through the `meta` object. This can be
     * used to access values that aren't defined as part of the SDK function.
     */
    meta?: Record<string, unknown>;
};
export declare const appHealthCheck: <ThrowOnError extends boolean = false>(options?: Options<AppHealthCheckData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const authLogin: <ThrowOnError extends boolean = false>(options: Options<AuthLoginData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").SignInResponseDto, unknown, ThrowOnError>;
export declare const authAdminLogin: <ThrowOnError extends boolean = false>(options: Options<AuthAdminLoginData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").SignInResponseDto, unknown, ThrowOnError>;
export declare const authRegister: <ThrowOnError extends boolean = false>(options: Options<AuthRegisterData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const authRefreshTokens: <ThrowOnError extends boolean = false>(options?: Options<AuthRefreshTokensData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").AccessToken, unknown, ThrowOnError>;
export declare const authMe: <ThrowOnError extends boolean = false>(options?: Options<AuthMeData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ProfileDto, unknown, ThrowOnError>;
export declare const actionsCreate: <ThrowOnError extends boolean = false>(options: Options<ActionsCreateData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ActionDto, unknown, ThrowOnError>;
export declare const actionsJoin: <ThrowOnError extends boolean = false>(options: Options<ActionsJoinData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const actionsMyStatus: <ThrowOnError extends boolean = false>(options: Options<ActionsMyStatusData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").UserActionDto, unknown, ThrowOnError>;
export declare const actionsFindAll: <ThrowOnError extends boolean = false>(options?: Options<ActionsFindAllData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ActionDto[], unknown, ThrowOnError>;
export declare const actionsRemove: <ThrowOnError extends boolean = false>(options: Options<ActionsRemoveData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const actionsFindOne: <ThrowOnError extends boolean = false>(options: Options<ActionsFindOneData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ActionDto, unknown, ThrowOnError>;
export declare const actionsUpdate: <ThrowOnError extends boolean = false>(options: Options<ActionsUpdateData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const communiquesFindAll: <ThrowOnError extends boolean = false>(options?: Options<CommuniquesFindAllData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").CommuniqueDto[], unknown, ThrowOnError>;
export declare const communiquesCreate: <ThrowOnError extends boolean = false>(options: Options<CommuniquesCreateData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").CreateCommuniqueDto, unknown, ThrowOnError>;
export declare const communiquesRemove: <ThrowOnError extends boolean = false>(options: Options<CommuniquesRemoveData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<boolean, unknown, ThrowOnError>;
export declare const communiquesFindOne: <ThrowOnError extends boolean = false>(options: Options<CommuniquesFindOneData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").CommuniqueDto, unknown, ThrowOnError>;
export declare const communiquesUpdate: <ThrowOnError extends boolean = false>(options: Options<CommuniquesUpdateData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").CommuniqueDto, unknown, ThrowOnError>;
export declare const communiquesGetRead: <ThrowOnError extends boolean = false>(options: Options<CommuniquesGetReadData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ReadResultDto, unknown, ThrowOnError>;
export declare const communiquesRead: <ThrowOnError extends boolean = false>(options: Options<CommuniquesReadData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
export declare const imagesUploadImage: <ThrowOnError extends boolean = false>(options: Options<ImagesUploadImageData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ImageResponseDto, unknown, ThrowOnError>;
export declare const imagesGetImage: <ThrowOnError extends boolean = false>(options: Options<ImagesGetImageData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<Blob | File, unknown, ThrowOnError>;
export declare const imagesDeleteImage: <ThrowOnError extends boolean = false>(options: Options<ImagesDeleteImageData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").DeleteImageResponseDto, unknown, ThrowOnError>;
/**
 * Get all forum posts
 */
export declare const forumFindAllPosts: <ThrowOnError extends boolean = false>(options?: Options<ForumFindAllPostsData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").PostDto[], unknown, ThrowOnError>;
/**
 * Create a new forum post
 */
export declare const forumCreatePost: <ThrowOnError extends boolean = false>(options: Options<ForumCreatePostData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").PostDto, unknown, ThrowOnError>;
/**
 * Get posts for a specific action
 */
export declare const forumFindPostsByAction: <ThrowOnError extends boolean = false>(options: Options<ForumFindPostsByActionData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").PostDto[], unknown, ThrowOnError>;
/**
 * Delete a post
 */
export declare const forumRemovePost: <ThrowOnError extends boolean = false>(options: Options<ForumRemovePostData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
/**
 * Get a specific post with its replies
 */
export declare const forumFindOnePost: <ThrowOnError extends boolean = false>(options: Options<ForumFindOnePostData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").PostDto, unknown, ThrowOnError>;
/**
 * Update a post
 */
export declare const forumUpdatePost: <ThrowOnError extends boolean = false>(options: Options<ForumUpdatePostData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").PostDto, unknown, ThrowOnError>;
/**
 * Create a new reply to a post
 */
export declare const forumCreateReply: <ThrowOnError extends boolean = false>(options: Options<ForumCreateReplyData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").Reply, unknown, ThrowOnError>;
/**
 * Delete a reply
 */
export declare const forumRemoveReply: <ThrowOnError extends boolean = false>(options: Options<ForumRemoveReplyData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<unknown, unknown, ThrowOnError>;
/**
 * Update a reply
 */
export declare const forumUpdateReply: <ThrowOnError extends boolean = false>(options: Options<ForumUpdateReplyData, ThrowOnError>) => import("@hey-api/client-fetch").RequestResult<import("./types.gen").ReplyDto, unknown, ThrowOnError>;
