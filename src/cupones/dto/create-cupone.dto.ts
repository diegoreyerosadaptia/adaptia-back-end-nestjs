import { IsNotEmpty, IsNumber, IsString } from "class-validator"

export class CreateCuponeDto {

    @IsString()
    @IsNotEmpty()
    name: string

    @IsNumber()
    @IsNotEmpty()
    percentage: number
}
