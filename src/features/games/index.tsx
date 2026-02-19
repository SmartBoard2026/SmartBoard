import { useEffect, useRef, useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Chess } from 'chess.js'
import { format } from 'date-fns'
import {
  Search,
  Trash2,
  Eye,
  Radio,
  ArrowUpDown,
  Filter,
  Plus,
  Loader2,
  Upload,
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

interface Game {
  id: string
  title: string
  status: 'in_progress' | 'completed'
  created_at: string
  user_id: string
}

type SortOrder = 'newest' | 'oldest'
type StatusFilter = 'all' | 'in_progress' | 'completed'

export function Games() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteGameId, setDeleteGameId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    fetchGames()

    const channel = supabase
      .channel('games-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchGames()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function fetchGames() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Errore nel caricamento delle partite')
      console.error(error)
    } else {
      setGames(data ?? [])
    }
    setLoading(false)
  }

  async function deleteGame(gameId: string) {
    setDeleting(true)
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId)

    if (error) {
      toast.error('Errore nell\'eliminazione della partita')
    } else {
      toast.success('Partita eliminata')
      setGames((prev) => prev.filter((g) => g.id !== gameId))
    }
    setDeleting(false)
    setDeleteGameId(null)
  }

  async function importPgn(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const chess = new Chess()
      chess.loadPgn(text)

      const whiteMatch = text.match(/\[White\s+"([^"]+)"\]/)
      const blackMatch = text.match(/\[Black\s+"([^"]+)"\]/)
      const white = whiteMatch?.[1] ?? 'Bianco'
      const black = blackMatch?.[1] ?? 'Nero'
      const title = `${white} vs ${black}`

      const history = chess.history()
      chess.reset()

      const movesData: { move_number: number; notation: string; fen: string }[] = []
      for (let i = 0; i < history.length; i++) {
        chess.move(history[i])
        movesData.push({
          move_number: i + 1,
          notation: history[i],
          fen: chess.fen(),
        })
      }

      if (movesData.length === 0) {
        toast.error('Il file PGN non contiene mosse')
        return
      }

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({ user_id: user!.id, title, status: 'completed' })
        .select('id')
        .single()

      if (gameError || !gameData) {
        toast.error('Errore nella creazione della partita')
        console.error(gameError)
        return
      }

      const { error: movesError } = await supabase
        .from('moves')
        .insert(movesData.map((m) => ({ game_id: gameData.id, ...m })))

      if (movesError) {
        await supabase.from('games').delete().eq('id', gameData.id)
        toast.error('Errore nel caricamento delle mosse')
        console.error(movesError)
        return
      }

      toast.success(`Partita "${title}" importata con ${movesData.length} mosse`)
      fetchGames()
    } catch (err) {
      console.error(err)
      toast.error('File PGN non valido o corrotto')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const filteredGames = useMemo(() => {
    let result = [...games]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((g) =>
        g.title.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((g) => g.status === statusFilter)
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    return result
  }, [games, searchQuery, statusFilter, sortOrder])

  return (
    <>
      <Header>
        <div className='flex-1'>
          <h1 className='text-lg font-semibold'>Le mie partite</h1>
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
              <div>
                <CardTitle>Storico Partite</CardTitle>
                <CardDescription>
                  Gestisci e rivedi le tue partite di scacchi
                </CardDescription>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.pgn'
                  className='hidden'
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) importPgn(file)
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <Upload className='mr-2 h-4 w-4' />
                  )}
                  Importa PGN
                </Button>
              </div>
            </div>
            <div className='flex flex-col gap-3 pt-4 sm:flex-row sm:items-center'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='Cerca partita per titolo...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-9'
                />
              </div>
              <div className='flex gap-2'>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className='w-[160px]'>
                    <Filter className='mr-2 h-4 w-4' />
                    <SelectValue placeholder='Stato' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Tutte</SelectItem>
                    <SelectItem value='in_progress'>In corso</SelectItem>
                    <SelectItem value='completed'>Completate</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortOrder}
                  onValueChange={(v) => setSortOrder(v as SortOrder)}
                >
                  <SelectTrigger className='w-[160px]'>
                    <ArrowUpDown className='mr-2 h-4 w-4' />
                    <SelectValue placeholder='Ordina' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='newest'>Più recenti</SelectItem>
                    <SelectItem value='oldest'>Più vecchie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
              </div>
            ) : filteredGames.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='mb-4 rounded-full bg-muted p-4'>
                  <Plus className='h-8 w-8 text-muted-foreground' />
                </div>
                <h3 className='text-lg font-semibold'>Nessuna partita trovata</h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {searchQuery || statusFilter !== 'all'
                    ? 'Prova a cambiare i filtri di ricerca'
                    : 'Le tue partite appariranno qui quando ne inizierai una'}
                </p>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className='text-right'>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGames.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className='font-medium'>
                          {game.title}
                        </TableCell>
                        <TableCell>
                          {game.status === 'in_progress' ? (
                            <Badge variant='default' className='bg-green-600 hover:bg-green-700'>
                              <Radio className='mr-1 h-3 w-3' />
                              In corso
                            </Badge>
                          ) : (
                            <Badge variant='secondary'>
                              Completata
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {format(new Date(game.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex items-center justify-end gap-2'>
                            <Button
                              variant='ghost'
                              size='icon'
                              asChild
                            >
                              <Link to='/games/$gameId' params={{ gameId: game.id }}>
                                <Eye className='h-4 w-4' />
                              </Link>
                            </Button>
                            <Button
                              variant='ghost'
                              size='icon'
                              onClick={() => setDeleteGameId(game.id)}
                            >
                              <Trash2 className='h-4 w-4 text-destructive' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog
          open={!!deleteGameId}
          onOpenChange={(open) => !open && setDeleteGameId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina partita</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questa partita? L&apos;azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={() => deleteGameId && deleteGame(deleteGameId)}
                className='bg-destructive text-white hover:bg-destructive/90'
              >
                {deleting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : null}
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Main>
    </>
  )
}
