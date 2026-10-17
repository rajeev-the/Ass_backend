import env from '../../config/env.js';
import Setting from '../../models/Setting.js';
import AppError from '../../utils/AppError.js';

class AiClient {
  constructor() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
    this.overrideConfig = null;
  }

  // Load config merging database override with process.env defaults
  async getConfig() {
    if (this.overrideConfig) {
      return this.overrideConfig;
    }

    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection.readyState === 1) {
        const settingDoc = await Setting.findById('aiConfig').lean();
        if (settingDoc && settingDoc.value) {
          return {
            provider: settingDoc.value.provider || env.AI_PROVIDER,
            apiKey: settingDoc.value.apiKey || env.AI_API_KEY,
            baseURL: settingDoc.value.baseURL || env.AI_BASE_URL,
            model: settingDoc.value.model || env.AI_MODEL,
            enabled:
              settingDoc.value.enabled !== undefined ? settingDoc.value.enabled : env.AI_ENABLED,
            timeoutMs: settingDoc.value.timeoutMs || env.AI_TIMEOUT_MS,
            maxRetries: settingDoc.value.maxRetries || env.AI_MAX_RETRIES,
          };
        }
      }
    } catch {
      // Fallback silently if db not ready
    }

    return {
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
      model: env.AI_MODEL,
      enabled: env.AI_ENABLED,
      timeoutMs: env.AI_TIMEOUT_MS,
      maxRetries: env.AI_MAX_RETRIES,
    };
  }

  // Update dynamic AI configuration (Admin only)
  async updateConfig(newConfig) {
    const current = await this.getConfig();
    const updated = {
      provider: newConfig.provider || current.provider,
      apiKey: newConfig.apiKey !== undefined ? newConfig.apiKey : current.apiKey,
      model: newConfig.model || current.model,
      enabled: newConfig.enabled !== undefined ? newConfig.enabled : current.enabled,
      timeoutMs: newConfig.timeoutMs || current.timeoutMs,
      maxRetries: newConfig.maxRetries || current.maxRetries,
    };

    await Setting.findByIdAndUpdate(
      'aiConfig',
      { value: updated },
      { upsert: true, returnDocument: 'after' }
    );

    this.overrideConfig = updated;
    // Reset circuit breaker upon config update
    this.resetCircuit();

    return this.getPublicConfig();
  }

  async getPublicConfig() {
    const config = await this.getConfig();
    const isCircuitOpen = Date.now() < this.circuitOpenUntil;

    return {
      provider: config.provider,
      model: config.model,
      enabled: !!config.enabled,
      hasKey: !!(config.apiKey && config.apiKey.trim().length > 0),
      maskedKey:
        config.apiKey && config.apiKey.length > 8
          ? `${config.apiKey.slice(0, 4)}...${config.apiKey.slice(-4)}`
          : null,
      circuitStatus: isCircuitOpen ? 'open' : 'closed',
    };
  }

  resetCircuit() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= 3) {
      this.circuitOpenUntil = Date.now() + 60000; // Open circuit for 60 seconds
      console.warn('⚠️ AI Circuit Breaker tripped: skipping AI calls for 60 seconds');
    }
  }

  isCircuitOpen() {
    if (this.circuitOpenUntil && Date.now() < this.circuitOpenUntil) {
      return true;
    }
    if (this.circuitOpenUntil && Date.now() >= this.circuitOpenUntil) {
      this.resetCircuit(); // Half-open / reset
    }
    return false;
  }

  // Main completion method
  async complete({ system, user, maxTokens = 500, temperature = 0.4, taskName = 'general' }) {
    const config = await this.getConfig();

    if (!config.enabled) {
      throw AppError.aiUnavailable('AI is currently disabled in configuration');
    }

    if (!config.apiKey || config.apiKey.trim() === '') {
      throw AppError.aiUnavailable('No AI API key configured');
    }

    if (this.isCircuitOpen()) {
      throw AppError.aiUnavailable('AI service circuit breaker is open (consecutive failures)');
    }

    let attempts = 0;
    const maxAttempts = (config.maxRetries || 1) + 1;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      const startTime = Date.now();

      try {
        let result;

        if (config.provider === 'openai') {
          result = await this._callOpenAi({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            model: config.model,
            system,
            user,
            maxTokens,
            temperature,
            timeoutMs: config.timeoutMs,
          });
        } else if (config.provider === 'gemini') {
          result = await this._callGemini({
            apiKey: config.apiKey,
            model: config.model || 'gemini-1.5-flash',
            system,
            user,
            maxTokens,
            temperature,
            timeoutMs: config.timeoutMs,
          });
        } else {
          // Default: Anthropic Claude
          result = await this._callAnthropic({
            apiKey: config.apiKey,
            model: config.model || 'claude-3-haiku-20240307',
            system,
            user,
            maxTokens,
            temperature,
            timeoutMs: config.timeoutMs,
          });
        }

        const latencyMs = Date.now() - startTime;
        this.recordSuccess();

        // Safe call logging (Never logs API key)
        console.log(
          `🤖 [AI ${taskName}] ok | provider: ${config.provider} | model: ${result.model} | latency: ${latencyMs}ms | in: ${result.usage.inputTokens} | out: ${result.usage.outputTokens}`
        );

        return {
          text: result.text,
          usage: result.usage,
          latencyMs,
          model: result.model,
        };
      } catch (err) {
        lastError = err;
        const latencyMs = Date.now() - startTime;

        console.error(
          `❌ [AI ${taskName}] attempt ${attempts}/${maxAttempts} failed (${latencyMs}ms): ${err.message}`
        );

        // Do not retry on client auth errors (400, 401, 403)
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          this.recordFailure();
          throw AppError.aiUnavailable(`AI authentication or client error: ${err.message}`);
        }

        if (attempts < maxAttempts) {
          // Exponential backoff with jitter (500ms to 1500ms)
          const delay = 500 * attempts + Math.floor(Math.random() * 500);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.recordFailure();
    throw AppError.aiUnavailable(`AI call failed after retries: ${lastError?.message}`);
  }

  async _callAnthropic({ apiKey, model, system, user, maxTokens, temperature, timeoutMs }) {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, timeout: timeoutMs });

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const text = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
    return {
      text,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      model: response.model || model,
    };
  }

  async _callOpenAi({ apiKey, baseURL, model, system, user, maxTokens, temperature, timeoutMs }) {
    const { OpenAI } = await import('openai');
    const isMilePost = apiKey?.startsWith('sk-milepost-');
    const effectiveBaseURL =
      baseURL || env.AI_BASE_URL || (isMilePost ? 'https://bettergpt-keys.vercel.app/v1' : undefined);

    const clientOptions = { apiKey, timeout: timeoutMs };
    if (effectiveBaseURL) {
      clientOptions.baseURL = effectiveBaseURL;
    }
    const client = new OpenAI(clientOptions);

    // ChatGPT reverse proxies / Mile-Post endpoints reject system roles.
    // For proxies, merging system instructions with the user prompt guarantees high reliability.
    const messages = [];
    if (isMilePost || effectiveBaseURL?.includes('vercel.app') || effectiveBaseURL?.includes('mile-post')) {
      const combinedUser = system ? `${system}\n\nUser Request:\n${user}` : user;
      messages.push({ role: 'user', content: combinedUser });
    } else {
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: user });
    }

    // Determine target model (handling proxy models like codex-auto-review)
    let targetModel = model;
    if (isMilePost && (!targetModel || targetModel === 'gpt-5.5' || targetModel.startsWith('gpt-4'))) {
      targetModel = 'codex-auto-review';
    } else if (!targetModel) {
      targetModel = 'gpt-4o-mini';
    }

    const response = await client.chat.completions.create({
      model: targetModel,
      max_tokens: maxTokens,
      temperature,
      messages,
    });

    const text = response.choices?.[0]?.message?.content || '';
    return {
      text,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: response.model || targetModel,
    };
  }

  async _callGemini({ apiKey, model, system, user, maxTokens, temperature, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err = new Error(`Gemini API error ${res.status}: ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return {
        text,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
        model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const aiClient = new AiClient();
export default aiClient;
