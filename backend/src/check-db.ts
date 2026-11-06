import net from 'net';

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function run() {
  console.log('Verificando conexões locais e remotas...');
  const p54321 = await checkPort('127.0.0.1', 54321);
  const p54322 = await checkPort('127.0.0.1', 54322);
  const p5432 = await checkPort('127.0.0.1', 5432);

  console.log('Porta 54321 (Supabase API Local):', p54321 ? 'ABERTA ✅' : 'FECHADA ❌');
  console.log('Porta 54322 (Supabase DB Local):', p54322 ? 'ABERTA ✅' : 'FECHADA ❌');
  console.log('Porta 5432 (Postgres padrão Local):', p5432 ? 'ABERTA ✅' : 'FECHADA ❌');
}

run();
