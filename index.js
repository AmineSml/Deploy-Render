const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/scrape", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const results = [];

  const countries = {
    US: "https://www.hermes.com/us/en/search/?q=",
    FR: "https://www.hermes.com/fr/fr/search/?q=",
    UK: "https://www.hermes.com/uk/en/search/?q=",
    JP: "https://www.hermes.com/jp/ja/search/?q=",
    AE: "https://www.hermes.com/ae/en/search/?q="
  };

  for (const [countryCode, baseUrl] of Object.entries(countries)) {
    try {
      const searchUrl = `${baseUrl}${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

      const product = await page.$(".product-item");

      if (product) {
        const name = await product.$eval(".product-item-name", el => el.textContent.trim());
        const localPrice = await product.$eval(".price", el => el.textContent.trim());
        const link = await product.$eval("a", el => el.href);

        // Dummy exchange rates — update with real API for production
        const rates = { EUR: 1.09, GBP: 1.27, JPY: 0.0063, AED: 0.27, USD: 1 };
        const symbolToCurrency = { "€": "EUR", "£": "GBP", "¥": "JPY", "د.إ": "AED", "$": "USD" };

        const symbol = localPrice.trim().charAt(0);
        const currency = symbolToCurrency[symbol] || "USD";
        const numericValue = parseFloat(localPrice.replace(/[^\d.]/g, ""));

        const usdPrice = +(numericValue * (rates[currency] || 1)).toFixed(2);

        results.push({
          country: countryCode,
          name,
          local_price: localPrice,
          usd_price: usdPrice,
          link
        });
      }
    } catch (e) {
      console.warn(`Error scraping ${countryCode}:`, e.message);
    }
  }

  await browser.close();
  res.json({ results });
});

app.listen(10000, () => {
  console.log("API running on http://localhost:10000");
});
