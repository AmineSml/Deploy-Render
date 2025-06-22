import express from 'express';
import { chromium } from 'playwright';
import cors from 'cors';

const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/api/scrape', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  const sites = {
    FR: 'https://www.hermes.com/fr/fr/',
    US: 'https://www.hermes.com/us/en/'
  };

  for (const [country, url] of Object.entries(sites)) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      try {
        await page.click('button:has-text("Accepter")', { timeout: 2000 });
      } catch {}

      await page.click('button[aria-label="Search"]');
      await page.fill('input[type="search"]', query);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      const product = await page.locator('[data-testid="ProductGridItem"]').first();
      const name = await product.locator('[data-testid="ProductGridItemName"]').innerText();
      const price = await product.locator('[data-testid="ProductGridItemPrice"]').innerText();
      const link = await product.locator('a').first().getAttribute('href');

      const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));
      const usdPrice = convertToUSD(numericPrice, country);

      results.push({
        country,
        name,
        local_price: price,
        usd_price: usdPrice,
        link: `https://www.hermes.com${link}`
      });
    } catch (e) {
      console.error(`Error scraping ${country}:`, e.message);
    }
    await page.close();
  }

  await browser.close();
  res.status(200).json({ results });
});

function convertToUSD(price, country) {
  const rates = {
    FR: 1.08,
    US: 1.0
  };
  return Math.round(price * (rates[country] || 1));
}

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
