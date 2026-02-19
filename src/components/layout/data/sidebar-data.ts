import {
  LayoutDashboard,
  Radio,
  Settings,
  UserCog,
  Palette,
  Command,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Giocatore',
    email: '',
    avatar: '',
  },
  teams: [
    {
      name: 'SmartBoard',
      logo: Command,
      plan: 'Chess Viewer',
    },
  ],
  navGroups: [
    {
      title: 'Menu',
      items: [
        {
          title: 'Le mie partite',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Live',
          url: '/live',
          icon: Radio,
        },
        {
          title: 'Impostazioni',
          icon: Settings,
          items: [
            {
              title: 'Profilo',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Aspetto',
              url: '/settings/appearance',
              icon: Palette,
            },
          ],
        },
      ],
    },
  ],
}
