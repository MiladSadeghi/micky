import assert from 'node:assert/strict'
import test from 'node:test'
import { writeNeedsApproval } from './write-policy'

test('writes ordinary documents, data, source code, and config without approval', () => {
  for (const path of [
    '/Users/mani/Documents/notes.md',
    '/Users/mani/Documents/export.csv',
    '/Users/mani/project/src/app.tsx',
    '/Users/mani/project/server.py',
    '/Users/mani/project/package.json',
    '/Users/mani/project/config.yaml',
    '/Users/mani/project/README'
  ]) {
    assert.equal(writeNeedsApproval(path), false, path)
  }
})

test('keeps approval for executable and startup file formats', () => {
  for (const path of [
    '/Users/mani/Desktop/install.sh',
    '/Users/mani/Desktop/do-it.command',
    '/Users/mani/Desktop/setup.ps1',
    '/Users/mani/Library/LaunchAgents/dev.micky.helper.plist',
    '/Users/mani/.zshrc',
    '/Users/mani/.gitconfig'
  ]) {
    assert.equal(writeNeedsApproval(path), true, path)
  }
})

test('keeps approval for auto-run destinations regardless of extension', () => {
  for (const path of [
    '/Users/mani/project/.git/hooks/pre-commit',
    '/Users/mani/.config/autostart/micky.txt',
    '/Users/mani/.config/systemd/user/micky.conf'
  ]) {
    assert.equal(writeNeedsApproval(path), true, path)
  }
})
