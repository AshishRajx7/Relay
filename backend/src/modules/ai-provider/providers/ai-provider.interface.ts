import { CompletionRequestDto, AiCompletionResult } from '../dto/completion-request.dto';

export interface IAIProvider {
  complete(request: CompletionRequestDto): Promise<AiCompletionResult<string>>;
  structuredComplete<T>(request: CompletionRequestDto): Promise<AiCompletionResult<T>>;
}
