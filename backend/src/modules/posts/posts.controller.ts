import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PostType, Role } from '@prisma/client';
import { PostsService } from './posts.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('posts')
@UseGuards(RolesGuard)
export class PostsController {
  constructor(private posts: PostsService) {}

  @Public()
  @Get('feed')
  feed(
    @Query('childId') childId?: string,
    @Query('orphanageId') orphanageId?: string,
    @Query('type') type?: PostType,
    @Query('countryId') countryId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.posts.feed({
      childId,
      orphanageId,
      type,
      countryId,
      take: Number(take ?? 20),
      skip: Number(skip ?? 0),
    });
  }

  @Get('my-feed')
  myFeed(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    return this.posts.myFeed(user, Number(take ?? 20));
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.posts.myPosts(user);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthUser) {
    return this.posts.myFavorites(user);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.posts.get(id);
  }

  @Post('check')
  check(@Body() body: { content: string; childId?: string }) {
    return this.posts.checkContent(body.content, body.childId);
  }

  @Roles(
    Role.AMBASSADOR,
    Role.ORPHANAGE_DIRECTOR,
    Role.REGIONAL_MANAGER,
    Role.NATIONAL_MANAGER,
    Role.SUPER_ADMIN,
    Role.MODERATOR,
  )
  @Post()
  create(@Body() dto: any, @CurrentUser() user: AuthUser) {
    return this.posts.create(dto, user);
  }

  @Post(':id/react')
  react(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: { kind?: string }) {
    return this.posts.react(id, user, body?.kind);
  }

  @Post(':id/comment')
  comment(@Param('id') id: string, @Body() body: { content: string }, @CurrentUser() user: AuthUser) {
    return this.posts.comment(id, body?.content, user);
  }

  @Post('subscribe/:childId')
  subscribe(@Param('childId') childId: string, @CurrentUser() user: AuthUser) {
    return this.posts.subscribe(childId, user);
  }

  @Post('favorite')
  favorite(@Body() body: { childId?: string; projectId?: string }, @CurrentUser() user: AuthUser) {
    return this.posts.favorite(user, body?.childId, body?.projectId);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN)
  @Post(':id/hide')
  hide(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.posts.hide(id, body?.reason, user);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.posts.restore(id, user);
  }

  @Roles(Role.MODERATOR, Role.SUPER_ADMIN)
  @Post('comments/:id/hide')
  hideComment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.posts.hideComment(id, user);
  }
}
