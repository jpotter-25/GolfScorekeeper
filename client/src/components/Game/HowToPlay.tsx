import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowToPlay({ isOpen, onClose }: HowToPlayProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 [&>button]:text-white [&>button]:hover:text-game-gold [&>button]:hover:bg-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">How to Play Golf 9</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Objective */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Objective</h3>
            <p className="text-slate-300">Get the lowest total score across 5 or 9 rounds by strategically managing your 3×3 grid of cards.</p>
          </div>

          {/* Card Values */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Card Values</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-700 p-3 rounded-lg text-center border border-slate-600">
                <div className="font-semibold text-white">Ace</div>
                <div className="text-2xl font-bold text-green-400">1</div>
              </div>
              <div className="bg-slate-700 p-3 rounded-lg text-center border border-slate-600">
                <div className="font-semibold text-white">2-4, 6-10</div>
                <div className="text-sm text-slate-300">Face Value</div>
              </div>
              <div className="bg-slate-700 p-3 rounded-lg text-center border border-slate-600">
                <div className="font-semibold text-white">5</div>
                <div className="text-2xl font-bold text-green-400">-5</div>
              </div>
              <div className="bg-slate-700 p-3 rounded-lg text-center border border-slate-600">
                <div className="font-semibold text-white">J, Q</div>
                <div className="text-2xl font-bold text-red-400">10</div>
              </div>
            </div>
            <div className="mt-4 bg-game-gold/20 p-3 rounded-lg text-center border border-game-gold/30">
              <div className="font-semibold text-white">King</div>
              <div className="text-2xl font-bold text-game-gold">0</div>
            </div>
          </div>

          {/* Special Rule */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Special Rule: Three of a Kind</h3>
            <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
              <p className="text-slate-200">When you get three cards of the same value in a <strong className="text-green-400">column</strong>, that entire column becomes worth 0 points and you get an extra turn!</p>
            </div>
          </div>

          {/* Game Flow */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-3">Game Flow</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <div className="font-medium text-white">Deal Phase</div>
                  <div className="text-slate-300">Each player gets 9 face-down cards in a 3×3 grid</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <div className="font-medium text-white">Peek Phase</div>
                  <div className="text-slate-300">Each player flips 2 cards face-up</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <div className="font-medium text-white">Turn Phase</div>
                  <div className="text-slate-300">Draw a card, select a grid slot, then decide to keep the drawn card or the revealed card</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">4</div>
                <div>
                  <div className="font-medium text-white">Round End</div>
                  <div className="text-slate-300">When any player has all 9 cards revealed, others get one final turn</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
            <h4 className="font-semibold text-game-gold mb-2">Pro Tips</h4>
            <ul className="text-slate-200 space-y-1 text-sm">
              <li>• Remember where your low-value cards are!</li>
              <li>• Try to collect three of the same card in a column for the bonus</li>
              <li>• Kings are worth 0 points - they're valuable!</li>
              <li>• 5s are worth -5 points - even better!</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={onClose} 
              className="bg-game-gold hover:bg-game-gold/80 text-black font-semibold"
              data-testid="button-close-how-to-play"
            >
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
