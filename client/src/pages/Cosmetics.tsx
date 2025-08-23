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
      return apiRequest("POST", `/api/cosmetics/${cosmeticId}/purchase`);
    },
    onSuccess: () => {
      // Invalidate all cosmetic queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cosmetics"] });
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
      return apiRequest("POST", `/api/cosmetics/${cosmeticId}/equip`);
    },
    onSuccess: () => {
      // Invalidate all cosmetic queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/cosmetics"] });
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
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-gradient-to-r from-game-gold to-yellow-300 bg-clip-text mb-2 flex items-center gap-3">
              <div className="w-12 h-12 bg-game-gold/20 rounded-full flex items-center justify-center">
                <Palette className="w-6 h-6 text-game-gold" />
              </div>
              Cosmetics Store
            </h1>
            <p className="text-slate-200 opacity-90 text-lg">Customize your Golf 9 experience</p>
          </div>
          {user && (
            <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur-sm px-6 py-3 rounded-xl border-2 border-game-gold/30 shadow-lg">
              <div className="w-8 h-8 bg-game-gold/20 rounded-full flex items-center justify-center">
                <Coins className="w-5 h-5 text-game-gold" />
              </div>
              <span className="text-white font-bold text-lg">{user.currency ?? 0}</span>
              <span className="text-slate-300">coins</span>
            </div>
          )}
        </div>

        <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 p-1 rounded-xl">
            <TabsTrigger 
              value="card_back" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Palette className="w-4 h-4" />
              Card Backs
            </TabsTrigger>
            <TabsTrigger 
              value="table_theme" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Gem className="w-4 h-4" />
              Table Themes
            </TabsTrigger>
            <TabsTrigger 
              value="avatar" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
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
                {cosmetics
                  .sort((a, b) => (a.unlockLevel ?? 1) - (b.unlockLevel ?? 1))
                  .map((cosmetic) => (
                  <Card 
                    key={cosmetic.id} 
                    className={cn(
                      "relative overflow-hidden transition-all hover:scale-105 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-700/50 hover:border-game-gold/50 shadow-lg hover:shadow-xl hover:shadow-game-gold/20 flex flex-col h-full",
                      cosmetic.equipped && "ring-2 ring-game-gold shadow-game-gold/30"
                    )}
                  >
                    <CardHeader className="pb-2 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <Badge 
                          className={cn(
                            "flex items-center gap-1 text-xs text-white border-0 shadow-md",
                            getRarityColor(cosmetic.rarity)
                          )}
                        >
                          {getRarityIcon(cosmetic.rarity)}
                          {cosmetic.rarity}
                        </Badge>
                        {cosmetic.equipped && (
                          <Badge className="text-xs bg-game-gold text-slate-900 border-0 shadow-md">
                            <Check className="w-3 h-3 mr-1" />
                            Equipped
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg text-white font-bold">{cosmetic.name}</CardTitle>
                      <CardDescription className="text-sm text-slate-300 h-10 flex items-start">
                        <span className="line-clamp-2">{cosmetic.description}</span>
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-grow flex flex-col">
                      <div className="aspect-square bg-gradient-to-br from-game-felt to-black rounded-lg mb-4 flex items-center justify-center flex-shrink-0">
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

                      <div className="space-y-2 mt-auto">
                        {!canUnlock(cosmetic.unlockLevel ?? 1) ? (
                          <Button disabled className="w-full bg-slate-700 text-slate-400 border-slate-600" data-testid={`button-locked-${cosmetic.id}`}>
                            <Lock className="w-4 h-4 mr-2" />
                            Requires Level {cosmetic.unlockLevel}
                          </Button>
                        ) : !cosmetic.owned ? (
                          <Button
                            onClick={() => purchaseMutation.mutate(cosmetic.id)}
                            disabled={!canAfford(cosmetic.cost) || purchaseMutation.isPending}
                            className={cn(
                              "w-full transition-all duration-200",
                              canAfford(cosmetic.cost) 
                                ? "bg-gradient-to-r from-game-gold to-yellow-400 hover:from-yellow-400 hover:to-game-gold text-slate-900 font-bold shadow-lg hover:shadow-xl hover:shadow-game-gold/30" 
                                : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
                            )}
                            data-testid={`button-purchase-${cosmetic.id}`}
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            {canAfford(cosmetic.cost) ? `Buy for ${cosmetic.cost}` : 'Not enough coins'}
                          </Button>
                        ) : cosmetic.equipped ? (
                          <Button disabled className="w-full bg-game-gold text-slate-900 font-bold border-0">
                            <Check className="w-4 h-4 mr-2" />
                            Currently Equipped
                          </Button>
                        ) : (
                          <Button
                            onClick={() => equipMutation.mutate(cosmetic.id)}
                            disabled={equipMutation.isPending}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200"
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
            className="bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/50 text-game-gold hover:bg-slate-700 hover:border-game-gold hover:shadow-lg hover:shadow-game-gold/20 transition-all duration-200 px-8 py-3"
            data-testid="button-back"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Back to Game
          </Button>
        </div>
      </div>
    </div>
  );
}