import {SetMetadata} from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** 标记接口需要指定角色才能访问 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);