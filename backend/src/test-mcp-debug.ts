import { mcpClient } from './services/mcpClient.js';

async function test() {
  try {
    console.log('--- Connecting to Kapruka MCP... ---');
    await mcpClient.connect();
    
    console.log('--- Calling kapruka_search_products for "cake" ---');
    const result = await mcpClient.callTool('kapruka_search_products', { q: 'cake', limit: 2 });
    
    console.log('--- Raw Search Result type:', typeof result);
    console.log('--- Raw Search Result Value:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Test error:', err);
  }
}

test();
