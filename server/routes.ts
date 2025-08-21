import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User progression routes
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get('/api/user/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await storage.getUserGameHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Game completion endpoint - awards XP and coins
  app.post('/api/game/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        gameMode, 
        playerCount, 
        rounds, 
        finalScore, 
        placement, 
        won,
        gameDuration 
      } = req.body;

      // Calculate XP and coin rewards
      const baseXP = 10;
      const winBonus = won ? 20 : 0;
      const placementBonus = Math.max(0, (5 - placement) * 5); // 1st: 20, 2nd: 15, 3rd: 10, 4th: 5
      const xpEarned = baseXP + winBonus + placementBonus;

      const baseCoins = 5;
      const coinBonus = won ? 10 : 0;
      const coinsEarned = baseCoins + coinBonus;

      // Add game to history
      await storage.addGameToHistory({
        userId,
        gameMode,
        playerCount,
        rounds,
        finalScore,
        placement,
        won,
        xpEarned,
        coinsEarned,
        gameDuration
      });

      // Update user stats
      const currentStats = await storage.getUserStats(userId);
      await storage.updateUserStats(userId, {
        gamesPlayed: (currentStats?.gamesPlayed || 0) + 1,
        gamesWon: (currentStats?.gamesWon || 0) + (won ? 1 : 0),
        gamesLost: (currentStats?.gamesLost || 0) + (won ? 0 : 1),
        totalScore: (currentStats?.totalScore || 0) + finalScore,
        bestScore: currentStats?.bestScore ? Math.min(currentStats.bestScore, finalScore) : finalScore,
        currentWinStreak: won ? (currentStats?.currentWinStreak || 0) + 1 : 0,
        longestWinStreak: won ? Math.max(currentStats?.longestWinStreak || 0, (currentStats?.currentWinStreak || 0) + 1) : currentStats?.longestWinStreak || 0,
        perfectGames: (currentStats?.perfectGames || 0) + (finalScore === 0 ? 1 : 0),
      });

      // Award currency and XP
      await storage.addCurrency(userId, coinsEarned);
      const updatedUser = await storage.addExperience(userId, xpEarned);

      res.json({ 
        xpEarned, 
        coinsEarned, 
        newLevel: updatedUser.level,
        newExperience: updatedUser.experience,
        newCurrency: updatedUser.currency
      });
    } catch (error) {
      console.error("Error completing game:", error);
      res.status(500).json({ message: "Failed to complete game" });
    }
  });

  // Achievement routes
  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get('/api/user/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAchievements = await storage.getUserAchievements(userId);
      res.json(userAchievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  // Cosmetic routes
  app.get('/api/cosmetics', isAuthenticated, async (req: any, res) => {
    try {
      const cosmetics = await storage.getAllCosmetics();
      res.json(cosmetics);
    } catch (error) {
      console.error("Error fetching cosmetics:", error);
      res.status(500).json({ message: "Failed to fetch cosmetics" });
    }
  });

  app.get('/api/user/cosmetics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userCosmetics = await storage.getUserCosmetics(userId);
      res.json(userCosmetics);
    } catch (error) {
      console.error("Error fetching user cosmetics:", error);
      res.status(500).json({ message: "Failed to fetch user cosmetics" });
    }
  });

  app.post('/api/cosmetics/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cosmeticId } = req.body;

      // Get cosmetic details
      const cosmetics = await storage.getAllCosmetics();
      const cosmetic = cosmetics.find(c => c.id === cosmeticId);
      if (!cosmetic) {
        return res.status(404).json({ message: "Cosmetic not found" });
      }

      // Check if user has enough currency
      const user = await storage.getUser(userId);
      if (!user || (user.currency || 0) < cosmetic.cost) {
        return res.status(400).json({ message: "Insufficient currency" });
      }

      // Check if user already owns this cosmetic
      const userCosmetics = await storage.getUserCosmetics(userId);
      if (userCosmetics.some(uc => uc.cosmeticId === cosmeticId)) {
        return res.status(400).json({ message: "Already owned" });
      }

      // Purchase cosmetic
      await storage.spendCurrency(userId, cosmetic.cost);
      const purchasedCosmetic = await storage.purchaseCosmetic({
        userId,
        cosmeticId,
        equipped: false
      });

      res.json(purchasedCosmetic);
    } catch (error) {
      console.error("Error purchasing cosmetic:", error);
      res.status(500).json({ message: "Failed to purchase cosmetic" });
    }
  });

  app.post('/api/cosmetics/equip', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cosmeticId } = req.body;

      await storage.equipCosmetic(userId, cosmeticId);
      res.json({ message: "Cosmetic equipped successfully" });
    } catch (error) {
      console.error("Error equipping cosmetic:", error);
      res.status(500).json({ message: "Failed to equip cosmetic" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}