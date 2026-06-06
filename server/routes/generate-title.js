const express = require("express");
const router = express.Router();
const openaiService = require("../services/openai");

// POST /api/generate-title - Generate a title from markdown content
router.post("/", async (req, res) => {
	try {
		const { markdown, model } = req.body;

		if (!markdown) {
			return res.status(400).json({
				error: "Markdown içeriği gerekli",
				errorKey: "errors.noContent",
			});
		}

		console.log("🏷️ Başlık üretiliyor...");

		const title = await openaiService.generateFilename(
			markdown,
			model || "gemini-3.5-flash",
		);

		res.json({
			success: true,
			title: title,
		});
	} catch (error) {
		console.error("❌ Başlık üretme hatası:", error.message);

		// Fallback to UUID
		const crypto = require("crypto");
		const fallbackTitle = crypto.randomUUID();

		res.json({
			success: true,
			title: fallbackTitle,
			fallback: true,
		});
	}
});

module.exports = router;
