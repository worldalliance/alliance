import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { Push } from "src/push/push.entity";
import { PushService } from "src/push/push.service";
import { DataSource, type Repository } from "typeorm";
import { RegisterDeviceDto } from "./dto/device.dto";
import { UserDevice } from "./entities/user-device.entity";
import { User } from "./entities/user.entity";
import { UserService } from "./user.service";

@Injectable()
export class UserDeviceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    private readonly userService: UserService,
    private readonly pushService: PushService,
  ) {}

  async registerDevice(
    userId: number,
    body: RegisterDeviceDto,
  ): Promise<string> {
    const user = await this.userService.findOneOrFail(userId, {
      devices: true,
    });
    const taskBadgePushes = body.taskBadgePushes ?? false;
    if (body.deviceId) {
      const existingDevice = await this.userDeviceRepository.findOne({
        where: { id: body.deviceId, user: { id: userId } },
      });
      if (
        existingDevice &&
        (await updateLive(this.dataSource.manager, {
          target: UserDevice,
          id: existingDevice.id,
          changes: {
            expoPushToken: body.expoPushToken,
            taskBadgePushes,
            ...(existingDevice.expoPushToken !== body.expoPushToken && {
              badgeCount: null,
              badgeCountComputedAt: null,
            }),
          },
        }))
      ) {
        return existingDevice.id;
      }
    }

    if (body.expoPushToken) {
      const existingByToken = await this.userDeviceRepository.findOne({
        where: { expoPushToken: body.expoPushToken },
        relations: { user: true },
      });
      if (
        existingByToken?.user?.id === userId &&
        (await updateLive(this.dataSource.manager, {
          target: UserDevice,
          id: existingByToken.id,
          changes: { taskBadgePushes },
        }))
      ) {
        return existingByToken.id;
      }
      if (existingByToken) {
        console.log("Reassigning device by expo push token to user", userId);
        const reassigned = await writeUnderLive(this.dataSource.manager, {
          parents: [{ target: User, id: userId }],
          write: (manager) =>
            updateLive(manager, {
              target: UserDevice,
              id: existingByToken.id,
              changes: {
                user: { id: userId },
                deviceType: body.deviceType ?? existingByToken.deviceType,
                taskBadgePushes,
                badgeCount: null,
                badgeCountComputedAt: null,
              },
            }),
        });
        if (reassigned) {
          return existingByToken.id;
        }
      }
    }

    const device = this.userDeviceRepository.create({
      deviceType: body.deviceType,
      expoPushToken: body.expoPushToken,
      taskBadgePushes,
      user,
    });
    const savedDevice = await writeUnderLive(this.dataSource.manager, {
      parents: [{ target: User, id: userId }],
      write: (manager) => manager.save(device),
    });
    return savedDevice.id;
  }

  async unregisterDevice(params: {
    deviceId: string;
    expoPushToken: string;
  }): Promise<void> {
    await softDeleteWhere(this.userDeviceRepository.manager, {
      target: UserDevice,
      where: { id: params.deviceId, expoPushToken: params.expoPushToken },
    });
  }

  async testPushNotification(userId: number, message: string): Promise<Push> {
    const user = await this.userService.findOneOrFail(userId, {
      devices: true,
    });
    const device = user.devices?.[0];
    if (!device || !device.expoPushToken) {
      throw new BadRequestException("User has no expo push token");
    }
    return this.pushService.sendPushNotification(
      userId,
      device.expoPushToken,
      message,
    );
  }
}
