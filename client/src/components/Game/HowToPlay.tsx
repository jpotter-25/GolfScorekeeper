import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HowToPlay({ isOpen, onClose }: HowToPlayProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">How to Play Golf 9</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Objective */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Objective</h3>
            <p className="text-gray-700">Get the lowest total score across 5 or 9 rounds by strategically managing your 3×3 grid of cards.</p>
          </div>

          {/* Card Values */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Card Values</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="font-semibold">Ace</div>
                <div className="text-2xl font-bold text-green-600">1</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="font-semibold">2-4, 6-10</div>
                <div className="text-sm text-gray-600">Face Value</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="font-semibold">5</div>
                <div className="text-2xl font-bold text-green-600">-5</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="font-semibold">J, Q</div>
                <div className="text-2xl font-bold text-red-600">10</div>
              </div>
            </div>
            <div className="mt-4 bg-yellow-100 p-3 rounded-lg text-center">
              <div className="font-semibold">King</div>
              <div className="text-2xl font-bold text-blue-600">0</div>
            </div>
          </div>

          {/* Special Rule */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Special Rule: Three of a Kind</h3>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-gray-700">When you get three cards of the same value in a <strong>column</strong>, that entire column becomes worth 0 points and you get an extra turn!</p>
            </div>
          </div>

          {/* Game Flow */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Game Flow</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">1</div>
                <div>
                  <div className="font-medium">Deal Phase</div>
                  <div className="text-gray-600">Each player gets 9 face-down cards in a 3×3 grid</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">2</div>
                <div>
                  <div className="font-medium">Peek Phase</div>
                  <div className="text-gray-600">Each player flips 2 cards face-up</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">3</div>
                <div>
                  <div className="font-medium">Turn Phase</div>
                  <div className="text-gray-600">Draw a card, select a grid slot, then decide to keep the drawn card or the revealed card</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-game-gold text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">4</div>
                <div>
                  <div className="font-medium">Round End</div>
                  <div className="text-gray-600">When any player has all 9 cards revealed, others get one final turn</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Pro Tips</h4>
            <ul className="text-blue-800 space-y-1 text-sm">
              <li>• Remember where your low-value cards are!</li>
              <li>• Try to collect three of the same card in a column for the bonus</li>
              <li>• Kings are worth 0 points - they're valuable!</li>
              <li>• 5s are worth -5 points - even better!</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose} data-testid="button-close-how-to-play">
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
