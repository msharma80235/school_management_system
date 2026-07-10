// Test stand-in for a ClamAV-style scanner (used via AV_SCAN_CMD in tests).
// Reports "infected" for any file whose name contains "virus", else "clean".
// Mirrors clamdscan's contract: exit 1 + "<path>: <sig> FOUND" when infected.
const file = process.argv[process.argv.length - 1] || '';
if (/virus/i.test(file)) {
  process.stdout.write(`${file}: Test-Signature FOUND\n`);
  process.exit(1);
}
process.stdout.write(`${file}: OK\n`);
process.exit(0);
