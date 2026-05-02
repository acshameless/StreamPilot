export interface SKU {
  id: string;
  name: string;
  price: string;
  material: string;
  sellingPoints: string[];
  bannedWords: string[];
  imageUrl: string;
  script: string;
  createdAt: number;
  updatedAt: number;
}

export type SkuInput = Pick<
  SKU,
  "name" | "price" | "material" | "sellingPoints" | "bannedWords"
> & { imageUrl?: string; script?: string };
