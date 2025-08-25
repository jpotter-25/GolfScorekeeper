import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { UserSettings, UpdateUserSettings } from "@shared/schema";
import { Volume2, VolumeX, Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/user/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: UpdateUserSettings) => {
      return apiRequest("PATCH", "/api/user/settings", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
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
      // Convert from 0-100 range to match database expectations
      handleSettingChange(key, Math.round(value[0]));
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-game-gold to-yellow-400 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-slate-300">Customize your Golf 9 experience</p>
        </div>

        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-game-gold/30 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-game-gold" />
              Game Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Sound Effects */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="sound-effects" className="text-white text-lg">Sound Effects</Label>
                  <p className="text-sm text-slate-400">
                    Toggle game sound effects on/off
                  </p>
                </div>
                <Switch
                  id="sound-effects"
                  checked={settings.soundEnabled ?? true}
                  onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                  data-testid="switch-sound-effects"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sound-volume" className="text-white">Volume</Label>
                  <span className="text-game-gold font-semibold">
                    {settings.soundVolume ?? 50}%
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <Slider
                    id="sound-volume"
                    value={[settings.soundVolume ?? 50]}
                    onValueChange={(value) => handleVolumeChange('soundVolume', value)}
                    max={100}
                    step={5}
                    className="flex-1"
                    disabled={!settings.soundEnabled}
                    data-testid="slider-sound-volume"
                  />
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Background Music */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="background-music" className="text-white text-lg">Background Music</Label>
                  <p className="text-sm text-slate-400">
                    Toggle background music on/off
                  </p>
                </div>
                <Switch
                  id="background-music"
                  checked={settings.musicEnabled ?? true}
                  onCheckedChange={(checked) => handleSettingChange('musicEnabled', checked)}
                  data-testid="switch-background-music"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="music-volume" className="text-white">Volume</Label>
                  <span className="text-game-gold font-semibold">
                    {settings.musicVolume ?? 30}%
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <Slider
                    id="music-volume"
                    value={[settings.musicVolume ?? 30]}
                    onValueChange={(value) => handleVolumeChange('musicVolume', value)}
                    max={100}
                    step={5}
                    className="flex-1"
                    disabled={!settings.musicEnabled}
                    data-testid="slider-music-volume"
                  />
                  <Volume2 className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Haptic Feedback */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="vibration-enabled" className="text-white text-lg">Haptic Feedback</Label>
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

        <div className="mt-8 text-center">
          <Button 
            onClick={() => setLocation("/")} 
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