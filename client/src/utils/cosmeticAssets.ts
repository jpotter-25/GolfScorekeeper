// Import cosmetic assets - Card backs (NEW - No white borders)
import classicRoyalBlueCardBack from "@assets/generated_images/Royal_blue_luxury_card_back_1ffa9a63.png";
import crimsonGoldOrnateCardBack from "@assets/generated_images/Crimson_gold_ornate_card_back_0dd11d91.png";
import emeraldCelticCardBack from "@assets/generated_images/Emerald_Celtic_pattern_card_back_a37b4373.png";
import midnightGeometricCardBack from "@assets/generated_images/Midnight_geometric_card_back_08947429.png";
import purpleArtDecoCardBack from "@assets/generated_images/Purple_Art_Deco_card_back_5f4e5114.png";
import bronzeWesternCardBack from "@assets/generated_images/Bronze_Western_style_card_back_2a3082f0.png";
import nauticalOceanCardBack from "@assets/generated_images/Nautical_ocean_wave_card_back_90fa67cb.png";
import forestBotanicalCardBack from "@assets/generated_images/Forest_botanical_luxury_card_back_8fccb385.png";
import cyberpunkNeonCardBack from "@assets/generated_images/Cyberpunk_neon_tech_card_back_b9ef9432.png";
import roseGoldMarbleCardBack from "@assets/generated_images/Rose_gold_marble_card_back_03710169.png";
import antiqueIvoryCardBack from "@assets/generated_images/Antique_ivory_heritage_card_back_9596359b.png";
import turquoiseTribalCardBack from "@assets/generated_images/Turquoise_tribal_pattern_card_back_0e7e7c24.png";
import mahoganyBaroqueCardBack from "@assets/generated_images/Mahogany_baroque_luxury_card_back_70363571.png";
import pearlHolographicCardBack from "@assets/generated_images/Pearl_holographic_modern_card_back_6995c5ee.png";
import steelSteampunkCardBack from "@assets/generated_images/Steel_steampunk_industrial_card_back_2da7ac41.png";
import greenFeltTable from "@assets/generated_images/Green_Felt_Table_Texture_2c002c0f.png";
import mahoganyWoodTable from "@assets/generated_images/Mahogany_Wood_Table_47b7e302.png";
import professionalAvatar from "@assets/generated_images/Professional_Business_Avatar_8860d667.png";
import gamingAvatar from "@assets/generated_images/Gaming_Enthusiast_Avatar_6f97dd65.png";
import elegantAvatar from "@assets/generated_images/Elegant_Premium_Avatar_db98b5b8.png";
import mysteriousAvatar from "@assets/generated_images/Mysterious_Shadow_Avatar_9d70c2ca.png";
import golferAvatar from "@assets/generated_images/Professional_Golfer_Avatar_52698db1.png";
import beachAvatar from "@assets/generated_images/Beach_Vacation_Avatar_19a231ab.png";
import pokerAvatar from "@assets/generated_images/Poker_Player_Avatar_692713df.png";
import femaleProAvatar from "@assets/generated_images/Professional_Female_Avatar_ce38d866.png";
import americanFlagAvatar from "@assets/generated_images/American_Flag_Avatar_88ae7301.png";
import femaleGamerAvatar from "@assets/generated_images/Female_Gamer_Avatar_d7259774.png";
import defaultAvatar from "@assets/generated_images/Simple_Default_Avatar_fab5c9e0.png";

// Asset mapping for cosmetics
export const cosmeticAssets: Record<string, string> = {
  // Card backs
  "classic_royal_blue": classicRoyalBlueCardBack,
  "crimson_gold_ornate": crimsonGoldOrnateCardBack,
  "emerald_celtic": emeraldCelticCardBack,
  "midnight_geometric": midnightGeometricCardBack,
  "purple_art_deco": purpleArtDecoCardBack,
  "bronze_western": bronzeWesternCardBack,
  "nautical_ocean": nauticalOceanCardBack,
  "forest_botanical": forestBotanicalCardBack,
  "cyberpunk_neon": cyberpunkNeonCardBack,
  "rose_gold_marble": roseGoldMarbleCardBack,
  "antique_ivory": antiqueIvoryCardBack,
  "turquoise_tribal": turquoiseTribalCardBack,
  "mahogany_baroque": mahoganyBaroqueCardBack,
  "pearl_holographic": pearlHolographicCardBack,
  "steel_steampunk": steelSteampunkCardBack,
  // Table themes
  "green_felt": greenFeltTable,
  "wood_mahogany": mahoganyWoodTable,
  "default_avatar": defaultAvatar,
  "professional_avatar": professionalAvatar,
  "gaming_avatar": gamingAvatar,
  "elegant_avatar": elegantAvatar,
  "mysterious_avatar": mysteriousAvatar,
  "golfer_avatar": golferAvatar,
  "beach_avatar": beachAvatar,
  "poker_avatar": pokerAvatar,
  "female_pro_avatar": femaleProAvatar,
  "american_flag_avatar": americanFlagAvatar,
  "female_gamer_avatar": femaleGamerAvatar,
};

// Helper function to get asset URL
export function getCosmeticAsset(cosmeticId: string): string | undefined {
  return cosmeticAssets[cosmeticId];
}