import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Users, Settings, Trophy, Coins, DollarSign, Star, Crown } from "lucide-react";

type StakeLevel = "free" | "low" | "medium" | "high" | "premium";

interface StakeOption {
  value: StakeLevel;
  label: string;
  coins: number;
  icon: React.ReactNode;
  color: string;
}

const STAKE_OPTIONS: StakeOption[] = [
  { value: "free", label: "Free", coins: 0, icon: <Trophy className="w-4 h-4" />, color: "bg-gray-500" },
  { value: "low", label: "Low", coins: 10, icon: <Coins className="w-4 h-4" />, color: "bg-green-500" },
  { value: "medium", label: "Medium", coins: 50, icon: <DollarSign className="w-4 h-4" />, color: "bg-blue-500" },
  { value: "high", label: "High", coins: 100, icon: <Star className="w-4 h-4" />, color: "bg-purple-500" },
  { value: "premium", label: "Premium", coins: 500, icon: <Crown className="w-4 h-4" />, color: "bg-yellow-500" },
];

export default function OnlineMultiplayer() {
  const [selectedStake, setSelectedStake] = useState<StakeLevel>(() => {
    // Load persisted stake from localStorage
    const saved = localStorage.getItem("selectedStake");
    return (saved as StakeLevel) || "free";
  });

  // Persist stake selection to localStorage
  useEffect(() => {
    localStorage.setItem("selectedStake", selectedStake);
  }, [selectedStake]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Online Multiplayer</h1>
          
          {/* Navigation Controls */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
              <Users className="w-4 h-4 mr-2" />
              Social
            </Button>
            <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Link href="/">
              <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Main Menu
              </Button>
            </Link>
          </div>
        </div>

        {/* Stake Filter Section */}
        <Card className="mb-6 bg-black/20 backdrop-blur border-white/10">
          <CardContent className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Select Stake Level</h2>
            
            <ToggleGroup 
              type="single" 
              value={selectedStake} 
              onValueChange={(value) => value && setSelectedStake(value as StakeLevel)}
              className="flex flex-wrap gap-2"
            >
              {STAKE_OPTIONS.map((stake) => (
                <ToggleGroupItem
                  key={stake.value}
                  value={stake.value}
                  className={`
                    flex flex-col items-center gap-1 p-3 sm:p-4 min-w-[80px] sm:min-w-[100px]
                    bg-white/10 hover:bg-white/20 data-[state=on]:bg-white/30 
                    border border-white/20 data-[state=on]:border-white/40
                    text-white transition-all
                  `}
                  data-testid={`stake-filter-${stake.value}`}
                >
                  <div className={`p-2 rounded-full ${stake.color} bg-opacity-20`}>
                    {stake.icon}
                  </div>
                  <span className="font-semibold text-sm sm:text-base">{stake.label}</span>
                  <span className="text-xs sm:text-sm opacity-80">
                    {stake.coins === 0 ? "Free" : `${stake.coins} coins`}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="mt-4 text-white/70 text-sm">
              <span>Selected: </span>
              <Badge className="ml-2" variant="secondary">
                {STAKE_OPTIONS.find(s => s.value === selectedStake)?.label} Stakes
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Rooms Section */}
        <Card className="bg-black/20 backdrop-blur border-white/10">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Active Rooms</h2>
              <Badge variant="outline" className="text-white border-white/20">
                {selectedStake === "free" ? "Free Play" : `${STAKE_OPTIONS.find(s => s.value === selectedStake)?.coins} Coins Entry`}
              </Badge>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-12 text-white/60">
              <Users className="w-16 h-16 mb-4 opacity-40" />
              <p className="text-lg font-medium mb-2">No Active Rooms</p>
              <p className="text-sm text-center max-w-sm">
                No rooms are currently available at this stake level. 
                Create a new room or wait for other players to join.
              </p>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  Create Room
                </Button>
                <Button variant="outline" className="bg-white/10 backdrop-blur border-white/20 text-white hover:bg-white/20">
                  Quick Match
                </Button>
              </div>
            </div>

            {/* Room list will be populated here when subscribed */}
            <div id="room-list" className="space-y-2" data-testid="active-rooms-list">
              {/* Rooms will be dynamically added here */}
            </div>
          </CardContent>
        </Card>

        {/* Mobile-friendly bottom navigation */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur border-t border-white/20 p-4">
          <div className="flex justify-around">
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Trophy className="w-5 h-5" />
              <span className="text-xs">Rooms</span>
            </Button>
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Users className="w-5 h-5" />
              <span className="text-xs">Social</span>
            </Button>
            <Button variant="ghost" className="text-white flex-col gap-1 h-auto py-2">
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}