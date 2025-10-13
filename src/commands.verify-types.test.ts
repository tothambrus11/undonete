/**
 * TypeScript compile-time type tests for command system
 *
 * These tests verify that the type system correctly enforces
 * type safety between command types and their corresponding instruction types.
 *
 * Key Test: AnyCommand<Registry> array should reject mismatched command/instruction pairs
 *
 * Run with: deno check src/commands.verify-types.test.ts
 *
 * Expected behavior:
 * ✅ Valid command/instruction pairs should type check
 * ❌ Invalid combinations should cause compile-time errors
 */

import { expectTypeOf } from "expect-type";
import type {
  AnyCommand,
  AnyCommandWithResult,
  CommandExecutionResult,
  CommandTypeRegistry,
  ExecutionResultOf_Simple,
  InstructionOf_Simple,
  SuccessfulExecutionResultOf_Simple,
} from "./commands.ts";

// Test setup - creating a simple registry for testing
interface TestModel {
  value: number;
  items: string[];
}

interface SetValueInstruction {
  newValue: number;
}

interface AddItemInstruction {
  item: string;
}

interface ComplexInstruction {
  data: { nested: boolean };
}

const testRegistry = {
  setValue: {
    execute: (model: TestModel, instruction: SetValueInstruction): CommandExecutionResult<void> => {
      model.value = instruction.newValue;
      return { success: true, result: undefined };
    },
    undo: () => {},
    redo: () => {},
  },
  addItem: {
    execute: (model: TestModel, instruction: AddItemInstruction): CommandExecutionResult<{ itemId: number }> => {
      model.items.push(instruction.item);
      return { success: true, result: { itemId: model.items.length - 1 } };
    },
    undo: () => {},
    redo: () => {},
  },
  complexCommand: {
    execute: (_model: TestModel, _instruction: ComplexInstruction): CommandExecutionResult<{ success: true; data: string }> => {
      return { success: true, result: { success: true, data: "processed" } };
    },
    undo: () => {},
    redo: () => {},
  },
} as const satisfies CommandTypeRegistry<TestModel, string>;

type TestRegistry = typeof testRegistry;

// ✅ TEST 1: Valid command/instruction pairs should type check
function testValidCommandUsage() {
  const commands: AnyCommand<TestRegistry>[] = [];

  // These should all compile without errors
  commands.push({ commandType: "setValue", instruction: { newValue: 42 } });
  commands.push({ commandType: "addItem", instruction: { item: "test" } });
  commands.push({ commandType: "complexCommand", instruction: { data: { nested: true } } });

  // Array literals should also work
  const moreCommands: AnyCommand<TestRegistry>[] = [
    { commandType: "setValue", instruction: { newValue: 1 } },
    { commandType: "addItem", instruction: { item: "hello" } },
    { commandType: "complexCommand", instruction: { data: { nested: false } } },
  ];

  // Using expectTypeOf for additional validation
  expectTypeOf(commands).toEqualTypeOf<AnyCommand<TestRegistry>[]>();
  expectTypeOf(moreCommands).toEqualTypeOf<AnyCommand<TestRegistry>[]>();

  return { commands, moreCommands };
}

// ❌ TEST 2: Invalid command/instruction pairs should cause compile errors
function testInvalidCommandUsage() {
  const commands: AnyCommand<TestRegistry>[] = [];

  // UNCOMMENT ANY LINE BELOW TO SEE TYPE ERRORS:

  // @ts-expect-error Wrong instruction type for setValue:
  commands.push({ commandType: "setValue", instruction: { item: "wrong" } });

  // @ts-expect-error Wrong instruction type for addItem:
  commands.push({ commandType: "addItem", instruction: { newValue: 42 } });

  // @ts-expect-error Wrong instruction type for complexCommand:
  commands.push({ commandType: "complexCommand", instruction: { newValue: 42 } });

  // @ts-expect-error Non-existent command:
  commands.push({ commandType: "nonExistentCommand", instruction: { anything: true } });

  // @ts-expect-error Wrong property name (should be commandType, not commandName):
  commands.push({ commandName: "setValue", instruction: { newValue: 42 } });

  return commands;
}

function typeOfAnyCommandIsAKey() {
  const commands: AnyCommand<TestRegistry>[] = [];

  commands.push({ commandType: "setValue", instruction: { newValue: 42 } });

  testRegistry[commands[0].commandType];
}

// ✅ TEST 4: forEach and other array operations should maintain type safety
function testArrayOperations() {
  const commands: AnyCommand<TestRegistry>[] = [
    { commandType: "setValue", instruction: { newValue: 42 } },
    { commandType: "addItem", instruction: { item: "test" } },
    { commandType: "complexCommand", instruction: { data: { nested: true } } },
  ];

  commands.forEach((cmd) => {
    // Type narrowing should work in array iteration
    if (cmd.commandType === "setValue") {
      console.log("Setting value to:", cmd.instruction.newValue);
    } else if (cmd.commandType === "addItem") {
      console.log("Adding item:", cmd.instruction.item);
    } else if (cmd.commandType === "complexCommand") {
      console.log("Complex command with nested:", cmd.instruction.data.nested);
    }
  });

  // Map operations should preserve types
  const commandTypes = commands.map((cmd) => cmd.commandType); // Should be ("setValue" | "addItem" | "complexCommand")[]
  return commandTypes;
}

