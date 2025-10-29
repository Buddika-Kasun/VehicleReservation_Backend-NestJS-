import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

export function ApiPaginatedResponse<TModel extends Type<any>>(model: TModel) {
  return applyDecorators(ApiOkResponse({ description: 'Paginated response' }));
}
