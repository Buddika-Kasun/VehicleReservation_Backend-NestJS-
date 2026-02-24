import { Module, Global } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FirebaseConfigService } from 'src/config/firebase.config';

@Global()
@Module({
  providers: [
    FirebaseService,
    FirebaseConfigService,
  ],
  exports: [
    FirebaseService,
    FirebaseConfigService
  ],
})
export class FirebaseModule {}
