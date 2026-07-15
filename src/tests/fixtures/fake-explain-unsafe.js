// Test stand-in for a misbehaving explanation AI: emits content that the
// kid-safety scanner flags, so explainText must discard it and fall back.
process.stdout.write('This explanation contains fucking profanity that must be discarded.\n');
process.exit(0);
