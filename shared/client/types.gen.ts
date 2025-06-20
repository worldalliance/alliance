// This file is auto-generated by @hey-api/openapi-ts

export type SignInDto = {
    email: string;
    password: string;
    mode: 'cookie' | 'header';
};

export type SignInResponseDto = {
    isAdmin: boolean;
    access_token: string;
    refresh_token: string;
};

export type SignUpDto = {
    name: string;
    email: string;
    password: string;
    mode: 'cookie' | 'header';
    referralCode?: string;
};

export type AccessToken = {
    access_token: string;
};

export type UserDto = {
    id: number;
    name: string;
    email: string;
    admin: boolean;
    referralCode: string | null;
    onboardingComplete: boolean;
};

export type ForgotPasswordDto = {
    email: string;
};

export type ResetPasswordDto = {
    token: string;
    password: string;
};

export type ProfileDto = {
    id: number;
    name: string;
    email: string;
    admin: boolean;
    profilePicture: string | null;
    profileDescription: string | null;
};

export type OnboardingDto = {
    cityId: number | null;
    over18: boolean | null;
    makesMoney: boolean | null;
};

export type UpdateProfileDto = {
    id?: number;
    name?: string;
    email?: string;
    admin?: boolean;
    profilePicture?: string | null;
    profileDescription?: string | null;
};

export type City = {
    id: number;
    name: string;
    admin1: string;
    admin2: string;
    countryCode: string;
    countryName: string;
    latitude: number;
    longitude: number;
};

export type FriendStatusDto = {
    status: 'pending' | 'accepted' | 'declined' | 'none';
};

export type UserActionDto = {
    status: 'completed' | 'joined' | 'seen' | 'declined' | 'none';
    dateCommitted: string;
    dateCompleted: string;
    deadline: string;
};

export type ActionEventDto = {
    /**
     * Unique identifier for the action event
     */
    id: number;
    /**
     * Title of the event
     */
    title: string;
    /**
     * secondary text
     */
    description: string;
    /**
     * New status of the action after the event
     */
    newStatus: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Notification type for the event
     */
    sendNotifsTo: 'all' | 'joined' | 'none';
    /**
     * time of the event (for display)
     */
    date: string;
    /**
     * Indicates whether the event should be shown in the timeline
     */
    showInTimeline: boolean;
};

export type ActionDto = {
    /**
     * Unique identifier for the action
     */
    id: number;
    /**
     * Name of the action
     */
    name: string;
    /**
     * Category of the action
     */
    category: string;
    /**
     * Reason to join the action
     */
    whyJoin: string;
    /**
     * Image URL for the action
     */
    image: string | null;
    /**
     * Description of the action
     */
    description: string;
    /**
     * Short description shown in cards
     */
    shortDescription: string;
    /**
     * Steps to complete the action
     */
    howTo: string;
    timeEstimate: string;
    /**
     * Current status of the action
     */
    status: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Type of the action
     */
    type: 'Funding' | 'Activity' | 'Ongoing';
    /**
     * Number of users who have joined the action
     */
    usersJoined: number;
    /**
     * Number of users who have completed the action
     */
    usersCompleted: number;
    myRelation: UserActionDto;
    events: Array<ActionEventDto>;
};

export type LatLonDto = {
    latitude: number;
    longitude: number;
};

export type CreateActionDto = {
    /**
     * Name of the action
     */
    name: string;
    /**
     * Category of the action
     */
    category: string;
    /**
     * Reason to join the action
     */
    whyJoin: string;
    /**
     * Image URL for the action
     */
    image: string | null;
    /**
     * Description of the action
     */
    description: string;
    /**
     * Short description shown in cards
     */
    shortDescription: string;
    /**
     * Steps to complete the action
     */
    howTo: string;
    timeEstimate: string;
    /**
     * Current status of the action
     */
    status: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Type of the action
     */
    type: 'Funding' | 'Activity' | 'Ongoing';
};

