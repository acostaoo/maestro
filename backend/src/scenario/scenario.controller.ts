import { Body, Controller, Post } from '@nestjs/common';
import { ScenarioRequestDto } from './dto/scenario-request.dto';
import { ScenarioService } from './scenario.service';
import type { ScenarioResult } from './scenario.types';

@Controller('scenario')
export class ScenarioController {
  constructor(private readonly scenario: ScenarioService) {}

  @Post()
  run(@Body() body: ScenarioRequestDto): ScenarioResult {
    return this.scenario.run(body);
  }
}
