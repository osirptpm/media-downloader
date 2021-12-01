

import MediaExtractor from "./MediaExtractor.js"
import Downloader from "./Downloader.js"
import { getProgressBar } from "./progress.js"

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("./config.json");

const progressBar = getProgressBar(undefined, 'Downloading ')
const mediaExtracter = new MediaExtractor({
    debug: false,
    progressBar: progressBar,
})
const downloader = new Downloader({
    maxConcurrency: 10,
    downloadDir: './downloads',
    debug: false,
    progressBar: progressBar,
})

const twtUrl = `https://twitter.com/${process.argv[2]}/media`

mediaExtracter.pipe(downloader)
mediaExtracter.login(config.id, config.password)
    .then(() => mediaExtracter.getAllMediaURL(twtUrl))