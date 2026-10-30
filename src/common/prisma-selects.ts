// TypeORM's `@Column({ select: false })` on User.password had no Prisma
// equivalent: Prisma returns EVERY scalar field unless you pass an explicit
// `select`, and `include: { author: true }` pulls in all of the related
// model's scalars too — password included.
//
// These allowlists are the fix. They fail safe: a column added to the schema
// later stays out of API responses until someone deliberately adds it here.

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  coverUrl: true,
  createdAt: true,
} as const;

// Only ever used on the login / password-change paths, which genuinely need
// the hash to run bcrypt.compare.
export const credentialUserSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  role: true,
  avatarUrl: true,
  coverUrl: true,
  createdAt: true,
} as const;

// The post feed only needs to know WHO liked a post, never their details.
export const likerIdSelect = {
  id: true,
} as const;
