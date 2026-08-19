import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { HealthController } from './health.controller.js';
import { IdempotencyService } from './idempotency.service.js';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class CommonModule {}
