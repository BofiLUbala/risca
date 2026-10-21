import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus, PostType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeService } from '../../common/services/scope.service';
import { AuditService } from '../../common/services/audit.service';
import { ContentSafetyService } from '../../common/services/content-safety.service';
import { NotificationsService } from '../../common/services/notifications.service';
import { TimelineService } from '../children/timeline.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private audit: AuditService,
    private safety: ContentSafetyService,
    private notifications: NotificationsService,
    private timeline: TimelineService,
  ) {}

  /**
   * Publication (section 8).
   * L ambassadeur ne publie que pour les enfants qui lui sont assignes.
   * Le chef d orphelinat publie pour l orphelinat; une publication sur un
   * enfant passe par l ambassadeur.
   */
  async create(
    dto: {
      type?: PostType;
      content: string;
      photos?: string[];
      videos?: string[];
      childId?: string;
      orphanageId?: string;
      projectId?: string;
    },
    user: AuthUser,
  ) {
    this.scope.assertCanWrite(user);

    const canPublish: Role[] = [
      Role.AMBASSADOR,
      Role.ORPHANAGE_DIRECTOR,
      Role.REGIONAL_MANAGER,
      Role.NATIONAL_MANAGER,
      Role.SUPER_ADMIN,
      Role.MODERATOR,
    ];
    if (!canPublish.includes(user.role as Role)) {
      throw new ForbiddenException('Votre rôle ne permet pas de publier');
    }

    let child = null;

    if (dto.childId) {
      child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child) throw new NotFoundException('Enfant introuvable');
      if (child.status !== 'ACTIVE') {
        throw new BadRequestException('Le dossier de cet enfant doit être actif');
      }

      // Seul l ambassadeur assigne publie pour un enfant
      if (user.role === Role.AMBASSADOR) {
        await this.scope.assertAmbassadorOwnsChild(user, dto.childId);
      } else if (user.role === Role.ORPHANAGE_DIRECTOR) {
        throw new ForbiddenException(
          'Une publication sur un enfant doit passer par son ambassadeur',
        );
      }

      // Consentement photo obligatoire des qu il y a une image ou une video
      const hasMedia = (dto.photos?.length ?? 0) > 0 || (dto.videos?.length ?? 0) > 0;
      if (hasMedia) {
        const consent = await this.timeline.hasValidPhotoConsent(dto.childId);
        if (!consent) {
          throw new BadRequestException(
            'Publication impossible : le consentement photo n’est pas signe pour cet enfant',
          );
        }
      }
    }

    if (dto.orphanageId && user.role === Role.ORPHANAGE_DIRECTOR && user.orphanageId !== dto.orphanageId) {
      throw new ForbiddenException('Vous ne pouvez publier que pour votre structure');
    }

    // Verification automatique du contenu (section 8.2)
    const check = this.safety.check(dto.content, child?.lastName);
    if (!check.safe) {
      throw new BadRequestException({
        message: 'Publication bloquee par la verification automatique',
        violations: check.violations,
      });
    }

    const post = await this.prisma.post.create({
      data: {
        type: dto.type ?? PostType.NEWS,
        content: dto.content,
        photos: dto.photos ?? [],
        videos: dto.videos ?? [],
        authorId: user.id,
        childId: dto.childId ?? null,
        orphanageId: dto.orphanageId ?? child?.orphanageId ?? user.orphanageId ?? null,
        projectId: dto.projectId ?? null,
        status: PostStatus.PUBLISHED,
      },
    });

    // Tout le reseau est prevenu d'une nouvelle publication : le fil est l'espace
    // commun, son contenu est deja filtre pour ne rien exposer de confidentiel.
    const everyone = await this.notifications.allActiveUsers(user.id);
    await this.notifications.notifyMany(everyone, {
      title: 'Nouvelle publication',
      body: dto.content.slice(0, 120),
      link: '/communication',
      metadata: { postId: post.id },
    });

    // Fil du parrain : notifier les abonnes de l enfant
    if (dto.childId) {
      const subs = await this.prisma.subscription.findMany({
        where: { childId: dto.childId },
        select: { userId: true },
      });
      await this.notifications.notifyMany(
        subs.map((s) => s.userId),
        {
          title: `Nouvelle publication sur ${child.firstName}`,
          // Le prenom d un enfant ne doit pas s afficher sur un ecran verrouille.
          sensitive: true,
          body: dto.content.slice(0, 120),
          link: '/communication',
          metadata: { postId: post.id, childId: dto.childId },
        },
      );
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'POST_CREATED',
      entityType: 'Post',
      entityId: post.id,
      metadata: { type: post.type, childId: dto.childId },
    });

    return post;
  }

  /** Verification prealable, sans publier : utile pour l aperçu cote client. */
  async checkContent(content: string, childId?: string) {
    let lastName: string | undefined;
    if (childId) {
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        select: { lastName: true },
      });
      lastName = child?.lastName;
    }
    return this.safety.check(content, lastName);
  }

  /** Fil de l espace de communication. */
  async feed(
    params: {
      childId?: string;
      orphanageId?: string;
      type?: PostType;
      countryId?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const where: any = {
      status: PostStatus.PUBLISHED,
      ...(params.childId ? { childId: params.childId } : {}),
      ...(params.orphanageId ? { orphanageId: params.orphanageId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.countryId ? { orphanage: { countryId: params.countryId } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(params.take ?? 20),
        skip: Number(params.skip ?? 0),
        include: {
          author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
          child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true } },
          orphanage: { select: { id: true, name: true, province: { select: { nameFr: true } } } },
          project: {
            select: {
              id: true,
              title: true,
              targetAmount: true,
              collectedAmount: true,
              currency: true,
              status: true,
            },
          },
          comments: {
            where: { hidden: false },
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { items, total };
  }

  /** Fil personnalise d un bailleur : ses enfants parraines. */
  async myFeed(user: AuthUser, take = 20) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId: user.id },
      select: { childId: true },
    });
    const childIds = subs.map((s) => s.childId).filter(Boolean) as string[];

    if (!childIds.length) return this.feed({ take });

    const items = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, childId: { in: childIds } },
      orderBy: { createdAt: 'desc' },
      take: Number(take),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        child: { select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true } },
        project: {
          select: { id: true, title: true, targetAmount: true, collectedAmount: true, currency: true },
        },
      },
    });
    return { items, total: items.length };
  }

  async get(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        child: {
          select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true, publicStory: true },
        },
        orphanage: { select: { id: true, name: true } },
        project: {
          select: { id: true, title: true, targetAmount: true, collectedAmount: true, currency: true },
        },
        comments: {
          where: { hidden: false },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException('Publication introuvable');

    await this.prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return post;
  }

  /** Mes publications : vues, reactions, financements generes (section 11). */
  async myPosts(user: AuthUser) {
    const posts = await this.prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        child: { select: { id: true, firstName: true } },
        project: { select: { id: true, title: true, collectedAmount: true, currency: true } },
      },
    });

    const totals = posts.reduce(
      (acc, p) => ({
        views: acc.views + p.viewCount,
        reactions: acc.reactions + p.reactionCount,
        comments: acc.comments + p.commentCount,
      }),
      { views: 0, reactions: 0, comments: 0 },
    );

    return { posts, totals };
  }

  async react(postId: string, user: AuthUser, kind = 'HEART') {
    const existing = await this.prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    });

    if (existing) {
      await this.prisma.reaction.delete({ where: { id: existing.id } });
      await this.prisma.post.update({ where: { id: postId }, data: { reactionCount: { decrement: 1 } } });
      return { reacted: false };
    }

    await this.prisma.reaction.create({ data: { postId, userId: user.id, kind } });
    await this.prisma.post.update({ where: { id: postId }, data: { reactionCount: { increment: 1 } } });
    return { reacted: true };
  }

  /** Commentaires moderes. */
  async comment(postId: string, content: string, user: AuthUser) {
    if (!content || content.trim().length < 2) {
      throw new BadRequestException('Commentaire trop court');
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { child: { select: { lastName: true } } },
    });
    if (!post) throw new NotFoundException('Publication introuvable');

    const check = this.safety.check(content, post.child?.lastName);
    if (!check.safe) {
      throw new BadRequestException({
        message: 'Commentaire bloque par la verification automatique',
        violations: check.violations,
      });
    }

    const comment = await this.prisma.comment.create({
      data: { postId, authorId: user.id, content },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    await this.prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });

    return comment;
  }

  async subscribe(childId: string, user: AuthUser) {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId_childId: { userId: user.id, childId } },
    });
    if (existing) {
      await this.prisma.subscription.delete({ where: { id: existing.id } });
      return { subscribed: false };
    }
    await this.prisma.subscription.create({ data: { userId: user.id, childId } });
    return { subscribed: true };
  }

  async favorite(user: AuthUser, childId?: string, projectId?: string) {
    const existing = await this.prisma.favorite.findFirst({
      where: { userId: user.id, childId: childId ?? null, projectId: projectId ?? null },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }
    await this.prisma.favorite.create({
      data: { userId: user.id, childId: childId ?? null, projectId: projectId ?? null },
    });
    return { favorited: true };
  }

  async myFavorites(user: AuthUser) {
    return this.prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        child: {
          select: { id: true, publicId: true, firstName: true, publicPhotoUrl: true, publicNeeds: true },
        },
      },
    });
  }

  /** Le moderateur peut masquer une publication signalee (section 8.2). */
  async hide(id: string, reason: string, user: AuthUser) {
    const allowed: Role[] = [Role.MODERATOR, Role.SUPER_ADMIN];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seul un modérateur peut masquer une publication');
    }

    const post = await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.HIDDEN, hiddenReason: reason, hiddenById: user.id },
    });

    await this.notifications.notify({
      userId: post.authorId,
      title: 'Publication masquée',
      body: reason,
      link: '/communication',
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'POST_HIDDEN',
      entityType: 'Post',
      entityId: id,
      metadata: { reason },
    });

    return post;
  }

  async restore(id: string, user: AuthUser) {
    const allowed: Role[] = [Role.MODERATOR, Role.SUPER_ADMIN];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seul un moderateur peut retablir une publication');
    }
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: PostStatus.PUBLISHED, hiddenReason: null, hiddenById: null },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'POST_RESTORED',
      entityType: 'Post',
      entityId: id,
    });
    return post;
  }

  async hideComment(id: string, user: AuthUser) {
    const allowed: Role[] = [Role.MODERATOR, Role.SUPER_ADMIN];
    if (!allowed.includes(user.role as Role)) {
      throw new ForbiddenException('Seul un moderateur peut masquer un commentaire');
    }
    const comment = await this.prisma.comment.update({ where: { id }, data: { hidden: true } });
    await this.prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    });
    return comment;
  }
}
