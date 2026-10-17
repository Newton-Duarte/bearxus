import { Text, type TextProps } from "./text";

const headingProps: TextProps<"h2"> = {
  as: "h2",
  id: "page-title",
  variant: "h2",
};

const linkProps: TextProps<"a"> = {
  as: "a",
  href: "/dashboard",
  variant: "muted",
};

const invalidParagraphProps: TextProps<"p"> = {
  // @ts-expect-error href belongs to anchor elements, not paragraphs.
  href: "/dashboard",
};

const invalidInputProps: TextProps<"input"> = {
  // @ts-expect-error href belongs to anchor elements, not inputs.
  href: "/dashboard",
};

const defaultText = <Text variant="body">Body copy</Text>;
const customElement = <Text as="a" href="/profile">Profile</Text>;

void [headingProps, linkProps, invalidParagraphProps, invalidInputProps, defaultText, customElement];
