import { Validate } from 'class-validator';
import { IsUserAlreadyExist } from './user-already-exists.validator';

class UserDTO {
  @Validate(IsUserAlreadyExist)
  readonly email: string;

  constructor(email: string) {
    this.email = email;
  }
}

describe('IsUserAlreadyExist', () => {
  it('should be defined', () => {
    expect(IsUserAlreadyExist).toBeDefined();
  });
});
