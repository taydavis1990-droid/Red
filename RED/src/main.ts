import { Game } from './game/Game';
import './styles.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const root = document.querySelector<HTMLDivElement>('#interface');

if (!canvas || !root) {
  throw new Error('The RED game canvas or interface root is missing.');
}

let game: Game;
try {
  game = new Game(canvas, root);
} catch (error) {
  console.error('RED could not initialize.', error);
  root.innerHTML = '<div class="fatal-error"><h1>The valley is unavailable</h1><p>Refresh the page to try again.</p></div>';
  throw error;
}

void game.start().catch((error: unknown) => {
  console.error('RED failed to start.', error);
  game.dispose();
  root.innerHTML = '<div class="fatal-error"><h1>The valley is unavailable</h1><p>Refresh the page to try again.</p></div>';
});
