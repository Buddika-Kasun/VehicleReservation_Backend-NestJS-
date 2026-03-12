import * as moment from 'moment-timezone';

export class SriLankaTimeUtil {
  private static readonly TIMEZONE = 'Asia/Colombo';
  private static readonly DATE_FORMAT = 'YYYY-MM-DD';
  private static readonly TIME_FORMAT = 'HH:mm:ss';
  private static readonly DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

  /**
   * Get current date and time in Sri Lanka timezone
   */
  static now(): Date {
    return moment().tz(this.TIMEZONE).toDate();
  }

  /**
   * Get current date in Sri Lanka timezone as string (YYYY-MM-DD)
   */
  static todayDateStr(): string {
    return moment().tz(this.TIMEZONE).format(this.DATE_FORMAT);
  }

  /**
   * Get current time in Sri Lanka timezone as string (HH:mm:ss)
   */
  static currentTimeStr(): string {
    return moment().tz(this.TIMEZONE).format(this.TIME_FORMAT);
  }

  /**
   * Format a date to Sri Lanka timezone with specified format
   */
  static format(date: Date | string, format: string = this.DATE_FORMAT): string {
    return moment(date).tz(this.TIMEZONE).format(format);
  }

  /**
   * Parse a date string in Sri Lanka timezone
   */
  static parse(dateStr: string, format: string = this.DATE_FORMAT): Date {
    return moment.tz(dateStr, format, this.TIMEZONE).toDate();
  }

  /**
   * Convert date to database format (YYYY-MM-DD) in Sri Lanka timezone
   */
  static toDBDate(date: Date | string): string {
    return moment(date).tz(this.TIMEZONE).format(this.DATE_FORMAT);
  }

  /**
   * Convert time string to have seconds (HH:MM:SS)
   */
  static toDBTime(time: string): string {
    if (!time) return '00:00:00';
    
    const parts = time.split(':');
    if (parts.length === 3) return time;
    if (parts.length === 2) return `${time}:00`;
    return '00:00:00';
  }

  /**
   * Combine date and time strings into a single Date object in Sri Lanka timezone
   */
  static combineDateTime(dateStr: string, timeStr: string): Date {
    return moment.tz(
      `${dateStr} ${timeStr}`,
      this.DATETIME_FORMAT,
      this.TIMEZONE
    ).toDate();
  }

