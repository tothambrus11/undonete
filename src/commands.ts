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

// Utility type to extract Model and PossibleKeys from a Registry type
export type ModelOf<Registry> = Registry extends CommandTypeRegistry<infer M, string> ? M : never;
export type KeysOf<Registry> = Registry extends CommandTypeRegistry<unknown, infer K> ? K : never;

// Single generic parameter abstraction for command/instruction pairs
export type AnyCommand<Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys> ? {
    [K in keyof Registry]: {
      commandType: K;
      instruction: InstructionOf<Registry, K>;
    };
  }[keyof Registry]
  : never;

// Alternative with execution result included
export type AnyCommandWithResult<Registry> = Registry extends CommandTypeRegistry<infer Model, infer Keys> ? {
    [K in keyof Registry]: {
      commandType: K;
      instruction: InstructionOf<Registry, K>;
      executionResult: SuccessfulExecutionResultOf<Registry, K>;
    };
  }[keyof Registry]
  : never;

export type ExecutionResultOf<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer _Model, infer _Keys>
  ? ReturnType<Registry[CommandType]["execute"]>
  : never;

export type SuccessfulExecutionResultOf<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer _Model, infer _Keys>
  ? SuccessTypeOfResult<ExecutionResultOf<Registry, CommandType>>
  : never;

export type InstructionOf<Registry, CommandType extends keyof Registry> = Registry extends CommandTypeRegistry<infer _Model, infer _Keys>
  ? Parameters<Registry[CommandType]["execute"]>[1]
  : never;

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
      ConcreteCommandTypeRegistry,
      ConcreteCommandType
    >,
    model: Model,
  ): ExecutionResultOf<ConcreteCommandTypeRegistry, ConcreteCommandType> {
    const commandHandler = this.commandTypeRegistry[commandType];
    const result = commandHandler.execute(model, instruction);
    if (!result.success) {
      return result as ExecutionResultOf<ConcreteCommandTypeRegistry, ConcreteCommandType>;
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

    return result as ExecutionResultOf<ConcreteCommandTypeRegistry, ConcreteCommandType>;
  }

  /// Returns whether there was a command to undo
  undo(model: Model): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    const commandHandler = this.commandTypeRegistry[command.commandType as keyof ConcreteCommandTypeRegistry];
    commandHandler.undo({ model, instruction: command.instruction, executionResult: command.executionResult });
    this.redoStack.push(command);
    return true;
  }

  /// Returns whether there was a command to redo
  redo(model: Model): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    const commandHandler = this.commandTypeRegistry[command.commandType as keyof ConcreteCommandTypeRegistry];
    commandHandler.redo({ model, instruction: command.instruction, executionResult: command.executionResult });
    this.undoStack.push(command);
    return true;
  }

  private clearRedoStack() {
    this.redoStack.splice(0, this.redoStack.length);
  }

  get commands() {
    type Commands = {
      [K in keyof ConcreteCommandTypeRegistry]: (
        instruction: InstructionOf<
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
