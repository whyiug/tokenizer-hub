const { compactContext } = await import("../src/lib/tokenizer.ts");

const cases = [
  [1_048_576, "1M"],
  [1_047_576, "1M"],
  [2_000_000, "2M"],
  [1_500_000, "1.5M"],
  [262_144, "262K"],
  [131_072, "131K"],
  [16_385, "16K"],
];

const failures = cases
  .map(([input, expected]) => ({ input, expected, actual: compactContext(input) }))
  .filter(({ expected, actual }) => actual !== expected);

if (failures.length) {
  for (const failure of failures) {
    console.error(`${failure.input}: expected ${failure.expected}, got ${failure.actual}`);
  }
  process.exit(1);
}

console.log("Context format validation ok.");
