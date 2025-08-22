import { db } from "./db";
import { achievements, cosmetics } from "@shared/schema";

export async function seedAchievements() {
  const achievementData = [
    {
      id: "first_win",
      name: "First Victory",
      description: "Win your first game of Golf 9",
      icon: "trophy",
      xpReward: 50,
      coinReward: 25,
      requirement: { type: "wins", count: 1 }
    },
    {
      id: "perfect_game",
      name: "Perfect Score",
      description: "Complete a game with a score of 0",
      icon: "star",
      xpReward: 100,
      coinReward: 50,
      requirement: { type: "perfect_score", count: 1 }
    },
    {
      id: "streak_5",
      name: "Hot Streak",
      description: "Win 5 games in a row",
      icon: "fire",
      xpReward: 75,
      coinReward: 35,
      requirement: { type: "win_streak", count: 5 }
    },
    {
      id: "games_10",
      name: "Getting Started",
      description: "Play 10 games",
      icon: "gamepad",
      xpReward: 30,
      coinReward: 15,
      requirement: { type: "games_played", count: 10 }
    },
    {
      id: "level_10",
      name: "Rising Star",
      description: "Reach level 10",
      icon: "level-up",
      xpReward: 150,
      coinReward: 75,
      requirement: { type: "level", count: 10 }
    }
  ];

  await db.insert(achievements).values(achievementData).onConflictDoNothing();
}

