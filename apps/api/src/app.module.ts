import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { ClinicCoreModule } from './clinic/clinic-core.module.js';
import { CommonModule } from './common/common.module.js';
import { CommissionsModule } from './commissions/commissions.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { FxModule } from './fx/fx.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MediaModule } from './media/media.module.js';
import { PlansModule } from './plans/plans.module.js';
import { PosModule } from './pos/pos.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    PlansModule,
    SettingsModule,
    ClinicCoreModule,
    SchedulingModule,
    PosModule,
    FinanceModule,
    FxModule,
    InventoryModule,
    CommissionsModule,
    MediaModule,
  ],
})
export class AppModule {}