export type UpdateActionDto = {
    /**
     * Name of the action
     */
    name?: string;
    /**
     * Category of the action
     */
    category?: string;
    /**
     * Reason to join the action
     */
    whyJoin?: string;
    /**
     * Image URL for the action
     */
    image?: string | null;
    /**
     * Description of the action
     */
    description?: string;
    /**
     * Short description shown in cards
     */
    shortDescription?: string;
    /**
     * Steps to complete the action
     */
    howTo?: string;
    timeEstimate?: string;
    /**
     * Current status of the action
     */
    status?: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Type of the action
     */
    type?: 'Funding' | 'Activity' | 'Ongoing';
};

export type ActionWithRelationDto = {
    /**
     * Unique identifier for the action
     */
    id: number;
    /**
     * Name of the action
     */
    name: string;
    /**
     * Category of the action
     */
    category: string;
    /**
     * Reason to join the action
     */
    whyJoin: string;
    /**
     * Image URL for the action
     */
    image: string | null;
    /**
     * Description of the action
     */
    description: string;
    /**
     * Short description shown in cards
     */
    shortDescription: string;
    /**
     * Steps to complete the action
     */
    howTo: string;
    timeEstimate: string;
    /**
     * Current status of the action
     */
    status: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Type of the action
     */
    type: 'Funding' | 'Activity' | 'Ongoing';
    /**
     * Number of users who have joined the action
     */
    usersJoined: number;
    /**
     * Number of users who have completed the action
     */
    usersCompleted: number;
    events: Array<ActionEventDto>;
    relation: UserActionDto;
};

export type CreateActionEventDto = {
    /**
     * Title of the event
     */
    title: string;
    /**
     * secondary text
     */
    description: string;
    /**
     * New status of the action after the event
     */
    newStatus: 'active' | 'upcoming' | 'past' | 'draft';
    /**
     * Notification type for the event
     */
    sendNotifsTo: 'all' | 'joined' | 'none';
    /**
     * time of the event (for display)
     */
    date: string;
    /**
     * Indicates whether the event should be shown in the timeline
     */
    showInTimeline: boolean;
};

export type CreateCommuniqueDto = {
    title: string;
    bodyText: string;
    headerImage: string | null;
    dateCreated: string;
};

export type CommuniqueDto = {
    id: number;
    title: string;
    bodyText: string;
    headerImage: string | null;
    dateCreated: string;
};

export type UpdateCommuniqueDto = {
    title?: string;
    bodyText?: string;
    headerImage?: string | null;
    dateCreated?: string;
};

export type ReadResultDto = {
    read: boolean;
};

export type ImageResponseDto = {
    id: number;
    filename: string;
};

export type DeleteImageResponseDto = {
    deleted: boolean;
};

export type CreatePostDto = {
    title: string;
    content: string;
    actionId?: number;
};

export type MinimalUserDto = {
    id: number;
    name: string;
    email: string;
};

export type ReplyDto = {
    id: number;
    content: string;
    postId: number;
    createdAt: string;
    updatedAt: string;
    author: UserDto;
};

export type PostDto = {
    id: number;
    title: string;
    content: string;
    authorId: number;
    actionId?: number;
    createdAt: string;
    updatedAt: string;
    action?: ActionDto;
    author: MinimalUserDto;
    replies: Array<ReplyDto>;
};

export type UpdatePostDto = {
    title?: string;
    content?: string;
    actionId?: number;
};

export type CreateReplyDto = {
    content: string;
    postId: number;
};

export type UpdateReplyDto = {
    content?: string;
    postId?: number;
};

export type NotificationDto = {
    id: number;
    category: string;
    message: string;
    webAppLocation: string;
    mobileAppLocation: string;
    read: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CitySearchDto = {
    id: number;
    name: string;
    admin1: string;
    countryCode: string;
    countryName: string;
};

export type AppHealthCheckData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/';
};

export type AppHealthCheckResponses = {
    200: unknown;
};

export type AuthLoginData = {
    body: SignInDto;
    path?: never;
    query?: never;
    url: '/auth/login';
};

export type AuthLoginErrors = {
    401: unknown;
};

export type AuthLoginResponses = {
    200: SignInResponseDto;
};

export type AuthLoginResponse = AuthLoginResponses[keyof AuthLoginResponses];

export type AuthAdminLoginData = {
    body: SignInDto;
    path?: never;
    query?: never;
    url: '/auth/admin/login';
};

