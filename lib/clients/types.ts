import { Client } from '@/lib/types'

/**
 * Source of the "cliente visitato" directory. Independent from the visits
 * backend: visits are stored in SharePoint while clients are read from the
 * company ERP (Oracle/Skyline). Selecting from the directory is optional —
 * the UI always allows free-text client names too.
 *
 * The whole directory is small (~1.4k rows), so it is loaded once and filtered
 * client-side rather than queried per keystroke (each ERP query spawns a slow
 * process — see providers/oracle.ts).
 */
export interface ClientDirectory {
  listClients(): Promise<Client[]>
}
