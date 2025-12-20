#!/usr/bin/env node
import { query, getPoolStats } from '../src/db.js';

async function probe() {
  try {
    console.log('Pool before:', getPoolStats());
    const t1 = Date.now();
    await query('SELECT 1');
    console.log('First SELECT took', Date.now() - t1, 'ms');

    console.log('Pool middle:', getPoolStats());
    const t2 = Date.now();
    await query('SELECT 1');
    console.log('Second SELECT took', Date.now() - t2, 'ms');
    console.log('Pool after:', getPoolStats());
  } catch (e) {
    console.error('Probe error', e);
  } finally {
    process.exit(0);
  }
}

probe();