export type AuthAdminLoginErrors = {
    401: unknown;
};

export type AuthAdminLoginResponses = {
    200: SignInResponseDto;
};

export type AuthAdminLoginResponse = AuthAdminLoginResponses[keyof AuthAdminLoginResponses];

export type AuthRegisterData = {
    body: SignUpDto;
    path?: never;
    query?: never;
    url: '/auth/register';
};

export type AuthRegisterErrors = {
    401: unknown;
};

export type AuthRegisterResponses = {
    /**
     * User created successfully
     */
    201: SignInResponseDto;
};

export type AuthRegisterResponse = AuthRegisterResponses[keyof AuthRegisterResponses];

export type AuthRefreshTokensData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/auth/refresh';
};

export type AuthRefreshTokensResponses = {
    200: AccessToken;
};

export type AuthRefreshTokensResponse = AuthRefreshTokensResponses[keyof AuthRefreshTokensResponses];

export type AuthMeData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/auth/me';
};

export type AuthMeResponses = {
    200: UserDto;
};

export type AuthMeResponse = AuthMeResponses[keyof AuthMeResponses];

export type AuthLogoutData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/auth/logout';
};

export type AuthLogoutResponses = {
    200: unknown;
};

export type AuthForgotPasswordData = {
    body: ForgotPasswordDto;
    path?: never;
    query?: never;
    url: '/auth/forgot-password';
};

export type AuthForgotPasswordResponses = {
    200: unknown;
};

export type AuthResetPasswordData = {
    body: ResetPasswordDto;
    path?: never;
    query?: never;
    url: '/auth/reset-password';
};

export type AuthResetPasswordResponses = {
    200: unknown;
};

export type UserFindMeData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/user/me';
};

export type UserFindMeErrors = {
    401: unknown;
};

export type UserFindMeResponses = {
    200: ProfileDto;
};

export type UserFindMeResponse = UserFindMeResponses[keyof UserFindMeResponses];

export type UserOnboardingData = {
    body: OnboardingDto;
    path?: never;
    query?: never;
    url: '/user/onboarding';
};

export type UserOnboardingErrors = {
    401: unknown;
};

export type UserOnboardingResponses = {
    200: ProfileDto;
};

export type UserOnboardingResponse = UserOnboardingResponses[keyof UserOnboardingResponses];

export type UserUpdateData = {
    body: UpdateProfileDto;
    path?: never;
    query?: never;
    url: '/user/update';
};

export type UserUpdateResponses = {
    201: unknown;
};

export type UserMyLocationData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/user/mylocation';
};

export type UserMyLocationResponses = {
    200: City;
};

export type UserMyLocationResponse = UserMyLocationResponses[keyof UserMyLocationResponses];

export type UserRemoveFriendData = {
    body?: never;
    path: {
        targetUserId: number;
    };
    query?: never;
    url: '/user/friends/{targetUserId}';
};

export type UserRemoveFriendResponses = {
    /**
     * Relationship removed
     */
    200: unknown;
};

export type UserRequestFriendData = {
    body?: never;
    path: {
        targetUserId: number;
    };
    query?: never;
    url: '/user/friends/{targetUserId}';
};

export type UserRequestFriendResponses = {
    /**
     * Friend request is now pending
     */
    200: unknown;
};

export type UserAcceptFriendRequestData = {
    body?: never;
    path: {
        requesterId: number;
    };
    query?: never;
    url: '/user/friends/{requesterId}/accept';
};

export type UserAcceptFriendRequestResponses = {
    /**
     * Friend request accepted
     */
    200: unknown;
};

export type UserDeclineFriendRequestData = {
    body?: never;
    path: {
        requesterId: number;
    };
    query?: never;
    url: '/user/friends/{requesterId}/decline';
};

export type UserDeclineFriendRequestResponses = {
    /**
     * Friend request declined
     */
    200: unknown;
};

export type UserListReceivedRequestsData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/user/friends/requests/received';
};

export type UserListReceivedRequestsResponses = {
    200: Array<UserDto>;
};

export type UserListReceivedRequestsResponse = UserListReceivedRequestsResponses[keyof UserListReceivedRequestsResponses];

