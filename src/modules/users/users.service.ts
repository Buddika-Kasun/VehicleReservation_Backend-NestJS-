import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { hash } from '../../common/utils/hash.util';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOneBy({ email });
  }

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  async create(data: Partial<User>) {
    const hashed = await hash(data.password as string);
    const user = this.repo.create({ ...data, password: hashed });
    return this.repo.save(user);
  }
}
