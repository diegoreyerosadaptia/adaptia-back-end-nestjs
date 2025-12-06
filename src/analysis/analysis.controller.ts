import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';
import { SendAnalysisDto } from './dto/send-analysis.dto';

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post()
  create(@Body() createAnalysisDto: CreateAnalysisDto) {
    return this.analysisService.create(createAnalysisDto);
  }

  @Get()
  findAll() {
    return this.analysisService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analysisService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAnalysisDto: UpdateAnalysisDto) {
    return this.analysisService.update(id, updateAnalysisDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.analysisService.remove(id);
  }

  @Patch('statusPayment/:id')
  updatePaymentStatus(@Param('id') id: string) {
    return this.analysisService.updatePaymentStatus(id);
  }
// analysis.controller.ts (ejemplo)
@Patch('sendAnalysis/:id')
sendAnalysis(
  @Param('id') id: string,
) {
  return this.analysisService.sendAnalysisUser(id)
}

}