// Helper type to extract instruction type from AnyCommand union
type ExtractInstruction<T, K> = T extends { commandType: K; instruction: infer I } ? I : never;

// Helper type to create instruction map
type InstructionMap<Registry> = {
  [K in keyof Registry]: ExtractInstruction<AnyCommand<Registry>, K>;
};

// ✅ TEST 5: Generic functions should work with proper constraints
function processCommand<T extends keyof TestRegistry>(
  commandType: T,
  instruction: InstructionMap<TestRegistry>[T],
): Extract<AnyCommand<TestRegistry>, { commandType: T }> {
  return { commandType, instruction } as Extract<AnyCommand<TestRegistry>, { commandType: T }>;
}

function testGenericFunction() {
  // These should work:
  const cmd1 = processCommand("setValue", { newValue: 42 });
  const cmd2 = processCommand("addItem", { item: "test" });

  // Verify types
  if (cmd1.commandType === "setValue") {
    const _value = cmd1.instruction.newValue; // Should work
  }
  if (cmd2.commandType === "addItem") {
    const _item = cmd2.instruction.item; // Should work
  }

  // These would cause compile errors:
  // @ts-expect-error Wrong instruction type
  const _cmd3 = processCommand("setValue", { item: "wrong" });
  // @ts-expect-error Wrong instruction type
  const _cmd4 = processCommand("nonExistent", { anything: true });

  return { cmd1, cmd2 };
}

// ===============================
// Additional comprehensive type tests from the legacy test file
// ===============================

// Test A: Type inference for instruction types using expectTypeOf
function testInstructionTypeInference() {
  // InstructionOf_Simple should correctly extract instruction types
  expectTypeOf<InstructionOf_Simple<TestRegistry, "setValue">>().toEqualTypeOf<SetValueInstruction>();
  expectTypeOf<InstructionOf_Simple<TestRegistry, "addItem">>().toEqualTypeOf<AddItemInstruction>();
  expectTypeOf<InstructionOf_Simple<TestRegistry, "complexCommand">>().toEqualTypeOf<ComplexInstruction>();

  // Should not be assignable to wrong instruction types
  expectTypeOf<InstructionOf_Simple<TestRegistry, "setValue">>().not.toEqualTypeOf<AddItemInstruction>();
  expectTypeOf<InstructionOf_Simple<TestRegistry, "addItem">>().not.toEqualTypeOf<SetValueInstruction>();
}

// Test B: Type inference for execution result types
function testExecutionResultTypeInference() {
  // ExecutionResultOf_Simple should correctly extract return types
  expectTypeOf<ExecutionResultOf_Simple<TestRegistry, "setValue">>().toEqualTypeOf<CommandExecutionResult<void>>();
  expectTypeOf<ExecutionResultOf_Simple<TestRegistry, "addItem">>().toEqualTypeOf<CommandExecutionResult<{ itemId: number }>>();
  expectTypeOf<ExecutionResultOf_Simple<TestRegistry, "complexCommand">>().toEqualTypeOf<CommandExecutionResult<{ success: true; data: string }>>();

  // SuccessfulExecutionResultOf_Simple should extract only the success case
  expectTypeOf<SuccessfulExecutionResultOf_Simple<TestRegistry, "setValue">>().toEqualTypeOf<void>();
  expectTypeOf<SuccessfulExecutionResultOf_Simple<TestRegistry, "addItem">>().toEqualTypeOf<{ itemId: number }>();
  expectTypeOf<SuccessfulExecutionResultOf_Simple<TestRegistry, "complexCommand">>().toEqualTypeOf<{ success: true; data: string }>();
}

// Test C: AnyCommandWithResult type safety
function testAnyCommandWithResult() {
  const commandsWithResults: AnyCommandWithResult<TestRegistry>[] = [];

  // Valid usage
  commandsWithResults.push({
    commandType: "setValue",
    instruction: { newValue: 42 },
    executionResult: undefined,
  });

  commandsWithResults.push({
    commandType: "addItem",
    instruction: { item: "test" },
    executionResult: { itemId: 0 },
  });

  commandsWithResults.push({
    commandType: "complexCommand",
    instruction: { data: { nested: true } },
    executionResult: { success: true, data: "processed" },
  });

  // Invalid usage - wrong execution result type
  // @ts-expect-error - Wrong result type
  commandsWithResults.push({
    commandType: "setValue",
    instruction: { newValue: 42 },
    executionResult: { itemId: 0 }, // Wrong result type
  });

  // @ts-expect-error - Wrong result type
  commandsWithResults.push({
    commandType: "addItem",
    instruction: { item: "test" },
    executionResult: undefined, // Wrong result type
  });
}

