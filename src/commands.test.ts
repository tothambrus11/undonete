import {
  type AnyCommand,
  type CommandExecutionResult,
  type CommandHandlerWithExecutionResult,
  type CommandTypeRegistry,
  LinearCommandManager,
} from "./commands.ts";
import { expect } from "@deno/std-expect";

export interface Rectange {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Circle {
  x: number;
  y: number;
  radius: number;
}

class PaintModel {
  color: string = "black";

  rectangles: Rectange[] = [];
  circles: Circle[] = [];
}

export interface AddRectangleInstruction {
  rectangleToAdd: Rectange;
}

const addRectangleCommandHandler: CommandHandlerWithExecutionResult<
  PaintModel,
  AddRectangleInstruction,
  void
> = {
  execute: (model: PaintModel, instruction: AddRectangleInstruction): CommandExecutionResult<void> => {
    model.rectangles.push(instruction.rectangleToAdd);
    return { success: true, result: undefined };
  },
  redo: ({ model, instruction }) => {
    model.rectangles.push(instruction.rectangleToAdd);
  },
  undo: ({ model }) => {
    model.rectangles.pop();
  },
};

const addRectangleCommandHandlerWithResult = {
  execute: (model: PaintModel, instruction: AddRectangleInstruction): CommandExecutionResult<{ addedId: number }> => {
    model.rectangles.push(instruction.rectangleToAdd);
    return {
      success: true,
      result: { addedId: model.rectangles.length - 1 },
    };
  },
  undo: ({ model, executionResult }) => {
    model.rectangles.splice(executionResult.addedId, 1);
  },
  redo: ({ model, instruction, executionResult }) => {
    model.rectangles.splice(
      executionResult.addedId,
      0,
      instruction.rectangleToAdd,
    );
  },
} as const satisfies CommandHandlerWithExecutionResult<
  PaintModel,
  AddRectangleInstruction,
  { addedId: number }
>;

const addCircleCommandHandler = {
  execute: (model: PaintModel, instruction: { circleToAdd: Circle }): CommandExecutionResult<void> => {
    model.circles.push(instruction.circleToAdd);
    return { success: true, result: undefined };
  },
  undo: ({ model }) => {
    model.circles.pop();
  },
  redo: ({ model, instruction }) => {
    model.circles.push(instruction.circleToAdd);
  },
} as const satisfies CommandHandlerWithExecutionResult<
  PaintModel,
  { circleToAdd: Circle },
  void
>;

export const paintCommandTypeRegistry = {
  addRectangle: addRectangleCommandHandler,
  addRectangleWithResult: addRectangleCommandHandlerWithResult,
  addCircle: addCircleCommandHandler,
} as const satisfies CommandTypeRegistry<PaintModel, string>;
type PaintCommandTypeRegistry = typeof paintCommandTypeRegistry;

Deno.test("can create command", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  expect(paintModelCommandManager.commands.addRectangle({ rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 } }, paintModel)).toEqual({
    success: true,
    result: undefined,
  });
  expect(paintModelCommandManager.commands.addCircle({ circleToAdd: { x: 75, y: 75, radius: 10 } }, paintModel)).toEqual({ success: true, result: undefined });
});

Deno.test("can execute command", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  const commands: AnyCommand<PaintCommandTypeRegistry>[] = [
    { commandType: "addRectangle", instruction: { rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 } } },
    { commandType: "addCircle", instruction: { circleToAdd: { x: 75, y: 75, radius: 10 } } },
  ];

  commands.push({ commandType: "addCircle", instruction: { circleToAdd: { x: 10, y: 10, radius: 5 } } });

  for (const { commandType: commandName, instruction } of commands) {
    const res = paintModelCommandManager.executeCommand(commandName, instruction, paintModel);
    expect(res.success).toBe(true);
  }

  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.circles.length).toBe(2);
});

