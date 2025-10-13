/**
 * Simple TypeScript type safety demonstration for AnyCommand<Registry>
 *
 * This demonstrates that the type system correctly enforces type safety between
 * command types and their corresponding instruction types.
 *
 * Run: deno check src/simple-type-test.ts
 */

import type { AnyCommand, CommandExecutionResult, CommandTypeRegistry } from "./commands.ts";

// Simple test registry
interface TestModel {
  value: number;
  items: string[];
}

const testRegistry = {
  setValue: {
    execute: (model: TestModel, instruction: { newValue: number }): CommandExecutionResult<void> => {
      model.value = instruction.newValue;
      return { success: true, result: undefined };
    },
    undo: () => {},
    redo: () => {},
  },
  addItem: {
    execute: (model: TestModel, instruction: { item: string }): CommandExecutionResult<{ itemId: number }> => {
      model.items.push(instruction.item);
      return { success: true, result: { itemId: model.items.length - 1 } };
    },
    undo: () => {},
    redo: () => {},
  },
} as const satisfies CommandTypeRegistry<TestModel, string>;

type TestRegistry = typeof testRegistry;

// ✅ These work - correct command/instruction pairs
export function demonstrateValidUsage() {
  const commands: AnyCommand<TestRegistry>[] = [];

  // Valid: setValue with newValue
  commands.push({ commandType: "setValue", instruction: { newValue: 42 } });

  // Valid: addItem with item
  commands.push({ commandType: "addItem", instruction: { item: "test" } });

  console.log("All valid commands compiled successfully!");
  return commands;
}

// ❌ Uncomment any of these to see type errors:
export function demonstrateInvalidUsage() {
  const commands: AnyCommand<TestRegistry>[] = [];

  // UNCOMMENT TO TEST TYPE CHECKING:

  // Type error - setValue expects { newValue: number }, not { item: string }
  // commands.push({ commandType: "setValue", instruction: { item: "wrong" } });

  // Type error - addItem expects { item: string }, not { newValue: number }
  // commands.push({ commandType: "addItem", instruction: { newValue: 42 } });

  // Type error - nonExistent command doesn't exist
  // commands.push({ commandType: "nonExistent", instruction: { anything: true } });

  return commands;
}

// ✅ Type narrowing works in practice
export function demonstrateTypeNarrowing() {
  const commands: AnyCommand<TestRegistry>[] = [
    { commandType: "setValue", instruction: { newValue: 42 } },
    { commandType: "addItem", instruction: { item: "hello" } },
  ];

  commands.forEach((command) => {
    if (command.commandType === "setValue") {
      // TypeScript knows instruction has newValue
      console.log("Setting value to:", command.instruction.newValue);
    } else if (command.commandType === "addItem") {
      // TypeScript knows instruction has item
      console.log("Adding item:", command.instruction.item);
    }
  });
}

/*
TESTING INSTRUCTIONS:

1. Run: deno check src/simple-type-test.ts
   ✅ Should pass (no compile errors)

2. Uncomment any line in demonstrateInvalidUsage()
   ❌ Should show compile-time errors

3. Try typing in VS Code:
   - commands.push({ commandType: "setValue", instruction: { |cursor| } });
   - Should autocomplete with "newValue"

   - commands.push({ commandType: "addItem", instruction: { |cursor| } });
   - Should autocomplete with "item"

This proves that AnyCommand<Registry> provides:
✅ Type safety: Wrong combinations caught at compile time
✅ IntelliSense: Autocomplete shows correct properties
✅ Type narrowing: Discriminated union works correctly
*/
