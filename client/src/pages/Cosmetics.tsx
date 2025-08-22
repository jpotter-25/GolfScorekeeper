import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Cosmetic, UserCosmetic, User } from "@shared/schema";
import { Palette, Star, Crown, Gem, Coins, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCosmeticAsset } from "@/utils/cosmeticAssets";

interface CosmeticWithOwnership extends Cosmetic {
  owned: boolean;
  equipped: boolean;
}

export default function Cosmetics() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<'card_back' | 'avatar' | 'table_theme'>('card_back');

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: cosmetics = [], isLoading } = useQuery<CosmeticWithOwnership[]>({
    queryKey: ["/api/cosmetics", selectedCategory],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (cosmeticId: string) => {
      return apiRequest("POST", "/api/cosmetics/purchase", { cosmeticId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Purchase Successful",
        description: "Cosmetic item added to your collection!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "You don't have enough coins.",
        variant: "destructive",
      });
    },
  });

  const equipMutation = useMutation({
    mutationFn: async (cosmeticId: string) => {
      return apiRequest("POST", "/api/cosmetics/equip", { cosmeticId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      toast({
        title: "Item Equipped",
        description: "Your cosmetic is now active!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to equip item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      case 'legendary': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'common': return <Star className="w-3 h-3" />;
      case 'rare': return <Gem className="w-3 h-3" />;
      case 'epic': return <Crown className="w-3 h-3" />;
      case 'legendary': return <Crown className="w-3 h-3" />;
      default: return <Star className="w-3 h-3" />;
    }
  };

  const canAfford = (cost: number) => user && (user.currency ?? 0) >= cost;
  const canUnlock = (unlockLevel: number) => user && (user.level ?? 1) >= unlockLevel;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-highlight-blue mx-auto mb-4"></div>
          <p className="text-white">Loading cosmetics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-felt p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cosmetics Store</h1>
            <p className="text-white opacity-80">Customize your Golf 9 experience</p>
          </div>
          {user && (
            <div className="flex items-center gap-2 bg-black bg-opacity-30 rounded-lg px-4 py-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-white font-bold">{user.currency ?? 0}</span>
              <span className="text-white opacity-80">coins</span>
            </div>
          )}
        </div>

        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="card_back" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Card Backs
            </TabsTrigger>
            <TabsTrigger value="table_theme" className="flex items-center gap-2">
              <Gem className="w-4 h-4" />
              Table Themes
            </TabsTrigger>
            <TabsTrigger value="avatar" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Avatars
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory}>
            {cosmetics.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-white opacity-60 mb-4">
                  <Palette className="w-12 h-12 mx-auto mb-2" />
                  <p>No {selectedCategory.replace('_', ' ')} items available yet</p>
                  <p className="text-sm">Check back soon for new cosmetics!</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cosmetics.map((cosmetic) => (
                  <Card 
                    key={cosmetic.id} 
                    className={cn(
                      "relative overflow-hidden transition-all hover:scale-105",
                      cosmetic.equipped && "ring-2 ring-highlight-blue"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge 
                          className={cn(
                            "flex items-center gap-1 text-xs text-white",
                            getRarityColor(cosmetic.rarity)
                          )}
                        >
                          {getRarityIcon(cosmetic.rarity)}
                          {cosmetic.rarity}
                        </Badge>
                        {cosmetic.equipped && (
                          <Badge variant="outline" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Equipped
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{cosmetic.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {cosmetic.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="aspect-square bg-gradient-to-br from-game-felt to-black rounded-lg mb-4 flex items-center justify-center">
                        {(() => {
                          const assetUrl = getCosmeticAsset(cosmetic.id);
                          return assetUrl ? (
                            <img 
                              src={assetUrl} 
                              alt={cosmetic.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <div className="text-white opacity-50 text-center">
                              <Palette className="w-8 h-8 mx-auto mb-2" />
                              <p className="text-xs">Preview Coming Soon</p>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        {!canUnlock(cosmetic.unlockLevel ?? 1) ? (
                          <Button disabled className="w-full" data-testid={`button-locked-${cosmetic.id}`}>
                            <Lock className="w-4 h-4 mr-2" />
                            Requires Level {cosmetic.unlockLevel}
                          </Button>
                        ) : !cosmetic.owned ? (
                          <Button
                            onClick={() => purchaseMutation.mutate(cosmetic.id)}
                            disabled={!canAfford(cosmetic.cost) || purchaseMutation.isPending}
                            className="w-full"
                            variant={canAfford(cosmetic.cost) ? "default" : "destructive"}
                            data-testid={`button-purchase-${cosmetic.id}`}
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            {canAfford(cosmetic.cost) ? `Buy for ${cosmetic.cost}` : 'Not enough coins'}
                          </Button>
                        ) : cosmetic.equipped ? (
                          <Button disabled className="w-full" variant="outline">
                            <Check className="w-4 h-4 mr-2" />
                            Currently Equipped
                          </Button>
                        ) : (
                          <Button
                            onClick={() => equipMutation.mutate(cosmetic.id)}
                            disabled={equipMutation.isPending}
                            className="w-full"
                            data-testid={`button-equip-${cosmetic.id}`}
                          >
                            Equip
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <Button 
            onClick={() => window.history.back()} 
            variant="outline"
            data-testid="button-back"
          >
            Back to Game
          </Button>
        </div>
      </div>
    </div>
  );
}