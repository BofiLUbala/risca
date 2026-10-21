import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        countryId: true,
        provinceId: true,
        orphanageId: true,
        staffFunction: true,
        tokenVersion: true,
      },
    });

    if (!user) throw new UnauthorizedException('Compte introuvable');
    if (user.tokenVersion !== payload.tv) throw new UnauthorizedException('Session revoquee');
    if (user.status === 'BLOCKED') throw new UnauthorizedException('Compte bloque');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('Compte suspendu');
    if (user.status === 'FROZEN') throw new UnauthorizedException('Compte gele par la gouvernance');
    if (user.status === 'INVITED') throw new UnauthorizedException('Compte non active');

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      countryId: user.countryId,
      provinceId: user.provinceId,
      orphanageId: user.orphanageId,
      staffFunction: user.staffFunction,
    };
  }
}
