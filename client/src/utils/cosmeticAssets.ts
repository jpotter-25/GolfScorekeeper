// Import cosmetic assets
import classicBlueCardBack from "@assets/generated_images/Classic_Blue_Card_Back_be4bbe28.png";
import royalRedCardBack from "@assets/generated_images/Royal_Red_Card_Back_aafc7f73.png";
import midnightBlackCardBack from "@assets/generated_images/Midnight_Black_Card_Back_37a72889.png";
import greenFeltTable from "@assets/generated_images/Green_Felt_Table_Texture_2c002c0f.png";
import mahoganyWoodTable from "@assets/generated_images/Mahogany_Wood_Table_47b7e302.png";

// Asset mapping for cosmetics
export const cosmeticAssets: Record<string, string> = {
  "classic_blue": classicBlueCardBack,
  "royal_red": royalRedCardBack,
  "midnight_black": midnightBlackCardBack,
  "green_felt": greenFeltTable,
  "wood_mahogany": mahoganyWoodTable,
};

// Helper function to get asset URL
export function getCosmeticAsset(cosmeticId: string): string | undefined {
  return cosmeticAssets[cosmeticId];
}