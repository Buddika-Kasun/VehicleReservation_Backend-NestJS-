# NestJS Boilerplate (TypeORM + PostgreSQL + JWT)

## Quick start
1. Copy `.env.example` to `.env` and fill DB credentials.
2. `npm install`
3. `npm run start:dev`

Swagger docs: `http://localhost:3000/docs`

## Structure
```
nestjs-boilerplate/
│
├── src/
│ ├── config/
│ │ ├── app.config.ts
│ │ ├── database.config.ts
│ │ └── jwt.config.ts
│ │
│ ├── common/
│ │ ├── decorators/
│ │ │ ├── current-user.decorator.ts
│ │ │ ├── public.decorator.ts
│ │ │ ├── roles.decorator.ts
│ │ │ └── api-paginated-response.decorator.ts
│ │ │
│ │ ├── filters/
│ │ │ ├── all-exceptions.filter.ts
│ │ │ └── http-exception.filter.ts
│ │ │
│ │ ├── guards/
│ │ │ ├── jwt-auth.guard.ts
│ │ │ ├── local-auth.guard.ts
│ │ │ └── roles.guard.ts
│ │ │
│ │ ├── interceptors/
│ │ │ ├── logging.interceptor.ts
│ │ │ ├── transform.interceptor.ts
│ │ │ └── timeout.interceptor.ts
│ │ │
│ │ ├── pipes/
│ │ │ └── validation.pipe.ts
│ │ │
│ │ ├── dto/
│ │ │ └── pagination.dto.ts
│ │ │
│ │ ├── interfaces/
│ │ │ └── response.interface.ts
│ │ │
│ │ ├── utils/
│ │ │ ├── hash.util.ts
│ │ │ ├── date.util.ts
│ │ │ ├── pagination.util.ts
│ │ │ └── response.util.ts
│ │ │
│ │ └── constants/
│ │ ├── error-messages.ts
│ │ └── success-messages.ts
│ │
│ ├── modules/
│ │ ├── auth/
│ │ │ ├── dto/
│ │ │ │ ├── login.dto.ts
│ │ │ │ ├── register.dto.ts
│ │ │ │ └── refresh-token.dto.ts
│ │ │ │
│ │ │ ├── strategies/
│ │ │ │ ├── jwt.strategy.ts
│ │ │ │ └── local.strategy.ts
│ │ │ │
│ │ │ ├── auth.controller.ts
│ │ │ ├── auth.service.ts
│ │ │ └── auth.module.ts
│ │ │
│ │ ├── users/
│ │ │ ├── dto/
│ │ │ │ ├── create-user.dto.ts
│ │ │ │ ├── update-user.dto.ts
│ │ │ │ └── change-password.dto.ts
│ │ │ │
│ │ │ ├── entities/
│ │ │ │ └── user.entity.ts
│ │ │ │
│ │ │ ├── users.controller.ts
│ │ │ ├── users.service.ts
│ │ │ └── users.module.ts
│ │ │
│ │ └── health/
│ │ ├── health.controller.ts
│ │ └── health.module.ts
│ │
│ ├── database/
│ │ ├── migrations/
│ │ │ └── (migration files will be generated here)
│ │ │
│ │ └── seeds/
│ │ └── (seed files go here)
│ │
│ ├── app.module.ts
│ └── main.ts
│
├── test/
│ ├── app.e2e-spec.ts
│ └── jest-e2e.json
│
├── node_modules/
│
├── .env
├── .env.example
├── .gitignore
├── .dockerignore
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```
