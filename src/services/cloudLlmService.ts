/**
 * Helper function to handle Server-Sent Events (SSE) streaming from OpenAI-compatible APIs.
 * Parses the stream chunks and invokes the callback with the extracted text.
 */
async function handleOpenAIStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";
  if (!reader) return "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("data: ")) {
          const data = trimmedLine.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            // ignore parse errors for incomplete JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return fullText;
}

/**
 * Helper function to handle Server-Sent Events (SSE) streaming from Anthropic's API.
 * Parses the stream chunks and invokes the callback with the extracted text.
 */
async function handleAnthropicStream(response: Response, onChunk: (chunk: string) => void): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";
  if (!reader) return "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("data: ")) {
          const data = trimmedLine.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              fullText += parsed.delta.text;
              onChunk(parsed.delta.text);
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return fullText;
}

/**
 * Generates text using the OpenAI API (via the backend proxy).
 * Supports both streaming and non-streaming responses.
 * 
 * @param prompt The input prompt.
 * @param apiKey The user's OpenAI API key.
 * @param onChunk Optional callback for streaming chunks.
 * @returns The generated text.
 */
export async function generateWithOpenAI(prompt: string, apiKey: string, onChunk?: (chunk: string) => void, systemPrompt?: string): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API Key mancante nelle impostazioni.");
  
  const response = await fetch("/api/llm/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "openai",
      prompt,
      apiKey,
      stream: !!onChunk,
      systemPrompt
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI Error: ${error.error || response.statusText}`);
  }

  if (onChunk) {
    return handleOpenAIStream(response, onChunk);
  } else {
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export async function generateWithAnthropic(prompt: string, apiKey: string, onChunk?: (chunk: string) => void, systemPrompt?: string): Promise<string> {
  if (!apiKey) throw new Error("Anthropic API Key mancante nelle impostazioni.");
  
  const response = await fetch("/api/llm/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "anthropic",
      prompt,
      apiKey,
      stream: !!onChunk,
      systemPrompt
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic Error: ${error.error || response.statusText}`);
  }

  if (onChunk) {
    return handleAnthropicStream(response, onChunk);
  } else {
    const data = await response.json();
    return data.content[0].text;
  }
}

export async function generateWithGroq(prompt: string, apiKey: string, onChunk?: (chunk: string) => void, systemPrompt?: string): Promise<string> {
  if (!apiKey) throw new Error("Groq API Key mancante nelle impostazioni.");
  
  const response = await fetch("/api/llm/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "groq",
      prompt,
      apiKey,
      stream: !!onChunk,
      systemPrompt
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Groq Error: ${error.error || response.statusText}`);
  }

  if (onChunk) {
    return handleOpenAIStream(response, onChunk);
  } else {
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export async function generateWithDeepSeek(prompt: string, apiKey: string, onChunk?: (chunk: string) => void, systemPrompt?: string): Promise<string> {
  if (!apiKey) throw new Error("DeepSeek API Key mancante nelle impostazioni.");
  
  const response = await fetch("/api/llm/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      provider: "deepseek",
      prompt,
      apiKey,
      stream: !!onChunk,
      systemPrompt
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`DeepSeek Error: ${error.error || response.statusText}`);
  }

  if (onChunk) {
    return handleOpenAIStream(response, onChunk);
  } else {
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
