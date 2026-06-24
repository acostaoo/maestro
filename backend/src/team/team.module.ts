import { Module } from '@nestjs/common';
import { VisionModule } from '../vision/vision.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [VisionModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
