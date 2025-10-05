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

export type AnyCommandHandler<Model> =
  // deno-lint-ignore no-explicit-any
  | CommandHandlerWithoutExecutionResult<Model, any>
  // deno-lint-ignore no-explicit-any
  | CommandHandlerWithExecutionResult<Model, any, any>;

export type CommandTypeRegistry<Model, PossibleKeys extends string> = {
  [key in PossibleKeys]: AnyCommandHandler<Model>;
};

export type ExecutionResultOf<
  Model,
  PossibleKeys extends string,
  Registry extends CommandTypeRegistry<Model, PossibleKeys>,
  CommandType extends keyof Registry,
> = ReturnType<Registry[CommandType]["execute"]>;

export type SuccessfulExecutionResultOf<
  Model,
  PossibleKeys extends string,
  Registry extends CommandTypeRegistry<Model, PossibleKeys>,
  CommandType extends keyof Registry,
> = SuccessTypeOfResult<ExecutionResultOf<Model, PossibleKeys, Registry, CommandType>>;

export type InstructionOf<
  Model,
  PossibleKeys extends string,
  Registry extends CommandTypeRegistry<Model, PossibleKeys>,
  CommandType extends keyof Registry,
> = Parameters<Registry[CommandType]["execute"]>[1];

export interface SpecificDoneCommand<
  Model,
  PossibleKeys extends string,
  ConcreteCommandTypeRegistry extends CommandTypeRegistry<
    Model,
    PossibleKeys
  >,
  SpecificCommandType extends keyof ConcreteCommandTypeRegistry,
> {
  commandType: SpecificCommandType;
  instruction: InstructionOf<Model, keyof ConcreteCommandTypeRegistry & string, ConcreteCommandTypeRegistry, SpecificCommandType>;
  executionResult: SuccessfulExecutionResultOf<Model, keyof ConcreteCommandTypeRegistry & string, ConcreteCommandTypeRegistry, SpecificCommandType> & {
    success: true;
  };
}

export class LinearCommandManager<
  Model,
  PossibleKeys extends string,
  ConcreteCommandTypeRegistry extends CommandTypeRegistry<
    Model,
    PossibleKeys
  >,
> {
  private undoStack: SpecificDoneCommand<Model, PossibleKeys, ConcreteCommandTypeRegistry, keyof ConcreteCommandTypeRegistry>[] = [];
  private redoStack: SpecificDoneCommand<Model, PossibleKeys, ConcreteCommandTypeRegistry, keyof ConcreteCommandTypeRegistry>[] = [];

  private readonly commandTypeRegistry: ConcreteCommandTypeRegistry;

  constructor(
    commandTypeRegistry: ConcreteCommandTypeRegistry,
  ) {
    this.commandTypeRegistry = commandTypeRegistry;
  }

  executeCommand<
    ConcreteCommandType extends keyof ConcreteCommandTypeRegistry & string,
    ConcreteInstruction extends InstructionOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      ConcreteCommandType
    >,
  >(
    commandType: ConcreteCommandType,
    instruction: ConcreteInstruction,
    model: Model,
  ): ReturnType<ConcreteCommandTypeRegistry[ConcreteCommandType]['execute']>{
    const commandHandler = this.commandTypeRegistry[commandType];
    const result = commandHandler.execute(model, instruction);
    if (!result.success) {
      // deno-lint-ignore no-explicit-any
      return result as any;
    }

    this.clearRedoStack();
    // deno-lint-ignore no-explicit-any
    this.undoStack.push({ commandType: commandType, instruction: instruction, executionResult: result.result as any});

    // deno-lint-ignore no-explicit-any
    return result as any;
  }
  
  private clearRedoStack() {
    this.redoStack.splice(0, this.redoStack.length);
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
        _target: Commands,
        commandType: string | symbol,
      ) => {
        return ((
          instruction: InstructionOf<
            Model,
            PossibleKeys,
            ConcreteCommandTypeRegistry,
            keyof ConcreteCommandTypeRegistry & string
          >,
          model: Model,
        ) => {
          return this.executeCommand(
            commandType as keyof ConcreteCommandTypeRegistry & string,
            instruction,
            model,
          );
        }) as Commands[keyof Commands];
      },
    });
  }
}
