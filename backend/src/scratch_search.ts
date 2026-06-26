import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const MCP_ENDPOINT = process.env.KAPRUKA_MCP_ENDPOINT || 'https://mcp.kapruka.com/mcp';

async function run() {
  console.log('Connecting to MCP Endpoint:', MCP_ENDPOINT);
  
  // Handshake
  const initRes = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' }
      }
    })
  });
  
  const sessionId = initRes.headers.get('mcp-session-id');
  console.log('Session ID:', sessionId);

  // Call tool helper
  async function callTool(name: string, args: any) {
    const res = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name,
          arguments: { params: args }
        }
      })
    });
    const text = await res.text();
    // Parse event-stream data: prefix
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('data:')) {
        return JSON.parse(line.trim().replace('data:', '').trim());
      }
    }
    return JSON.parse(text);
  }

  // Let's search with query "flower", "rose", "bouquet"
  for (const q of ['flower', 'rose', 'bouquet']) {
    console.log(`\n================= QUERY: "${q}" =================`);
    const result = await callTool('kapruka_search_products', { q, limit: 20 });
    console.log(JSON.stringify(result, null, 2));
  }
}

run().catch(console.error);
