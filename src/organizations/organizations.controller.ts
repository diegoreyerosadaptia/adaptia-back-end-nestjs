import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { SupabaseAuthGuard } from '../utils/guards/supabase-auth.guard';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  findAll(@Req() req) {
    const userId = req.user.id;
    return this.organizationsService.findAll(userId);
  }
  
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrganizationDto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationsService.remove(id);
  }

  @Post('claim')
  async claimOrg(
    @Body('userId') userId: string,
    @Body('orgId') orgId: string,
    @Body('claim') claimToken: string,
  ) {
    return this.organizationsService.claimOrganization(userId, orgId, claimToken)
  }
}
