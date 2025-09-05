// Simple backend test script for health and creators API
import fetch from 'node-fetch';

const API = process.env.API_URL || 'http://localhost:5000';

async function testHealth() {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error('Health check failed');
  console.log('Health OK');
}

async function testCreators() {
  const res = await fetch(`${API}/api/creators`);
  if (!res.ok) throw new Error('Creators list failed');
  const list = await res.json();
  console.log('Creators:', Array.isArray(list) ? list.length : 'not an array');
}

async function run() {
  try {
    await testHealth();
    await testCreators();
    console.log('All tests passed');
  } catch (e) {
    console.error('Test failed:', e.message);
    process.exit(1);
  }
}

run();
