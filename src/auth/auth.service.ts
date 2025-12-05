import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { LoginUserDto } from './dto/login-user';
import { CreatePasswordResetTokenDto } from './dto/create-password-reset-token.dto';
import { CreateVerificationTokenDto } from './dto/create-verification-token.dto';
import { VerificationToken } from './entities/verification-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { SupabaseAuthService } from './superbase-auth.service';
import { UpdatePasswordDto } from 'src/users/dto/update-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async login(loginUserDto: LoginUserDto) {
    try {
      const { user, session } = await this.supabaseAuthService.signIn(
        loginUserDto.email,
        loginUserDto.password,
      );
  
      // Buscar datos locales del usuario
      const localUser = await this.userRepository.findOne({
        where: { id: user.id }
      });
  
      if (!localUser) {
        throw new NotFoundException('User not found in local DB');
      }
  
      return {
        message: '✅ Login exitoso',
        session,
        user: {
          ...localUser,
          email: user.email,
        },
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
  

  async getVerificationTokenByEmail(email: string): Promise<VerificationToken> {
    try {
      const verificationToken = await this.verificationTokenRepository.findOne({
        where: { email },
      });

      if (!verificationToken) {
        throw new NotFoundException(
          `Verification token for email ${email} not found`,
        );
      }

      return verificationToken;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async getVerificationTokenByToken(token: string): Promise<VerificationToken> {
    try {
      const verificationToken = await this.verificationTokenRepository.findOne({
        where: { token },
      });

      if (!verificationToken) {
        throw new NotFoundException(`Verification token ${token} not found`);
      }

      return verificationToken;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async getPasswordResetTokenByToken(
    token: string,
  ): Promise<PasswordResetToken> {
    try {
      const passwordResetToken =
        await this.passwordResetTokenRepository.findOne({
          where: { token },
        });

      if (!passwordResetToken) {
        throw new NotFoundException(`Password reset token ${token} not found`);
      }

      return passwordResetToken;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async getPasswordResetTokenByEmail(
    email: string,
  ): Promise<PasswordResetToken> {
    try {
      const passwordResetToken =
        await this.passwordResetTokenRepository.findOne({
          where: { email },
        });

      if (!passwordResetToken) {
        throw new NotFoundException(
          `Password reset token for email ${email} not found`,
        );
      }

      return passwordResetToken;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async createVerificationToken(
    createVerificationTokenDto: CreateVerificationTokenDto,
  ): Promise<VerificationToken> {
    try {
      const existingVerificationToken =
        await this.verificationTokenRepository.findOne({
          where: { email: createVerificationTokenDto.email },
        });

      if (existingVerificationToken) {
        await this.verificationTokenRepository.remove(
          existingVerificationToken,
        );
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60); // 1 hour

      const verificationToken = this.verificationTokenRepository.create({
        email: createVerificationTokenDto.email,
        token,
        expiresAt,
      });

      await this.verificationTokenRepository.save(verificationToken);

      return verificationToken;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async createPasswordResetToken(
    createPasswordResetTokenDto: CreatePasswordResetTokenDto,
  ): Promise<PasswordResetToken> {
    try {
      const existingPasswordResetToken =
        await this.passwordResetTokenRepository.findOne({
          where: { email: createPasswordResetTokenDto.email },
        });

      if (existingPasswordResetToken) {
        await this.passwordResetTokenRepository.remove(
          existingPasswordResetToken,
        );
      }

      const token = crypto.randomUUID();
      const expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60); // 1 hour

      const passwordResetToken = this.passwordResetTokenRepository.create({
        email: createPasswordResetTokenDto.email,
        token,
        expiresAt,
      });

      await this.passwordResetTokenRepository.save(passwordResetToken);

      return passwordResetToken;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }

  async deleteVerificationToken(id: string): Promise<{ message: string }> {
    try {
      const verificationToken = await this.verificationTokenRepository.findOne({
        where: { id },
      });

      if (!verificationToken) {
        throw new NotFoundException(`Verification token ${id} not found`);
      }

      await this.verificationTokenRepository.remove(verificationToken);

      return { message: 'Verification token deleted' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async deletePasswordResetToken(id: string): Promise<{ message: string }> {
    try {
      const passwordResetToken =
        await this.passwordResetTokenRepository.findOne({
          where: { id },
        });

      if (!passwordResetToken) {
        throw new NotFoundException(`Password reset token ${id} not found`);
      }

      await this.passwordResetTokenRepository.remove(passwordResetToken);

      return { message: 'Password reset token deleted' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

    // ✅ NUEVO: cambio de contraseña usando Supabase
    async changePassword(userId: string, dto: UpdatePasswordDto) {
      try {
        // Opcional: validar que exista en tu DB local si querés mantener consistencia
        const localUser = await this.userRepository.findOne({
          where: { id: userId },
        });
  
        if (!localUser) {
          throw new NotFoundException('User not found in local DB');
        }
  
        const updatedUser = await this.supabaseAuthService.updatePassword(
          userId,
          dto,
          localUser.email, // si lo tenés guardado localmente
        );
  
        return {
          message: '✅ Contraseña actualizada correctamente',
          user: {
            ...localUser,
            email: updatedUser.email,
          },
        };
      } catch (error) {
        this.logger.error(error.message, error.stack);
        throw error;
      }
    }
}
