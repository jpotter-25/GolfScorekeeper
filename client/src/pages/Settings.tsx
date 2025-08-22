import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings, UpdateUserSettings } from "@shared/schema";
import { Volume2, VolumeX, Eye, Gamepad2, Accessibility } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/user/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: UpdateUserSettings) => {
      return apiRequest("PATCH", "/api/user/settings", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Debounce volume changes to prevent excessive API calls
  const [volumeTimeout, setVolumeTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleSettingChange = (key: keyof UpdateUserSettings, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleVolumeChange = (key: 'soundVolume' | 'musicVolume', value: number[]) => {
    // Clear existing timeout
    if (volumeTimeout) {
      clearTimeout(volumeTimeout);
    }
    
    // Set new timeout to debounce the API call
    const timeout = setTimeout(() => {
      handleSettingChange(key, value[0]);
    }, 300); // Wait 300ms after user stops dragging
    
    setVolumeTimeout(timeout);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-highlight-blue mx-auto mb-4"></div>
          <p className="text-white">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-white">
          <p>Unable to load settings</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-gradient-to-r from-game-gold to-yellow-300 bg-clip-text mb-2 flex items-center gap-3">
              <div className="w-12 h-12 bg-game-gold/20 rounded-full flex items-center justify-center">
                <i className="fas fa-cog text-game-gold text-xl"></i>
              </div>
              Settings
            </h1>
            <p className="text-slate-200 opacity-90 text-lg">Customize your Golf 9 experience</p>
          </div>
        </div>

        <Tabs defaultValue="audio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/80 backdrop-blur-sm border-2 border-game-gold/30 p-1 rounded-xl">
            <TabsTrigger 
              value="audio" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Volume2 className="w-4 h-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger 
              value="accessibility" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Accessibility className="w-4 h-4" />
              Accessibility
            </TabsTrigger>
            <TabsTrigger 
              value="gameplay" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Gamepad2 className="w-4 h-4" />
              Gameplay
            </TabsTrigger>
            <TabsTrigger 
              value="visual" 
              className="flex items-center gap-2 data-[state=active]:bg-game-gold data-[state=active]:text-slate-900 text-slate-300 hover:text-white transition-all duration-200"
            >
              <Eye className="w-4 h-4" />
              Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audio">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-game-gold" />
                  Audio Settings
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Control sound effects, music, and volume levels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="sound-enabled" className="text-white">Sound Effects</Label>
                    <p className="text-sm text-slate-400">
                      Play sounds for card flips, matches, and game actions
                    </p>
                  </div>
                  <Switch
                    id="sound-enabled"
                    checked={settings.soundEnabled ?? true}
                    onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                    data-testid="switch-sound-enabled"
                  />
                </div>

                {settings.soundEnabled && (
                  <div className="space-y-2">
                    <Label className="text-white">Sound Volume: {settings.soundVolume}%</Label>
                    <Slider
                      value={[settings.soundVolume ?? 50]}
                      onValueChange={(value) => handleVolumeChange('soundVolume', value)}
                      max={100}
                      step={5}
                      className="w-full"
                      data-testid="slider-sound-volume"
                    />
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="music-enabled" className="text-white">Background Music</Label>
                    <p className="text-sm text-slate-400">
                      Play ambient music during gameplay
                    </p>
                  </div>
                  <Switch
                    id="music-enabled"
                    checked={settings.musicEnabled ?? true}
                    onCheckedChange={(checked) => handleSettingChange('musicEnabled', checked)}
                    data-testid="switch-music-enabled"
                  />
                </div>

                {settings.musicEnabled && (
                  <div className="space-y-2">
                    <Label className="text-white">Music Volume: {settings.musicVolume}%</Label>
                    <Slider
                      value={[settings.musicVolume ?? 30]}
                      onValueChange={(value) => handleVolumeChange('musicVolume', value)}
                      max={100}
                      step={5}
                      className="w-full"
                      data-testid="slider-music-volume"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessibility">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Accessibility className="w-5 h-5 text-game-gold" />
                  Accessibility Settings
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Customize the interface for better accessibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="reduced-motion" className="text-white">Reduce Motion</Label>
                    <p className="text-sm text-slate-400">
                      Minimize animations and transitions
                    </p>
                  </div>
                  <Switch
                    id="reduced-motion"
                    checked={settings.reducedMotion ?? false}
                    onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
                    data-testid="switch-reduced-motion"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="high-contrast" className="text-white">High Contrast</Label>
                    <p className="text-sm text-slate-400">
                      Increase contrast for better visibility
                    </p>
                  </div>
                  <Switch
                    id="high-contrast"
                    checked={settings.highContrast ?? false}
                    onCheckedChange={(checked) => handleSettingChange('highContrast', checked)}
                    data-testid="switch-high-contrast"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="large-text" className="text-white">Large Text</Label>
                    <p className="text-sm text-slate-400">
                      Increase text size for better readability
                    </p>
                  </div>
                  <Switch
                    id="large-text"
                    checked={settings.largeText ?? false}
                    onCheckedChange={(checked) => handleSettingChange('largeText', checked)}
                    data-testid="switch-large-text"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="vibration-enabled" className="text-white">Haptic Feedback</Label>
                    <p className="text-sm text-slate-400">
                      Vibration feedback on mobile devices
                    </p>
                  </div>
                  <Switch
                    id="vibration-enabled"
                    checked={settings.vibrationEnabled ?? true}
                    onCheckedChange={(checked) => handleSettingChange('vibrationEnabled', checked)}
                    data-testid="switch-vibration-enabled"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gameplay">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-game-gold" />
                  Gameplay Settings
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Customize game behavior and assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-end-turn" className="text-white">Auto End Turn</Label>
                    <p className="text-sm text-slate-400">
                      Automatically end turn when no actions available
                    </p>
                  </div>
                  <Switch
                    id="auto-end-turn"
                    checked={settings.autoEndTurn ?? false}
                    onCheckedChange={(checked) => handleSettingChange('autoEndTurn', checked)}
                    data-testid="switch-auto-end-turn"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="show-hints" className="text-white">Show Hints</Label>
                    <p className="text-sm text-slate-400">
                      Display helpful tips and suggestions during gameplay
                    </p>
                  </div>
                  <Switch
                    id="show-hints"
                    checked={settings.showHints ?? true}
                    onCheckedChange={(checked) => handleSettingChange('showHints', checked)}
                    data-testid="switch-show-hints"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visual">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-game-gold" />
                  Visual Preferences
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Coming soon: Card backs, table themes, and more customization options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <div className="text-slate-400 mb-4">
                    <Eye className="w-12 h-12 mx-auto mb-2 text-game-gold" />
                    <p className="text-white">Visual customization options are being developed</p>
                    <p className="text-sm">Check back soon for card backs, table themes, and more!</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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