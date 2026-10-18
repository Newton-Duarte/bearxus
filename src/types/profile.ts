import type { OAuthProviderId } from "@/lib/oauth-providers";

export interface ProfileStats {
  notes: number;
  projects: number;
  tasks: number;
  resources: number;
  transactions: number;
}

export interface AuthorizedApplication {
  provider: OAuthProviderId;
  connected: boolean;
  canDisconnect: boolean;
}

export interface ProfileData {
  user: {
    name: string | null;
    email: string;
    image: string | null;
    createdAt: Date;
    canChangePassword: boolean;
  };
  authorizedApplications: AuthorizedApplication[];
  stats: ProfileStats;
}

export interface ChangePasswordState {
  success: boolean;
  error: string | null;
  fieldErrors?: Partial<
    Record<"currentPassword" | "password" | "confirmPassword", string>
  >;
}

export interface UnlinkProviderState {
  success: boolean;
  error: string | null;
}

export const initialChangePasswordState: ChangePasswordState = {
  success: false,
  error: null,
};

export const initialUnlinkProviderState: UnlinkProviderState = {
  success: false,
  error: null,
};
