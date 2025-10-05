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
export type SuccessTypeOfResult<T extends CommandExecutionResult<any>> = T extends { success: true; result: infer U } ? U : never;

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
  | CommandHandlerWithExecutionResult<Model, Instruction, any>;

export type CommandTypeRegistry<Model, PossibleKeys extends string> = {
  [key in PossibleKeys]: AnyCommandHandler<Model, any>;
};

export type ExecutionResultOf<
  Model,
  PossibleKeys extends string,
  Registry extends CommandTypeRegistry<Model, PossibleKeys>,
  CommandType extends keyof Registry,
> = SuccessTypeOfResult<ReturnType<Registry[CommandType]["execute"]>>;

export type InstructionOf<
  Model,
  PossibleKeys extends string,
  Registry extends CommandTypeRegistry<Model, PossibleKeys>,
  CommandType extends keyof Registry,
> = Parameters<Registry[CommandType]["execute"]>[1];

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
  >(
    commandType: ConcreteCommandType,
    command: ConcreteInstruction,
    model: Model,
  ): void {
    const commandHandler = this.commandTypeRegistry[commandType];
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

    return new Proxy({} as Commands, {
      get: (
        _target,
        commandType: string,
      ) => ((instruction: any, model: Model) => {
        this.executeCommand(
          commandType as keyof ConcreteCommandTypeRegistry,
          instruction,
          model,
        );
      }),
    });
  }
}
