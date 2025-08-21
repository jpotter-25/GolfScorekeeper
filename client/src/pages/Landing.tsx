import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 bg-opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 bg-opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400 bg-opacity-5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <h1 className="text-7xl md:text-9xl font-bold text-white mb-6 drop-shadow-2xl">
              Golf 9
            </h1>
            <p className="text-2xl md:text-3xl text-gray-300 font-light mb-4 drop-shadow-lg">
              The Strategic Card Game
            </p>
            <p className="text-lg md:text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed">
              Master the art of low scores in this exciting card game. Compete against intelligent AI opponents, 
              track your progress, and unlock exclusive rewards as you climb the leaderboards.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-trophy text-yellow-300 text-2xl"></i>
              </div>
              <h3 className="text-white font-semibold mb-2">Earn Rewards</h3>
              <p className="text-gray-300 text-sm">Unlock achievements and collect coins</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-chart-line text-green-300 text-2xl"></i>
              </div>
              <h3 className="text-white font-semibold mb-2">Track Progress</h3>
              <p className="text-gray-300 text-sm">Monitor stats and level up your skills</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-500 bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-palette text-purple-300 text-2xl"></i>
              </div>
              <h3 className="text-white font-semibold mb-2">Customize</h3>
              <p className="text-gray-300 text-sm">Personalize cards and themes</p>
            </div>
          </div>
        </div>

        {/* Sign In Card */}
        <div className="max-w-md mx-auto">
          <Card className="bg-white bg-opacity-15 backdrop-blur-lg border-white border-opacity-30 shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Play?</h2>
                <p className="text-gray-200">Choose your preferred sign-in method</p>
              </div>

              <Button 
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                data-testid="button-login"
              >
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                    <i className="fas fa-sign-in-alt text-blue-600 text-sm"></i>
                  </div>
                  <span>Sign In</span>
                </div>
              </Button>

              <div className="mt-4 text-center">
                <p className="text-gray-300 text-xs mb-2">Available sign-in options:</p>
                <div className="flex justify-center space-x-3 text-gray-400 flex-wrap gap-y-2">
                  <div className="flex items-center space-x-1">
                    <i className="fab fa-google text-sm"></i>
                    <span className="text-xs">Google</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <i className="fab fa-x-twitter text-sm"></i>
                    <span className="text-xs">X</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <i className="fab fa-apple text-sm"></i>
                    <span className="text-xs">Apple</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-envelope text-sm"></i>
                    <span className="text-xs">Email</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <i className="fas fa-user text-sm"></i>
                    <span className="text-xs">Replit</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-gray-200 text-sm mb-3">What you'll get:</p>
                <div className="space-y-2 text-left">
                  <div className="flex items-center space-x-3 text-gray-200 text-sm">
                    <i className="fas fa-check text-emerald-400"></i>
                    <span>Persistent game progress and statistics</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-200 text-sm">
                    <i className="fas fa-check text-emerald-400"></i>
                    <span>XP system with level progression</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-200 text-sm">
                    <i className="fas fa-check text-emerald-400"></i>
                    <span>Coin rewards and cosmetic unlocks</span>
                  </div>
                  <div className="flex items-center space-x-3 text-gray-200 text-sm">
                    <i className="fas fa-check text-emerald-400"></i>
                    <span>Global leaderboards and achievements</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white border-opacity-30">
                <p className="text-center text-gray-300 text-xs">
                  Enterprise-grade security • No credit card required
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo hint */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            Game demo available after sign in • No payment required
          </p>
        </div>
      </div>
    </div>
  );
}