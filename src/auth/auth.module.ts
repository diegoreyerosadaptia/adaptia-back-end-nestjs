import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { SupabaseAuthService } from './superbase-auth.service';
import { VerificationToken } from './entities/verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationToken,
      PasswordResetToken,
      User,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseAuthService],
  exports: [SupabaseAuthService],
})
export class AuthModule {}
