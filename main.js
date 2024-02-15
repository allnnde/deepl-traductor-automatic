import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import axios from "axios";

const CONFIG = JSON.parse(fs.readFileSync("./pack-extractor/pack-extractor-config.json", "utf-8"));

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const htmlRegexG = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
const corchetesRegex = /{(.*?)}/g;
const linkRegex = /@([aA-zZ])\w+\[(.*?)\]/g;
const llavesRegex = /\[\[(.*?)\]\]/g;

function replaceGroup(text, match, tag) {
  for (const [i, v] of match.entries()) {
    const textR = v[0];
    text = text.replace(textR, ` ___${tag}_${i}___ `);
  }
  return text;
}

function replaceTag(text, match, tag) {
  for (const [i, v] of match.entries()) {
    const textR = v[0];
    text = text.replaceAll(`___${tag}_${i}___`, textR);
  }
  return text;
}

function splitIntoLines(input, len) {
  var i;
  var output = [];
  var lineSoFar = "";
  var temp;
  var words = input.split(" ");
  for (i = 0; i < words.length; ) {
    // check if adding this word would exceed the len
    temp = addWordOntoLine(lineSoFar, words[i]);
    if (temp.length > len) {
      if (lineSoFar.length == 0) {
        lineSoFar = temp; // force to put at least one word in each line
        i++; // skip past this word now
      }
      output.push(lineSoFar); // put line into output
      lineSoFar = ""; // init back to empty
    } else {
      lineSoFar = temp; // take the new word
      i++; // skip past this word now
    }
  }
  if (lineSoFar.length > 0) {
    output.push(lineSoFar);
  }
  return output;
}

function addWordOntoLine(line, word) {
  if (line.length != 0) {
    line += " ";
  }
  return (line += word);
}


function calculateTotalLines(files) {
  let totalCount = 0;
  for (const file of files) {
    const data = fs.readFileSync(file);
    const object = JSON.parse(data);
    totalCount = countLines(object);
  }
  return totalCount;
}
let count = 0;
function countLines(obj, parent_node) {
  parent_node = parent_node || "";
  for (const property in obj) {
    if (obj.hasOwnProperty(property)) {
      const node = parent_node + "/" + property;
      if (obj[property] instanceof Array) {
        countLines(obj[property], node);
      } else if (obj[property] instanceof Object) {
        countLines(obj[property], node);
      } else {
        count++;
      }
    }
  }
  return count;
}

let countLine = 0;
let countErros = 0;

let errosList = [];

async function iterate(obj, parent_node, totalCount) {
  parent_node = parent_node || "";
  for (const property in obj) {
    if (obj.hasOwnProperty(property)) {
      const node = parent_node + "/" + property;
      if (obj[property] instanceof Array) {
        await iterate(obj[property], node, totalCount);
      } else if (obj[property] instanceof Object) {
        await iterate(obj[property], node, totalCount);
      } else {
        let text = obj[property].toString();
        const matchAllhtml = [...text.matchAll(htmlRegexG)];
        text = replaceGroup(text, matchAllhtml, "hhh");

        const matchAllllaves = [...text.matchAll(llavesRegex)];
        text = replaceGroup(text, matchAllllaves, "kkk");

        const matchAllcorchete = [...text.matchAll(corchetesRegex)];
        text = replaceGroup(text, matchAllcorchete, "ccc");

        const matchAlllink = [...text.matchAll(linkRegex)];
        text = replaceGroup(text, matchAlllink, "lll");

        let lines = splitIntoLines(text, 500);
        let tempText = "";
        let hasError = false;
        for (const line of lines) {
          try {
            const options = {
              method: "POST",
              url: "http://localhost:3000/api/graphql",
              headers: {
                "content-type": "application/json",
              },
              data: {
                query: `query translation($source: String $target: String $query: String!) {
                translation(source: $source target:  $target query: $query) {      
                    target{        
                        text            
                    }
                }   
            }`,
                variables: {
                  source: "en",
                  target: "es",
                  query: line,
                },
              },
            };

            const res = await axios.request(options);
            tempText += res.data.data.translation.target.text;
          } catch (error) {
            countErros++;
            errosList.push(node + ":" + obj[property]);
            let errorFile = "./errors.txt";
            fs.writeFileSync(errorFile, JSON.stringify(errosList));
            hasError = true;
          }
        }
        if (!hasError) text = tempText;
        text = replaceTag(text, matchAlllink, "lll");
        text = replaceTag(text, matchAllcorchete, "ccc");
        text = replaceTag(text, matchAllllaves, "kkk");
        text = replaceTag(text, matchAllhtml, "hhh");
        obj[property] = text;
        countLine++;

        const updated = (20 * countLine) / totalCount;
        const percent = "|".repeat(updated);
        const empty = " ".repeat(20 - updated);
        process.stdout.clearLine();
        process.stdout.write(
          `\r[${percent}${empty}] (${countLine} / ${totalCount}) ${(5 * updated).toFixed(2)}% - errors: ${countErros} (${countErros} / ${totalCount})%`
        );
      }
    }
  }
  return obj;
}

function deepReadDir(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });
  return files.flatMap((p) => {
    const pathFile = path.join(directory, p.name);
    return p.isDirectory() ? deepReadDir(pathFile) : pathFile;
  });
}

const files = deepReadDir(path.join(__dirname, CONFIG.filePaths.i18n));
const totalLines = calculateTotalLines(files);

console.log("-----> Iniciando Tranduccion : " + new Date().toLocaleString());
for (const file of files) {
  console.log("-----> Traducciendo : " + file);
  const data = fs.readFileSync(file);

  const object = JSON.parse(data);

  const obj = await iterate(object, null, totalLines);

  const objectOriginal = JSON.parse(data);
  obj.label = objectOriginal.label;
  obj.mapping = objectOriginal.mapping;

  let pathOfCompendiumEn = CONFIG.filePaths["i18n"].replace("/", "\\").replace("/", "\\").replace(".","");
  let pathOfCompendiumEs = "./translation/es".replace("/", "\\").replace("/", "\\").replace(".","");

  console.log(pathOfCompendiumEn);
  console.log(pathOfCompendiumEs);
  let final = file.replace(pathOfCompendiumEn, pathOfCompendiumEs)
  .replace("action-en.json","action-es.json")
  .replace("en.json","es.json")
  .replace("kingmaker-en.json","kingmaker-es.json")
  .replace("re-en.json","re-es.json");

  var dirname = path.dirname(final);

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  fs.writeFileSync(path.join(final), JSON.stringify(obj));
  console.log("-----> Guardando : " + final);
}
console.log("-----> Finalizando Tranduccion : " + new Date().toLocaleTimeString());

// Separar el codigo