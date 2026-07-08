import { execFile } from 'child_process';

// Pluggable SMS backend, mirroring the help-chat AI-agent contract
// (CHAT_AGENT_CMD). Off by default — a developer opts in by pointing SMS_CMD at
// any executable:
//
//   SMS_CMD=python3 /path/to/send_sms.py
//   SMS_TIMEOUT_MS=15000   # optional, default 15s
//
// The command is run WITHOUT a shell; the recipient and message are appended as
// the final two arguments. Exit 0 = delivered. Config lives in .env (gitignored)
// so the operator's SMS provider credentials never leave their machine.
export function sendSms(to: string, message: string): Promise<{ delivered: boolean }> {
  return new Promise((resolve) => {
    const cmdline = (process.env.SMS_CMD || '').trim();
    if (!cmdline || !to) { resolve({ delivered: false }); return; }

    const [cmd, ...args] = cmdline.split(/\s+/);
    const timeout = parseInt(process.env.SMS_TIMEOUT_MS || '', 10) || 15000;
    execFile(cmd, [...args, to, message.slice(0, 480)], { timeout, maxBuffer: 1024 * 1024 }, (err) => {
      if (err) console.error('SMS send failed:', err.message);
      resolve({ delivered: !err });
    });
  });
}
