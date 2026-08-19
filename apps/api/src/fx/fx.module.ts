import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DolarApiClient } from './dolar-api.client.js';
import { FxRateCache } from './fx-rate.cache.js';
import { FxController } from './fx.controller.js';
import { FxRepository } from './fx.repository.js';
import { FxService } from './fx.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [FxController],
  providers: [DolarApiClient, FxRateCache, FxRepository, FxService],
  exports: [FxService],
})
export class FxModule {}
