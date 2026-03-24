import { Kysely, Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('author', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('wallet_mapping')
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .addColumn('walletAddress', 'varchar', (col) => col.notNull())
      .addColumn('verifiedAt', 'varchar', (col) => col.notNull())
      .addColumn('lastUpdated', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('wallet_mapping_wallet_idx')
      .on('wallet_mapping')
      .column('walletAddress')
      .execute()
    await db.schema
      .createTable('token_balance')
      .addColumn('walletAddress', 'varchar', (col) => col.primaryKey())
      .addColumn('balance', 'varchar', (col) => col.notNull())
      .addColumn('lastUpdated', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('token_holder')
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .addColumn('isActive', 'integer', (col) => col.notNull().defaultTo(1))
      .addColumn('lastChecked', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('token_holder_active_idx')
      .on('token_holder')
      .column('isActive')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
    await db.schema.dropTable('wallet_mapping').execute()
    await db.schema.dropTable('token_balance').execute()
    await db.schema.dropTable('token_holder').execute()
  },
}

migrations['002'] = {
  async up(db: Kysely<unknown>) {
    // Add score columns to posts for the ranked feed algo
    // boostScore: total USDC boosted (in USDC units, e.g. 59.52)
    // voteScore: net token vote weight (upvoteWeight - downvoteWeight, normalized to token units)
    await db.schema
      .alterTable('post')
      .addColumn('boostScore', 'real', (col) => col.notNull().defaultTo(0))
      .execute()
    await db.schema
      .alterTable('post')
      .addColumn('voteScore', 'real', (col) => col.notNull().defaultTo(0))
      .execute()
    await db.schema
      .alterTable('post')
      .addColumn('scoreUpdatedAt', 'varchar')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    // SQLite doesn't support DROP COLUMN directly in older versions,
    // so we just leave these columns on downgrade
  },
}

