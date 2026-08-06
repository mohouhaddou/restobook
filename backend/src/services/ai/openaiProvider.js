'use strict';

const OpenAI = require('openai');

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_TIMEOUT_MS = 60000;
// gpt-image-1 en quality "high" peut prendre 60-120s ; le timeout texte (60s)
// coupait ces requêtes en cours de génération avant que le serveur ne réponde
// (constaté en prod : "AI_TEMPORARY" / 503 sur les images "hero").
const DEFAULT_IMAGE_TIMEOUT_MS = 180000;
// gpt-5-mini est un modèle "reasoning" : les tokens de raisonnement interne
// sont décomptés de max_output_tokens. Sans contrôle explicite, une requête
// triviale peut consommer >100 tokens de raisonnement invisible et épuiser
// tout le budget avant la moindre sortie visible — status "incomplete" côté
// OpenAI, ou JSON tronqué/vide côté nous (AI_EMPTY_RESPONSE / AI_VALIDATION_ERROR
// constatés en prod). 'low' laisse une marge large aux budgets 8000/16000
// tout en gardant une qualité rédactionnelle correcte (vérifié empiriquement).
const DEFAULT_REASONING_EFFORT = 'low';
const TEMPORARY_CODES = new Set(['AI_RATE_LIMIT', 'AI_TIMEOUT', 'AI_TEMPORARY']);

const aiConfig = Object.freeze({
  provider: 'openai',
  model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
  imageModel: process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
  timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  imageTimeoutMs: Number(process.env.OPENAI_IMAGE_TIMEOUT_MS || DEFAULT_IMAGE_TIMEOUT_MS),
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
});

class AIProviderError extends Error {
  constructor(message, { code = 'AI_PROVIDER_ERROR', status = 500, retryable = false, cause = null, requestId = null } = {}) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
    this.requestId = requestId;
  }
}

function ensureConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new AIProviderError("La génération IA n'est pas configurée sur le serveur.", {
      code: 'AI_NOT_CONFIGURED',
      status: 400,
      retryable: false,
    });
  }
  if (!aiConfig.model) {
    throw new AIProviderError("Le modèle IA n'est pas configuré.", {
      code: 'AI_MODEL_NOT_CONFIGURED',
      status: 400,
      retryable: false,
    });
  }
}

