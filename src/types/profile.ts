export interface ProfileStats {
  notes: number;
  projects: number;
  tasks: number;
  resources: number;
  transactions: number;
}

export interface ProfileData {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    createdAt: Date;
    canChangePassword: boolean;
  };
  stats: ProfileStats;
}

export interface ChangePasswordState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<
    Record<"currentPassword" | "password" | "confirmPassword", string>
  >;
}

export const initialChangePasswordState: ChangePasswordState = {
  success: false,
  error: null,
};
