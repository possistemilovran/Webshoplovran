import { TranslatedText } from "@/components/TranslatedText";

type Props = {
  text: string;
  /** Ako je true, tekst je već na aktivnom jeziku (npr. iz arhive) — bez LibreTranslate. */
  skipTranslate?: boolean;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
};

export function MaybeTranslated({
  text,
  skipTranslate,
  as: Tag = "span",
  className,
}: Props) {
  if (skipTranslate) {
    return <Tag className={className}>{text}</Tag>;
  }
  return <TranslatedText text={text} as={Tag} className={className} />;
}
