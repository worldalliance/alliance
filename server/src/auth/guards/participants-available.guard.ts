import { participantsAvailable } from "@alliance/common/participant";
import {
  type CanActivate,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class ParticipantsAvailableGuard implements CanActivate {
  canActivate(): boolean {
    if (!participantsAvailable(process.env.NODE_ENV)) {
      throw new NotFoundException();
    }
    return true;
  }
}
