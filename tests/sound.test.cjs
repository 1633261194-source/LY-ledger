const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('audio is lazy, respects mute, throttles taps and releases audio nodes', () => {
  const nodes = [];
  let contexts = 0;
  class AudioContext {
    constructor() { contexts++; this.currentTime = 0; this.state = 'running'; }
    createOscillator() {
      const node = {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target) { return target; }, start() {}, stop() {},
        disconnect() { this.disconnected = true; }
      };
      nodes.push(node);
      return node;
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
  }
  const storage = new Map([['lingyu-ledger-clean-start-v1', 'true']]);
  const context = vm.createContext({
    window: { AudioContext },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: { addEventListener() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  assert.equal(contexts, 0);
  vm.runInContext('playSound()', context);
  assert.equal(nodes.length, 1, 'first tap plays immediately');
  vm.runInContext('playSound()', context);
  assert.equal(nodes.length, 1, 'rapid duplicate tap is throttled');
  vm.runInContext('soundEnabled = false; playSound("success")', context);
  assert.equal(nodes.length, 1);
  vm.runInContext('soundEnabled = true; playSound("success")', context);
  assert.equal(nodes.length, 2);
  nodes[0].onended();
  assert.equal(nodes[0].disconnected, true);
  vm.runInContext('audioContext = null; window.AudioContext = undefined; playSound()', context);
});
