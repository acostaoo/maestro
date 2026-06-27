import { Body, Controller, Post } from '@nestjs/common';
import { AskRequestDto } from './dto/ask-request.dto';
import { OrchestratorService } from './orchestrator.service';
import type { AskResult } from './orchestrator.types';

@Controller('ask')
export class OrchestratorController {
  constructor(private readonly orchestrator: OrchestratorService) {}

  @Post()
  async ask(@Body() body: AskRequestDto): Promise<AskResult> {
    return this.orchestrator.ask(body.text);
  }
}
