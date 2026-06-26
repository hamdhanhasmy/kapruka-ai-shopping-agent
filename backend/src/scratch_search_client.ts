import { mcpClient } from './services/mcpClient.js';

async function run() {
  console.log('Searching via mcpClient...');
  for (const q of ['flower', 'rose', 'bouquet']) {
    console.log(`\n================= QUERY: "${q}" =================`);
    const result = await mcpClient.searchProducts({ q, limit: 20 });
    console.log(`Found ${result.products.length} products:`);
    result.products.forEach(p => {
      console.log(`- [${p.id}] ${p.name}: LKR ${p.price} (${p.category}) - Stock: ${p.in_stock}`);
    });
  }
}

run().catch(console.error);
