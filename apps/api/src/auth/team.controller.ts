import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { inviteMemberSchema, updateMemberSchema } from '@aesthetic/shared';

import { AuthGuard } from './auth.guard.js';
import { AuthService, type AuthenticatedMembership } from './auth.service.js';

type AuthRequest = { authMembership?: AuthenticatedMembership };

@Controller('v1/team')
@UseGuards(AuthGuard)
export class TeamController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('members')
  listMembers(@Req() request: AuthRequest) {
    return this.auth.listMembers(this.membership(request));
  }

  @Post('members')
  inviteMember(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = inviteMemberSchema.parse(body);
    return this.auth.inviteMember(this.membership(request), input);
  }

  @Patch('members/:id')
  updateMember(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = updateMemberSchema.parse(body);
    return this.auth.updateMember(this.membership(request), id, input);
  }

  private membership(request: AuthRequest): AuthenticatedMembership {
    if (!request.authMembership) {
      throw new Error('Auth membership was not attached by the auth guard.');
    }
    return request.authMembership;
  }
}
