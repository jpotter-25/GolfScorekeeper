// Import cosmetic assets - Card Backs
import classicBlueCardBack from "@assets/generated_images/Classic_Blue_Card_Back_d609ccbb.png";
import royalRedCardBack from "@assets/generated_images/Royal_Red_Velvet_Back_69d585c4.png";
import midnightBlackCardBack from "@assets/generated_images/Midnight_Black_Star_Back_acdd879d.png";
import forestNatureBack from "@assets/generated_images/Forest_Nature_Back_cf54e94f.png";
import oceanWaveBack from "@assets/generated_images/Ocean_Wave_Back_dcebe69a.png";
import mysticGalaxyBack from "@assets/generated_images/Mystic_Galaxy_Back_f8bcaa3a.png";
import goldenCelticBack from "@assets/generated_images/Golden_Celtic_Back_0810fdc3.png";
import dragonOrientalBack from "@assets/generated_images/Dragon_Oriental_Back_db181a47.png";
import cyberpunkNeonBack from "@assets/generated_images/Cyberpunk_Neon_Back_55346ffb.png";
import steampunkGearsBack from "@assets/generated_images/Steampunk_Gears_Back_20802675.png";
import marbleLuxuryBack from "@assets/generated_images/Marble_Luxury_Back_dceabaf2.png";
import tropicalParadiseBack from "@assets/generated_images/Tropical_Paradise_Back_6b2110c0.png";
import arcticIceBack from "@assets/generated_images/Arctic_Ice_Back_27d09823.png";
import phoenixFireBack from "@assets/generated_images/Phoenix_Fire_Back_26711800.png";
import diamondGeometricBack from "@assets/generated_images/Diamond_Geometric_Back_4dc0fa3b.png";
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
  // Card Backs
  "classic_blue": classicBlueCardBack,
  "royal_red": royalRedCardBack,
  "midnight_black": midnightBlackCardBack,
  "forest_nature": forestNatureBack,
  "ocean_wave": oceanWaveBack,
  "mystic_galaxy": mysticGalaxyBack,
  "golden_celtic": goldenCelticBack,
  "dragon_oriental": dragonOrientalBack,
  "cyberpunk_neon": cyberpunkNeonBack,
  "steampunk_gears": steampunkGearsBack,
  "marble_luxury": marbleLuxuryBack,
  "tropical_paradise": tropicalParadiseBack,
  "arctic_ice": arcticIceBack,
  "phoenix_fire": phoenixFireBack,
  "diamond_geometric": diamondGeometricBack,
  
  // Table Themes
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