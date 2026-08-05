import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { FacepileService } from './facepile.service';
import { LikeOrderFunctionService } from './like-order-function.service';

/**
 * Owns the `likeOrderRank` SQL function its query depends on, so every module
 * that imports this one gets the function installed.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [FacepileService, LikeOrderFunctionService],
  exports: [FacepileService],
})
export class FacepileModule {}
