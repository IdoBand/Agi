import { createWorker } from 'tesseract.js';
import Tesseract from 'tesseract.js';
import path from "path";

const tesseractPath = path.join(process.cwd(), 'src\\tesseractjs')
// npx tsx ./src/tesseractjs/tesseract.ts

function main() {

    // images from url
    // (async () => {
        //     const worker = await createWorker('eng');
        //     const ret = await worker.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png');
        //     console.log(ret.data.text);
        //     await worker.terminate();
        // })();
        
        
    // local images
    const imagePath = path.join(tesseractPath, 'images\\test.jpeg');
    const langPath = path.join(tesseractPath, 'langData');

    Tesseract.recognize(imagePath, 'hun')
  .then(({ data: { text } }) => {
    console.log('Extracted text:', text);
  });

}

main()