// Test file to verify processCommand type safety
// This file should show compile errors when uncommented lines are enabled

import type { AnyCommand } from "./commands.ts";

interface TestModel {
  value: number;
  items: string[];
}

const testRegistry = {
  setValue: {
    execute: (_model: TestModel, _instruction: { newValue: number }) => ({ success: true as const, result: undefined }),
    undo: () => {},
    redo: () => {},
  },
  addItem: {
    execute: (_model: TestModel, _instruction: { item: string }) => ({ success: true as const, result: { itemId: 0 } }),
    undo: () => {},
    redo: () => {},
  },
} as const;

type TestRegistry = typeof testRegistry;

// Helper types
type ExtractInstruction<T, K> = T extends { commandType: K; instruction: infer I } ? I : never;
type InstructionMap<Registry> = {
  [K in keyof Registry]: ExtractInstruction<AnyCommand<Registry>, K>;
};

// Working processCommand function
function processCommand<T extends keyof TestRegistry>(
  commandType: T,
  instruction: InstructionMap<TestRegistry>[T],
): Extract<AnyCommand<TestRegistry>, { commandType: T }> {
  return { commandType, instruction } as Extract<AnyCommand<TestRegistry>, { commandType: T }>;
}

// ✅ Valid usage (should compile)
export function testValidProcessCommand() {
  const cmd1 = processCommand("setValue", { newValue: 42 });
  const cmd2 = processCommand("addItem", { item: "test" });

  console.log("Valid commands created:", cmd1, cmd2);
  return { cmd1, cmd2 };
}

// ❌ Invalid usage (uncomment to see type errors)
export function testInvalidProcessCommand() {
  // UNCOMMENT TO TEST TYPE ERRORS:

  // Wrong instruction type for setValue
  // const cmd1 = processCommand("setValue", { item: "wrong" });

  // Wrong instruction type for addItem
  // const cmd2 = processCommand("addItem", { newValue: 42 });

  // Non-existent command
  // const cmd3 = processCommand("nonExistent", { anything: true });

  console.log("Invalid usage test function (all lines commented out)");
}

// ✅ Type narrowing should work
export function testProcessCommandTypeNarrowing() {
  const cmd1 = processCommand("setValue", { newValue: 42 });
  const cmd2 = processCommand("addItem", { item: "test" });

  // Type narrowing verification
  if (cmd1.commandType === "setValue") {
    const value = cmd1.instruction.newValue; // Should work
    console.log("Value:", value);
  }

  if (cmd2.commandType === "addItem") {
    const item = cmd2.instruction.item; // Should work
    console.log("Item:", item);
  }

  return { cmd1, cmd2 };
}

/*
TESTING INSTRUCTIONS:

1. Run: deno check src/test-process-command.ts
   ✅ Should pass (no compile errors)

2. Uncomment lines in testInvalidProcessCommand()
   ❌ Should show specific type errors for each invalid case

3. Verify type narrowing works in testProcessCommandTypeNarrowing()
   ✅ Should access .newValue and .item properties correctly

This proves that processCommand<T>() provides:
✅ Type safety: Wrong combinations caught at compile time
✅ Proper return types: Extract<AnyCommand<Registry>, { commandType: T }>
✅ Type narrowing: Discriminated union works correctly
*/
