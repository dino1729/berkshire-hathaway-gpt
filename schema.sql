--  RUN 1st
create extension vector;

-- RUN 2nd
create table bh (
  id bigserial primary key,
  letter_year text,
  letter_url text,
  letter_date text,
  content text,
  content_length bigint,
  content_tokens bigint,
  embedding vector (1536)
);

-- RUN 3rd after running the scripts
create or replace function bh_search (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
returns table (
  id bigint,
  letter_year text,
  letter_url text,
  letter_date text,
  content text,
  content_length bigint,
  content_tokens bigint,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    bh.id,
    bh.letter_year,
    bh.letter_url,
    bh.letter_date,
    bh.content,
    bh.content_length,
    bh.content_tokens,
    1 - (bh.embedding <=> query_embedding) as similarity
  from bh
  where 1 - (bh.embedding <=> query_embedding) > similarity_threshold
  order by bh.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- RUN 4th
create index on bh 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
