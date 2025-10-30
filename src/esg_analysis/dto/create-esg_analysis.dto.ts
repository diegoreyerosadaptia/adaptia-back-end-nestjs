import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateEsgAnalysisDto {

    @IsString()
    @IsNotEmpty()
    organization_name: string

    @IsString()
    @IsNotEmpty()
    country: string

    @IsString()
    @IsNotEmpty()
    website: string

    @IsString()
    @IsOptional()
    organizationId?: string
}
