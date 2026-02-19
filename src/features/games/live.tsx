import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  Eye,
  Loader2,
  Radio,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

interface Game {
  id: string
  name: string
  status: 'in_progress' | 'finished'
  created_at: string
  updated_at: string
  user_id: string
}

export function LiveGames() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchLiveGames()

    const channel = supabase
      .channel('live-games-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchLiveGames()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchLiveGames() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Errore nel caricamento delle partite live')
      console.error(error)
    } else {
      setGames(data ?? [])
    }
    setLoading(false)
  }

  return (
    <>
      <Header>
        <div className='flex-1'>
          <h1 className='text-lg font-semibold'>Live</h1>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <Card>
          <CardHeader>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='w-full text-center'>
                <CardTitle className='flex items-center justify-center gap-2'>
                  <Radio className='h-5 w-5 animate-pulse text-green-500' />
                  Live
                </CardTitle>
                <CardDescription>
                  Partita attualmente in corso — si aggiorna in tempo reale
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            ) : games.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='mb-4 rounded-full bg-muted p-4'>
                  <Radio className='h-8 w-8 text-muted-foreground' />
                </div>
                <h3 className='text-lg font-semibold'>Nessuna partita live</h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Non ci sono partite in corso al momento
                </p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Iniziata il</TableHead>
                      <TableHead className='text-right'>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className='font-medium'>
                          {game.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant='default' className='bg-green-600 hover:bg-green-700'>
                            <Radio className='mr-1 h-3 w-3 animate-pulse' />
                            In corso
                          </Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {format(new Date(game.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='icon'
                            asChild
                          >
                            <Link to='/games/$gameId' params={{ gameId: game.id }}>
                              <Eye className='h-4 w-4' />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
