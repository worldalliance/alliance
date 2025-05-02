import { PickType } from '@nestjs/swagger';
import { Reply } from '../entities/reply.entity';

export class CreateReplyDto extends PickType(Reply, ['content', 'postId']) {}
