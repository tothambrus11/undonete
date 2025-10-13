import {
  type AnyCommand,
  type CommandExecutionResult,
  type CommandHandlerWithExecutionResult,
  type CommandTypeRegistry,
  LinearCommandManager,
} from "./commands.ts";
import { expect } from "jsr:@std/expect@1.0.17";

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
