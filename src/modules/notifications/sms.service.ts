// src/infra/sms/sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiToken: string;
  private readonly senderId: string;
  private readonly apiUrl: string;

  constructor(private configService: ConfigService, private httpService: HttpService) {
    this.apiToken = this.configService.get('TEXT_LK_API_TOKEN');
    this.senderId = this.configService.get('TEXT_LK_SENDER_ID', 'Notify');
    this.apiUrl = this.configService.get('TEXT_LK_API_URL', 'https://app.text.lk/api/v3');
  }

  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Format Sri Lankan phone number (remove + and spaces)
      const formattedNumber = this.formatSriLankanNumber(phoneNumber);

      if (!this.isValidSriLankanNumber(formattedNumber)) {
        this.logger.warn(`Invalid Sri Lankan phone number: ${phoneNumber}`);
        console.log(`Invalid Sri Lankan phone number: ${phoneNumber}`);
        return false;
      }

      // Text.lk API request using OAuth 2.0 endpoint
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/sms/send`,
          {
            recipient: formattedNumber,
            sender_id: this.senderId,
            type: 'plain',
            message: message,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      ); //console.log("response :", response);

      // Check response
      if (response.data && response.data.status == 'success') {
        this.logger.log(`SMS sent to ${formattedNumber}: ${response.data.data?.sms_id}`);
        //console.log(`SMS sent to ${formattedNumber}: ${response.data.data?.sms_id}`);
        return true;
      } else {
        this.logger.error(`Text.lk API error: ${response.data?.message}`);
        //console.error(`Text.lk API error: ${response.data?.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      if (error.response) {
        this.logger.error(`API Response: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  async sendBulkSms(
    phoneNumbers: string[],
    message: string,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Process in batches to avoid rate limiting
    const batchSize = 100;
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);

      for (const phone of batch) {
        const result = await this.sendSms(phone, message);
        if (result) {
          success++;
        } else {
          failed++;
        }

        // Small delay between messages (100ms)
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait between batches (1 second)
      if (i + batchSize < phoneNumbers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { success, failed };
  }

  async sendMultipleRecipients(phoneNumbers: string[], message: string): Promise<boolean> {
    try {
      // Format all numbers
      const formattedNumbers = phoneNumbers
        .map((num) => this.formatSriLankanNumber(num))
        .filter((num) => this.isValidSriLankanNumber(num))
        .join(',');

      if (!formattedNumbers) {
        this.logger.warn('No valid phone numbers provided');
        return false;
      }

      // Send to multiple recipients at once
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/sms/send`,
          {
            recipient: formattedNumbers,
            sender_id: this.senderId,
            type: 'plain',
            message: message,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      if (response.data && response.data.status === true) {
        this.logger.log(`Bulk SMS sent to ${phoneNumbers.length} recipients`);
        return true;
      } else {
        this.logger.error(`Bulk SMS failed: ${response.data?.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS: ${error.message}`);
      return false;
    }
  }

  async checkBalance(): Promise<number | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/balance`, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }),
      );

      if (response.data && response.data.balance !== undefined) {
        this.logger.log(`SMS balance: ${response.data.balance}`);
        return response.data.balance;
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to check balance: ${error.message}`);
      return null;
    }
  }

  async getSmsStatus(smsId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/sms/${smsId}`, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
          },
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get SMS status: ${error.message}`);
      return null;
    }
  }

  private formatSriLankanNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Sri Lankan number formats
    if (cleaned.length === 9) {
      // 7XXXXXXXX (9 digits) - add 94 prefix
      cleaned = '94' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
      // 07XXXXXXXX (10 digits with leading 0) - remove 0 and add 94
      cleaned = '94' + cleaned.substring(1);
    } else if (cleaned.length === 11 && cleaned.startsWith('94')) {
      // Already has 94 prefix (11 digits)
      cleaned = cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('94')) {
      // Has 94 prefix with extra digit
      cleaned = cleaned;
    } else {
      // Default: assume local number without prefix
      cleaned = '94' + cleaned;
    }

    return cleaned;
  }

  private isValidSriLankanNumber(phoneNumber: string): boolean {
    // Sri Lankan numbers should start with 94 and have 11 digits total
    const sriLankaPattern = /^94\d{9}$/;
    return sriLankaPattern.test(phoneNumber);
  }
}
