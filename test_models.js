const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Merhaba, çalışıyor musun?");
    console.log(`✅ ${modelName} ÇALIŞIYOR! Yanıt: ${result.response.text().substring(0, 30)}...`);
    return true;
  } catch (error) {
    console.log(`❌ ${modelName} BAŞARISIZ: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const modelsToTest = [
    "gemini-1.5-pro",
    "gemini-1.5-flash-latest",
    "gemini-pro-vision",
    "gemini-1.0-pro-vision-latest",
    "gemini-2.0-pro",
    "gemini-1.5-pro-latest"
  ];

  for (const m of modelsToTest) {
    await testModel(m);
  }
}

runTests();
