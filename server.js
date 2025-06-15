const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const condition = req.body.condition || {};
  const HL = condition.HL || "low";
  const IS = condition.IS || "low";
  const participantID = req.body.participantID || "anonymous";

  const systemPrompt =
    HL === "high"
      ? "You are a friendly and engaging travel assistant named Mira. Respond warmly and use natural human expressions. Acknowledge participant responses politely. Ask questions to gather travel preferences."
      : "You are EUR-Bot, a robotic assistant for trip planning. Respond with concise, neutral, and functional language. Do not acknowledge responses. Ask for required inputs only.";

  const sensitivityInstructions =
    IS === "high"
      ? "Ask the user to share some mildly sensitive travel-related preferences like budget, dietary restrictions, or past travel habits."
      : "Keep questions general and non-sensitive, such as destination type or preferred activities.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or 'gpt-4.1-mini' if you're using it
      messages: [
        { role: "system", content: `${systemPrompt} ${sensitivityInstructions}` },
        { role: "user", content: userMessage }
      ]
    });

    const reply = response.choices[0].message.content;

    // Optional: Save to file
    const logFolder = path.join(__dirname, "conversations");
    if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder);
    const logPath = path.join(logFolder, `${participantID}.txt`);
    fs.appendFileSync(logPath, `User: ${userMessage}\nBot: ${reply}\n\n`);

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ reply: "Sorry, I ran into a problem processing your request." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
