import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Analysis } from 'src/analysis/entities/analysis.entity';
import { User } from 'src/users/entities/user.entity';
import { EsgAnalysisModule } from 'src/esg_analysis/esg_analysis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Analysis, User, Analysis]), EsgAnalysisModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
