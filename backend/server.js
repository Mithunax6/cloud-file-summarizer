require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

function summarize(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || text.split("\n").filter(s => s.trim().length > 10);
  if (sentences.length === 0) return text.slice(0, 300);

  const wordFreq = {};
  sentences.forEach((sentence) => {
    sentence.toLowerCase().split(/\s+/).forEach((word) => {
      word = word.replace(/[^\w]/g, "");
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
  });

  return sentences
    .map((sentence) => {
      const score = sentence.toLowerCase().split(/\s+/).reduce((sum, word) => {
        return sum + (wordFreq[word.replace(/[^\w]/g, "")] || 0);
      }, 0);
      return { sentence: sentence.trim(), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.sentence)
    .join(" ");
}

async function translateToEnglish(text, sourceLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|en`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("To English:", data.responseData.translatedText.slice(0, 100));
    return data.responseData.translatedText;
  } catch (e) {
    console.error("Translation error:", e.message);
    return text;
  }
}

async function translateText(text, targetLang) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Translated to", targetLang, ":", data.responseData.translatedText.slice(0, 100));
    return data.responseData.translatedText;
  } catch (e) {
    console.error("Translation error:", e.message);
    return text;
  }
}

app.post("/summarize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const targetLang = req.body.language || "en";
    const sourceLang = req.body.sourceLang || "en";
    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, "utf-8");
    fs.unlinkSync(filePath);

    if (!fileContent.trim()) {
      return res.status(400).json({ error: "File is empty." });
    }

    // Step 1: Translate to English
    let englishText = fileContent;
    if (sourceLang !== "en") {
      englishText = await translateToEnglish(fileContent.slice(0, 500), sourceLang);
    }

    // Step 2: Summarize
    const summary = summarize(englishText);

    // Step 3: Translate to target language
    let finalSummary = summary;
    if (targetLang !== "en") {
      finalSummary = await translateText(summary, targetLang);
    }

    res.json({ summary: finalSummary });

  } catch (error) {
    console.error("Full Error:", error);
    res.status(500).json({ error: "Failed to summarize. Try again." });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "Cloud File Summarizer API is running." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:5000`);
});