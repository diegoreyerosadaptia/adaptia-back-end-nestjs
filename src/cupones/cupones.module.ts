import { Module } from '@nestjs/common';
import { CuponesService } from './cupones.service';
import { CuponesController } from './cupones.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from './entities/cupone.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Analysis } from 'src/analysis/entities/analysis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Coupon, Organization, Analysis])],
  providers: [CuponesService],
  controllers: [CuponesController]
})
export class CuponesModule {}

