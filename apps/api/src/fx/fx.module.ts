import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { TenantContextGuard } from '../tenants/tenant-context.js';
import { DolarApiClient } from './dolar-api.client.js';
import { FxRateCache } from './fx-rate.cache.js';
import { FxController } from './fx.controller.js';
import { FxRepository } from './fx.repository.js';
import { FxService } from './fx.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [FxController],
  providers: [
    DolarApiClient,
    FxRateCache,
    FxRepository,
    FxService,
    TenantContextGuard,
  ],
  exports: [FxService],
})
export class FxModule {}
