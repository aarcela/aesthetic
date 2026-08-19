import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CommonModule } from '../common/common.module.js';
import { CommissionsModule } from '../commissions/commissions.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FxModule } from '../fx/fx.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PosController } from './pos.controller.js';
import { PosService } from './pos.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    FxModule,
    PlansModule,
    SettingsModule,
    InventoryModule,
    CommissionsModule,
    CommonModule,
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