// Test D: Enhanced command type narrowing with expectTypeOf
function testCommandTypeNarrowingWithExpectTypeOf() {
  const command: AnyCommand<TestRegistry> = {} as AnyCommand<TestRegistry>;

  if (command.commandType === "setValue") {
    // TypeScript should narrow the instruction type
    expectTypeOf(command.instruction).toEqualTypeOf<SetValueInstruction>();
  }

  if (command.commandType === "addItem") {
    expectTypeOf(command.instruction).toEqualTypeOf<AddItemInstruction>();
  }

  if (command.commandType === "complexCommand") {
    expectTypeOf(command.instruction).toEqualTypeOf<ComplexInstruction>();
  }
}

// Test E: Registry type constraints
function testRegistryConstraints() {
  // Valid registry should be assignable to CommandTypeRegistry
  expectTypeOf(testRegistry).toMatchTypeOf<CommandTypeRegistry<TestModel, string>>();
}

// Test F: Cross-command type isolation
function testCrossCommandTypeIsolation() {
  // Verify that instruction types don't leak between commands
  type SetValueInstr = InstructionOf_Simple<TestRegistry, "setValue">;
  type AddItemInstr = InstructionOf_Simple<TestRegistry, "addItem">;

  expectTypeOf<SetValueInstr>().not.toEqualTypeOf<AddItemInstr>();
  expectTypeOf<AddItemInstr>().not.toEqualTypeOf<SetValueInstr>();

  // Verify that execution result types don't leak between commands
  type SetValueResult = SuccessfulExecutionResultOf_Simple<TestRegistry, "setValue">;
  type AddItemResult = SuccessfulExecutionResultOf_Simple<TestRegistry, "addItem">;

  expectTypeOf<SetValueResult>().not.toEqualTypeOf<AddItemResult>();
  expectTypeOf<AddItemResult>().not.toEqualTypeOf<SetValueResult>();
}

// Test G: Union type behavior
function testUnionTypeBehavior() {
  // AnyCommand should be a union of all possible command types
  type CommandUnion = AnyCommand<TestRegistry>;

  // Each specific command type should be assignable to the union
  expectTypeOf<{ commandType: "setValue"; instruction: { newValue: number } }>().toMatchTypeOf<CommandUnion>();
  expectTypeOf<{ commandType: "addItem"; instruction: { item: string } }>().toMatchTypeOf<CommandUnion>();
  expectTypeOf<{ commandType: "complexCommand"; instruction: { data: { nested: boolean } } }>().toMatchTypeOf<CommandUnion>();

  // Test that the union properly discriminates
  const validCommand: CommandUnion = { commandType: "setValue", instruction: { newValue: 42 } };
  expectTypeOf(validCommand).toMatchTypeOf<CommandUnion>();
}

// Test H: Enhanced array operations with proper type checking using expectTypeOf
function testArrayOperationsTypeCheckingWithExpectTypeOf() {
  const commands: AnyCommand<TestRegistry>[] = [];

  // Valid pushes should work
  commands.push({ commandType: "setValue", instruction: { newValue: 42 } });
  commands.push({ commandType: "addItem", instruction: { item: "test" } });
  commands.push({ commandType: "complexCommand", instruction: { data: { nested: true } } });

  // Type checking in array context
  const validCommands: AnyCommand<TestRegistry>[] = [
    { commandType: "setValue", instruction: { newValue: 1 } },
    { commandType: "addItem", instruction: { item: "hello" } },
    { commandType: "complexCommand", instruction: { data: { nested: false } } },
  ];

  expectTypeOf(validCommands).toEqualTypeOf<AnyCommand<TestRegistry>[]>();

  // Invalid array entries should cause type errors
  const invalidCommands = [
    { commandType: "setValue", instruction: { item: "wrong" } },
    { commandType: "fakeCommand", instruction: { anything: true } },
  ];

  // Verify the invalid array doesn't match our expected type
  expectTypeOf(invalidCommands[0]).not.toExtend<AnyCommand<TestRegistry>[]>();
}

// Summary: Export all test functions
export {
  processCommand,
  testAnyCommandWithResult,
  testArrayOperations,
  testArrayOperationsTypeCheckingWithExpectTypeOf,
  testCommandTypeNarrowingWithExpectTypeOf,
  testCrossCommandTypeIsolation,
  testExecutionResultTypeInference,
  testGenericFunction,
  testInstructionTypeInference,
  testInvalidCommandUsage,
  testRegistryConstraints,
  testUnionTypeBehavior,
  testValidCommandUsage,
  typeOfAnyCommandIsAKey,
};
