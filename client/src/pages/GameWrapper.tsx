import Game from '@/pages/Game';
import MultiplayerGame from '@/pages/MultiplayerGame';

export default function GameWrapper() {
  // Check if there's a room parameter in the URL
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  
  // If there's a room code, use MultiplayerGame, otherwise use regular Game
  if (roomCode) {
    return <MultiplayerGame />;
  }
  
  return <Game />;
}