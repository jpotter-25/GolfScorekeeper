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
      description: "Traditional blue card back design",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "@assets/generated_images/Classic_Blue_Card_Back_be4bbe28.png"
    },
    {
      id: "royal_red",
      type: "card_back",
      name: "Royal Red",
      description: "Elegant red card back with golden accents",
      rarity: "rare",
      cost: 50,
      unlockLevel: 5,
      imageUrl: "@assets/generated_images/Royal_Red_Card_Back_aafc7f73.png"
    },
    {
      id: "midnight_black",
      type: "card_back",
      name: "Midnight Black",
      description: "Sleek black design for sophisticated players",
      rarity: "epic",
      cost: 150,
      unlockLevel: 15,
      imageUrl: "@assets/generated_images/Midnight_Black_Card_Back_37a72889.png"
    },
    // Avatars
    {
      id: "default_avatar",
      type: "avatar",
      name: "Default",
      description: "Classic player avatar",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "/cosmetics/avatars/default.png"
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
      description: "Classic golf professional with club",
      rarity: "common",
      cost: 25,
      unlockLevel: 3,
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