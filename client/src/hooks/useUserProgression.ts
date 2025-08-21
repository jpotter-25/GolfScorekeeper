import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useUserStats() {
  return useQuery({
    queryKey: ["/api/user/stats"],
    retry: false,
  });
}

export function useUserHistory(limit = 10) {
  return useQuery({
    queryKey: ["/api/user/history", limit],
    retry: false,
  });
}

export function useCompleteGame() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gameData: {
      gameMode: string;
      playerCount: number;
      rounds: number;
      finalScore: number;
      placement: number;
      won: boolean;
      gameDuration?: number;
    }) => {
      const response = await fetch("/api/game/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gameData),
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch user-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/history"] });
      
      // Show success notification with rewards
      toast({
        title: "Game Complete!",
        description: `Earned ${data.xpEarned} XP and ${data.coinsEarned} coins!`,
        variant: "default",
      });
      
      // Show level up notification if applicable
      if (data.newLevel > 1) {
        setTimeout(() => {
          toast({
            title: `Level Up! Level ${data.newLevel}`,
            description: `You're getting better at Golf 9!`,
            variant: "default",
          });
        }, 1000);
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to save game progress. Please try again.",
        variant: "destructive",
      });
    },
  });
}