export type Product = {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency: string;
  image: string;
  images: string[];
  collectionIds: string[];
  shortDescription: string;
  description: string;
  soldOut?: boolean;
  featured?: boolean;
  /** Mjere u cm; 0 ili izostavljeno = ne prikazuj na kartici. */
  widthCm?: number;
  heightCm?: number;
  /** Promjer (⌀) u cm. */
  diameterCm?: number;
  /** Oblik (slobodan tekst). */
  shape?: string;
  /** Tekst je već u aktivnom jeziku iz arhive — bez strojnog prijevoda. */
  skipMachineTranslateTitle?: boolean;
  skipMachineTranslateShort?: boolean;
  skipMachineTranslateDescription?: boolean;
  skipMachineTranslateShape?: boolean;
};

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  /** Tekst je već u aktivnom jeziku (npr. iz spremljenog prijevoda) — bez strojnog prijevoda. */
  skipMachineTranslateTitle?: boolean;
  skipMachineTranslateDescription?: boolean;
};
