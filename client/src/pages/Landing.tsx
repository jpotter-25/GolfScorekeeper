import { Button } from '@/components/ui/button';

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-game-green to-game-felt flex flex-col items-center justify-center px-6">
      <div className="text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-4">Golf 9</h1>
        <p className="text-xl text-game-cream opacity-90 mb-2">The Card Game</p>
        <p className="text-lg text-white opacity-80 max-w-md mx-auto">
          Compete against AI or friends in this strategic card game. Build your stats, earn rewards, and climb the leaderboards!
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <Button 
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-200"
          data-testid="button-login"
        >
          <i className="fas fa-sign-in-alt mr-2"></i>
          Sign In to Play
        </Button>
        
        <div className="text-center text-white opacity-60 text-sm">
          <p>Sign in with your Replit account to:</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• Track your progress and stats</li>
            <li>• Earn XP and unlock rewards</li>
            <li>• Compete on leaderboards</li>
            <li>• Customize your profile</li>
          </ul>
        </div>
      </div>
    </div>
  );
}