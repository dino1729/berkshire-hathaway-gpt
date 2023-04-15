import { OpenAIModel } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export const OpenAIStream = async (prompt: string, apiKey: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const openaiApiKey = process.env.AZURE_OPENAI_APIKEY!;
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const openaiEmbedding = process.env.AZURE_OPENAI_EMBEDDING!;
  const openaiModel = process.env.AZURE_OPENAI_MODEL!;
  const openaiVersion = process.env.AZURE_OPENAI_VERSION!;

  const res = await fetch(`${openaiEndpoint}/openai/deployments/${openaiModel}/completions?api-version=${openaiVersion}`, {
    headers: {
      "Content-Type": "application/json",
      "api-key": openaiApiKey
    },
    method: "POST",
    body: JSON.stringify({
      "model": openaiModel,
      "prompt": "<|im_start|>system\nYou are a helpful assistant that accurately answers queries using Paul Graham's essays. Use the text provided to form your answer, but avoid copying word-for-word from the essays. Try to use your own words when possible. Keep your answer under 5 sentences. Be accurate, helpful, concise, and clear.\n<|im_end|>\n<|im_start|>user\n"+prompt+"\n<|im_end|>\n<|im_start|>assistant\n\n<|im_end|>\n",
      "max_tokens": 150,
      "temperature": 0.8,
      "stream": true,
      "stop": [
        "<|im_end|>"
      ]
    })
  });

  if (res.status !== 200) {
    const error = new Error(`Azure OpenAI ChatGPT API returned an error with status code ${res.status}`);
    error.stack = await res.text();
    console.error(error);
    throw error;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            //const text = json.choices[0].delta.content;
            const text = json.choices[0].text;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
