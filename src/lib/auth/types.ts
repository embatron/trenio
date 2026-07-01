export type UserRole = "user" | "trainer" | "club" | "admin" | "superadmin";

export type SignupIntent =
  | "client_signup"
  | "trainer_create"
  | "branch_create"
  | "brand_create"
  | "trainer_claim";

export type UserStatus = "pending_verification" | "active" | "suspended" | "deleted";
