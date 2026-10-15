export interface AuthFormState {
  success: boolean;
  data: null;
  error: string | null;
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>;
}

export interface AccountUser {
  name: string | null;
  email: string | null;
  image: string | null;
}
