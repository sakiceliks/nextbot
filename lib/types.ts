export type AutoCategory = {
  label: string;
  keywords: string[];
};

export type VehicleBrand = {
  marka: string;
  modeller: string[];
};

export type VehicleTypeReference = {
  name: string;
  brands: VehicleBrand[];
};

export type CategoryTreeNode = {
  id: number;
  name: string;
  children: CategoryTreeNode[];
};

export type ListingFieldConfidence = {
  brand: number;
  model: number;
  vehicleType: number;
  partCategory: number;
  product: number;
};

export type ListingDraft = {
  _id: string;
  name: string;
  slug: string;
  brand: string;
  model: string;
  series: string;
  product: string;
  productType: string;
  vehicleType: string;
  condition: string;
  category: string;
  partCategory: string;
  price: number;
  description: string;
  imageUrl: string;
  imagePath: string;
  inStock: boolean;
  createdAt: string;
  categoryPath: string[];
  confidence: number;
  fieldConfidence: ListingFieldConfidence;
  sourceHints: string[];
  warnings: string[];
};

export type AnalyzeResult = {
  lensRaw: unknown;
  draft: ListingDraft;
};

export type PublishMode = "draft" | "publish";
