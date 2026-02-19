import { createFileRoute } from '@tanstack/react-router'
import { LiveGames } from '@/features/games/live'

export const Route = createFileRoute('/_authenticated/live/')({
  component: LiveGames,
})
