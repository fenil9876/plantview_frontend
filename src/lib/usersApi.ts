import { api } from "./api";
import type { Role, User } from "./types";

export interface UserCreatePayload {
  email: string;
  username: string;
  password: string;
  roles: Role[];
}

export async function listUsers(): Promise<User[]> {
  return (await api.get<User[]>("/users")).data;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  return (await api.post<User>("/users", payload)).data;
}

export async function updateUserRoles(id: number, roles: Role[]): Promise<User> {
  return (await api.put<User>(`/users/${id}/roles`, { roles })).data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
