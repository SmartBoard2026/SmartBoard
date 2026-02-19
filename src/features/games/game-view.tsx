import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import {
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

interface Game {
  id: string
  title: string
  status: 'in_progress' | 'completed'
  created_at: string
}

interface Move {
  game_id: string
  move_number: number
  notation: string
  fen: string
  created_at: string
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function GameView() {
  const { gameId } = useParams({ from: '/_authenticated/games/$gameId' })
  const navigate = useNavigate()
  const [game, setGame] = useState<Game | null>(null)
  const [moves, setMoves] = useState<Move[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [loading, setLoading] = useState(true)

  const currentFen =
    currentMoveIndex >= 0 && moves[currentMoveIndex]
      ? moves[currentMoveIndex].fen
      : START_FEN

  const moveSquares = useMemo(() => {
    const chess = new Chess()
    return moves.map((move) => {
      try {
        const result = chess.move(move.notation)
        return { from: result?.from ?? '', to: result?.to ?? '' }
      } catch {
        return { from: '', to: '' }
      }
    })
  }, [moves])

  const highlightStyles = useMemo(() => {
    if (currentMoveIndex < 0 || !moveSquares[currentMoveIndex]) return {}
    const { from, to } = moveSquares[currentMoveIndex]
    const styles: Record<string, React.CSSProperties> = {}
    if (from) styles[from] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    if (to) styles[to] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    return styles
  }, [currentMoveIndex, moveSquares])

  const movePairs = useMemo(() => {
    const pairs: {
      moveNumber: number
      white: Move
      black?: Move
      whiteIndex: number
      blackIndex?: number
    }[] = []
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
        whiteIndex: i,
        blackIndex: i + 1 < moves.length ? i + 1 : undefined,
      })
    }
    return pairs
  }, [moves])

  const fetchGame = useCallback(async () => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (error) {
      toast.error('Partita non trovata')
      navigate({ to: '/' })
      return
    }
    setGame(data)
  }, [gameId, navigate])

  const fetchMoves = useCallback(async () => {
    const { data, error } = await supabase
      .from('moves')
      .select('*')
      .eq('game_id', gameId)
      .order('move_number', { ascending: true })

    if (error) {
      toast.error('Errore nel caricamento delle mosse')
      return
    }
    setMoves(data ?? [])
    return data ?? []
  }, [gameId])

  useEffect(() => {
    async function init() {
      await fetchGame()
      const fetchedMoves = await fetchMoves()
      if (fetchedMoves && fetchedMoves.length > 0) {
        setCurrentMoveIndex(0)
      }
      setLoading(false)
    }
    init()
  }, [fetchGame, fetchMoves])

  useEffect(() => {
    if (!game || game.status !== 'in_progress') return

    const channel = supabase
      .channel(`game-${gameId}-moves`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'moves',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMove = payload.new as Move
          setMoves((prev) => {
            const exists = prev.some(
              (m) => m.move_number === newMove.move_number
            )
            if (exists) return prev
            const updated = [...prev, newMove].sort(
              (a, b) => a.move_number - b.move_number
            )
            setCurrentMoveIndex(updated.length - 1)
            return updated
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGame(payload.new as Game)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game, gameId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentMoveIndex((prev) => Math.max(-1, prev - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setCurrentMoveIndex((prev) => Math.min(moves.length - 1, prev + 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setCurrentMoveIndex(-1)
      } else if (e.key === 'End') {
        e.preventDefault()
        setCurrentMoveIndex(moves.length - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moves.length])

  if (loading) {
    return (
      <>
        <Header>
          <div className='flex-1' />
          <div className='ms-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>
        <Main>
          <div className='flex items-center justify-center py-24'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </Main>
      </>
    )
  }

  if (!game) return null

  const isLive = game.status === 'in_progress'

  return (
    <>
      <Header>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => navigate({ to: '/' })}
        >
          <ArrowLeft className='h-5 w-5' />
        </Button>
        <div className='flex-1'>
          <h1 className='text-lg font-semibold'>{game.title}</h1>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          {isLive && (
            <Badge variant='default' className='bg-green-600 hover:bg-green-700'>
              <Radio className='mr-1 h-3 w-3 animate-pulse' />
              Live
            </Badge>
          )}
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mx-auto max-w-4xl'>
          <div className='grid gap-6 lg:grid-cols-[1fr_300px]'>
            <Card>
              <CardContent className='flex items-center justify-center p-4'>
                <div className='w-full max-w-[560px]'>
                  <Chessboard
                    options={{
                      id: 'game-board',
                      position: currentFen,
                      allowDragging: false,
                      animationDurationInMs: 300,
                      showAnimations: true,
                      boardStyle: {
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                      },
                      darkSquareStyle: { backgroundColor: '#345830' },
                      lightSquareStyle: { backgroundColor: '#e8eddf' },
                      squareStyles: highlightStyles,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className='flex flex-col gap-4'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Controlli</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => setCurrentMoveIndex(-1)}
                      disabled={currentMoveIndex <= -1}
                      title='Prima mossa'
                    >
                      <ChevronFirst className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() =>
                        setCurrentMoveIndex((prev) => Math.max(-1, prev - 1))
                      }
                      disabled={currentMoveIndex <= -1}
                      title='Mossa precedente'
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() =>
                        setCurrentMoveIndex((prev) =>
                          Math.min(moves.length - 1, prev + 1)
                        )
                      }
                      disabled={currentMoveIndex >= moves.length - 1}
                      title='Mossa successiva'
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => setCurrentMoveIndex(moves.length - 1)}
                      disabled={currentMoveIndex >= moves.length - 1}
                      title='Ultima mossa'
                    >
                      <ChevronLast className='h-4 w-4' />
                    </Button>
                  </div>
                  <p className='mt-3 text-center text-sm text-muted-foreground'>
                    Mossa {currentMoveIndex + 1} di {moves.length}
                  </p>
                  <p className='mt-1 text-center text-xs text-muted-foreground'>
                    Usa ← → per navigare
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-base'>Mosse</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='max-h-[300px] overflow-y-auto'>
                    {moves.length === 0 ? (
                      <p className='text-center text-sm text-muted-foreground'>
                        Nessuna mossa
                      </p>
                    ) : (
                      <div className='flex flex-col gap-1'>
                        {movePairs.map((pair) => (
                          <div
                            key={pair.moveNumber}
                            className='grid grid-cols-[30px_1fr_1fr] items-center gap-1'
                          >
                            <span className='text-center text-xs text-muted-foreground'>
                              {pair.moveNumber}.
                            </span>
                            <Button
                              variant={
                                pair.whiteIndex === currentMoveIndex
                                  ? 'default'
                                  : 'ghost'
                              }
                              size='sm'
                              className='h-7 justify-start px-2 text-xs'
                              onClick={() => setCurrentMoveIndex(pair.whiteIndex)}
                            >
                              {pair.white.notation}
                            </Button>
                            {pair.black && (
                              <Button
                                variant={
                                  pair.blackIndex === currentMoveIndex
                                    ? 'default'
                                    : 'ghost'
                                }
                                size='sm'
                                className='h-7 justify-start px-2 text-xs'
                                onClick={() =>
                                  setCurrentMoveIndex(pair.blackIndex!)
                                }
                              >
                                {pair.black.notation}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Main>
    </>
  )
}
