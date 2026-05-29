import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ResponseService } from "src/common/services/response.service";
import { TrackUserActivityDto, UserActivityLog } from "src/infra/database/entities/user-log.entity";
import { Repository } from "typeorm";

@Injectable()
export class UsersLogService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly userLogRepo: Repository<UserActivityLog>,
    private readonly responseService: ResponseService,
  ) {}

  /*
  async updateUserLog(dto: TrackUserActivityDto, reqUser: any) {
    const userId = reqUser.userId;

    try {
      // Find existing user log
      const userLog = await this.userLogRepo.findOne({ where: { userId } });

      if (dto.isLogin) {
        // Handle LOGIN action
        if (!userLog) {
          // Create new record for login
          userLog = this.userLogRepo.create({
            userId,
            isLogin: true,
            lastLogin: dto.dateTime,
            lastAccess: dto.dateTime,
            deviceName: dto.deviceName,
            platform: dto.platform,
            appVersion: dto.appVersion,
          });
        } else {
          // Update existing record for login
          userLog.isLogin = true;
          userLog.lastLogin = dto.dateTime;
          userLog.lastAccess = dto.dateTime;
          userLog.deviceName = dto.deviceName;
          userLog.platform = dto.platform;
          userLog.appVersion = dto.appVersion;
        }

        await this.userLogRepo.save(userLog);
      } else {
        // Handle ACCESS action
        if (!userLog) {
          // Create new record for access (not logged in yet)
          userLog = this.userLogRepo.create({
            userId,
            isLogin: true,
            lastAccess: dto.dateTime,
            deviceName: dto.deviceName,
            platform: dto.platform,
            appVersion: dto.appVersion,
          });
        } else {
          // Check if user has ever logged in
          if (!userLog.isLogin) {
            return this.responseService.error('User has not logged in yet', 401);
          }

          // Update existing record for access
          userLog.lastAccess = dto.dateTime;
          userLog.deviceName = dto.deviceName;
          userLog.platform = dto.platform;
          userLog.appVersion = dto.appVersion;
        }

        await this.userLogRepo.save(userLog);
      }

      return this.responseService.success('User activity updated successfully', {
        userId,
        isLogin: userLog.isLogin,
        lastLogin: userLog.lastLogin,
        lastAccess: userLog.lastAccess,
      });
    } catch (error) {
      return this.responseService.error('Failed to update user activity', 500);
    }
  }
  */

  async updateUserLog(dto: TrackUserActivityDto, reqUser: any) {
    const userId = reqUser.userId;

    try {
      // Use upsert pattern
      const existingLog = await this.userLogRepo.findOne({ where: { userId: userId } });

      if (existingLog) {
        // Update existing
        if (dto.isLogin) {
          existingLog.isLogin = true;
          existingLog.lastLogin = dto.dateTime;
          existingLog.lastAccess = dto.dateTime;
        } else {
          if (!existingLog.isLogin) {
            return this.responseService.error('User has not logged in yet', 401);
          }
          existingLog.lastAccess = dto.dateTime;
        }
        existingLog.deviceName = dto.deviceName;
        existingLog.platform = dto.platform;
        existingLog.appVersion = dto.appVersion;

        await this.userLogRepo.save(existingLog);
      } else {
        // Create new
        const newLog = this.userLogRepo.create({
          userId:userId,
          isLogin: dto.isLogin || false,
          lastLogin: dto.isLogin ? dto.dateTime : null,
          lastAccess: dto.dateTime,
          deviceName: dto.deviceName,
          platform: dto.platform,
          appVersion: dto.appVersion,
        });
        await this.userLogRepo.save(newLog);
      }

      return this.responseService.success('User activity updated successfully');
    } catch (error) {
      // Handle duplicate key error (PostgreSQL error code 23505)
      if (error.code === '23505') {
        // Retry or handle gracefully
        return this.updateUserLog(dto, reqUser); // Simple retry
      }
      return this.responseService.error('Failed to update user activity', 500);
    }
  }

}