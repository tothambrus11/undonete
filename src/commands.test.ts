import {
  type CommandExecutionResult,
  type CommandHandlerWithExecutionResult,
  type CommandHandlerWithoutExecutionResult,
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

const addRectangleCommandHandler: CommandHandlerWithoutExecutionResult<
  PaintModel,
  AddRectangleInstruction
> = {
  execute: (model: PaintModel, instruction: AddRectangleInstruction): CommandExecutionResult<void> => {
    model.rectangles.push(instruction.rectangleToAdd);
    return { success: true, result: undefined };
  },
  undo: (params) => {
    params.model.rectangles.pop();
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
  undo: (params) => {
    params.model.circles.pop();
  },
} as const satisfies CommandHandlerWithoutExecutionResult<
  PaintModel,
  { circleToAdd: Circle }
>;

export const paintCommandTypeRegistry = {
  addRectangle: addRectangleCommandHandler,
  addRectangleWithResult: addRectangleCommandHandlerWithResult,
  addCircle: addCircleCommandHandler,
} as const satisfies CommandTypeRegistry<PaintModel, string>;

Deno.test("can create command", () => {
  const paintModelCommandManager = new LinearCommandManager<PaintModel, string, typeof paintCommandTypeRegistry>(paintCommandTypeRegistry);
  const paintModel = new PaintModel();

  expect(paintModelCommandManager.commands.addRectangle({ rectangleToAdd: { x: 100, y: 100, width: 50, height: 50 } }, paintModel)).toEqual({
    success: true,
    result: undefined,
  });
  expect(paintModelCommandManager.commands.addCircle({ circleToAdd: { x: 75, y: 75, radius: 10 } }, paintModel)).toEqual({ success: true, result: undefined });
});
