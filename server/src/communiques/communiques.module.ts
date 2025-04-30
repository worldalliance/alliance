import { Module } from '@nestjs/common';
import { CommuniquesService } from './communiques.service';
import { CommuniquesController } from './communiques.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Communique } from './entities/communique.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Communique])],
  controllers: [CommuniquesController],
  providers: [CommuniquesService],
})
export class CommuniquesModule {}
