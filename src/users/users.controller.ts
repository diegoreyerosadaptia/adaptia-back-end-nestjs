import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UpdatePasswordDto } from './dto/update-password.dto';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':userId')
  getUser(@Param('userId') userId: string): Promise<User> {
    return this.usersService.findOne(userId);
  }

  @Patch(':userId')
  update(
    @Param('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, updateUserDto);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.usersService.remove(userId);
  }

  @Delete('soft-delete/:userId')
  softDeleteUser(@Param('userId') userId: string): Promise<void> {
    return this.usersService.softDeleteUser(userId);
  }

  @Patch('restore/:userId')
  restoreUser(@Param('userId') userId: string): Promise<void> {
    return this.usersService.restoreUser(userId);
  }

  @Patch(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<User> {
    return this.usersService.updatePassword(id, updatePasswordDto);
  }

  @Get(':userId/hasPassword')
  passwordNull(@Param('userId') id: string) {
    return this.usersService.userHasPassword(id);
  }

  
}
