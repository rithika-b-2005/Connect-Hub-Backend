import {
  MediaType as PrismaMediaType,
  UserRole as PrismaUserRole,
} from '../generated/prisma/client';

// Prisma derives the TypeScript enum value from the member NAME, and @map only
// renames the value stored in the column. The database stores lowercase
// ('admin', 'user', 'image', 'video') and the frontend compares
// `role === 'admin'` / `media.type === 'video'`, so the Prisma members are
// lowercase and these aliases keep the SCREAMING_CASE call sites readable
// without changing a single runtime value.
export const UserRole = {
  ADMIN: PrismaUserRole.admin,
  USER: PrismaUserRole.user,
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const MediaType = {
  IMAGE: PrismaMediaType.image,
  VIDEO: PrismaMediaType.video,
} as const;
export type MediaType = (typeof MediaType)[keyof typeof MediaType];