Deno.test("undo single command", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Execute a command
  const result = paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 },
  }, paintModel);

  expect(result.success).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);

  // Undo the command
  const undoResult = paintModelCommandManager.undo(paintModel);
  expect(undoResult).toBe(true);
  expect(paintModel.rectangles.length).toBe(0);
});

Deno.test("undo multiple commands in reverse order", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Execute multiple commands
  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 },
  }, paintModel);

  paintModelCommandManager.executeCommand("addCircle", {
    circleToAdd: { x: 75, y: 75, radius: 10 },
  }, paintModel);

  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 200, y: 200, width: 30, height: 30 },
  }, paintModel);

  expect(paintModel.rectangles.length).toBe(2);
  expect(paintModel.circles.length).toBe(1);

  // Undo commands in reverse order
  // Undo last rectangle
  expect(paintModelCommandManager.undo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.circles.length).toBe(1);

  // Undo circle
  expect(paintModelCommandManager.undo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.circles.length).toBe(0);

  // Undo first rectangle
  expect(paintModelCommandManager.undo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(0);
  expect(paintModel.circles.length).toBe(0);
});

Deno.test("undo when no commands executed returns false", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Try to undo when no commands have been executed
  const undoResult = paintModelCommandManager.undo(paintModel);
  expect(undoResult).toBe(false);
});

Deno.test("redo single command", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Execute and undo a command
  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 },
  }, paintModel);
  paintModelCommandManager.undo(paintModel);

  expect(paintModel.rectangles.length).toBe(0);

  // Redo the command
  const redoResult = paintModelCommandManager.redo(paintModel);
  expect(redoResult).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.rectangles[0]).toEqual({ x: 100, y: 100, width: 50, height: 50 });
});

Deno.test("redo multiple commands in original order", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  const rect1 = { x: 100, y: 100, width: 50, height: 50 };
  const circle1 = { x: 75, y: 75, radius: 10 };
  const rect2 = { x: 200, y: 200, width: 30, height: 30 };

  // Execute multiple commands
  paintModelCommandManager.executeCommand("addRectangle", { rectangleToAdd: rect1 }, paintModel);
  paintModelCommandManager.executeCommand("addCircle", { circleToAdd: circle1 }, paintModel);
  paintModelCommandManager.executeCommand("addRectangle", { rectangleToAdd: rect2 }, paintModel);

  // Undo all commands
  paintModelCommandManager.undo(paintModel); // undo rect2
  paintModelCommandManager.undo(paintModel); // undo circle1
  paintModelCommandManager.undo(paintModel); // undo rect1

  expect(paintModel.rectangles.length).toBe(0);
  expect(paintModel.circles.length).toBe(0);

  // Redo commands in original order
  expect(paintModelCommandManager.redo(paintModel)).toBe(true); // redo rect1
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.rectangles[0]).toEqual(rect1);

  expect(paintModelCommandManager.redo(paintModel)).toBe(true); // redo circle1
  expect(paintModel.circles.length).toBe(1);
  expect(paintModel.circles[0]).toEqual(circle1);

  expect(paintModelCommandManager.redo(paintModel)).toBe(true); // redo rect2
  expect(paintModel.rectangles.length).toBe(2);
  expect(paintModel.rectangles[1]).toEqual(rect2);
});

Deno.test("redo when no commands undone returns false", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Try to redo when no commands have been undone
  const redoResult = paintModelCommandManager.redo(paintModel);
  expect(redoResult).toBe(false);

  // Execute a command and try redo (should still return false)
  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 },
  }, paintModel);

  const redoResult2 = paintModelCommandManager.redo(paintModel);
  expect(redoResult2).toBe(false);
});