export type UserListSentRequestsData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/user/friends/requests/sent';
};

export type UserListSentRequestsResponses = {
    200: Array<UserDto>;
};

export type UserListSentRequestsResponse = UserListSentRequestsResponses[keyof UserListSentRequestsResponses];

export type UserMyFriendRelationshipData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/user/myfriendrelationship/{id}';
};

export type UserMyFriendRelationshipResponses = {
    200: FriendStatusDto;
};

export type UserMyFriendRelationshipResponse = UserMyFriendRelationshipResponses[keyof UserMyFriendRelationshipResponses];

export type UserPrefillData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/user/prefill/{id}';
};

export type UserPrefillErrors = {
    401: unknown;
};

export type UserPrefillResponses = {
    200: ProfileDto;
};

export type UserPrefillResponse = UserPrefillResponses[keyof UserPrefillResponses];

export type UserListFriendsData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/user/listfriends/{id}';
};

export type UserListFriendsResponses = {
    200: Array<UserDto>;
};

export type UserListFriendsResponse = UserListFriendsResponses[keyof UserListFriendsResponses];

export type UserCountReferredData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/user/countreferred/{id}';
};

export type UserCountReferredResponses = {
    200: number;
};

export type UserCountReferredResponse = UserCountReferredResponses[keyof UserCountReferredResponses];

export type UserFindOneData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/user/{id}';
};

export type UserFindOneErrors = {
    401: unknown;
};

export type UserFindOneResponses = {
    200: ProfileDto;
};

export type UserFindOneResponse = UserFindOneResponses[keyof UserFindOneResponses];

export type ActionsJoinData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/actions/join/{id}';
};

export type ActionsJoinResponses = {
    201: unknown;
};

export type ActionsCompleteData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/actions/complete/{id}';
};

export type ActionsCompleteResponses = {
    201: unknown;
};

export type ActionsMyStatusData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/actions/myStatus/{id}';
};

export type ActionsMyStatusResponses = {
    200: UserActionDto;
};

export type ActionsMyStatusResponse = ActionsMyStatusResponses[keyof ActionsMyStatusResponses];

export type ActionsFindAllWithStatusData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/actions/withStatus';
};

export type ActionsFindAllWithStatusResponses = {
    200: Array<ActionDto>;
};

export type ActionsFindAllWithStatusResponse = ActionsFindAllWithStatusResponses[keyof ActionsFindAllWithStatusResponses];

export type ActionsFindAllPublicData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/actions';
};

export type ActionsFindAllPublicResponses = {
    200: Array<ActionDto>;
};

export type ActionsFindAllPublicResponse = ActionsFindAllPublicResponses[keyof ActionsFindAllPublicResponses];

export type ActionsUserLocationsData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/userlocations/{id}';
};

export type ActionsUserLocationsResponses = {
    200: Array<LatLonDto>;
};

export type ActionsUserLocationsResponse = ActionsUserLocationsResponses[keyof ActionsUserLocationsResponses];

export type ActionsFindAllWithDraftsData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/actions/all';
};

export type ActionsFindAllWithDraftsResponses = {
    200: Array<ActionDto>;
};

export type ActionsFindAllWithDraftsResponse = ActionsFindAllWithDraftsResponses[keyof ActionsFindAllWithDraftsResponses];

export type ActionsSseActionCountData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/live/{id}';
};

export type ActionsSseActionCountResponses = {
    200: unknown;
};

export type ActionsLiveListData = {
    body?: never;
    path?: never;
    query: {
        ids: string;
    };
    url: '/actions/live-list';
};

export type ActionsLiveListResponses = {
    200: unknown;
};

export type ActionsOpengraphData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/actions/opengraph';
};

export type ActionsOpengraphResponses = {
    200: string;
};

export type ActionsOpengraphResponse = ActionsOpengraphResponses[keyof ActionsOpengraphResponses];

export type ActionsRemoveData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/{id}';
};

export type ActionsRemoveResponses = {
    200: unknown;
};

export type ActionsFindOneData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/{id}';
};

export type ActionsFindOneErrors = {
    401: unknown;
};

