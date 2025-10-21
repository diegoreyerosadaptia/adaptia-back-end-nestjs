import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
  } from 'class-validator';
  
  import { USER_ROLES } from '../entities/user.entity';
  import type { UserRole } from '../entities/user.entity';
  
  export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    email: string;
  
    @IsString()
    @IsOptional()
    firstName: string;
  
    @IsString()
    @IsOptional()
    lastName: string;
  
    @IsString()
    @IsOptional()
    password: string;
  
    @IsEnum(USER_ROLES)
    role: UserRole;
  }
  