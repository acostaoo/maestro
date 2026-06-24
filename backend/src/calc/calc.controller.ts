import { Body, Controller, Post } from '@nestjs/common';
import { CalcService } from './calc.service';
import { CalcRequestDto } from './dto/calc-request.dto';
import type { CalcResult } from './calc-result.interface';

@Controller('calc')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  @Post()
  calculate(@Body() body: CalcRequestDto): CalcResult {
    return this.calcService.calculate(body);
  }
}