export type ActionsFindOneResponses = {
    200: ActionDto;
};

export type ActionsFindOneResponse = ActionsFindOneResponses[keyof ActionsFindOneResponses];

export type ActionsUpdateData = {
    body: UpdateActionDto;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/{id}';
};

export type ActionsUpdateResponses = {
    200: unknown;
};

export type ActionsCreateData = {
    body: CreateActionDto;
    path?: never;
    query?: never;
    url: '/actions/create';
};

export type ActionsCreateResponses = {
    200: ActionDto;
};

export type ActionsCreateResponse = ActionsCreateResponses[keyof ActionsCreateResponses];

export type ActionsFindCompletedForUserData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/completed/{id}';
};

export type ActionsFindCompletedForUserResponses = {
    200: Array<ActionWithRelationDto>;
};

export type ActionsFindCompletedForUserResponse = ActionsFindCompletedForUserResponses[keyof ActionsFindCompletedForUserResponses];

export type ActionsAddEventData = {
    body: CreateActionEventDto;
    path: {
        id: number;
    };
    query?: never;
    url: '/actions/{id}/events';
};

export type ActionsAddEventResponses = {
    200: ActionDto;
};

export type ActionsAddEventResponse = ActionsAddEventResponses[keyof ActionsAddEventResponses];

export type CommuniquesFindAllData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/communiques';
};

export type CommuniquesFindAllResponses = {
    200: Array<CommuniqueDto>;
};

export type CommuniquesFindAllResponse = CommuniquesFindAllResponses[keyof CommuniquesFindAllResponses];

export type CommuniquesCreateData = {
    body: CreateCommuniqueDto;
    path?: never;
    query?: never;
    url: '/communiques';
};

export type CommuniquesCreateResponses = {
    201: CreateCommuniqueDto;
};

export type CommuniquesCreateResponse = CommuniquesCreateResponses[keyof CommuniquesCreateResponses];

export type CommuniquesRemoveData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/communiques/{id}';
};

export type CommuniquesRemoveResponses = {
    200: boolean;
};

export type CommuniquesRemoveResponse = CommuniquesRemoveResponses[keyof CommuniquesRemoveResponses];

export type CommuniquesFindOneData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/communiques/{id}';
};

export type CommuniquesFindOneResponses = {
    200: CommuniqueDto;
};

export type CommuniquesFindOneResponse = CommuniquesFindOneResponses[keyof CommuniquesFindOneResponses];

export type CommuniquesUpdateData = {
    body: UpdateCommuniqueDto;
    path: {
        id: string;
    };
    query?: never;
    url: '/communiques/{id}';
};

export type CommuniquesUpdateResponses = {
    200: CommuniqueDto;
};

export type CommuniquesUpdateResponse = CommuniquesUpdateResponses[keyof CommuniquesUpdateResponses];

export type CommuniquesGetReadData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/communiques/{id}/read';
};

export type CommuniquesGetReadResponses = {
    200: ReadResultDto;
};

export type CommuniquesGetReadResponse = CommuniquesGetReadResponses[keyof CommuniquesGetReadResponses];

export type CommuniquesReadData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/communiques/{id}/read';
};

export type CommuniquesReadResponses = {
    200: unknown;
};

export type ImagesUploadImageData = {
    body: {
        image?: Blob | File;
    };
    path?: never;
    query?: never;
    url: '/images/upload';
};

export type ImagesUploadImageResponses = {
    201: ImageResponseDto;
};

export type ImagesUploadImageResponse = ImagesUploadImageResponses[keyof ImagesUploadImageResponses];

export type ImagesGetImageData = {
    body?: never;
    path: {
        filename: string;
    };
    query?: never;
    url: '/images/{filename}';
};

export type ImagesGetImageResponses = {
    /**
     * Returns an image file
     */
    200: Blob | File;
};

export type ImagesGetImageResponse = ImagesGetImageResponses[keyof ImagesGetImageResponses];

export type ImagesDeleteImageData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/images/{id}';
};

export type ImagesDeleteImageResponses = {
    200: DeleteImageResponseDto;
};

export type ImagesDeleteImageResponse = ImagesDeleteImageResponses[keyof ImagesDeleteImageResponses];

