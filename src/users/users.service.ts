import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { SupabaseAuthService } from 'src/auth/superbase-auth.service';
import { Organization } from 'src/organizations/entities/organization.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()
  
    try {
      // 1) email único
      const existingUser = await queryRunner.manager.getRepository(User).findOne({
        where: { email: createUserDto.email },
      })
      if (existingUser) throw new ConflictException('email already exists')
  
      // 2) signup en Supabase
      const { user: supabaseUser } = await this.supabaseAuthService.signUp(
        createUserDto.email,
        createUserDto.password,
      )
  
      // 3) crear user local
      const userRepo = queryRunner.manager.getRepository(User)
      const user = userRepo.create({
        ...createUserDto,
        id: supabaseUser?.id || '',        // id externo
        password: bcrypt.hashSync(createUserDto.password, 10),
      })
      const savedUser = await userRepo.save(user)
  
      // 4) Si vino orgId + claimToken => reclamar organización
      if (createUserDto.orgId && createUserDto.claimToken) {
        const orgRepo = queryRunner.manager.getRepository(Organization)
      
        const org = await orgRepo
          .createQueryBuilder('org')
          .setLock('pessimistic_write')               // opcional (estás en TX)
          .where('org.id = :id', { id: createUserDto.orgId })
          .andWhere('org.claimToken = :token', { token: createUserDto.claimToken })
          .andWhere('org."ownerId" IS NULL')          // FK implícita
          .getOne()
      
        if (!org) {
          throw new NotFoundException('Organización no encontrada o token inválido')
        }
      
        if (org.claimExpiresAt && org.claimExpiresAt < new Date()) {
          throw new BadRequestException('El token ha expirado')
        }
      
        // ✅ asignar relación y demás campos, luego save()
        org.owner = savedUser
        org.claimToken = null
        org.claimExpiresAt = null
        org.claimedAt = new Date()
      
        await orgRepo.save(org)                       // 👈 esto sí guarda el owner
      }
      
  
      await queryRunner.commitTransaction()
      return savedUser
    } catch (error) {
      await queryRunner.rollbackTransaction()
      this.logger.error(error.message, error.stack)
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async findAll() {
    try {
      return await this.userRepository.find({
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw error;
    }
  }
  

  async findOne(id: string) {
    try {
      const user = await this.userRepository.findOne({
        where: { id }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const fieldsToUpdate = Object.entries(updateUserDto).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== user[key]) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Partial<UpdateUserDto>,
      );

      const updatedUser = this.userRepository.merge(user, fieldsToUpdate);

      if (updateUserDto.password) {
        const hashedPassword = bcrypt.hashSync(updateUserDto.password, 10);
        updatedUser.password = hashedPassword;
      }

      const result = await this.userRepository.save(updatedUser);

      this.logger.log(`User "${result.email}" updated successfully`);
      return result;
    } catch (error) {
      if (
        !(
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        )
      ) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      await this.userRepository.remove(user);

      return { message: 'User removed successfully' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async softDeleteUser(id: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.userRepository.softDelete(id);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async restoreUser(id: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({
        where: { id },
        withDeleted: true,
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (!user.deletedAt) {
        throw new BadRequestException(`User with ID ${id} is not deleted`);
      }

      await this.userRepository.restore(id);
    } catch (error) {
      if (
        !(
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        )
      ) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async userHasPassword(id: string): Promise<{ hasPassword: boolean }> {
    try {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.id = :id', { id })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const hasPassword = user.password !== null && user.password !== '';
      return { hasPassword };
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }

  async updatePassword(id: string, updatePasswordDto: UpdatePasswordDto) {
    try {
      const { currentPassword, newPassword, repeatNewPassword } =
        updatePasswordDto;

      if (newPassword !== repeatNewPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where({ id })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        throw new BadRequestException({
          code: 'CURRENT_PASSWORD_INCORRECT',
          message: 'Current password is incorrect',
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      return this.userRepository.save(user);
    } catch (error) {
      if (
        !(
          error instanceof NotFoundException ||
          error instanceof BadRequestException
        )
      ) {
        this.logger.error(error.message, error.stack);
      }
      throw error;
    }
  }
}
