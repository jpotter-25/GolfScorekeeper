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
      description: "Classic golfer avatar",
      rarity: "common",
      cost: 0,
      unlockLevel: 1,
      imageUrl: "/cosmetics/avatars/default.png"
    },
    {
      id: "pro_golfer",
      type: "avatar",
      name: "Pro Golfer",
      description: "Professional tournament player",
      rarity: "rare",
      cost: 75,
      unlockLevel: 8,
      imageUrl: "/cosmetics/avatars/pro_golfer.png"
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