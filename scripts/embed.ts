import { PGEssay, PGJSON } from "@/types";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { Configuration, OpenAIApi } from "openai";

loadEnvConfig("");
const apikey = process.env.AZURE_OPENAI_APIKEY;
const baseurl = process.env.AZURE_OPENAI_ENDPOINT;
const deploymentname = process.env.AZURE_OPENAI_DEPLOYMENT;
let base_url = `${baseurl}openai/deployments/${deploymentname}`;
//let url = `${baseurl}openai/deployments/${deploymentname}/embeddings?api-version=2022-12-01`;

const generateEmbeddings = async (essays: PGEssay[]) => {
  //const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
  //const openai = new OpenAIApi(configuration);
  const configuration = new Configuration({
    basePath: base_url,
    apiKey: apikey,
  });
  const openai = new OpenAIApi(configuration);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  for (let i = 0; i < essays.length; i++) {
    const section = essays[i];

    for (let j = 0; j < section.chunks.length; j++) {
      const chunk = section.chunks[j];

      const { essay_title, essay_url, essay_date, essay_thanks, content, content_length, content_tokens } = chunk;

      const embeddingResponse = await openai.createEmbedding({
        deployment: "text-embedding-ada-002",
        input: content
      },
      {
        headers: {
          "api-key": apikey,
        },
        params: {
          "api-version": "2022-12-01",
        },
      });

      const [{ embedding }] = embeddingResponse.data.data;

      const { data, error } = await supabase
        .from("pg")
        .insert({
          essay_title,
          essay_url,
          essay_date,
          essay_thanks,
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

      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
};

(async () => {
  const book: PGJSON = JSON.parse(fs.readFileSync("scripts/pg.json", "utf8"));

  await generateEmbeddings(book.essays);
})();
