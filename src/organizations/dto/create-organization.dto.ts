import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsEnum,
    IsUUID,
    IsUrl,
  } from 'class-validator';
  import { EMPLYEES_NUMBER } from '../entities/organization.entity';
  import type { EmployeesNumber } from '../entities/organization.entity';
  
  
  export class CreateOrganizationDto {
    @IsNotEmpty()
    @IsString()
    name: string;
  
    @IsNotEmpty()
    @IsString()
    lastName: string;
  
    @IsNotEmpty()
    @IsString()
    company: string;
  
    @IsNotEmpty()
    @IsString()
    industry: string;
  
    @IsEnum(EMPLYEES_NUMBER)
    employees_number: EmployeesNumber;
  
    @IsOptional()
    @IsString()
    phone?: string;
  
    @IsNotEmpty()
    @IsString()
    country: string;
  
    @IsNotEmpty()
    @IsUrl()
    website: string;
  
    @IsOptional()
    @IsString()
    document?: string;
  
    @IsOptional()
    owner_id: string;
  }
  