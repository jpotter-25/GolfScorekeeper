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
      id: "classic_royal_blue",
      type: "card_back",
      name: "Classic Royal Blue",
      description: "Traditional royal blue with ornate white flourishes",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "@assets/generated_images/Classic_Royal_Blue_Card_e92be256.png"
    },
    {
      id: "crimson_gold_ornate",
      type: "card_back",
      name: "Crimson Gold",
      description: "Deep crimson with gold geometric patterns",
      rarity: "rare",
      cost: 50,
      unlockLevel: 3,
      imageUrl: "@assets/generated_images/Crimson_Gold_Ornate_Card_0af373f8.png"
    },
    {
      id: "emerald_celtic",
      type: "card_back",
      name: "Emerald Celtic",
      description: "Elegant emerald green with silver Celtic knots",
      rarity: "rare",
      cost: 75,
      unlockLevel: 5,
      imageUrl: "@assets/generated_images/Emerald_Celtic_Pattern_Card_cc828358.png"
    },
    {
      id: "midnight_geometric",
      type: "card_back",
      name: "Midnight Geometric",
      description: "Sleek black with modern geometric silver accents",
      rarity: "epic",
      cost: 125,
      unlockLevel: 8,
      imageUrl: "@assets/generated_images/Midnight_Modern_Geometric_Card_4181dee8.png"
    },
    {
      id: "purple_art_deco",
      type: "card_back",
      name: "Purple Art Deco",
      description: "Deep purple with gold 1920s style flourishes",
      rarity: "epic",
      cost: 150,
      unlockLevel: 10,
      imageUrl: "@assets/generated_images/Purple_Art_Deco_Card_ca6e4c63.png"
    },
    {
      id: "bronze_western",
      type: "card_back",
      name: "Bronze Western",
      description: "Warm bronze with copper swirl western motifs",
      rarity: "rare",
      cost: 100,
      unlockLevel: 7,
      imageUrl: "@assets/generated_images/Bronze_Western_Style_Card_52c428e4.png"
    },
    {
      id: "nautical_ocean",
      type: "card_back",
      name: "Nautical Ocean",
      description: "Ocean blue with white wave patterns and rope borders",
      rarity: "epic",
      cost: 175,
      unlockLevel: 12,
      imageUrl: "@assets/generated_images/Nautical_Ocean_Wave_Card_2ddded57.png"
    },
    {
      id: "forest_botanical",
      type: "card_back",
      name: "Forest Botanical",
      description: "Forest green with gold leaf botanical motifs",
      rarity: "epic",
      cost: 200,
      unlockLevel: 15,
      imageUrl: "@assets/generated_images/Forest_Botanical_Luxury_Card_ccc4668d.png"
    },
    {
      id: "cyberpunk_neon",
      type: "card_back",
      name: "Cyberpunk Neon",
      description: "Charcoal gray with electric blue neon circuits",
      rarity: "legendary",
      cost: 300,
      unlockLevel: 18,
      imageUrl: "@assets/generated_images/Cyberpunk_Neon_Tech_Card_59d68df2.png"
    },
    {
      id: "rose_gold_marble",
      type: "card_back",
      name: "Rose Gold Marble",
      description: "Rose gold with pink marble texture and geometric lines",
      rarity: "epic",
      cost: 180,
      unlockLevel: 13,
      imageUrl: "@assets/generated_images/Rose_Gold_Marble_Card_a74d530a.png"
    },
    {
      id: "antique_ivory",
      type: "card_back",
      name: "Antique Ivory",
      description: "Vintage ivory with sepia brown ornamental details",
      rarity: "rare",
      cost: 90,
      unlockLevel: 6,
      imageUrl: "@assets/generated_images/Antique_Ivory_Heritage_Card_863ad18a.png"
    },
    {
      id: "turquoise_tribal",
      type: "card_back",
      name: "Turquoise Tribal",
      description: "Vibrant turquoise with silver southwestern patterns",
      rarity: "epic",
      cost: 160,
      unlockLevel: 11,
      imageUrl: "@assets/generated_images/Turquoise_Tribal_Pattern_Card_6d3a0abd.png"
    },
    {
      id: "mahogany_baroque",
      type: "card_back",
      name: "Mahogany Baroque",
      description: "Deep mahogany with gold filigree baroque details",
      rarity: "legendary",
      cost: 350,
      unlockLevel: 20,
      imageUrl: "@assets/generated_images/Mahogany_Baroque_Luxury_Card_e300c138.png"
    },
    {
      id: "pearl_holographic",
      type: "card_back",
      name: "Pearl Holographic",
      description: "Pearl white with holographic rainbow shimmer effects",
      rarity: "legendary",
      cost: 400,
      unlockLevel: 25,
      imageUrl: "@assets/generated_images/Pearl_Holographic_Modern_Card_62ae8ace.png"
    },
    {
      id: "steel_steampunk",
      type: "card_back",
      name: "Steel Steampunk",
      description: "Steel gray with chrome accents and industrial gears",
      rarity: "legendary",
      cost: 250,
      unlockLevel: 16,
      imageUrl: "@assets/generated_images/Steel_Steampunk_Industrial_Card_3b92933e.png"
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
    console.log("Starting database seeding...");
    
    console.log("Seeding achievements...");
    await seedAchievements();
    console.log("Achievements seeded successfully");
    
    console.log("Seeding cosmetics...");
    await seedCosmetics();
    console.log("Cosmetics seeded successfully");
    
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error; // Re-throw so the main startup can catch it
  }
}