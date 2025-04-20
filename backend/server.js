const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdf = require('pdf-poppler');
const mammoth = require('mammoth');
const { extractEntities } = require('./huggingface');


const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
let lastUploadedText = '';

// app.post('/upload', upload.single('file'), async (req, res) => {
//   const file = req.file;
//   const ext = path.extname(file.originalname).toLowerCase();
//   const baseName = path.parse(file.originalname).name;
//   const textsDir = path.join(__dirname, 'texts');
//   fs.mkdirSync(textsDir, { recursive: true });

//   const outputTxtFile = path.join(textsDir, `${baseName}-${Date.now()}.txt`);

//   let resultText = '';

//   const worker = await createWorker('eng');

//   try {
//     await worker.setParameters({});

//     if (ext === '.pdf') {
//       const outputDir = path.join(__dirname, 'converted', file.filename);
//       fs.mkdirSync(outputDir, { recursive: true });

//       const options = {
//         format: 'png',
//         out_dir: outputDir,
//         out_prefix: 'page',
//         page: null,
//         resolution: 150
//       };

//       await pdf.convert(file.path, options);
//       const images = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));

//       for (const img of images) {
//         const fullImgPath = path.join(outputDir, img);
//         const { data: { text } } = await worker.recognize(fullImgPath);
//         resultText += text + '\n';
//       }

//       // Clean up images
//       images.forEach(img => fs.unlinkSync(path.join(outputDir, img)));
//       fs.rmdirSync(outputDir);

//     } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
//       const { data: { text } } = await worker.recognize(file.path);
//       resultText = text;

//     } else if (ext === '.docx') {
//       const buffer = fs.readFileSync(file.path);
//       const { value } = await mammoth.extractRawText({ buffer });
//       resultText = value;

//     } else {
//       return res.status(400).json({ error: 'Unsupported file format' });
//     }

//     // Save extracted text to file
//     fs.writeFileSync(outputTxtFile, resultText);

//     res.json({ text: resultText });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to process document' });
//   } finally {
//     await worker.terminate();
//     fs.unlinkSync(file.path);
//   }
// });

app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const ext = path.extname(file.originalname).toLowerCase();
  const baseName = path.parse(file.originalname).name;
  const textsDir = path.join(__dirname, 'texts');
  fs.mkdirSync(textsDir, { recursive: true });

  const outputTxtFile = path.join(textsDir, `${baseName}-${Date.now()}.txt`);

  let resultText = '';
  const worker = await createWorker('eng');

  try {
    await worker.setParameters({});

    if (ext === '.pdf') {
      const outputDir = path.join(__dirname, 'converted', file.filename);
      fs.mkdirSync(outputDir, { recursive: true });

      const options = {
        format: 'png',
        out_dir: outputDir,
        out_prefix: 'page',
        page: null,
        resolution: 150
      };

      await pdf.convert(file.path, options);
      const images = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));

      for (const img of images) {
        const fullImgPath = path.join(outputDir, img);
        const { data: { text } } = await worker.recognize(fullImgPath);
        resultText += text + '\n';
      }

      images.forEach(img => fs.unlinkSync(path.join(outputDir, img)));
      fs.rmdirSync(outputDir);

    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      const { data: { text } } = await worker.recognize(file.path);
      resultText = text;

    } else if (ext === '.docx') {
      const buffer = fs.readFileSync(file.path);
      const { value } = await mammoth.extractRawText({ buffer });
      resultText = value;

    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Save extracted text
    fs.writeFileSync(outputTxtFile, resultText);
    lastUploadedText = resultText;
    // 🔥 Extract named entities using Hugging Face
    const entities = await extractEntities(resultText);

    // Respond with both raw text and entities
    res.json({ text: resultText, entities });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process document' });
  } finally {
    await worker.terminate();
    fs.unlinkSync(file.path);
  }
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question || !lastUploadedText) {
    return res.status(400).json({ error: 'Missing question or no uploaded document yet.' });
  }

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/deepset/roberta-base-squad2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          question,
          context: lastUploadedText
        }
      })
    });

    const data = await response.json();
    res.json({ answer: data.answer, score: data.score });
  } catch (err) {
    console.error('Error in /ask:', err);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

app.listen(3000, () => console.log('✅ Server running on http://localhost:3000'));
