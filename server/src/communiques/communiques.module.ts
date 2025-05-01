import { Module } from '@nestjs/common';
import { CommuniquesService } from './communiques.service';
import { CommuniquesController } from './communiques.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Communique } from './entities/communique.entity';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports: [
    TypeOrmModule.forFeature([Communique]),
    TypeOrmModule.forFeature([User]),
    UserModule,
    JwtModule,
  ],
  controllers: [CommuniquesController],
  providers: [CommuniquesService],
})
export class CommuniquesModule {}