export async function seedCosmetics() {
  const cosmeticData = [
    // Card backs
    {
      id: "classic_blue",
      type: "card_back",
      name: "Classic Blue",
      description: "Traditional blue card back design with rounded corners",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "@assets/generated_images/Classic_Blue_Card_Back_d609ccbb.png"
    },
    {
      id: "forest_nature",
      type: "card_back",
      name: "Forest Nature",
      description: "Earthy woodland design with golden oak leaves",
      rarity: "common",
      cost: 25,
      unlockLevel: 2,
      imageUrl: "@assets/generated_images/Forest_Nature_Back_cf54e94f.png"
    },
    {
      id: "ocean_wave",
      type: "card_back",
      name: "Ocean Wave",
      description: "Nautical design with rolling sea waves",
      rarity: "common",
      cost: 30,
      unlockLevel: 3,
      imageUrl: "@assets/generated_images/Ocean_Wave_Back_dcebe69a.png"
    },
    {
      id: "royal_red",
      type: "card_back", 
      name: "Royal Red Velvet",
      description: "Luxurious crimson velvet with gold filigree",
      rarity: "rare",
      cost: 75,
      unlockLevel: 5,
      imageUrl: "@assets/generated_images/Royal_Red_Velvet_Back_69d585c4.png"
    },
    {
      id: "tropical_paradise",
      type: "card_back",
      name: "Tropical Paradise",
      description: "Beach vacation vibes with palm leaves and sunset colors",
      rarity: "rare",
      cost: 90,
      unlockLevel: 6,
      imageUrl: "@assets/generated_images/Tropical_Paradise_Back_6b2110c0.png"
    },
    {
      id: "arctic_ice",
      type: "card_back",
      name: "Arctic Ice",
      description: "Crystalline snowflake pattern with ice blue colors",
      rarity: "rare",
      cost: 100,
      unlockLevel: 8,
      imageUrl: "@assets/generated_images/Arctic_Ice_Back_27d09823.png"
    },
    {
      id: "diamond_geometric",
      type: "card_back",
      name: "Diamond Geometric",
      description: "Modern minimalist design with rose gold accents",
      rarity: "rare",
      cost: 120,
      unlockLevel: 10,
      imageUrl: "@assets/generated_images/Diamond_Geometric_Back_4dc0fa3b.png"
    },
    {
      id: "steampunk_gears",
      type: "card_back",
      name: "Steampunk Gears",
      description: "Victorian-era industrial design with bronze clockwork",
      rarity: "epic",
      cost: 150,
      unlockLevel: 12,
      imageUrl: "@assets/generated_images/Steampunk_Gears_Back_20802675.png"
    },
    {
      id: "midnight_black",
      type: "card_back",
      name: "Midnight Black Star",
      description: "Dark luxury with silver metallic star patterns",
      rarity: "epic",
      cost: 175,
      unlockLevel: 15,
      imageUrl: "@assets/generated_images/Midnight_Black_Star_Back_acdd879d.png"
    },
    {
      id: "dragon_oriental",
      type: "card_back",
      name: "Dragon Oriental",
      description: "Asian-inspired design with mythical dragon silhouette",
      rarity: "epic",
      cost: 200,
      unlockLevel: 18,
      imageUrl: "@assets/generated_images/Dragon_Oriental_Back_db181a47.png"
    },
    {
      id: "marble_luxury",
      type: "card_back",
      name: "Marble Luxury",
      description: "Elegant white and gray marble texture pattern",
      rarity: "epic",
      cost: 225,
      unlockLevel: 20,
      imageUrl: "@assets/generated_images/Marble_Luxury_Back_dceabaf2.png"
    },
    {
      id: "mystic_galaxy",
      type: "card_back",
      name: "Mystic Galaxy",
      description: "Cosmic design with magical stars and ethereal glow",
      rarity: "legendary",
      cost: 300,
      unlockLevel: 25,
      imageUrl: "@assets/generated_images/Mystic_Galaxy_Back_f8bcaa3a.png"
    },
    {
      id: "golden_celtic",
      type: "card_back",
      name: "Golden Celtic",
      description: "Premium gold metallic finish with intricate Celtic knots",
      rarity: "legendary",
      cost: 400,
      unlockLevel: 30,
      imageUrl: "@assets/generated_images/Golden_Celtic_Back_0810fdc3.png"
    },
    {
      id: "cyberpunk_neon",
      type: "card_back",
      name: "Cyberpunk Neon",
      description: "Futuristic design with electric blue and pink circuits",
      rarity: "legendary",
      cost: 500,
      unlockLevel: 35,
      imageUrl: "@assets/generated_images/Cyberpunk_Neon_Back_55346ffb.png"
    },
    {
      id: "phoenix_fire",
      type: "card_back",
      name: "Phoenix Fire",
      description: "Epic fantasy design with flaming phoenix and dramatic fire effects",
      rarity: "legendary",
      cost: 750,
      unlockLevel: 40,
      imageUrl: "@assets/generated_images/Phoenix_Fire_Back_26711800.png"
    },
    // Avatars
    {
      id: "default_avatar", 
      type: "avatar",
      name: "Default",
      description: "Simple default player avatar",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "@assets/generated_images/Simple_Default_Avatar_fab5c9e0.png"
    },
    {
      id: "professional_avatar",
      type: "avatar",
      name: "Professional",
      description: "Confident business professional",
      rarity: "rare",
      cost: 75,
      unlockLevel: 5,
      imageUrl: "@assets/generated_images/Professional_Business_Avatar_8860d667.png"
    },
    {
      id: "gaming_avatar",
      type: "avatar",
      name: "Gaming Pro",
      description: "Elite gaming enthusiast with headphones",
      rarity: "rare",
      cost: 100,
      unlockLevel: 10,
      imageUrl: "@assets/generated_images/Gaming_Enthusiast_Avatar_6f97dd65.png"
    },
    {
      id: "elegant_avatar",
      type: "avatar",
      name: "Elegant Gold",
      description: "Sophisticated luxury avatar",
      rarity: "epic",
      cost: 200,
      unlockLevel: 15,
      imageUrl: "@assets/generated_images/Elegant_Premium_Avatar_db98b5b8.png"
    },
    {
      id: "mysterious_avatar",
      type: "avatar",
      name: "Shadow Walker",
      description: "Enigmatic hooded figure",
      rarity: "legendary",
      cost: 500,
      unlockLevel: 25,
      imageUrl: "@assets/generated_images/Mysterious_Shadow_Avatar_9d70c2ca.png"
    },
    {
      id: "golfer_avatar",
      type: "avatar", 
      name: "Pro Golfer",
      description: "Professional tournament player",
      rarity: "rare",
      cost: 75,
      unlockLevel: 8,
      imageUrl: "@assets/generated_images/Professional_Golfer_Avatar_52698db1.png"
    },
    {
      id: "beach_avatar",
      type: "avatar",
      name: "Beach Vibes",
      description: "Tropical vacation style with sunglasses",
      rarity: "rare",
      cost: 80,
      unlockLevel: 7,
      imageUrl: "@assets/generated_images/Beach_Vacation_Avatar_19a231ab.png"
    },
    {
      id: "poker_avatar",
      type: "avatar",
      name: "Casino Player",
      description: "Sophisticated poker professional",
      rarity: "rare",
      cost: 120,
      unlockLevel: 12,
      imageUrl: "@assets/generated_images/Poker_Player_Avatar_692713df.png"
    },
    {
      id: "female_pro_avatar",
      type: "avatar",
      name: "Executive Lady",
      description: "Confident businesswoman leader",
      rarity: "rare",
      cost: 90,
      unlockLevel: 8,
      imageUrl: "@assets/generated_images/Professional_Female_Avatar_ce38d866.png"
    },
    {
      id: "american_flag_avatar",
      type: "avatar",
      name: "Patriot",
      description: "American flag themed avatar",
      rarity: "epic",
      cost: 250,
      unlockLevel: 18,
      imageUrl: "@assets/generated_images/American_Flag_Avatar_88ae7301.png"
    },
    {
      id: "female_gamer_avatar",
      type: "avatar",
      name: "Gamer Girl",
      description: "Female gaming enthusiast with headset",
      rarity: "rare",
      cost: 110,
      unlockLevel: 11,
      imageUrl: "@assets/generated_images/Female_Gamer_Avatar_d7259774.png"
    },
    // Table themes
    {
      id: "green_felt",
      type: "table_theme",
      name: "Green Felt",
      description: "Classic casino-style green felt table",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "@assets/generated_images/Green_Felt_Table_Texture_2c002c0f.png"
    },
    {
      id: "wood_mahogany",
      type: "table_theme",
      name: "Mahogany Wood",
      description: "Luxurious mahogany wood finish",
      rarity: "epic",
      cost: 200,
      unlockLevel: 20,
      imageUrl: "@assets/generated_images/Mahogany_Wood_Table_47b7e302.png"
    }
  ];

  await db.insert(cosmetics).values(cosmeticData).onConflictDoNothing();
}

export async function seedDatabase() {
  try {
    await seedAchievements();
    await seedCosmetics();
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}