function sanitizeOpenAIError(error) {
  const status = error?.status || error?.response?.status || 500;
  const requestId = error?.request_id || error?.requestID || error?.headers?.['x-request-id'] || null;

  if (error?.name === 'AbortError' || error?.code === 'ETIMEDOUT') {
    return new AIProviderError('Le service de génération a dépassé le délai autorisé.', {
      code: 'AI_TIMEOUT',
      status: 504,
      retryable: true,
      cause: error,
      requestId,
    });
  }
  if (status === 401 || status === 403) {
    return new AIProviderError('La configuration IA est invalide ou non autorisée.', {
      code: 'AI_AUTH_ERROR',
      status: 502,
      retryable: false,
      cause: error,
      requestId,
    });
  }
  if (status === 429) {
    return new AIProviderError('Le service IA est temporairement limité. Réessayez dans quelques instants.', {
      code: 'AI_RATE_LIMIT',
      status: 429,
      retryable: true,
      cause: error,
      requestId,
    });
  }
  if (status === 402) {
    return new AIProviderError('Le service IA est indisponible pour des raisons de quota ou de facturation.', {
      code: 'AI_BILLING_ERROR',
      status: 402,
      retryable: false,
      cause: error,
      requestId,
    });
  }
  if (status >= 500) {
    return new AIProviderError('Le fournisseur IA est temporairement indisponible.', {
      code: 'AI_TEMPORARY',
      status: 503,
      retryable: true,
      cause: error,
      requestId,
    });
  }
  return new AIProviderError('Le service de génération est temporairement indisponible.', {
    code: 'AI_PROVIDER_ERROR',
    status: 502,
    retryable: false,
    cause: error,
    requestId,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class OpenAIProvider {
  constructor({ client = null } = {}) {
    ensureConfigured();
    this.client = client || new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: aiConfig.timeoutMs,
      maxRetries: 0,
    });
  }

  async withRetry(operation, { requestId, retries = 2 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const aiError = error instanceof AIProviderError ? error : sanitizeOpenAIError(error);
        lastError = aiError;
        console.warn('[ai.openai] request failed', {
          requestId,
          code: aiError.code,
          status: aiError.status,
          retryable: aiError.retryable,
          attempt: attempt + 1,
        });
        if (!aiError.retryable || !TEMPORARY_CODES.has(aiError.code) || attempt >= retries) break;
        await sleep(350 * Math.pow(2, attempt));
      }
    }
    throw lastError;
  }

  extractText(response) {
    if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text;
    const chunks = [];
    for (const item of response?.output || []) {
      for (const content of item.content || []) {
        if (content.type === 'output_text' && content.text) chunks.push(content.text);
        if (content.type === 'text' && content.text) chunks.push(content.text);
      }
    }
    return chunks.join('\n').trim();
  }

  async generateStructuredData({ instructions, input, jsonSchema, schemaName, maxOutputTokens = 8000, requestId, reasoningEffort = aiConfig.reasoningEffort }) {
    return this.withRetry(async () => {
      const response = await this.client.responses.create({
        model: aiConfig.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: reasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: schemaName || 'structured_result',
            schema: jsonSchema,
            strict: true,
          },
        },
      });

      if (response.status === 'incomplete') {
        throw new AIProviderError('Réponse IA incomplète.', {
          code: 'AI_EMPTY_RESPONSE',
          status: 502,
          retryable: true,
          requestId,
        });
      }

      const text = this.extractText(response);
      if (!text) {
        throw new AIProviderError('Réponse IA vide.', {
          code: 'AI_EMPTY_RESPONSE',
          status: 502,
          retryable: true,
          requestId,
        });
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new AIProviderError('Réponse IA structurée invalide.', {
          code: 'AI_INVALID_JSON',
          status: 502,
          retryable: false,
          cause: error,
          requestId,
        });
      }
    }, { requestId });
  }

  async generateText({ instructions, input, maxOutputTokens = 1200, requestId, reasoningEffort = aiConfig.reasoningEffort }) {
    return this.withRetry(async () => {
      const response = await this.client.responses.create({
        model: aiConfig.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: reasoningEffort },
      });
      if (response.status === 'incomplete') {
        throw new AIProviderError('Réponse IA incomplète (budget de tokens insuffisant).', {
          code: 'AI_EMPTY_RESPONSE',
          status: 502,
          retryable: true,
          requestId,
        });
      }
      const text = this.extractText(response);
      if (!text) {
        throw new AIProviderError('Réponse IA vide.', {
          code: 'AI_EMPTY_RESPONSE',
          status: 502,
          retryable: true,
          requestId,
        });
      }
      return { text };
    }, { requestId });
  }

  async generateImage({ prompt, size = '1536x1024', quality = 'high', requestId }) {
    return this.withRetry(async () => {
      const response = await this.client.images.generate(
        { model: aiConfig.imageModel, prompt, size, quality, n: 1 },
        { timeout: aiConfig.imageTimeoutMs },
      );
      const first = response?.data?.[0];
      if (!first?.b64_json) {
        throw new AIProviderError('Réponse image IA vide.', {
          code: 'AI_EMPTY_RESPONSE',
          status: 502,
          retryable: true,
          requestId,
        });
      }
      return {
        buffer: Buffer.from(first.b64_json, 'base64'),
        revisedPrompt: first.revised_prompt || null,
      };
    }, { requestId, retries: 1 });
  }

  async testConnection() {
    const result = await this.generateText({
      instructions: 'Réponds uniquement avec le mot OK.',
      input: 'Test de configuration.',
      maxOutputTokens: 64,
      // 'minimal' explicitement ici : pour une tâche aussi triviale, même
      // l'effort "low" par défaut peut consommer à lui seul ~64 tokens de
      // raisonnement invisible et épuiser ce petit budget (constaté en test).
      reasoningEffort: 'minimal',
      requestId: 'openai-config-test',
    });
    return { ok: !!result.text, provider: aiConfig.provider, model: aiConfig.model };
  }
}

function createAIProvider(options) {
  return new OpenAIProvider(options);
}

function getAiPublicStatus() {
  return {
    provider: aiConfig.provider,
    model: aiConfig.model,
    imageModel: aiConfig.imageModel,
    keyConfigured: !!process.env.OPENAI_API_KEY,
  };
}

module.exports = {
  aiConfig,
  AIProviderError,
  OpenAIProvider,
  createAIProvider,
  getAiPublicStatus,
};
