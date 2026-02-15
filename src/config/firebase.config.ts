// src/infra/firebase/firebase.config.ts
import { Injectable } from '@nestjs/common';
import { warn } from 'console';

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  privateKeyId?: string;
  clientId?: string;
}

@Injectable()
export class FirebaseConfigService {
  private readonly config: FirebaseConfig;

  constructor() {
    this.config = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      //privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      privateKey: this.processPrivateKey(process.env.FIREBASE_PRIVATE_KEY || ''),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      clientId: process.env.FIREBASE_CLIENT_ID,
    };
    
    this.validateConfig();
  }

  /**
   * Process private key to handle multiple formats:
   * 1. With actual newlines (multi-line in .env)
   * 2. With escaped newlines (\n) 
   * 3. With literal \n characters
   * 4. Base64 encoded (less common)
   */
  private processPrivateKey(rawKey: string): string {
    if (!rawKey || rawKey.trim().length === 0) {
      return '';
    }

    // Remove surrounding quotes if present
    let processedKey = rawKey.trim();
    if (processedKey.startsWith('"') && processedKey.endsWith('"')) {
      processedKey = processedKey.slice(1, -1);
    }
    if (processedKey.startsWith("'") && processedKey.endsWith("'")) {
      processedKey = processedKey.slice(1, -1);
    }

    // Check which format we have
    const hasEscapedNewlines = processedKey.includes('\\n');
    const hasActualNewlines = processedKey.includes('\n');
    
    // Format 1: Handle escaped newlines (\n)
    if (hasEscapedNewlines && !hasActualNewlines) {
      processedKey = processedKey.replace(/\\n/g, '\n');
    }
    // Format 2: Already has actual newlines (multi-line .env)
    else if (hasActualNewlines) {
      // Already correct, just ensure it's properly formatted
      processedKey = processedKey.trim();
    }
    // Format 3: No newlines at all (might be single line or malformed)
    else {
      // Check if it's a valid private key without newlines
      if (processedKey.includes('BEGINPRIVATEKEY') || processedKey.includes('ENDPRIVATEKEY')) {
        // Try to fix missing spaces
        processedKey = processedKey
          .replace(/BEGINPRIVATEKEY/g, 'BEGIN PRIVATE KEY')
          .replace(/ENDPRIVATEKEY/g, 'END PRIVATE KEY');
      }
    }

    // Ensure proper BEGIN/END formatting
    if (!processedKey.includes('BEGIN PRIVATE KEY')) {
      processedKey = '-----BEGIN PRIVATE KEY-----\n' + processedKey;
    }
    if (!processedKey.includes('END PRIVATE KEY')) {
      processedKey = processedKey + '\n-----END PRIVATE KEY-----';
    }

    // Clean up multiple newlines
    processedKey = processedKey
      .replace(/\r\n/g, '\n')  // Convert Windows CRLF to LF
      .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
      .trim();

    return processedKey;
  }

  private validateConfig(): void {
    const errors: string[] = [];
    
    if (!this.config.projectId) {
      errors.push('FIREBASE_PROJECT_ID is required');
    }
    
    if (!this.config.privateKey) {
      errors.push('FIREBASE_PRIVATE_KEY is required');
    } else {
      // Validate private key format
      const key = this.config.privateKey;
      
      if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
        errors.push('Private key must start with "-----BEGIN PRIVATE KEY-----"');
      }
      
      if (!key.includes('-----END PRIVATE KEY-----')) {
        errors.push('Private key must end with "-----END PRIVATE KEY-----"');
      }
      
      if (!key.includes('\n')) {
        //warnings.push('Private key should contain newlines for proper formatting');
      }
      
      // Check key length (rough validation)
      const keyContent = key
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\n/g, '')
        .trim();
        
      if (keyContent.length < 100) {
        //warnings.push('Private key seems too short. Expected ~1600 chars, got ' + keyContent.length);
      }
    }
    
    if (!this.config.clientEmail) {
      errors.push('FIREBASE_CLIENT_EMAIL is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Firebase configuration error:\n${errors.join('\n')}`);
    }
  }

  getConfig(): FirebaseConfig {
    return this.config;
  }

  getServiceAccount() {
    return {
      type: 'service_account',
      project_id: this.config.projectId,
      private_key_id: this.config.privateKeyId || 'default-key-id',
      private_key: this.config.privateKey,
      client_email: this.config.clientEmail,
      client_id: this.config.clientId || 'default-client-id',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(this.config.clientEmail)}`,
    };
  }
}