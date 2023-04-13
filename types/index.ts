// export enum OpenAIModel {
//   DAVINCI_TURBO = "gpt-3.5-turbo"
// }

export enum OpenAIModel {
  DAVINCI_TURBO = "gpt-3p5-turbo"
}

export type BHLetter = {
  year: string;
  url: string;
  date: string;
  content: string;
  length: number;
  tokens: number;
  chunks: BHChunk[];
};

export type BHChunk = {
  letter_year: string;
  letter_url: string;
  letter_date: string;
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: number[];
};

export type BHJSON = {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  essays: BHLetter[];
};
