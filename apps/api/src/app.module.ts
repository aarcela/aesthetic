import { Module } from '@nestjs/common';

import { FxModule } from './fx/fx.module.js';

@Module({
  imports: [FxModule],
})
export class AppModule {}
