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
      return apiRequest("/api/user/settings", "PATCH", updates);
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

  const handleSettingChange = (key: keyof UpdateUserSettings, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleVolumeChange = (key: 'soundVolume' | 'musicVolume', value: number[]) => {
    handleSettingChange(key, value[0]);
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
    <div className="min-h-screen bg-game-felt p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-white opacity-80">Customize your Golf 9 experience</p>
        </div>

        <Tabs defaultValue="audio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2">
              <Accessibility className="w-4 h-4" />
              Accessibility
            </TabsTrigger>
            <TabsTrigger value="gameplay" className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" />
              Gameplay
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Visual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audio">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  Audio Settings
                </CardTitle>
                <CardDescription>
                  Control sound effects, music, and volume levels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="sound-enabled">Sound Effects</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label>Sound Volume: {settings.soundVolume}%</Label>
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
                    <Label htmlFor="music-enabled">Background Music</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label>Music Volume: {settings.musicVolume}%</Label>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Accessibility className="w-5 h-5" />
                  Accessibility Settings
                </CardTitle>
                <CardDescription>
                  Customize the interface for better accessibility
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="reduced-motion">Reduce Motion</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label htmlFor="high-contrast">High Contrast</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label htmlFor="large-text">Large Text</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label htmlFor="vibration-enabled">Haptic Feedback</Label>
                    <p className="text-sm text-muted-foreground">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  Gameplay Settings
                </CardTitle>
                <CardDescription>
                  Customize game behavior and assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-end-turn">Auto End Turn</Label>
                    <p className="text-sm text-muted-foreground">
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
                    <Label htmlFor="show-hints">Show Hints</Label>
                    <p className="text-sm text-muted-foreground">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Visual Preferences
                </CardTitle>
                <CardDescription>
                  Coming soon: Card backs, table themes, and more customization options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">
                    <Eye className="w-12 h-12 mx-auto mb-2" />
                    <p>Visual customization options are being developed</p>
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