Deno.test("redo stack cleared after new command execution", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  // Execute two commands
  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 },
  }, paintModel);
  paintModelCommandManager.executeCommand("addCircle", {
    circleToAdd: { x: 75, y: 75, radius: 10 },
  }, paintModel);

  // Undo both commands
  paintModelCommandManager.undo(paintModel); // undo circle
  paintModelCommandManager.undo(paintModel); // undo rectangle

  expect(paintModel.rectangles.length).toBe(0);
  expect(paintModel.circles.length).toBe(0);

  // Redo one command
  expect(paintModelCommandManager.redo(paintModel)).toBe(true); // redo rectangle
  expect(paintModel.rectangles.length).toBe(1);

  // Execute a new command (should clear redo stack)
  paintModelCommandManager.executeCommand("addRectangle", {
    rectangleToAdd: { x: 200, y: 200, width: 30, height: 30 },
  }, paintModel);

  expect(paintModel.rectangles.length).toBe(2);

  // Try to redo the previously undone circle command (should return false)
  expect(paintModelCommandManager.redo(paintModel)).toBe(false);
});

Deno.test("undo and redo with command that has execution result", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  const rect1 = { x: 100, y: 100, width: 50, height: 50 };
  const rect2 = { x: 200, y: 200, width: 30, height: 30 };

  // Execute commands that return results
  const result1 = paintModelCommandManager.executeCommand("addRectangleWithResult", {
    rectangleToAdd: rect1,
  }, paintModel);

  const result2 = paintModelCommandManager.executeCommand("addRectangleWithResult", {
    rectangleToAdd: rect2,
  }, paintModel);

  expect(result1.success).toBe(true);
  expect(result2.success).toBe(true);
  if (result1.success && result2.success) {
    expect(result1.result.addedId).toBe(0);
    expect(result2.result.addedId).toBe(1);
  }
  expect(paintModel.rectangles.length).toBe(2);

  // Undo second rectangle (should remove at correct index)
  expect(paintModelCommandManager.undo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.rectangles[0]).toEqual(rect1);

  // Undo first rectangle
  expect(paintModelCommandManager.undo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(0);

  // Redo first rectangle
  expect(paintModelCommandManager.redo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.rectangles[0]).toEqual(rect1);

  // Redo second rectangle (should insert at correct index)
  expect(paintModelCommandManager.redo(paintModel)).toBe(true);
  expect(paintModel.rectangles.length).toBe(2);
  expect(paintModel.rectangles[0]).toEqual(rect1);
  expect(paintModel.rectangles[1]).toEqual(rect2);
});

Deno.test("mixed undo/redo operations", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, PaintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  const rect1 = { x: 100, y: 100, width: 50, height: 50 };
  const circle1 = { x: 75, y: 75, radius: 10 };
  const rect2 = { x: 200, y: 200, width: 30, height: 30 };

  // Execute commands
  paintModelCommandManager.executeCommand("addRectangle", { rectangleToAdd: rect1 }, paintModel);
  paintModelCommandManager.executeCommand("addCircle", { circleToAdd: circle1 }, paintModel);

  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.circles.length).toBe(1);

  // Undo one command
  expect(paintModelCommandManager.undo(paintModel)).toBe(true); // undo circle
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.circles.length).toBe(0);

  // Execute new command
  paintModelCommandManager.executeCommand("addRectangle", { rectangleToAdd: rect2 }, paintModel);
  expect(paintModel.rectangles.length).toBe(2);

  // Undo the new command
  expect(paintModelCommandManager.undo(paintModel)).toBe(true); // undo rect2
  expect(paintModel.rectangles.length).toBe(1);

  // Try to redo (should redo rect2, not the circle)
  expect(paintModelCommandManager.redo(paintModel)).toBe(true); // redo rect2
  expect(paintModel.rectangles.length).toBe(2);
  expect(paintModel.circles.length).toBe(0); // circle should still be gone

  // Undo back to rect1 only
  expect(paintModelCommandManager.undo(paintModel)).toBe(true); // undo rect2
  expect(paintModel.rectangles.length).toBe(1);
  expect(paintModel.rectangles[0]).toEqual(rect1);
});
