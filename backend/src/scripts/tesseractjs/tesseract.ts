import Tesseract from 'tesseract.js';
import path from "path";
import fs from "fs";

const imagesDir = path.join(__dirname, 'images');

// npx tsx ./src/scripts/tesseractjs/tesseract.ts
async function main() {

    // images from url
    // (async () => {
        //     const worker = await createWorker('eng');
        //     const ret = await worker.recognize('https://tesseract.projectnaptha.com/img/eng_bw.png');
        //     console.log(ret.data.text);
        //     await worker.terminate();
        // })();

    const files = fs.readdirSync(imagesDir).filter((f: string) =>
        /\.(jpe?g|png|webp|gif)$/i.test(f)
    );

    const outputPath = path.join(__dirname, 'output.md');
    fs.writeFileSync(outputPath, '');

    for (const file of files) {
        const imagePath = path.join(imagesDir, file);
        const { data: { text } } = await Tesseract.recognize(imagePath, 'hun');
        fs.appendFileSync(outputPath, text);
        console.log(`extracted ${text.length} chars from ${file}`);
    }
}

main();
