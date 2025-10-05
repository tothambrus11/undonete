export type CommandExecutionResult<T> = {
  success: true;
  result: T;
  // Optional, true is assumed if not provided.
  hadEffect?: boolean | undefined;
} | {
  success: false;
  errorMessage: string;
};

/// Extracts the type T from a given type that extends Result<T>.
export type SuccessTypeOfResult<T extends CommandExecutionResult<unknown>> = T extends { success: true; result: infer U } ? U : never;

export type CommandHandlerWithoutExecutionResult<
  Model,
  Instruction,
> = {
  execute: (
    model: Model,
    instruction: Instruction,
  ) => CommandExecutionResult<void>;
  undo: (params: {
    model: Model;
    instruction: Instruction;
  }) => void;
};

export type CommandHandlerWithExecutionResult<
  Model,
  Instruction,
  ExecutionResult,
> = {
  execute: (
    model: Model,
    instruction: Instruction,
  ) => CommandExecutionResult<ExecutionResult>;
  undo: (params: {
    model: Model;
    instruction: Instruction;
    executionResult: ExecutionResult;
  }) => void;
  redo: (params: {
    model: Model;
    instruction: Instruction;
    executionResult: ExecutionResult;
  }) => void;
};

export type AnyCommandHandler<Model, Instruction> =
  | CommandHandlerWithoutExecutionResult<Model, Instruction>
  | CommandHandlerWithExecutionResult<Model, Instruction, unknown>;

export type CommandTypeRegistry<Model, PossibleKeys extends string> = {
  [key in PossibleKeys]: unknown;
};

export type ExecutionResultOf<
  Model,
  PossibleKeys extends string,
  Registry,
  CommandType extends keyof Registry,
> = Registry[CommandType] extends {
  execute: (...args: unknown[]) => CommandExecutionResult<infer ER>;
}
  ? ER
  : never;

export type InstructionOf<
  Model,
  PossibleKeys extends string,
  Registry,
  CommandType extends keyof Registry,
> = Registry[CommandType] extends {
  execute: (model: Model, instruction: infer I, ...rest: unknown[]) => unknown;
}
  ? I
  : never;

export interface DoneCommand<ExecutionResult> {
  commandType: ExecutionResult;
}

export class LinearCommandManager<
  Model,
  PossibleKeys extends string,
  ConcreteCommandTypeRegistry extends CommandTypeRegistry<
    Model,
    PossibleKeys
  >,
> {
  private undoStack: DoneCommand<
    ExecutionResultOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      keyof ConcreteCommandTypeRegistry
    >
  >[] = [];

  private redoStack: DoneCommand<
    ExecutionResultOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      keyof ConcreteCommandTypeRegistry
    >
  >[] = [];

  private readonly commandTypeRegistry: ConcreteCommandTypeRegistry;

  constructor(
    commandTypeRegistry: ConcreteCommandTypeRegistry,
  ) {
    this.commandTypeRegistry = commandTypeRegistry;
  }

  executeCommand<
    ConcreteCommandType extends keyof ConcreteCommandTypeRegistry,
    ConcreteInstruction extends InstructionOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      ConcreteCommandType
    >,
    Handler extends ConcreteCommandTypeRegistry[ConcreteCommandType] & {
      execute: (model: Model, instruction: ConcreteInstruction) => CommandExecutionResult<unknown>;
    },
  >(
    commandType: ConcreteCommandType,
    command: ConcreteInstruction,
    model: Model,
  ): void {
    const commandHandler: Handler = this.commandTypeRegistry[commandType] as unknown as Handler;
    commandHandler.execute(model, command);
  }

  get commands() {
    type Commands = {
      [K in keyof ConcreteCommandTypeRegistry]: (
        instruction: InstructionOf<
          Model,
          PossibleKeys,
          ConcreteCommandTypeRegistry,
          K
        >,
        model: Model,
      ) => void;
    };

    // Build a concrete commands object at runtime by creating typed closures
    // for each key. We use a typed helper makeCommand so each closure captures
    // the specific key `k` as a type parameter, avoiding unsafe casts when
    // calling `executeCommand`.
    const commands = {} as Commands;
    const keys = Object.keys(this.commandTypeRegistry) as Array<keyof ConcreteCommandTypeRegistry>;
    for (const k of keys) {
      commands[k] = this.makeCommand(k);
    }

    return commands;
  }

  private makeCommand<CT extends keyof ConcreteCommandTypeRegistry>(
    commandType: CT,
  ): (
    instruction: InstructionOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      CT
    >,
    model: Model,
  ) => void {
    return (instruction, model) => {
      this.executeCommand(commandType, instruction, model);
    };
  }
}
