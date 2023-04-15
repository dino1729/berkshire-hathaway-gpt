import { BHLetter, BHJSON } from "@/types";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { Configuration, OpenAIApi } from "openai";

loadEnvConfig("");
const openaiApiKey = process.env.AZURE_OPENAI_APIKEY!;
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
const openaiEmbedding = process.env.AZURE_OPENAI_EMBEDDING!;
const openaiModel = process.env.AZURE_OPENAI_MODEL!;
const openaiVersion = process.env.AZURE_OPENAI_VERSION!;
let base_url = `${openaiEndpoint}openai/deployments/${openaiEmbedding}`;

const generateEmbeddings = async (letters: BHLetter[]) => {
  //const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  //const openai = new OpenAIApi(configuration);
  const configuration = new Configuration({
    basePath: base_url,
    apiKey: openaiApiKey,
  });
  const openai = new OpenAIApi(configuration);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  for (let i = 0; i < letters.length; i++) {
    const section = letters[i];

    for (let j = 0; j < section.chunks.length; j++) {
      const chunk = section.chunks[j];

      const { letter_year, letter_url, letter_date, content, content_length, content_tokens } = chunk;

      const embeddingResponse = await openai.createEmbedding({
        deployment: openaiEmbedding,
        input: content
      },
      {
        headers: {
          "api-key": openaiApiKey,
        },
        params: {
          "api-version": openaiVersion,
        },
      });

      const [{ embedding }] = embeddingResponse.data.data;

      const { data, error } = await supabase
        .from("bh")
        .insert({
          letter_year,
          letter_url,
          letter_date,
          content,
          content_length,
          content_tokens,
          embedding
        })
        .select("*");

      if (error) {
        console.log("error", error);
      } else {
        console.log("saved", i, j);
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
    }
  }
};

(async () => {
  const book: BHJSON = JSON.parse(fs.readFileSync("scripts/bh.json", "utf8"));

  await generateEmbeddings(book.letters);
})();
