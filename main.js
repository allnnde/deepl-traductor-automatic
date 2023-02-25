import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as deepl from "deepl-node";
import * as dotenv from "dotenv";
dotenv.config();
console.log(process.env); // remove this after you've confirmed it is working

const CONFIG = JSON.parse(
  fs.readFileSync("./db-extractor/db-extractor-config.json", "utf-8")
);

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const authKey = "DEEPL_KEY"; // Replace with your key
const translator = new deepl.Translator(authKey);

const htmlRegexG = /<(?:"[^"]*"['"]*|'[^']*'['"]*|[^'">])+>/g;
const corchetesRegex = /{(.*?)}/g;
const linkRegex = /@([aA-zZ])\w+\[(.*?)\]/g;
const llavesRegex = /\[\[(.*?)\]\]/g;

function replaceGroup(text, match, tag) {
  for (const [i, v] of match.entries()) {
    const textR = v[0];
    text = text.replace(textR, `#${tag}_${i}#`);
  }
  return text;
}

function replaceTag(text, match, tag) {
  for (const [i, v] of match.entries()) {
    const textR = v[0];
    text = text.replace(`#${tag}_${i}#`, textR);
  }
  return text;
}

let count = 0;
async function iterate(obj, parent_node) {
  parent_node = parent_node || "";
  for (const property in obj) {
    if (obj.hasOwnProperty(property)) {
      const node = parent_node + "/" + property;
      if (obj[property] instanceof Array) {
        await iterate(obj[property], node);
      } else if (obj[property] instanceof Object) {
        await iterate(obj[property], node);
      } else {
        let text = obj[property].toString();
        const matchAllhtml = [...text.matchAll(htmlRegexG)];
        text = replaceGroup(text, matchAllhtml, "hhh");

        const matchAllcorchete = [...text.matchAll(corchetesRegex)];
        text = replaceGroup(text, matchAllcorchete, "ccc");

        const matchAlllink = [...text.matchAll(linkRegex)];
        text = replaceGroup(text, matchAlllink, "lll");

        const matchAllllaves = [...text.matchAll(llavesRegex)];
        text = replaceGroup(text, matchAllllaves, "kkk");

        console.log(node + ":" + obj[property]);
        var trad = await translator.translateText(text, null, "es");

        text = trad.text;

        text = replaceTag(text, matchAllhtml, "hhh");
        text = replaceTag(text, matchAllcorchete, "ccc");
        text = replaceTag(text, matchAlllink, "lll");
        text = replaceTag(text, matchAllllaves, "kkk");
        obj[property] = text;
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

for (const file of files) {
  const data = fs.readFileSync(file);

  const object = JSON.parse(data);
  console.log("iniciando traduccion!!");

  const obj = await iterate({ ...object });
  console.log(count);

  console.log("Finalizando traduccion!!");
  let pathOfCompendiumEn = CONFIG.filePaths["i18n"]
    .replace("/", "\\")
    .replace("/", "\\");
  let pathOfCompendiumEs = CONFIG.filePaths["i18n-es"]
    .replace("/", "\\")
    .replace("/", "\\");
  let final = file.replace(pathOfCompendiumEn, pathOfCompendiumEs);

  var dirname = path.dirname(final);

  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
  fs.writeFileSync(path.join(final), JSON.stringify(obj));
}
