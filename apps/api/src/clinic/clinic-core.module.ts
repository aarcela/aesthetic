import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MediaModule } from '../media/media.module.js';
import { ClinicCoreController } from './clinic-core.controller.js';
import { ClinicCoreService } from './clinic-core.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, MediaModule],
  controllers: [ClinicCoreController],
  providers: [ClinicCoreService],
  exports: [ClinicCoreService],
})
export class ClinicCoreModule {}
