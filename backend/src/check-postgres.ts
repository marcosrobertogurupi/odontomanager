import { Client } from 'pg';

async function run() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });

  await client.connect();
  console.log('=== BANCOS DE DADOS EXISTENTES NO POSTGRESQL LOCAL ===');
  const dbs = await client.query(`SELECT datname FROM pg_database WHERE datistemplate = false;`);
  console.log(dbs.rows.map(r => r.datname));

  for (const row of dbs.rows) {
    const dbName = row.datname;
    const dbClient = new Client({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: dbName
    });
    try {
      await dbClient.connect();
      const tables = await dbClient.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      console.log(`\n--- Banco: "${dbName}" (${tables.rowCount} tabelas) ---`);
      for (const t of tables.rows) {
        const countRes = await dbClient.query(`SELECT count(*) FROM public."${t.table_name}";`).catch(() => null);
        const count = countRes ? countRes.rows[0].count : 'N/A';
        console.log(`  - ${t.table_name.padEnd(30)} | Registros: ${count}`);
      }
      await dbClient.end();
    } catch (e: any) {
      console.error(`Erro ao acessar banco ${dbName}:`, e.message);
    }
  }

  await client.end();
}

run();