  /**
   * Get start of day in Sri Lanka timezone
   */
  static startOfDay(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).startOf('day').toDate();
  }

  /**
   * Get end of day in Sri Lanka timezone
   */
  static endOfDay(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).endOf('day').toDate();
  }

  /**
   * Get start of week (Sunday) in Sri Lanka timezone
   */
  static startOfWeek(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).startOf('week').toDate();
  }

  /**
   * Get end of week (Saturday) in Sri Lanka timezone
   */
  static endOfWeek(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).endOf('week').toDate();
  }

  /**
   * Get start of month in Sri Lanka timezone
   */
  static startOfMonth(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).startOf('month').toDate();
  }

  /**
   * Get end of month in Sri Lanka timezone
   */
  static endOfMonth(date: Date = new Date()): Date {
    return moment(date).tz(this.TIMEZONE).endOf('month').toDate();
  }

  /**
   * Check if a date is today in Sri Lanka timezone
   */
  static isToday(date: Date | string): boolean {
    return moment(date).tz(this.TIMEZONE).isSame(
      moment().tz(this.TIMEZONE),
      'day'
    );
  }

  /**
   * Check if a date is in the past in Sri Lanka timezone
   */
  static isPast(date: Date | string): boolean {
    return moment(date).tz(this.TIMEZONE).isBefore(
      moment().tz(this.TIMEZONE),
      'day'
    );
  }

  /**
   * Check if a date is in the future in Sri Lanka timezone
   */
  static isFuture(date: Date | string): boolean {
    return moment(date).tz(this.TIMEZONE).isAfter(
      moment().tz(this.TIMEZONE),
      'day'
    );
  }

  /**
   * Calculate difference in minutes between two times on same date
   */
  static timeDiffInMinutes(
    date: string,
    time1: string,
    time2: string
  ): number {
    const dt1 = this.combineDateTime(date, time1);
    const dt2 = this.combineDateTime(date, time2);
    return Math.abs(moment(dt2).diff(moment(dt1), 'minutes'));
  }

  /**
   * Calculate difference in minutes accounting for midnight wrap
   */
  static timeDiffWithWrap(
    date: string,
    time1: string,
    time2: string
  ): number {
    const dt1 = this.combineDateTime(date, time1);
    let dt2 = this.combineDateTime(date, time2);
    
    // If time2 is earlier than time1, assume it's next day
    if (dt2 < dt1) {
      dt2 = moment(dt2).add(1, 'day').toDate();
    }
    
    return moment(dt2).diff(moment(dt1), 'minutes');
  }

  /**
   * Add days to a date in Sri Lanka timezone
   */
  static addDays(date: Date | string, days: number): Date {
    return moment(date).tz(this.TIMEZONE).add(days, 'days').toDate();
  }

  /**
   * Add minutes to a time on a specific date
   */
  static addMinutes(date: string, time: string, minutes: number): {
    date: string;
    time: string;
  } {
    const dt = this.combineDateTime(date, time);
    const newDt = moment(dt).add(minutes, 'minutes');
    
    return {
      date: newDt.format(this.DATE_FORMAT),
      time: newDt.format(this.TIME_FORMAT)
    };
  }

  /**
   * Format time for display (HH:MM AM/PM)
   */
  static formatTimeForDisplay(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  /**
   * Format date for display (DD/MM/YYYY)
   */
  static formatDateForDisplay(date: Date | string): string {
    return moment(date).tz(this.TIMEZONE).format('DD/MM/YYYY');
  }

  /**
   * Format datetime for display (DD/MM/YYYY HH:MM AM/PM)
   */
  static formatDateTimeForDisplay(dateTime: Date | string): string {
    return moment(dateTime).tz(this.TIMEZONE).format('DD/MM/YYYY hh:mm A');
  }

  /**
   * Get date range filters for different time periods
   */
  static getDateRangeForFilter(filter: 'today' | 'week' | 'month' | 'all'): {
    startDate: Date;
    endDate: Date;
  } {
    const now = moment().tz(this.TIMEZONE);
    
    switch (filter) {
      case 'today':
        return {
          startDate: now.clone().startOf('day').toDate(),
          endDate: now.clone().endOf('day').toDate()
        };
        
      case 'week':
        return {
          startDate: now.clone().startOf('week').toDate(),
          endDate: now.clone().endOf('week').toDate()
        };
        
      case 'month':
        return {
          startDate: now.clone().startOf('month').toDate(),
          endDate: now.clone().endOf('month').toDate()
        };
        
      case 'all':
      default:
        return {
          startDate: moment('2000-01-01').tz(this.TIMEZONE).toDate(),
          endDate: now.clone().add(100, 'years').toDate()
        };
    }
  }

  /**
   * Check if a time is within a range considering midnight wrap
   */
  static isTimeInRange(
    time: string,
    rangeStart: string,
    rangeEnd: string
  ): boolean {
    const timeMoment = moment(time, this.TIME_FORMAT);
    const startMoment = moment(rangeStart, this.TIME_FORMAT);
    const endMoment = moment(rangeEnd, this.TIME_FORMAT);
    
    if (startMoment.isBefore(endMoment)) {
      // Normal range
      return timeMoment.isBetween(startMoment, endMoment, null, '[]');
    } else {
      // Range crosses midnight
      return (
        timeMoment.isBetween(startMoment, moment('23:59:59', this.TIME_FORMAT), null, '[]') ||
        timeMoment.isBetween(moment('00:00:00', this.TIME_FORMAT), endMoment, null, '[]')
      );
    }
  }

  /**
   * Calculate duration between two timestamps in Sri Lanka timezone
   */
  static calculateDuration(
    startTime: Date,
    endTime: Date,
    unit: 'minutes' | 'hours' = 'minutes'
  ): number {
    const start = moment(startTime).tz(this.TIMEZONE);
    const end = moment(endTime).tz(this.TIMEZONE);
    
    if (unit === 'hours') {
      return parseFloat(end.diff(start, 'hours', true).toFixed(2));
    }
    return end.diff(start, 'minutes');
  }

  /**
   * Validate that a date is not in the past (Sri Lanka timezone)
   */
  static validateNotPast(date: Date | string, fieldName: string): void {
    if (this.isPast(date)) {
      throw new Error(`${fieldName} cannot be in the past`);
    }
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: Date, endDate: Date): void {
    if (moment(startDate).isAfter(moment(endDate))) {
      throw new Error('Start date must be before or equal to end date');
    }
    
    const maxDays = 365;
    const daysDiff = moment(endDate).diff(moment(startDate), 'days');
    
    if (daysDiff > maxDays) {
      throw new Error(`Date range cannot exceed ${maxDays} days`);
    }
  }

  /**
   * Generate array of dates between range (inclusive)
   */
  static getDatesInRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = moment(startDate).tz(this.TIMEZONE).startOf('day');
    const end = moment(endDate).tz(this.TIMEZONE).startOf('day');
    
    while (current.isSameOrBefore(end)) {
      dates.push(current.clone().toDate());
      current.add(1, 'day');
    }
    
    return dates;
  }

  /**
   * Check if a date is a weekend in Sri Lanka (Saturday or Sunday)
   */
  static isWeekend(date: Date | string): boolean {
    const day = moment(date).tz(this.TIMEZONE).day();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  /**
   * Get next working day (excluding weekends)
   */
  static getNextWorkingDay(date: Date = new Date()): Date {
    let nextDay = moment(date).tz(this.TIMEZONE).add(1, 'day');
    while (this.isWeekend(nextDay.toDate())) {
      nextDay.add(1, 'day');
    }
    return nextDay.toDate();
  }
}