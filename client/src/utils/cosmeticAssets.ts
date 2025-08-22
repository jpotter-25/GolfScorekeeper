// Import cosmetic assets
import classicBlueCardBack from "@assets/generated_images/Classic_Blue_Card_Back_be4bbe28.png";
import royalRedCardBack from "@assets/generated_images/Royal_Red_Card_Back_aafc7f73.png";
import midnightBlackCardBack from "@assets/generated_images/Midnight_Black_Card_Back_37a72889.png";
import greenFeltTable from "@assets/generated_images/Green_Felt_Table_Texture_2c002c0f.png";
import mahoganyWoodTable from "@assets/generated_images/Mahogany_Wood_Table_47b7e302.png";
import professionalAvatar from "@assets/generated_images/Professional_Business_Avatar_8860d667.png";
import gamingAvatar from "@assets/generated_images/Gaming_Enthusiast_Avatar_6f97dd65.png";
import elegantAvatar from "@assets/generated_images/Elegant_Premium_Avatar_db98b5b8.png";
import mysteriousAvatar from "@assets/generated_images/Mysterious_Shadow_Avatar_9d70c2ca.png";

// Asset mapping for cosmetics
export const cosmeticAssets: Record<string, string> = {
  "classic_blue": classicBlueCardBack,
  "royal_red": royalRedCardBack,
  "midnight_black": midnightBlackCardBack,
  "green_felt": greenFeltTable,
  "wood_mahogany": mahoganyWoodTable,
  "professional_avatar": professionalAvatar,
  "gaming_avatar": gamingAvatar,
  "elegant_avatar": elegantAvatar,
  "mysterious_avatar": mysteriousAvatar,
};

// Helper function to get asset URL
export function getCosmeticAsset(cosmeticId: string): string | undefined {
  return cosmeticAssets[cosmeticId];
}