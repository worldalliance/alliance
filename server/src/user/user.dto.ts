import { PickType } from '@nestjs/swagger';
import { User } from './user.entity';

export class UserDto extends PickType(User, ['name', 'email']) {}
