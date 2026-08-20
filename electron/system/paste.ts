import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { systemPreferences } from 'electron'

const runFile = promisify(execFile)

export type ForegroundTarget = {
  platform: NodeJS.Platform
  value: string | null
}

export class PasteService {
  async captureForeground(): Promise<ForegroundTarget> {
    try {
      if (process.platform === 'darwin') {
        const { stdout } = await runFile('/usr/bin/osascript', [
          '-e',
          'tell application "System Events" to get unix id of first application process whose frontmost is true'
        ])
        return { platform: process.platform, value: stdout.trim() || null }
      }
      if (process.platform === 'linux' && !process.env.WAYLAND_DISPLAY) {
        const { stdout } = await runFile('xdotool', ['getactivewindow'])
        return { platform: process.platform, value: stdout.trim() || null }
      }
      if (process.platform === 'win32') {
        const { stdout } = await runFile('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '(Add-Type -MemberDefinition \"[DllImport(\\\"user32.dll\\\")] public static extern IntPtr GetForegroundWindow();\" -Name Native -Namespace Micky -PassThru)::GetForegroundWindow().ToInt64()'
        ])
        return { platform: process.platform, value: stdout.trim() || null }
      }
    } catch {
      // Capturing the original app is best effort; clipboard output still succeeds.
    }
    return { platform: process.platform, value: null }
  }

  async paste(target: ForegroundTarget): Promise<boolean> {
    if (!target.value || target.platform !== process.platform) return false
    try {
      if (process.platform === 'darwin') {
        if (!systemPreferences.isTrustedAccessibilityClient(true)) return false
        await runFile('/usr/bin/osascript', [
          '-e',
          `tell application "System Events" to set frontmost of first application process whose unix id is ${Number(target.value)} to true`,
          '-e',
          'delay 0.08',
          '-e',
          'tell application "System Events" to keystroke "v" using command down'
        ])
        return true
      }
      if (process.platform === 'linux') {
        if (process.env.WAYLAND_DISPLAY) return false
        await runFile('xdotool', ['windowactivate', '--sync', target.value])
        await runFile('xdotool', ['key', '--clearmodifiers', 'ctrl+v'])
        return true
      }
      if (process.platform === 'win32') {
        const handle = Number(target.value)
        if (!Number.isSafeInteger(handle)) return false
        await runFile('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$s='[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'; $n=Add-Type -MemberDefinition $s -Name Native -Namespace Micky -PassThru; $null=$n::SetForegroundWindow([IntPtr]${handle}); Start-Sleep -Milliseconds 80; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`
        ])
        return true
      }
    } catch {
      return false
    }
    return false
  }
}
