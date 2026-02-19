import { createContext, useContext, useEffect, useState } from 'react'
import { fonts } from '@/config/fonts'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import { supabase } from '@/lib/supabase'

type Font = (typeof fonts)[number]

const FONT_COOKIE_NAME = 'font'
const FONT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

type FontContextType = {
  font: Font
  setFont: (font: Font) => void
  resetFont: () => void
}

const FontContext = createContext<FontContextType | null>(null)

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [font, _setFont] = useState<Font>(() => {
    const savedFont = getCookie(FONT_COOKIE_NAME)
    return fonts.includes(savedFont as Font) ? (savedFont as Font) : fonts[0]
  })

  // Al mount, carica le preferenze da Supabase se l'utente è loggato
  useEffect(() => {
    async function loadFromDb() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_preferences')
        .select('font')
        .eq('user_id', user.id)
        .single()

      if (data?.font && fonts.includes(data.font as Font)) {
        const dbFont = data.font as Font
        setCookie(FONT_COOKIE_NAME, dbFont, FONT_COOKIE_MAX_AGE)
        _setFont(dbFont)
      }
    }

    loadFromDb()

    // Ascolta i cambi di sessione (login/logout) per ricaricare o resettare
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadFromDb()
      if (event === 'SIGNED_OUT') {
        removeCookie(FONT_COOKIE_NAME)
        _setFont(fonts[0])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Applica il font al documento ogni volta che cambia
  useEffect(() => {
    const root = document.documentElement
    root.classList.forEach((cls) => {
      if (cls.startsWith('font-')) root.classList.remove(cls)
    })
    root.classList.add(`font-${font}`)
  }, [font])

  const setFont = async (newFont: Font) => {
    // Aggiorna subito cookie e stato locale per risposta immediata
    setCookie(FONT_COOKIE_NAME, newFont, FONT_COOKIE_MAX_AGE)
    _setFont(newFont)

    // Poi sincronizza con Supabase in background
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, font: newFont }, { onConflict: 'user_id' })
  }

  const resetFont = async () => {
    removeCookie(FONT_COOKIE_NAME)
    _setFont(fonts[0])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, font: fonts[0] }, { onConflict: 'user_id' })
  }

  return (
    <FontContext value={{ font, setFont, resetFont }}>{children}</FontContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useFont = () => {
  const context = useContext(FontContext)
  if (!context) {
    throw new Error('useFont must be used within a FontProvider')
  }
  return context
}