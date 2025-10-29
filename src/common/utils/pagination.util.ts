export const toPagination = (page = 0, limit = 10) => ({ skip: page * limit, take: limit });
