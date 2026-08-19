import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  adjustInventorySchema,
  createInventoryItemSchema,
  createRecipeSchema,
  inventoryItemKindSchema,
  recordVisitMaterialsSchema,
  updateInventoryItemSchema,
} from '@aesthetic/shared';

import type { AuthenticatedMembership } from '../auth/auth.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { TenantContext } from '../tenants/tenant-context.js';
import { InventoryService } from './inventory.service.js';

type AuthRequest = {
  tenantContext?: TenantContext;
  authMembership?: AuthenticatedMembership;
};

@Controller('v1')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get('inventory/items')
  listItems(
    @Req() request: AuthRequest,
    @Query('kind') kind?: string,
  ) {
    const parsed = kind ? inventoryItemKindSchema.parse(kind) : undefined;
    return this.inventory.listItems(this.context(request).tenantId, parsed);
  }

  @Post('inventory/items')
  createItem(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createInventoryItemSchema.parse(body);
    return this.inventory.createItem(this.context(request), input);
  }

  @Patch('inventory/items/:id')
  updateItem(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateInventoryItemSchema.parse(body);
    return this.inventory.updateItem(this.context(request), id, input);
  }

  @Delete('inventory/items/:id')
  deleteItem(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.inventory.softDeleteItem(this.context(request), id);
  }

  @Post('inventory/items/:id/adjust')
  adjust(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = adjustInventorySchema.parse(body);
    return this.inventory.adjustStock(this.membership(request), id, input);
  }

  @Get('inventory/recipes')
  listRecipes(
    @Req() request: AuthRequest,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.inventory.listRecipes(this.context(request).tenantId, serviceId);
  }

  @Post('inventory/recipes')
  createRecipe(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = createRecipeSchema.parse(body);
    return this.inventory.createRecipe(this.context(request), input);
  }

  @Get('inventory/low-stock')
  lowStock(@Req() request: AuthRequest) {
    return this.inventory.listLowStock(this.context(request).tenantId);
  }

  @Get('appointments/:id/materials')
  listVisitMaterials(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.inventory.listVisitMaterials(this.context(request).tenantId, id);
  }

  @Post('appointments/:id/materials')
  recordVisitMaterials(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = recordVisitMaterialsSchema.parse(body);
    return this.inventory.consumeForVisit(this.membership(request), id, input);
  }

  private context(request: AuthRequest): TenantContext {
    if (!request.tenantContext) {
      throw new Error('Tenant context missing.');
    }
    return request.tenantContext;
  }

  private membership(request: AuthRequest): AuthenticatedMembership {
    if (!request.authMembership) {
      throw new Error('Auth membership missing.');
    }
    return request.authMembership;
  }
}
