// src/infra/firebase/firebase.config.ts
import { Injectable } from '@nestjs/common';

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
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
      clientId: process.env.FIREBASE_CLIENT_ID,
    };
    
    this.validateConfig();
  }

  private validateConfig(): void {
    const errors: string[] = [];
    
    if (!this.config.projectId) {
      errors.push('FIREBASE_PROJECT_ID is required');
    }
    
    if (!this.config.privateKey) {
      errors.push('FIREBASE_PRIVATE_KEY is required');
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