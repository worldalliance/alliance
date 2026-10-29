import { koraAvailable } from "@alliance/common/kora";
import {
  type CanActivate,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class KoraAvailableGuard implements CanActivate {
  canActivate(): boolean {
    if (!koraAvailable(process.env.NODE_ENV)) {
      throw new NotFoundException();
    }
    return true;
  }
}
