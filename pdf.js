
"use strict";
const chromium = require('@sparticuz/chromium');
var AWS = require("aws-sdk");
const puppeteer = require('puppeteer-core')
AWS.config.update({
  region: "ap-south-1",
  accessKeyId: "your key",
  secretAccessKey: "your key",
  signatureVersion: "v4",
});
const s3 = new AWS.S3();

module.exports.pdf = async (event) => {
  console.log("Received event:", JSON.stringify(event)); // Log the entire incoming event for debugging

  let body;

  // Check if there's an event body and try to parse it
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  try {
    body = JSON.parse(event.body);
  } catch (error) {
    console.error("Failed to parse body:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  if (!body.template) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Template not provided in request body" }),
    };
  }

  const executablePath = event.isOffline
    ? "./node_modules/puppeteer/.local-chromium/mac-674921/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
    : await chromium.executablePath;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(body.template);

    const pdf = await page.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
    });

    const params = {
      Bucket: "brandfy-dashboard",
      Key: `pdf/Brand_book${Date.now()}_Brand.pdf`, // Where to save the file in your bucket
      Body: pdf,
      ContentType: "application/pdf",
    };

    const response = await s3.upload(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "PDF uploaded successfully", url: response.Location }),
    };

  } catch (error) {
    console.error("Error occurred:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};