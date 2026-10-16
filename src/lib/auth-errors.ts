import { CredentialsSignin } from "next-auth";

export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}
