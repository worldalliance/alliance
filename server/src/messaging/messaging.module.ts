import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { ImagesModule } from "src/images/images.module";
import { PushModule } from "src/push/push.module";
import { Friend } from "src/user/entities/friend.entity";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { CommunityConversationService } from "./community-conversation.service";
import { ConversationCreationService } from "./conversation-creation.service";
import { ConversationMembershipService } from "./conversation-membership.service";
import { ConversationUnreadService } from "./conversation-unread.service";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { Conversation } from "./entities/conversation.entity";
import { Message } from "./entities/message.entity";
import { Participant } from "./entities/participant.entity";
import { MessagePushListener } from "./message-push.listener";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { MessagingGateway } from "./messaging.gateway";
import { MessagingOverviewGateway } from "./messaging.overview.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      Participant,
      Community,
      User,
      Friend,
    ]),
    forwardRef(() => UserModule),
    ImagesModule,
    PushModule,
  ],
  controllers: [ConversationController, MessageController],
  providers: [
    CommunityConversationService,
    ConversationCreationService,
    ConversationMembershipService,
    ConversationService,
    ConversationUnreadService,
    MessageService,
    MessagingGateway,
    MessagingOverviewGateway,
    MessagePushListener,
  ],
  exports: [CommunityConversationService],
})
export class MessagingModule {}
