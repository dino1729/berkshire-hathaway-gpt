import { supabaseAdmin } from "@/utils";

export const config = {
  runtime: "edge"
};

const handler = async (req: Request): Promise<Response> => {

  try {
    const { query, apiKey, matches } = (await req.json()) as {
      query: string;
      apiKey: string;
      matches: number;
    };

    const input = query.replace(/\n/g, " ");

    const res = await fetch("https://textllmapi.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2022-12-01", {
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      method: "POST",
      body: JSON.stringify({
        deployment: "text-embedding-ada-002",
        input
      })
    });

    const json = await res.json();
    const embedding = json.data[0].embedding;

    const { data: chunks, error } = await supabaseAdmin.rpc("pg_search", {
      query_embedding: embedding,
      similarity_threshold: 0.01,
      match_count: matches
    });

    if (error) {
      console.error(error);
      return new Response("Error", { status: 500 });
    }

    return new Response(JSON.stringify(chunks), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
