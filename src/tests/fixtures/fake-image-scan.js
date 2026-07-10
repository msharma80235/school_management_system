// Test stand-in for a local image classifier (used via IMAGE_SCAN_CMD in tests).
// Emits a "flagged" verdict for any file whose name contains "bad", else "clean".
const file = process.argv[process.argv.length - 1] || '';
process.stdout.write(/bad/i.test(file) ? 'flagged: nudity 0.99\n' : 'clean\n');
process.exit(0);
