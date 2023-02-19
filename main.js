import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as deepl from "deepl-node";

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

async function iterate(obj, parent_node) {
  parent_node = parent_node || "";
  for (const property in obj) {
    if (obj.hasOwnProperty(property)) {
      const node = parent_node + "/" + property;
      if (obj[property] instanceof Array) {
        //console.log('array: ' + node + ":" + obj[property]);
        await iterate(obj[property], node);
      } else if (obj[property] instanceof Object) {
        //console.log('Object: ' + node + ":" + obj[property]);
        await iterate(obj[property], node);
      } else {
        let text = obj[property];
        
        const matchAllhtml = [...text.matchAll(htmlRegexG)];
        text = replaceGroup(text, matchAllhtml, "hhh");
        
        const matchAllcorchete = [...text.matchAll(corchetesRegex)];
        text = replaceGroup(text, matchAllcorchete, "ccc");
        
        const matchAlllink = [...text.matchAll(linkRegex)];
        text = replaceGroup(text, matchAlllink, "lll");
        
        const matchAllllaves = [...text.matchAll(llavesRegex)];
        text = replaceGroup(text, matchAllllaves, "kkk");

        console.log(node + ":" + obj[property]);
        var trad =await translator.translateText(
          text,
          null,
          "es"
        );

        text = trad.text;

        text = trad.text;
        text = replaceTag(text, matchAllhtml, "hhh");
        text = replaceTag(text, matchAllcorchete, "ccc");
        text = replaceTag(text, matchAlllink, "lll");
        text = replaceTag(text, matchAllllaves, "kkk");
        
        obj[property] = text;
      }
    }
  }
}


const files = fs.readdirSync(path.join(__dirname, "files"));
for (const file of files) {
 const data = fs.readFileSync(path.join(__dirname, "files", file));

  const object = JSON.parse(data);
  console.log("iniciando traduccion!!");
  await iterate(object);
  console.log("Finalizando traduccion!!");
  fs.writeFileSync(path.join(__dirname, "trad_files",file), JSON.stringify(object))

}