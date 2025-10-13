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

// deno-lint-ignore no-explicit-any
export type AnyCommandHandler<Model> = CommandHandlerWithExecutionResult<Model, any, any>;

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

// Utility type to extract Model and PossibleKeys from a Registry type
export type ModelOf<Registry> = Registry extends CommandTypeRegistry<infer M, string> ? M : never;
export type KeysOf<Registry> = Registry extends CommandTypeRegistry<unknown, infer K> ? K : never;

// Single generic parameter abstraction for command/instruction pairs
export type AnyCommand<Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys> ? {
    [K in keyof Registry]: {
      commandType: K;
      instruction: InstructionOf<Model, Keys, Registry, K>;
    };
  }[keyof Registry]
  : never;

// Alternative with execution result included
export type AnyCommandWithResult<Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys> ? {
    [K in keyof Registry]: {
      commandType: K;
      instruction: InstructionOf<Model, Keys, Registry, K>;
      executionResult: SuccessfulExecutionResultOf<Model, Keys, Registry, K>;
    };
  }[keyof Registry]
  : never;

// Simplified versions using single generic parameter
export type ExecutionResultOf_Simple<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys>
  ? ReturnType<Registry[CommandType]["execute"]>
  : never;

export type SuccessfulExecutionResultOf_Simple<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys>
  ? SuccessTypeOfResult<ExecutionResultOf_Simple<Registry, CommandType>>
  : never;

export type InstructionOf_Simple<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys>
  ? Parameters<Registry[CommandType]["execute"]>[1]
  : never;

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

/**
 * A command manager that supports linear undo/redo.
 */
export class LinearCommandManager<
  Model,
  PossibleKeys extends string,
  ConcreteCommandTypeRegistry extends CommandTypeRegistry<
    Model,
    PossibleKeys
  >,
> {
  private undoStack: AnyCommandWithResult<ConcreteCommandTypeRegistry>[] = [];
  private redoStack: AnyCommandWithResult<ConcreteCommandTypeRegistry>[] = [];

  private readonly commandTypeRegistry: ConcreteCommandTypeRegistry;

  constructor(
    commandTypeRegistry: ConcreteCommandTypeRegistry,
  ) {
    this.commandTypeRegistry = commandTypeRegistry;
  }

  /**
   * Tries executing the given instruction on the model, using the commandTypeRegistry for actually performing the command.
   */
  executeCommand<
    ConcreteCommandType extends ((keyof ConcreteCommandTypeRegistry) & string),
  >(
    commandType: ConcreteCommandType,
    instruction: InstructionOf<
      Model,
      PossibleKeys,
      ConcreteCommandTypeRegistry,
      ConcreteCommandType
    >,
    model: Model,
  ): ExecutionResultOf<Model, PossibleKeys, ConcreteCommandTypeRegistry, ConcreteCommandType> {
    const commandHandler = this.commandTypeRegistry[commandType];
    const result = commandHandler.execute(model, instruction);
    if (!result.success) {
      return result as ExecutionResultOf<Model, PossibleKeys, ConcreteCommandTypeRegistry, ConcreteCommandType>;
    }

    // Only save the command if it had effect
    if (result.hadEffect || result.hadEffect === undefined) {
      this.clearRedoStack();
      this.undoStack.push({
        commandType: commandType,
        instruction: instruction,
        executionResult: result.result,
      } as unknown as AnyCommandWithResult<ConcreteCommandTypeRegistry>);
    }

    return result as ExecutionResultOf<Model, PossibleKeys, ConcreteCommandTypeRegistry, ConcreteCommandType>;
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
