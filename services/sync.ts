import { db } from './db';
import { supabase } from './supabase';

class SyncEngine {
  private isSyncing = false;

  startBackgroundSync() {
    // FIX: Removed setInterval polling (was firing 8 Supabase calls every 10s)
    // Now uses event-driven sync only — zero unnecessary DB calls

    // Sync when network comes back online after being offline
    window.addEventListener('online', () => this.syncAll());

    // Sync when user returns to the tab (app foregrounded)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.syncAll();
    });

    // One initial sync after app boot (delayed to not compete with page load)
    setTimeout(() => this.syncAll(), 3000);
  }

  stopBackgroundSync() {
    // No interval to clear anymore — event listeners are lightweight
  }

  async syncAll() {
    if (!window.navigator.onLine || this.isSyncing) return;
    this.isSyncing = true;

    try {
      await this.syncTable('workouts',       'workouts');
      await this.syncTable('meals',          'meals');
      await this.syncTable('progress',       'progress');
      await this.syncTable('photos',         'photos');
      await this.syncTable('splits',         'splits');
      await this.syncTable('activeProtocol', 'active_protocol');
      await this.syncTable('activeDiet',     'active_diet');
      await this.syncTable('profile',        'profiles');
    } catch (e) {
      console.error("SyncAll Error", e);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncTable(dexieTableName: string, supabaseTableName: string) {
    if (!window.navigator.onLine) return;

    const table = (db as any)[dexieTableName];
    const pendingItems = await table.where('syncStatus').equals('pending').toArray();

    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        const payload = { ...item };
        delete payload.syncStatus;
        delete payload.lastModified;
        delete payload.serverId;

        const { data, error } = await supabase.from(supabaseTableName).upsert(payload).select().single();

        if (!error && data) {
          await table.update(item.id, {
            syncStatus: 'synced',
            serverId: data.id
          });
        }
      } catch (err) {
        console.error(`Error syncing ${dexieTableName} item`, err);
      }
    }
  }
}

export const SyncService = new SyncEngine();
