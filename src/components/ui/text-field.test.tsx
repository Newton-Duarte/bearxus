import { TextField, type TextFieldProps } from "./text-field";

const emailProps: TextFieldProps = {
  label: "Email",
  name: "email",
  type: "email",
  autoComplete: "email",
  description: "Use the address attached to your workspace.",
  error: "Enter a valid email address.",
};

const explicitIdProps: TextFieldProps = {
  id: "profile-email",
  label: "Profile email",
  name: "email",
  className: "h-12",
};

const invalidElementProps: TextFieldProps = {
  label: "Invalid",
  // @ts-expect-error href is not an input attribute.
  href: "/profile",
};

const repeatedFields = (
  <>
    <TextField label="First field" name="first" />
    <TextField label="Second field" name="second" />
  </>
);

void [emailProps, explicitIdProps, invalidElementProps, repeatedFields];
