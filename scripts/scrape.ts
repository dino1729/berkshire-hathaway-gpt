import { BHChunk, BHLetter, BHJSON } from "@/types";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { encode } from "gpt-3-encoder";
import pdfParse from 'pdf-parse';

const CHUNK_SIZE = 200;
const BASE_URL = "https://www.berkshirehathaway.com/letters/";

const getLinks = async () => {
  const html = await axios.get(`${BASE_URL}letters.html`);
  const $ = cheerio.load(html.data);
  const tables = $("table");
  //console.log(tables.length)

  const linksArr: { url: string; year: string }[] = [];
  tables.each((i, table) => {
    if (i == 1) {
      const links = $(table).find("a");
      links.each((i, link) => {
        const url = $(link).attr("href");
        const year = $(link).text();

        if (url && (url.endsWith(".html") || url.endsWith(".pdf"))) {
          const linkObj = {
            url,
            year
          };

          linksArr.push(linkObj);
        }
      });
    }
  });

  //console.log(linksArr);
  return linksArr;
};

const extractDate = (text: string) => {
  const cleanedText = text.replace(/\s+/g, " ");
  const date = cleanedText.match(/([A-Z][a-z]+ [0-9]{4})/);
  let dateStr = "";
  let textWithoutDate = "";

  if (date) {
    dateStr = date[0];
    textWithoutDate = cleanedText.replace(date[0], "");
  }

  return [dateStr, textWithoutDate];
};

const extractLetterText = (text: string) => {
  let letterText = text.replace(/\n/g, " ");
  letterText = letterText.replace(/\.([a-zA-Z])/g, ". $1");

  const split = letterText.split(". ").filter((s) => s);
  const lastSentence = split[split.length - 1];

  return letterText;
};

const getLetter = async (linkObj: { url: string; year: string }) => {
  const { year, url } = linkObj;

  let letter: BHLetter = {
    year: "",
    url: "",
    date: "",
    content: "",
    length: 0,
    tokens: 0,
    chunks: []
  };

  const fullLink = BASE_URL + url;
  console.log(fullLink);

if (fullLink.endsWith(".html")) {
    const html = await axios.get(fullLink);
    const $ = cheerio.load(html.data);

    // Use cheerio to extract text with newlines
    const letterText = $('html *').contents().map(function () {
      return (this.type === 'text') ? $(this).text() + '\n' : '';
    }).get().join('');

    const [dateStr, textWithoutDate] = extractDate(letterText);
    const trimmedContent = extractLetterText(textWithoutDate).trim();
    console.log(trimmedContent.length);

    letter = {
      year,
      url: fullLink,
      date: dateStr,
      content: trimmedContent,
      length: trimmedContent.length,
      tokens: encode(trimmedContent).length,
      chunks: []
    };
  } else if (fullLink.endsWith(".pdf")) {
    const pdfBuffer = await axios.get(fullLink, { responseType: "arraybuffer" });
    const pdfText = await pdfParse(pdfBuffer.data);

    const { text } = pdfText;
    const [dateStr, textWithoutDate] = extractDate(text);
    const letterText = extractLetterText(textWithoutDate);

    const trimmedContent = letterText.trim();
    console.log(trimmedContent.length);

    letter = {
      year,
      url: fullLink,
      date: dateStr,
      content: trimmedContent,
      length: trimmedContent.length,
      tokens: encode(trimmedContent).length,
      chunks: []
    };
  }

  return letter;
};

const chunkLetter = async (letter: BHLetter) => {
  const { year, url, date, content, ...chunklessSection } = letter;

  let letterTextChunks = [];

  if (encode(content).length > CHUNK_SIZE) {
    const split = content.split(". ");
    let chunkText = "";

    for (let i = 0; i < split.length; i++) {
      const sentence = split[i];
      const sentenceTokenLength = encode(sentence);
      const chunkTextTokenLength = encode(chunkText).length;

      if (chunkTextTokenLength + sentenceTokenLength.length > CHUNK_SIZE) {
        letterTextChunks.push(chunkText);
        chunkText = "";
      }

      if (sentence && sentence[sentence.length - 1].match(/[a-z0-9]/i)) {
        chunkText += sentence + ". ";
      } else {
        chunkText += sentence + " ";
      }
    }

    letterTextChunks.push(chunkText.trim());
  } else {
    letterTextChunks.push(content.trim());
  }

  const letterChunks = letterTextChunks.map((text) => {
    const trimmedText = text.trim();

    const chunk: BHChunk = {
      letter_year: year,
      letter_url: url,
      letter_date: date,
      content: trimmedText,
      content_length: trimmedText.length,
      content_tokens: encode(trimmedText).length,
      embedding: []
    };

    return chunk;
  });

  if (letterChunks.length > 1) {
    for (let i = 0; i < letterChunks.length; i++) {
      const chunk = letterChunks[i];
      const prevChunk = letterChunks[i - 1];

      if (chunk.content_tokens < 100 && prevChunk) {
        prevChunk.content += " " + chunk.content;
        prevChunk.content_length += chunk.content_length;
        prevChunk.content_tokens += chunk.content_tokens;
        letterChunks.splice(i, 1);
        i--;
      }
    }
  }

  const chunkedSection: BHLetter = {
    ...letter,
    chunks: letterChunks
  };

  return chunkedSection;
};

(async () => {
  const links = await getLinks();
  let letters = [];

  for (let i = 0; i < links.length; i++) {
    const letter = await getLetter(links[i]);
    const chunkedletter = await chunkLetter(letter);
    letters.push(chunkedletter);
  }

  const json: BHJSON = {
    current_date: "2023-04-12",
    author: "Berkshire Hathaway",
    url: "https://www.berkshirehathaway.com/letters/letters.html",
    length: letters.reduce((acc, letter) => acc + letter.length, 0),
    tokens: letters.reduce((acc, letter) => acc + letter.tokens, 0),
    letters
  };

  fs.writeFileSync("scripts/bh.json", JSON.stringify(json));
})();
