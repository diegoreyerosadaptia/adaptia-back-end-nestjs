import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
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

  @Post('apply-coupon/:id')
  applyCoupon(@Param('id') id: string, @Body('couponName') couponName: string,) {
    return this.organizationsService.applyCoupon(id, couponName);
  }


@Get()
@UseGuards(SupabaseAuthGuard)
findAll(
  @Req() req: any,
  @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query("limit", new DefaultValuePipe(15), ParseIntPipe) limit: number,
) {
  const userId = req.user.id;

  const pageNum = Math.max(1, page);
  const limitNum = Math.min(100, Math.max(1, limit));

  console.log("[ORG] incoming", { page, limit, pageNum, limitNum });

  return this.organizationsService.findAll(userId, pageNum, limitNum);
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