export type ForumFindAllPostsData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/forum/posts';
};

export type ForumFindAllPostsResponses = {
    200: Array<PostDto>;
};

export type ForumFindAllPostsResponse = ForumFindAllPostsResponses[keyof ForumFindAllPostsResponses];

export type ForumCreatePostData = {
    body: CreatePostDto;
    path?: never;
    query?: never;
    url: '/forum/posts';
};

export type ForumCreatePostResponses = {
    200: PostDto;
};

export type ForumCreatePostResponse = ForumCreatePostResponses[keyof ForumCreatePostResponses];

export type ForumFindPostsByActionData = {
    body?: never;
    path: {
        actionId: string;
    };
    query?: never;
    url: '/forum/posts/action/{actionId}';
};

export type ForumFindPostsByActionResponses = {
    200: Array<PostDto>;
};

export type ForumFindPostsByActionResponse = ForumFindPostsByActionResponses[keyof ForumFindPostsByActionResponses];

export type ForumRemovePostData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/forum/posts/{id}';
};

export type ForumRemovePostResponses = {
    200: unknown;
};

export type ForumFindOnePostData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/forum/posts/{id}';
};

export type ForumFindOnePostResponses = {
    200: PostDto;
};

export type ForumFindOnePostResponse = ForumFindOnePostResponses[keyof ForumFindOnePostResponses];

export type ForumUpdatePostData = {
    body: UpdatePostDto;
    path: {
        id: string;
    };
    query?: never;
    url: '/forum/posts/{id}';
};

export type ForumUpdatePostResponses = {
    200: PostDto;
};

export type ForumUpdatePostResponse = ForumUpdatePostResponses[keyof ForumUpdatePostResponses];

export type ForumFindPostsByUserData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/forum/posts/user/{id}';
};

export type ForumFindPostsByUserResponses = {
    200: Array<PostDto>;
};

export type ForumFindPostsByUserResponse = ForumFindPostsByUserResponses[keyof ForumFindPostsByUserResponses];

export type ForumCreateReplyData = {
    body: CreateReplyDto;
    path?: never;
    query?: never;
    url: '/forum/replies';
};

export type ForumCreateReplyResponses = {
    200: ReplyDto;
};

export type ForumCreateReplyResponse = ForumCreateReplyResponses[keyof ForumCreateReplyResponses];

export type ForumRemoveReplyData = {
    body?: never;
    path: {
        id: string;
    };
    query?: never;
    url: '/forum/replies/{id}';
};

export type ForumRemoveReplyResponses = {
    200: unknown;
};

export type ForumUpdateReplyData = {
    body: UpdateReplyDto;
    path: {
        id: string;
    };
    query?: never;
    url: '/forum/replies/{id}';
};

export type ForumUpdateReplyResponses = {
    200: ReplyDto;
};

export type ForumUpdateReplyResponse = ForumUpdateReplyResponses[keyof ForumUpdateReplyResponses];

export type NotifsFindAllData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/notifs';
};

export type NotifsFindAllResponses = {
    200: Array<NotificationDto>;
};

export type NotifsFindAllResponse = NotifsFindAllResponses[keyof NotifsFindAllResponses];

export type NotifsSetReadData = {
    body?: never;
    path: {
        id: number;
    };
    query?: never;
    url: '/notifs/read/{id}';
};

export type NotifsSetReadResponses = {
    200: unknown;
};

export type GeoSearchCityData = {
    body?: never;
    path?: never;
    query: {
        query: string;
        latitude?: number;
        longitude?: number;
    };
    url: '/geo/search-city';
};

export type GeoSearchCityResponses = {
    default: Array<CitySearchDto>;
};

export type GeoSearchCityResponse = GeoSearchCityResponses[keyof GeoSearchCityResponses];

export type GeoLoadCountryDataData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/geo/load-country-data';
};

export type GeoLoadCountryDataResponses = {
    200: unknown;
};

export type GeoLoadCityDataData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/geo/ip';
};

export type GeoLoadCityDataResponses = {
    200: unknown;
};

export type ClientOptions = {
    baseUrl: string;
};