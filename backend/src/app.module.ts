import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalcModule } from './calc/calc.module';

@Module({
  imports: [CalcModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
