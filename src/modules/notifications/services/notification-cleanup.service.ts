import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationCleanupService {
  private readonly logger = new Logger(NotificationCleanupService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private configService: ConfigService,
  ) {}

  /**
   * Cleanup expired notifications daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanUpExpiredNotifications() {
    try {
      this.logger.log('Starting expired notifications cleanup...');

      const result = await this.notificationRepository
        .createQueryBuilder()
        .delete()
        .where('expiresAt < NOW()')
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      this.logger.log(`Cleaned up ${result.affected || 0} expired notifications`);
    } catch (error) {
      this.logger.error('Error cleaning up expired notifications:', error);
    }
  }

  /**
   * Archive old notifications (keep for retention period)
   * Runs weekly on Sunday at 3 AM
   */
  @Cron('0 3 * * 0') // Every Sunday at 3 AM
  async archiveOldNotifications() {
    try {
      this.logger.log('Starting notifications archiving...');

      const retentionDays = this.configService.get<number>(
        'notifications.retention.days',
        30,
      );
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Archive notifications older than retention period
      const result = await this.notificationRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ isActive: false })
        .where('createdAt < :cutoffDate', { cutoffDate })
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      this.logger.log(`Archived ${result.affected || 0} old notifications`);
    } catch (error) {
      this.logger.error('Error archiving old notifications:', error);
    }
  }

  /**
   * Cleanup read notifications that are older than specified days
   * Runs monthly on the 1st at 4 AM
   */
  @Cron('0 4 1 * *') // 1st day of every month at 4 AM
  async cleanupReadNotifications() {
    try {
      this.logger.log('Starting read notifications cleanup...');

      const readRetentionDays = 7; // Keep read notifications for 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - readRetentionDays);

      const result = await this.notificationRepository
        .createQueryBuilder()
        .delete()
        .where('read = :read', { read: true })
        .andWhere('createdAt < :cutoffDate', { cutoffDate })
        .andWhere('isActive = :isActive', { isActive: true })
        .execute();

      this.logger.log(`Cleaned up ${result.affected || 0} read notifications`);
    } catch (error) {
      this.logger.error('Error cleaning up read notifications:', error);
    }
  }

  /**
   * Manual cleanup method (can be called from API)
   */
  async manualCleanup(options: {
    expireBefore?: Date;
    archiveBefore?: Date;
    deleteReadBefore?: Date;
  }): Promise<{
    expired: number;
    archived: number;
    deletedRead: number;
  }> {
    const results = {
      expired: 0,
      archived: 0,
      deletedRead: 0,
    };

    try {
      // Delete expired
      if (options.expireBefore) {
        const expiredResult = await this.notificationRepository
          .createQueryBuilder()
          .delete()
          .where('expiresAt < :expireBefore', { expireBefore: options.expireBefore })
          .andWhere('isActive = :isActive', { isActive: true })
          .execute();
        results.expired = expiredResult.affected || 0;
      }

      // Archive old
      if (options.archiveBefore) {
        const archiveResult = await this.notificationRepository
          .createQueryBuilder()
          .update(Notification)
          .set({ isActive: false })
          .where('createdAt < :archiveBefore', { archiveBefore: options.archiveBefore })
          .andWhere('isActive = :isActive', { isActive: true })
          .execute();
        results.archived = archiveResult.affected || 0;
      }

      // Delete read
      if (options.deleteReadBefore) {
        const deleteReadResult = await this.notificationRepository
          .createQueryBuilder()
          .delete()
          .where('read = :read', { read: true })
          .andWhere('createdAt < :deleteReadBefore', {
            deleteReadBefore: options.deleteReadBefore,
          })
          .andWhere('isActive = :isActive', { isActive: true })
          .execute();
        results.deletedRead = deleteReadResult.affected || 0;
      }

      this.logger.log(
        `Manual cleanup completed: ${results.expired} expired, ${results.archived} archived, ${results.deletedRead} read notifications cleaned`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error in manual cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    totalActive: number;
    totalExpired: number;
    totalRead: number;
    oldestNotification?: Date;
  }> {
    const stats = {
      totalActive: 0,
      totalExpired: 0,
      totalRead: 0,
      oldestNotification: undefined as Date | undefined,
    };

    try {
      // Count active notifications
      stats.totalActive = await this.notificationRepository.count({
        where: { isActive: true },
      });

      // Count expired notifications
      const expiredCount = await this.notificationRepository
        .createQueryBuilder()
        .where('expiresAt < NOW()')
        .andWhere('isActive = :isActive', { isActive: true })
        .getCount();
      stats.totalExpired = expiredCount;

      // Count read notifications
      stats.totalRead = await this.notificationRepository.count({
        where: { read: true, isActive: true },
      });

      // Get oldest notification
      const oldest = await this.notificationRepository
        .createQueryBuilder()
        .select('MIN(createdAt)', 'oldest')
        .where('isActive = :isActive', { isActive: true })
        .getRawOne();
      
      stats.oldestNotification = oldest?.oldest;

      return stats;
    } catch (error) {
      this.logger.error('Error getting cleanup stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup notifications for a specific user
   */
  async cleanupUserNotifications(
    userId: string,
    options: {
      keepLast?: number; // Keep last N notifications
      deleteRead?: boolean;
    } = {},
  ): Promise<{
    deleted: number;
    kept: number;
  }> {
    try {
      let deletedCount = 0;

      // If deleteRead is true, delete read notifications
      if (options.deleteRead) {
        const deleteResult = await this.notificationRepository
          .createQueryBuilder()
          .delete()
          .where('userId = :userId', { userId })
          .andWhere('read = :read', { read: true })
          .andWhere('isActive = :isActive', { isActive: true })
          .execute();

        deletedCount += deleteResult.affected || 0;
      }

      // If keepLast is specified, delete older ones
      if (options.keepLast && options.keepLast > 0) {
        // Get IDs of notifications to keep (most recent N)
        const notificationsToKeep = await this.notificationRepository
          .createQueryBuilder()
          .select('id')
          .where('userId = :userId', { userId })
          .andWhere('isActive = :isActive', { isActive: true })
          .orderBy('createdAt', 'DESC')
          .take(options.keepLast)
          .getMany();

        const idsToKeep = notificationsToKeep.map(n => n.id);

        // Delete notifications not in the keep list
        if (idsToKeep.length > 0) {
          const deleteOldResult = await this.notificationRepository
            .createQueryBuilder()
            .delete()
            .where('userId = :userId', { userId })
            .andWhere('id NOT IN (:...ids)', { ids: idsToKeep })
            .andWhere('isActive = :isActive', { isActive: true })
            .execute();

          deletedCount += deleteOldResult.affected || 0;
        }
      }

      this.logger.log(
        `Cleaned up ${deletedCount} notifications for user ${userId}`,
      );

      return {
        deleted: deletedCount,
        kept: await this.notificationRepository.count({
          where: { userId, isActive: true },
        }),
      };
    } catch (error) {
      this.logger.error(`Error cleaning up notifications for user ${userId}:`, error);
      throw error;
    }
  }
}