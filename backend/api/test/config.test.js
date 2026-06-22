import { test } from 'node:test';
import assert from 'node:assert';
import { config } from '../src/config.js';

test('config charge le port et le TTL de hold', () => {
  assert.equal(typeof config.port, 'number');
  assert.ok(config.holdTtlSeconds > 0);
});
