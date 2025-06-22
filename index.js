const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/scrape", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const results = [];
  const sites = {
    US: "https://www.hermes.com/us/en/search/?q=",
    FR: "https://www.hermes.com/fr/fr/search/?q=",
    UK: "https://www.hermes.com/uk/en/search/?q=",
    JP: "https://www.hermes.com/jp/ja/search/?q=",
    AE: "https://www.hermes.com/ae/en/search/?q="
  };

  for (const [country, baseUrl] of Object.entries(sites)) {
    try {
      const html = await axios.get(baseUrl + encodeURIComponent(query), {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const $ = cheerio.load(html.data);

      const product = $(".product-item").first();
      if (!product.length) continue;

      const name = product.find(".product-item-name").text().trim();
      const localPrice = product.find(".price").text().trim();
      const link = product.find("a").attr("href");

      // Currency conversion
      const rates = { EUR:1.09, GBP:1.27, JPY:0.0063, AED:0.27, USD:1 };
      const symbolToCode = { "€": "EUR", "£": "GBP", "¥": "JPY", "د.إ": "AED", "$": "USD" };

      const symbol = localPrice[0];
      const currency = symbolToCode[symbol] || "USD";
      const numVal = parseFloat(localPrice.replace(/[^\d.]/g, ""));
      const usdPrice = +(numVal * rates[currency]).toFixed(2);

      results.push({
        country,
        name,
        local_price: localPrice,
        usd_price: usdPrice,
        link: link.startsWith("http") ? link : `https://www.hermes.com${link}`
      });
    } catch (e) {
      console.warn(`⚠️ Error scraping ${country}: ${e.message}`);
    }
  }

  res.json({ results });
});

app.listen(10000, () => console.log("API running"));
