import { createFileRoute } from '@tanstack/react-router'
import { GameView } from '@/features/games/game-view'

export const Route = createFileRoute('/_authenticated/games/$gameId')({
  component: GameView,
})
